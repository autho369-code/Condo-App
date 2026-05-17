import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { ticketAttachments } from "../../drizzle/schema";

/**
 * Return all attachments for a given ticket, ordered by creation date.
 */
export async function getAttachmentsByTicket(ticketId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(ticketAttachments)
    .where(eq(ticketAttachments.ticketId, ticketId))
    .orderBy(ticketAttachments.createdAt);
}

/**
 * Delete an attachment record.
 * Only the uploader can delete their own attachment.
 */
export async function deleteAttachment(
  attachmentId: number,
  requestingUserId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Fetch the attachment first to verify ownership
  const rows = await db
    .select()
    .from(ticketAttachments)
    .where(eq(ticketAttachments.id, attachmentId))
    .limit(1);

  if (rows.length === 0) throw new Error("Attachment not found");

  const attachment = rows[0]!;
  if (attachment.uploadedById !== requestingUserId) {
    throw new Error("Not authorized to delete this attachment");
  }

  await db
    .delete(ticketAttachments)
    .where(eq(ticketAttachments.id, attachmentId));
}
