/**
 * Tests for notifyManagerReply notification service:
 *  - Creates in-app notification when msgReceivedInApp pref is true
 *  - Skips in-app notification when msgReceivedInApp pref is false
 *  - Sends email when msgReceivedEmail pref is true and owner has email
 *  - Skips email when msgReceivedEmail pref is false
 *  - Skips email when owner has no email address
 *  - Marks emailSent on the notification record after successful email send
 *  - Does not throw when owner is not found (graceful no-op)
 *  - Does not throw when DB helpers fail (error isolation)
 *  - Truncates long reply body in notification body text
 *  - Uses correct notification type "message_received"
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock all DB helpers used by the service ─────────────────────────────────
vi.mock("./db", () => ({
  getUserById: vi.fn(),
  getNotificationPrefs: vi.fn(),
  createOwnerNotification: vi.fn(),
  markNotificationEmailSent: vi.fn(),
  // Other helpers referenced in the module but not needed for these tests
  getOwnersByProperty: vi.fn(),
  getDocumentById: vi.fn(),
  getPropertyById: vi.fn(),
  markNotificationRead: vi.fn(),
}));

// ─── Mock fetch for email sending ────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { notifyManagerReply } from "./notifications/notificationService";
import {
  getUserById,
  getNotificationPrefs,
  createOwnerNotification,
  markNotificationEmailSent,
} from "./db";

// ─── Default test fixtures ────────────────────────────────────────────────────
const OWNER = { id: 1, name: "Alice Smith", email: "alice@example.com" };
const DEFAULT_PREFS = {
  msgReceivedInApp: true,
  msgReceivedEmail: true,
  docSharedInApp: true,
  docSharedEmail: true,
  paymentDueInApp: true,
  paymentDueEmail: true,
  ticketUpdateInApp: true,
  ticketUpdateEmail: true,
};
const BASE_PARAMS = {
  ownerId: 1,
  propertyId: 10,
  companyId: 5,
  managerName: "Bob Manager",
  replyBody: "We have looked into your issue and will fix it by Friday.",
  propertyName: "Sunset Towers",
};

function mockEmailSuccess() {
  mockFetch.mockResolvedValueOnce({ ok: true, text: async () => "" });
}
function mockEmailFailure() {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Server error" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserById).mockResolvedValue(OWNER as any);
  vi.mocked(getNotificationPrefs).mockResolvedValue(DEFAULT_PREFS as any);
  vi.mocked(createOwnerNotification).mockResolvedValue({ id: 42 } as any);
  vi.mocked(markNotificationEmailSent).mockResolvedValue(undefined);
  mockFetch.mockReset();
});

// ─── In-app notification creation ────────────────────────────────────────────
describe("notifyManagerReply — in-app notifications", () => {
  it("creates an in-app notification when msgReceivedInApp is true", async () => {
    mockEmailSuccess();
    await notifyManagerReply(BASE_PARAMS);
    expect(createOwnerNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 1,
        propertyId: 10,
        companyId: 5,
        type: "message_received",
        isRead: false,
        emailSent: false,
      })
    );
  });

  it("sets notification title to include manager name", async () => {
    mockEmailSuccess();
    await notifyManagerReply(BASE_PARAMS);
    const call = vi.mocked(createOwnerNotification).mock.calls[0][0];
    expect(call.title).toContain("Bob Manager");
  });

  it("sets notification body to include property name", async () => {
    mockEmailSuccess();
    await notifyManagerReply(BASE_PARAMS);
    const call = vi.mocked(createOwnerNotification).mock.calls[0][0];
    expect(call.body).toContain("Sunset Towers");
  });

  it("skips in-app notification when msgReceivedInApp is false", async () => {
    vi.mocked(getNotificationPrefs).mockResolvedValueOnce({ ...DEFAULT_PREFS, msgReceivedInApp: false } as any);
    mockEmailSuccess();
    await notifyManagerReply(BASE_PARAMS);
    expect(createOwnerNotification).not.toHaveBeenCalled();
  });

  it("uses 'message_received' as the notification type", async () => {
    mockEmailSuccess();
    await notifyManagerReply(BASE_PARAMS);
    const call = vi.mocked(createOwnerNotification).mock.calls[0][0];
    expect(call.type).toBe("message_received");
  });
});

// ─── Email sending ────────────────────────────────────────────────────────────
describe("notifyManagerReply — email notifications", () => {
  it("sends an email when msgReceivedEmail is true and owner has email", async () => {
    mockEmailSuccess();
    await notifyManagerReply(BASE_PARAMS);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.to).toBe("alice@example.com");
    expect(body.subject).toContain("Bob Manager");
  });

  it("email HTML includes manager name and property name", async () => {
    mockEmailSuccess();
    await notifyManagerReply(BASE_PARAMS);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.html).toContain("Bob Manager");
    expect(body.html).toContain("Sunset Towers");
  });

  it("email HTML includes a preview of the reply body", async () => {
    mockEmailSuccess();
    await notifyManagerReply(BASE_PARAMS);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.html).toContain("We have looked into your issue");
  });

  it("skips email when msgReceivedEmail is false", async () => {
    vi.mocked(getNotificationPrefs).mockResolvedValueOnce({ ...DEFAULT_PREFS, msgReceivedEmail: false } as any);
    await notifyManagerReply(BASE_PARAMS);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips email when owner has no email address", async () => {
    vi.mocked(getUserById).mockResolvedValueOnce({ ...OWNER, email: null } as any);
    await notifyManagerReply(BASE_PARAMS);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("marks emailSent on the notification after successful email send", async () => {
    mockEmailSuccess();
    await notifyManagerReply(BASE_PARAMS);
    expect(markNotificationEmailSent).toHaveBeenCalledWith(42);
  });

  it("does not mark emailSent when email send fails", async () => {
    mockEmailFailure();
    await notifyManagerReply(BASE_PARAMS);
    expect(markNotificationEmailSent).not.toHaveBeenCalled();
  });
});

// ─── Graceful error handling ──────────────────────────────────────────────────
describe("notifyManagerReply — error isolation", () => {
  it("does not throw when owner is not found", async () => {
    vi.mocked(getUserById).mockResolvedValueOnce(undefined);
    await expect(notifyManagerReply(BASE_PARAMS)).resolves.toBeUndefined();
    expect(createOwnerNotification).not.toHaveBeenCalled();
  });

  it("does not throw when createOwnerNotification throws", async () => {
    vi.mocked(createOwnerNotification).mockRejectedValueOnce(new Error("DB error"));
    mockEmailSuccess();
    await expect(notifyManagerReply(BASE_PARAMS)).resolves.toBeUndefined();
  });

  it("does not throw when fetch throws a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await expect(notifyManagerReply(BASE_PARAMS)).resolves.toBeUndefined();
  });

  it("does not throw when both in-app and email are disabled", async () => {
    vi.mocked(getNotificationPrefs).mockResolvedValueOnce({
      ...DEFAULT_PREFS,
      msgReceivedInApp: false,
      msgReceivedEmail: false,
    } as any);
    await expect(notifyManagerReply(BASE_PARAMS)).resolves.toBeUndefined();
    expect(createOwnerNotification).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── Reply body truncation ────────────────────────────────────────────────────
describe("notifyManagerReply — body truncation", () => {
  it("truncates a very long reply body in the notification body text", async () => {
    mockEmailSuccess();
    const longBody = "A".repeat(300);
    await notifyManagerReply({ ...BASE_PARAMS, replyBody: longBody });
    const call = vi.mocked(createOwnerNotification).mock.calls[0][0];
    // Notification body should be under 200 chars (100 char preview + surrounding text)
    expect(call.body.length).toBeLessThan(300);
    expect(call.body).toContain("…");
  });

  it("does not truncate short reply bodies", async () => {
    mockEmailSuccess();
    const shortBody = "Thanks for reaching out!";
    await notifyManagerReply({ ...BASE_PARAMS, replyBody: shortBody });
    const call = vi.mocked(createOwnerNotification).mock.calls[0][0];
    expect(call.body).toContain(shortBody);
  });
});
