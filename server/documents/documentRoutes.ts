import { Router, Request, Response } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { storagePut } from "../storage";
import { getDb } from "../db";
import { propertyDocuments, properties } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { parse as parseCookies } from "cookie";
import { verifySession } from "../_core/session";
import { getUserByOpenId } from "../db";
import { COOKIE_NAME } from "../../shared/const";
import { notifyDocumentShared } from "../notifications/notificationService";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB for documents
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

// ─── Multer ───────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// ─── Route registration ───────────────────────────────────────────────────────
export function registerDocumentRoutes(app: ReturnType<typeof Router>) {
  const router = Router();

  /**
   * POST /api/properties/:propertyId/documents
   * Upload a single document for a property (manager only)
   * Body fields: title, description, category, isSharedWithOwners
   */
  router.post(
    "/:propertyId/documents",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        // Auth check
        const cookieHeader = req.headers.cookie ?? "";
        const cookies = parseCookies(cookieHeader);
        const token = cookies[COOKIE_NAME];
        if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
        const session = await verifySession(token);
        if (!session?.openId) { res.status(401).json({ error: "Unauthorized" }); return; }
        const user = await getUserByOpenId(session.openId);
        if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

        // Only managers and above can upload documents
        const managerRoles = ["super_admin", "company_admin", "portfolio_manager", "property_manager", "accountant", "assistant_manager"];
        if (!user.portierRole || !managerRoles.includes(user.portierRole)) {
          res.status(403).json({ error: "Only managers can upload documents" });
          return;
        }

        const propertyId = parseInt(req.params.propertyId, 10);
        if (isNaN(propertyId)) { res.status(400).json({ error: "Invalid property ID" }); return; }

        const db = await getDb();
        if (!db) { res.status(503).json({ error: "Database unavailable" }); return; }

        // Verify the property belongs to the user's company
        const propRows = await db
          .select()
          .from(properties)
          .where(eq(properties.id, propertyId))
          .limit(1);

        if (propRows.length === 0) { res.status(404).json({ error: "Property not found" }); return; }
        const property = propRows[0]!;
        if (user.portierRole !== "super_admin" && property.companyId !== user.companyId) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        const file = req.file;
        if (!file) { res.status(400).json({ error: "No file provided" }); return; }

        const { title, description, category, isSharedWithOwners } = req.body;
        if (!title) { res.status(400).json({ error: "Title is required" }); return; }

        const ext = file.originalname.split(".").pop() ?? "bin";
        const key = `properties/${propertyId}/docs/${nanoid(12)}.${ext}`;
        const { url } = await storagePut(key, file.buffer, file.mimetype);

        const [row] = await db
          .insert(propertyDocuments)
          .values({
            propertyId,
            companyId: property.companyId,
            uploadedById: user.id,
            title,
            description: description ?? null,
            category: category ?? "other",
            fileName: file.originalname,
            fileKey: key,
            fileUrl: url,
            mimeType: file.mimetype,
            fileSize: file.size,
            isSharedWithOwners: isSharedWithOwners === "true" || isSharedWithOwners === true,
          })
          .returning();

        const sharedFlag = isSharedWithOwners === "true" || isSharedWithOwners === true;
        const newDocId = row?.id;

        // Fire notifications if document is shared at upload time
        if (sharedFlag && newDocId) {
          notifyDocumentShared(newDocId).catch(err =>
            console.error("[documentRoutes] Notification error:", err)
          );
        }

        res.json({
          id: newDocId,
          title,
          fileUrl: url,
          mimeType: file.mimetype,
          fileSize: file.size,
          isSharedWithOwners: sharedFlag,
        });
      } catch (err: any) {
        console.error("[documentRoutes] upload error:", err);
        if (err.message?.includes("File too large")) {
          res.status(413).json({ error: "File too large (max 25 MB)" });
        } else if (err.message?.includes("not allowed")) {
          res.status(415).json({ error: err.message });
        } else {
          res.status(500).json({ error: "Upload failed" });
        }
      }
    }
  );

  app.use("/api/properties", router);
}
