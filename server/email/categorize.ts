import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { emailThreads } from "../../drizzle/schema";
import { eq, isNull, and } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UrgencyLevel = "critical" | "high" | "medium" | "low";

export type EmailCategory =
  | "maintenance_request"
  | "billing_payment"
  | "noise_complaint"
  | "amenity_booking"
  | "vendor_communication"
  | "board_matter"
  | "emergency"
  | "general_inquiry"
  | "lease_ownership"
  | "other";

export interface PropertyHint {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
}

export interface CategorizationResult {
  urgency: UrgencyLevel;
  category: EmailCategory;
  matchedPropertyId: number | null;
  confidence: number; // 0-100
  reasoning: string;
}

// ─── Urgency decision rules (fast path, no LLM needed) ───────────────────────

const CRITICAL_KEYWORDS = [
  "fire", "flood", "gas leak", "burst pipe", "emergency", "911", "evacuate",
  "structural damage", "elevator stuck", "power outage", "water main",
];

const HIGH_KEYWORDS = [
  "urgent", "asap", "immediately", "broken", "no heat", "no hot water",
  "sewage", "leak", "mold", "security breach", "break-in", "vandalism",
];

function fastUrgencyCheck(subject: string, body: string): UrgencyLevel | null {
  const text = `${subject} ${body}`.toLowerCase();
  if (CRITICAL_KEYWORDS.some(kw => text.includes(kw))) return "critical";
  if (HIGH_KEYWORDS.some(kw => text.includes(kw))) return "high";
  return null; // Fall through to LLM
}

// ─── Property matching (keyword-based pre-filter) ─────────────────────────────

function preMatchProperty(
  subject: string,
  body: string,
  properties: PropertyHint[]
): PropertyHint | null {
  const text = `${subject} ${body}`.toLowerCase();
  for (const prop of properties) {
    const tokens = [
      prop.name,
      prop.address,
      prop.city,
    ]
      .filter(Boolean)
      .map(t => t!.toLowerCase());

    if (tokens.some(token => text.includes(token))) {
      return prop;
    }
  }
  return null;
}

// ─── Main AI categorization function ─────────────────────────────────────────

export async function categorizeEmail(
  emailId: number,
  subject: string,
  body: string,
  properties: PropertyHint[]
): Promise<CategorizationResult> {
  // 1. Fast path: check for critical/high keywords without LLM
  const fastUrgency = fastUrgencyCheck(subject, body);
  const preMatchedProperty = preMatchProperty(subject, body, properties);

  // 2. Build property list for LLM context
  const propertyList =
    properties.length > 0
      ? properties
          .map(p => `- ID ${p.id}: "${p.name}"${p.city ? ` (${p.city})` : ""}`)
          .join("\n")
      : "No properties on file.";

  // 3. Call LLM with structured JSON output
  const systemPrompt = `You are an AI assistant for a white-glove condominium property management company.
Analyze the email and return a JSON object with these fields:
- urgency: one of "critical" | "high" | "medium" | "low"
  - critical: life/safety emergency (fire, flood, gas leak, structural failure)
  - high: urgent issue requiring same-day response (no heat, sewage, burst pipe)
  - medium: important but not urgent (general repairs, billing questions, complaints)
  - low: routine inquiry, general information request, newsletter, spam
- category: one of "maintenance_request" | "billing_payment" | "noise_complaint" | "amenity_booking" | "vendor_communication" | "board_matter" | "emergency" | "general_inquiry" | "lease_ownership" | "other"
- matchedPropertyId: the integer ID from the property list that best matches this email, or null if none match
- confidence: integer 0-100 representing your overall confidence in this categorization
- reasoning: one sentence explaining your classification decision

Properties managed by this company:
${propertyList}

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`;

  const userPrompt = `Subject: ${subject || "(no subject)"}

Body:
${(body || "").slice(0, 1500)}`;

  try {
    const res = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 300,
    });

    const raw = res.choices[0]?.message.content?.trim() ?? "{}";

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<CategorizationResult>;

    const urgency: UrgencyLevel =
      fastUrgency ?? // Fast path overrides LLM for safety
      (["critical", "high", "medium", "low"].includes(parsed.urgency as string)
        ? (parsed.urgency as UrgencyLevel)
        : "medium");

    const category: EmailCategory =
      ([
        "maintenance_request", "billing_payment", "noise_complaint",
        "amenity_booking", "vendor_communication", "board_matter",
        "emergency", "general_inquiry", "lease_ownership", "other",
      ].includes(parsed.category as string)
        ? parsed.category as EmailCategory
        : "other");

    const matchedPropertyId =
      preMatchedProperty?.id ??
      (typeof parsed.matchedPropertyId === "number" ? parsed.matchedPropertyId : null);

    return {
      urgency,
      category,
      matchedPropertyId,
      confidence: Math.min(100, Math.max(0, typeof parsed.confidence === "number" ? parsed.confidence : 70)),
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "Categorized by AI.",
    };
  } catch (err) {
    console.error("[categorizeEmail] LLM error:", err);
    // Graceful fallback: use fast-path urgency if available
    return {
      urgency: fastUrgency ?? "medium",
      category: "other",
      matchedPropertyId: preMatchedProperty?.id ?? null,
      confidence: 30,
      reasoning: "Fallback categorization — AI unavailable.",
    };
  }
}

// ─── Persist categorization result to DB ─────────────────────────────────────

export async function saveCategorization(
  emailId: number,
  result: CategorizationResult
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(emailThreads)
    .set({
      aiUrgency: result.urgency,
      aiCategory: result.category,
      aiMatchedPropertyId: result.matchedPropertyId ?? undefined,
      aiConfidence: result.confidence,
      aiReasoning: result.reasoning,
      aiCategorizedAt: new Date(),
      // Auto-link property if matched
      ...(result.matchedPropertyId ? { propertyId: result.matchedPropertyId } : {}),
    })
    .where(eq(emailThreads.id, emailId));
}

// ─── Bulk categorize all uncategorized emails for a company ──────────────────

export async function bulkCategorizeCompanyEmails(
  companyId: number,
  properties: PropertyHint[]
): Promise<{ processed: number; errors: number }> {
  const db = await getDb();
  if (!db) return { processed: 0, errors: 0 };

  // Fetch uncategorized emails for this company (max 50 at a time)
  const uncategorized = await db
    .select({
      id: emailThreads.id,
      subject: emailThreads.subject,
      bodyPreview: emailThreads.bodyPreview,
      fullBody: emailThreads.fullBody,
    })
    .from(emailThreads)
    .where(
      and(
        eq(emailThreads.companyId, companyId),
        isNull(emailThreads.aiCategorizedAt)
      )
    )
    .limit(50);

  let processed = 0;
  let errors = 0;

  for (const email of uncategorized) {
    try {
      const result = await categorizeEmail(
        email.id,
        email.subject ?? "",
        email.fullBody ?? email.bodyPreview ?? "",
        properties
      );
      await saveCategorization(email.id, result);
      processed++;
    } catch {
      errors++;
    }
  }

  return { processed, errors };
}
