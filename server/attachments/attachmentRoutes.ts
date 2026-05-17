import { Router, Request, Response } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { storagePut } from "../storage";
import { getDb } from "../db";
import { ticketAttachments, tickets } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { parse as parseCookies } from "cookie";
import { verifySession } from "../_core/session";
import { getUserByOpenId } from "../db";
import { COOKIE_NAME } from "../../shared/const";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

// ─── Multer (memory storage — files stay in RAM before S3 upload) ─────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// ─── Route registration ───────────────────────────────────────────────────────
export function registerAttachmentRoutes(app: ReturnType<typeof Router>) {
  const router = Router();

  /**
   * POST /api/tickets/:ticketId/attachments
   * Upload one or more files (multipart/form-data, field name: "files")
   */
  router.post(
    "/:ticketId/attachments",
    upload.array("files", MAX_FILES),
    async (req: Request, res: Response) => {
      try {
        // Auth check — parse the session cookie and look up the full user
        const cookieHeader = req.headers.cookie ?? "";
        const cookies = parseCookies(cookieHeader);
        const token = cookies[COOKIE_NAME];
        if (!token) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        const session = await verifySession(token);
        if (!session?.openId) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        const user = await getUserByOpenId(session.openId);
        if (!user) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        const ticketId = parseInt(req.params.ticketId, 10);
        if (isNaN(ticketId)) {
          res.status(400).json({ error: "Invalid ticket ID" });
          return;
        }

        const db = await getDb();
        if (!db) {
          res.status(503).json({ error: "Database unavailable" });
          return;
        }

        // Verify the ticket belongs to the user's company
        const ticketRows = await db
          .select()
          .from(tickets)
          .where(eq(tickets.id, ticketId))
          .limit(1);

        if (ticketRows.length === 0) {
          res.status(404).json({ error: "Ticket not found" });
          return;
        }

        const ticket = ticketRows[0]!;
        if (ticket.companyId !== user.companyId) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          res.status(400).json({ error: "No files provided" });
          return;
        }

        // Upload each file to S3 and save metadata to DB
        const saved = await Promise.all(
          files.map(async (file) => {
            const ext = file.originalname.split(".").pop() ?? "bin";
            const key = `tickets/${ticketId}/${nanoid(12)}.${ext}`;
            const { url } = await storagePut(key, file.buffer, file.mimetype);

            const [row] = await db
              .insert(ticketAttachments)
              .values({
                ticketId,
                companyId: ticket.companyId,
                uploadedById: user.id,
                fileName: file.originalname,
                fileKey: key,
                fileUrl: url,
                mimeType: file.mimetype,
                fileSize: file.size,
              })
              .$returningId();

            return {
              id: row?.id,
              fileName: file.originalname,
              fileUrl: url,
              mimeType: file.mimetype,
              fileSize: file.size,
            };
          })
        );

        res.json({ attachments: saved });
      } catch (err: any) {
        console.error("[attachmentRoutes] upload error:", err);
        if (err.message?.includes("File too large")) {
          res.status(413).json({ error: "File too large (max 10 MB)" });
        } else if (err.message?.includes("not allowed")) {
          res.status(415).json({ error: err.message });
        } else {
          res.status(500).json({ error: "Upload failed" });
        }
      }
    }
  );

  app.use("/api/tickets", router);
}
