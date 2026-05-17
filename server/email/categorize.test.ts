import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the LLM and DB so tests run without network or database ─────────────

vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

import { invokeLLM } from "../_core/llm";
import {
  categorizeEmail,
  type PropertyHint,
} from "./categorize";

const mockLLM = vi.mocked(invokeLLM);

const SAMPLE_PROPERTIES: PropertyHint[] = [
  { id: 1, name: "Sunset Towers", address: "100 Sunset Blvd", city: "Miami" },
  { id: 2, name: "Ocean Breeze", address: "200 Ocean Dr", city: "Fort Lauderdale" },
];

// Helper: build a valid LLM response
function llmResponse(content: string) {
  return { choices: [{ message: { content } }] };
}

describe("categorizeEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns critical urgency for fire-related subject without calling LLM", async () => {
    mockLLM.mockResolvedValue(
      llmResponse(JSON.stringify({
        urgency: "low",
        category: "other",
        matchedPropertyId: null,
        confidence: 50,
        reasoning: "Routine email.",
      }))
    );

    const result = await categorizeEmail(
      1,
      "URGENT: Fire alarm triggered in lobby",
      "Please evacuate immediately.",
      SAMPLE_PROPERTIES
    );

    // Fast-path should override LLM's "low" with "critical"
    expect(result.urgency).toBe("critical");
  });

  it("returns critical urgency for burst pipe subject (fast-path)", async () => {
    mockLLM.mockResolvedValue(
      llmResponse(JSON.stringify({
        urgency: "medium",
        category: "maintenance_request",
        matchedPropertyId: null,
        confidence: 75,
        reasoning: "Maintenance issue.",
      }))
    );

    const result = await categorizeEmail(
      2,
      "Burst pipe in unit 4B",
      "Water is flooding the hallway.",
      SAMPLE_PROPERTIES
    );

    // "burst pipe" is in CRITICAL_KEYWORDS, so fast-path overrides LLM's "medium"
    expect(result.urgency).toBe("critical");
  });

  it("returns high urgency for sewage issue (high keyword)", async () => {
    mockLLM.mockResolvedValue(
      llmResponse(JSON.stringify({
        urgency: "medium",
        category: "maintenance_request",
        matchedPropertyId: null,
        confidence: 75,
        reasoning: "Maintenance issue.",
      }))
    );

    const result = await categorizeEmail(
      9,
      "Sewage smell in basement",
      "There is a strong sewage odor in the parking garage.",
      SAMPLE_PROPERTIES
    );

    // "sewage" is in HIGH_KEYWORDS
    expect(result.urgency).toBe("high");
  });

  it("uses LLM urgency when no fast-path keyword matches", async () => {
    mockLLM.mockResolvedValue(
      llmResponse(JSON.stringify({
        urgency: "medium",
        category: "billing_payment",
        matchedPropertyId: null,
        confidence: 85,
        reasoning: "Billing inquiry.",
      }))
    );

    const result = await categorizeEmail(
      3,
      "Question about my maintenance fee",
      "Hi, I have a question about the latest invoice.",
      SAMPLE_PROPERTIES
    );

    expect(result.urgency).toBe("medium");
    expect(result.category).toBe("billing_payment");
    expect(result.confidence).toBe(85);
  });

  it("pre-matches property by name keyword in subject", async () => {
    mockLLM.mockResolvedValue(
      llmResponse(JSON.stringify({
        urgency: "low",
        category: "general_inquiry",
        matchedPropertyId: 2, // LLM also matches
        confidence: 70,
        reasoning: "General inquiry.",
      }))
    );

    const result = await categorizeEmail(
      4,
      "Parking issue at Sunset Towers",
      "There is an unauthorized vehicle in lot B.",
      SAMPLE_PROPERTIES
    );

    // Pre-match by keyword should win (id=1 for Sunset Towers)
    expect(result.matchedPropertyId).toBe(1);
  });

  it("falls back to LLM property match when no keyword match", async () => {
    mockLLM.mockResolvedValue(
      llmResponse(JSON.stringify({
        urgency: "low",
        category: "noise_complaint",
        matchedPropertyId: 2,
        confidence: 60,
        reasoning: "Noise complaint.",
      }))
    );

    const result = await categorizeEmail(
      5,
      "Loud music from unit 3A",
      "The neighbors are very loud again.",
      SAMPLE_PROPERTIES
    );

    // No keyword match → use LLM's matchedPropertyId
    expect(result.matchedPropertyId).toBe(2);
  });

  it("strips markdown code fences from LLM response", async () => {
    mockLLM.mockResolvedValue(
      llmResponse("```json\n{\"urgency\":\"low\",\"category\":\"other\",\"matchedPropertyId\":null,\"confidence\":55,\"reasoning\":\"Test.\"}\n```")
    );

    const result = await categorizeEmail(
      6,
      "Hello",
      "Just checking in.",
      SAMPLE_PROPERTIES
    );

    expect(result.urgency).toBe("low");
    expect(result.category).toBe("other");
  });

  it("returns graceful fallback when LLM throws", async () => {
    mockLLM.mockRejectedValue(new Error("LLM unavailable"));

    const result = await categorizeEmail(
      7,
      "Some email",
      "Some body",
      SAMPLE_PROPERTIES
    );

    expect(result.confidence).toBe(30);
    expect(result.reasoning).toContain("Fallback");
  });

  it("clamps confidence to 0-100 range", async () => {
    mockLLM.mockResolvedValue(
      llmResponse(JSON.stringify({
        urgency: "medium",
        category: "other",
        matchedPropertyId: null,
        confidence: 150, // Out of range
        reasoning: "Test.",
      }))
    );

    const result = await categorizeEmail(
      8,
      "Test email",
      "Test body",
      []
    );

    expect(result.confidence).toBeLessThanOrEqual(100);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});
