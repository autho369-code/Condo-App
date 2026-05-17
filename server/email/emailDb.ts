import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { emailConnections, emailThreads, properties, InsertEmailConnection } from "../../drizzle/schema";
import { categorizeEmail, saveCategorization, PropertyHint } from "./categorize";

export async function upsertEmailConnection(data: InsertEmailConnection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(emailConnections)
    .where(and(eq(emailConnections.userId, data.userId), eq(emailConnections.provider, data.provider)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(emailConnections)
      .set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? existing[0].refreshToken,
        expiresAt: data.expiresAt,
        accountEmail: data.accountEmail,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(emailConnections.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(emailConnections).values(data);
    return (result as any).insertId as number;
  }
}

export async function getEmailConnectionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(emailConnections)
    .where(and(eq(emailConnections.userId, userId), eq(emailConnections.isActive, true)));
}

export async function getEmailConnectionsByCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(emailConnections)
    .where(and(eq(emailConnections.companyId, companyId), eq(emailConnections.isActive, true)));
}

export async function getEmailConnectionById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(emailConnections).where(eq(emailConnections.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateEmailConnectionTokens(
  id: number,
  accessToken: string,
  expiresAt: Date
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(emailConnections)
    .set({ accessToken, expiresAt, updatedAt: new Date() })
    .where(eq(emailConnections.id, id));
}

export async function updateEmailConnectionSyncCursor(
  id: number,
  syncCursor: string,
  lastSyncedAt: Date
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(emailConnections)
    .set({ syncCursor, lastSyncedAt, updatedAt: new Date() })
    .where(eq(emailConnections.id, id));
}

export async function deactivateEmailConnection(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(emailConnections)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(emailConnections.id, id));
}

// ─── Fetch company properties for AI property matching ───────────────────────

async function getCompanyProperties(companyId: number): Promise<PropertyHint[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: properties.id,
      name: properties.name,
      address: properties.address,
      city: properties.city,
    })
    .from(properties)
    .where(and(eq(properties.companyId, companyId), eq(properties.isActive, true)));
  return rows;
}

// ─── Save email threads with automatic AI categorization ─────────────────────

export async function saveEmailThreads(
  companyId: number,
  connectionId: number,
  provider: "gmail" | "outlook",
  emails: Array<{
    externalId: string;
    subject: string;
    fromAddress: string;
    toAddresses: string;
    bodyPreview: string;
    fullBody: string;
    receivedAt: Date;
  }>
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Fetch company properties once for the entire batch
  const companyProperties = await getCompanyProperties(companyId);

  let saved = 0;
  for (const email of emails) {
    try {
      // Dedup: skip if same provider + sender + subject already exists
      const existing = await db
        .select({ id: emailThreads.id })
        .from(emailThreads)
        .where(
          and(
            eq(emailThreads.companyId, companyId),
            eq(emailThreads.source, provider),
            eq(emailThreads.fromAddress, email.fromAddress)
          )
        )
        .limit(1);

      if (existing.length > 0) continue;

      // Insert the email thread
      const insertResult = await db.insert(emailThreads).values({
        companyId,
        subject: email.subject,
        fromAddress: email.fromAddress,
        toAddresses: email.toAddresses,
        bodyPreview: email.bodyPreview,
        fullBody: email.fullBody,
        isRead: false,
        source: provider,
        receivedAt: email.receivedAt,
      });

      const newEmailId = (insertResult as any).insertId as number;
      saved++;

      // Fire-and-forget AI categorization (non-blocking so sync stays fast)
      categorizeEmail(
        newEmailId,
        email.subject,
        email.fullBody || email.bodyPreview,
        companyProperties
      )
        .then(result => saveCategorization(newEmailId, result))
        .catch(err => console.warn(`[AI categorize] email ${newEmailId}:`, err));
    } catch {
      // Skip individual failures silently
    }
  }
  return saved;
}
