import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Unit tests for attachment validation logic ───────────────────────────────
// These tests cover the pure validation rules without hitting the database or S3.

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
]);

function validateAttachment(file: { name: string; size: number; mimetype: string }): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) return `File type not allowed: ${file.mimetype}`;
  if (file.size > MAX_FILE_SIZE) return `File too large: ${file.name}`;
  return null;
}

function validateBatch(
  files: { name: string; size: number; mimetype: string }[],
  existingCount: number
): string | null {
  if (existingCount + files.length > MAX_FILES) {
    return `Maximum ${MAX_FILES} attachments per ticket`;
  }
  for (const f of files) {
    const err = validateAttachment(f);
    if (err) return err;
  }
  return null;
}

describe("Attachment validation", () => {
  describe("validateAttachment", () => {
    it("allows JPEG images", () => {
      expect(validateAttachment({ name: "photo.jpg", size: 1024, mimetype: "image/jpeg" })).toBeNull();
    });

    it("allows PNG images", () => {
      expect(validateAttachment({ name: "photo.png", size: 2048, mimetype: "image/png" })).toBeNull();
    });

    it("allows PDF documents", () => {
      expect(validateAttachment({ name: "report.pdf", size: 500000, mimetype: "application/pdf" })).toBeNull();
    });

    it("allows DOCX documents", () => {
      expect(validateAttachment({
        name: "contract.docx",
        size: 100000,
        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      })).toBeNull();
    });

    it("rejects executable files", () => {
      const err = validateAttachment({ name: "virus.exe", size: 1024, mimetype: "application/x-msdownload" });
      expect(err).toContain("not allowed");
    });

    it("rejects ZIP archives", () => {
      const err = validateAttachment({ name: "archive.zip", size: 1024, mimetype: "application/zip" });
      expect(err).toContain("not allowed");
    });

    it("rejects files exceeding 10 MB", () => {
      const err = validateAttachment({ name: "huge.jpg", size: MAX_FILE_SIZE + 1, mimetype: "image/jpeg" });
      expect(err).toContain("too large");
    });

    it("allows files exactly at the 10 MB limit", () => {
      expect(validateAttachment({ name: "exact.jpg", size: MAX_FILE_SIZE, mimetype: "image/jpeg" })).toBeNull();
    });
  });

  describe("validateBatch", () => {
    const validFile = { name: "photo.jpg", size: 1024, mimetype: "image/jpeg" };

    it("allows a batch that stays within the 5-file limit", () => {
      expect(validateBatch([validFile, validFile], 2)).toBeNull();
    });

    it("rejects a batch that would exceed the 5-file limit", () => {
      const err = validateBatch([validFile, validFile], 4);
      expect(err).toContain("Maximum 5");
    });

    it("rejects a batch if any file has a disallowed type", () => {
      const badFile = { name: "virus.exe", size: 100, mimetype: "application/x-msdownload" };
      const err = validateBatch([validFile, badFile], 0);
      expect(err).toContain("not allowed");
    });

    it("allows exactly 5 files when starting from 0", () => {
      const files = Array.from({ length: 5 }, (_, i) => ({
        name: `file${i}.jpg`, size: 1024, mimetype: "image/jpeg"
      }));
      expect(validateBatch(files, 0)).toBeNull();
    });

    it("rejects 6 files when starting from 0", () => {
      const files = Array.from({ length: 6 }, (_, i) => ({
        name: `file${i}.jpg`, size: 1024, mimetype: "image/jpeg"
      }));
      expect(validateBatch(files, 0)).toContain("Maximum 5");
    });
  });

  describe("MIME type coverage", () => {
    const imageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic"];
    const docTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
    ];

    it.each(imageTypes)("allows image type: %s", (mime) => {
      expect(validateAttachment({ name: "file", size: 100, mimetype: mime })).toBeNull();
    });

    it.each(docTypes)("allows document type: %s", (mime) => {
      expect(validateAttachment({ name: "file", size: 100, mimetype: mime })).toBeNull();
    });
  });
});
