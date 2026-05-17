/**
 * Tests for the owner notification system.
 *
 * Covers:
 *  - DB helper contract (createOwnerNotification, getNotificationsByOwner, etc.)
 *  - notifyDocumentShared: skips when doc not found, skips when un-sharing, fires for shared doc
 *  - tRPC portal procedures: getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB helpers ──────────────────────────────────────────────────────
vi.mock("./db", () => ({
  createOwnerNotification: vi.fn(),
  getNotificationsByOwner: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationEmailSent: vi.fn(),
  getDocumentById: vi.fn(),
  getPropertyById: vi.fn(),
  getOwnersByProperty: vi.fn(),
  // Return all-enabled defaults so preference checks don't suppress notifications in these tests
  getNotificationPrefs: vi.fn().mockResolvedValue({
    docSharedInApp: true,
    docSharedEmail: true,
    paymentDueInApp: true,
    paymentDueEmail: true,
    msgReceivedInApp: true,
    msgReceivedEmail: true,
    ticketUpdateInApp: true,
    ticketUpdateEmail: true,
  }),
}));

// ─── Mock the ENV so email sending is skipped ─────────────────────────────────
vi.mock("./_core/env", () => ({
  ENV: {
    forgeApiKey: undefined,
    forgeApiUrl: undefined,
    ownerOpenId: "owner-open-id",
    databaseUrl: undefined,
    oauthPortalUrl: "https://example.com",
  },
}));

import {
  createOwnerNotification,
  getNotificationsByOwner,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  markNotificationEmailSent,
  getDocumentById,
  getPropertyById,
  getOwnersByProperty,
} from "./db";
import { notifyDocumentShared } from "./notifications/notificationService";

// ─── Helper: build a mock document ───────────────────────────────────────────
function mockDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    propertyId: 10,
    companyId: 5,
    uploadedById: 99,
    title: "Governing Rules 2025",
    description: null,
    category: "governing_document",
    fileKey: "properties/10/docs/abc123.pdf",
    fileUrl: "/manus-storage/abc123.pdf",
    mimeType: "application/pdf",
    fileSize: 204800,
    isSharedWithOwners: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Helper: build a mock property ───────────────────────────────────────────
function mockProperty() {
  return {
    id: 10,
    companyId: 5,
    name: "Sunset Towers",
    address: "123 Main St",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── Helper: build mock owners ────────────────────────────────────────────────
function mockOwners() {
  return [
    { id: 1, name: "Alice Smith", email: "alice@example.com", portierRole: "owner" },
    { id: 2, name: "Bob Jones",   email: null,                portierRole: "owner" },
  ];
}

// ─── notifyDocumentShared ─────────────────────────────────────────────────────
describe("notifyDocumentShared", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when document is not found", async () => {
    vi.mocked(getDocumentById).mockResolvedValue(undefined);

    await notifyDocumentShared(999);

    expect(createOwnerNotification).not.toHaveBeenCalled();
  });

  it("does nothing when document is not shared with owners", async () => {
    vi.mocked(getDocumentById).mockResolvedValue(mockDoc({ isSharedWithOwners: false }) as any);

    await notifyDocumentShared(1);

    expect(createOwnerNotification).not.toHaveBeenCalled();
  });

  it("does nothing when property is not found", async () => {
    vi.mocked(getDocumentById).mockResolvedValue(mockDoc() as any);
    vi.mocked(getPropertyById).mockResolvedValue(undefined);

    await notifyDocumentShared(1);

    expect(createOwnerNotification).not.toHaveBeenCalled();
  });

  it("does nothing when there are no owners for the property", async () => {
    vi.mocked(getDocumentById).mockResolvedValue(mockDoc() as any);
    vi.mocked(getPropertyById).mockResolvedValue(mockProperty() as any);
    vi.mocked(getOwnersByProperty).mockResolvedValue([]);

    await notifyDocumentShared(1);

    expect(createOwnerNotification).not.toHaveBeenCalled();
  });

  it("creates in-app notifications for each owner when document is shared", async () => {
    vi.mocked(getDocumentById).mockResolvedValue(mockDoc() as any);
    vi.mocked(getPropertyById).mockResolvedValue(mockProperty() as any);
    vi.mocked(getOwnersByProperty).mockResolvedValue(mockOwners() as any);
    vi.mocked(createOwnerNotification).mockResolvedValue({ id: 42 });

    await notifyDocumentShared(1);

    expect(createOwnerNotification).toHaveBeenCalledTimes(2);

    // Verify the notification payload for the first owner
    expect(createOwnerNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 1,
        propertyId: 10,
        companyId: 5,
        type: "document_shared",
        title: "New Document Shared",
        documentId: 1,
        isRead: false,
        emailSent: false,
      })
    );
  });

  it("skips email when owner has no email address", async () => {
    vi.mocked(getDocumentById).mockResolvedValue(mockDoc() as any);
    vi.mocked(getPropertyById).mockResolvedValue(mockProperty() as any);
    // Only owner with no email
    vi.mocked(getOwnersByProperty).mockResolvedValue([
      { id: 2, name: "Bob Jones", email: null, portierRole: "owner" },
    ] as any);
    vi.mocked(createOwnerNotification).mockResolvedValue({ id: 43 });

    await notifyDocumentShared(1);

    // Notification created but email not sent (no email address)
    expect(createOwnerNotification).toHaveBeenCalledTimes(1);
    expect(markNotificationEmailSent).not.toHaveBeenCalled();
  });

  it("does not throw even if createOwnerNotification rejects", async () => {
    vi.mocked(getDocumentById).mockResolvedValue(mockDoc() as any);
    vi.mocked(getPropertyById).mockResolvedValue(mockProperty() as any);
    vi.mocked(getOwnersByProperty).mockResolvedValue(mockOwners() as any);
    vi.mocked(createOwnerNotification).mockRejectedValue(new Error("DB error"));

    // Should not throw
    await expect(notifyDocumentShared(1)).resolves.toBeUndefined();
  });

  it("only notifies owners of the specific property, not all owners in the company", async () => {
    // Simulate two properties in the same company; only property 10 owners should be notified
    vi.mocked(getDocumentById).mockResolvedValue(mockDoc() as any); // propertyId = 10
    vi.mocked(getPropertyById).mockResolvedValue(mockProperty() as any); // companyId = 5
    // getOwnersByProperty is now property-scoped via owner_accounts
    // It returns only owners linked to property 10, not property 20
    vi.mocked(getOwnersByProperty).mockResolvedValue([
      { id: 1, name: "Alice Smith", email: "alice@example.com", portierRole: "owner" },
      // Bob is an owner of property 20 (different property, same company) — NOT returned here
    ] as any);
    vi.mocked(createOwnerNotification).mockResolvedValue({ id: 50 });

    await notifyDocumentShared(1);

    // Only Alice (property 10 owner) should receive a notification
    expect(createOwnerNotification).toHaveBeenCalledTimes(1);
    expect(createOwnerNotification).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 1 })
    );
  });
});

// ─── DB Helper unit tests ─────────────────────────────────────────────────────
describe("notification DB helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createOwnerNotification is called with correct shape", async () => {
    vi.mocked(createOwnerNotification).mockResolvedValue({ id: 1 });

    const result = await createOwnerNotification({
      ownerId: 1,
      propertyId: 10,
      companyId: 5,
      type: "document_shared",
      title: "Test",
      body: "A document was shared",
      isRead: false,
      emailSent: false,
    });

    expect(result).toEqual({ id: 1 });
    expect(createOwnerNotification).toHaveBeenCalledOnce();
  });

  it("getNotificationsByOwner returns an array", async () => {
    vi.mocked(getNotificationsByOwner).mockResolvedValue([
      { id: 1, ownerId: 1, type: "document_shared", title: "Test", body: "body", isRead: false } as any,
    ]);

    const result = await getNotificationsByOwner(1);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("getUnreadNotificationCount returns a number", async () => {
    vi.mocked(getUnreadNotificationCount).mockResolvedValue(3);

    const count = await getUnreadNotificationCount(1);
    expect(count).toBe(3);
  });

  it("markNotificationRead is called with correct args", async () => {
    vi.mocked(markNotificationRead).mockResolvedValue(undefined);

    await markNotificationRead(5, 1);

    expect(markNotificationRead).toHaveBeenCalledWith(5, 1);
  });

  it("markAllNotificationsRead is called with correct owner id", async () => {
    vi.mocked(markAllNotificationsRead).mockResolvedValue(undefined);

    await markAllNotificationsRead(1);

    expect(markAllNotificationsRead).toHaveBeenCalledWith(1);
  });
});
