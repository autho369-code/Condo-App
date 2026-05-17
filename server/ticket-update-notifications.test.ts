/**
 * Tests for notifyTicketUpdate notification service:
 *  - Creates in-app notification when ticketUpdateInApp pref is true
 *  - Skips in-app notification when ticketUpdateInApp pref is false
 *  - Sends email when ticketUpdateEmail is true and owner has email
 *  - Skips email when ticketUpdateEmail is false
 *  - Skips email when owner has no email address
 *  - Marks emailSent on the notification record after successful email send
 *  - Skips notification entirely when ticket is not found
 *  - Skips notification when ticket has no reportedById
 *  - Skips notification when reporter is not an owner (portierRole !== "owner")
 *  - Does not notify when newStatus === oldStatus (no-op)
 *  - Notification body includes ticket title and new status label
 *  - Email HTML includes old status → new status transition
 *  - Does not throw when DB helpers fail (error isolation)
 *  - Does not throw when fetch throws a network error
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock all DB helpers used by the service ─────────────────────────────────
vi.mock("./db", () => ({
  getUserById: vi.fn(),
  getNotificationPrefs: vi.fn(),
  createOwnerNotification: vi.fn(),
  markNotificationEmailSent: vi.fn(),
  getTicketById: vi.fn(),
  getPropertyById: vi.fn(),
  // Other helpers referenced in the module but not needed for these tests
  getOwnersByProperty: vi.fn(),
  getDocumentById: vi.fn(),
  markNotificationRead: vi.fn(),
}));

// ─── Mock fetch for email sending ────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { notifyTicketUpdate } from "./notifications/notificationService";
import {
  getUserById,
  getNotificationPrefs,
  createOwnerNotification,
  markNotificationEmailSent,
  getTicketById,
  getPropertyById,
} from "./db";

// ─── Default test fixtures ────────────────────────────────────────────────────
const OWNER = { id: 7, name: "Carol Owner", email: "carol@example.com", portierRole: "owner" };
const TICKET = {
  id: 42,
  title: "Leaking pipe in unit 3B",
  propertyId: 10,
  companyId: 5,
  reportedById: 7,
  status: "open",
};
const PROPERTY = { id: 10, name: "Maple Gardens" };
const DEFAULT_PREFS = {
  ticketUpdateInApp: true,
  ticketUpdateEmail: true,
  docSharedInApp: true,
  docSharedEmail: true,
  msgReceivedInApp: true,
  msgReceivedEmail: true,
  paymentDueInApp: true,
  paymentDueEmail: true,
};
const BASE_PARAMS = { ticketId: 42, newStatus: "in_progress", oldStatus: "open" };

function mockEmailSuccess() {
  mockFetch.mockResolvedValueOnce({ ok: true, text: async () => "" });
}
function mockEmailFailure() {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Server error" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTicketById).mockResolvedValue(TICKET as any);
  vi.mocked(getUserById).mockResolvedValue(OWNER as any);
  vi.mocked(getPropertyById).mockResolvedValue(PROPERTY as any);
  vi.mocked(getNotificationPrefs).mockResolvedValue(DEFAULT_PREFS as any);
  vi.mocked(createOwnerNotification).mockResolvedValue({ id: 99 } as any);
  vi.mocked(markNotificationEmailSent).mockResolvedValue(undefined);
  mockFetch.mockReset();
});

// ─── In-app notification creation ────────────────────────────────────────────
describe("notifyTicketUpdate — in-app notifications", () => {
  it("creates an in-app notification when ticketUpdateInApp is true", async () => {
    mockEmailSuccess();
    await notifyTicketUpdate(BASE_PARAMS);
    expect(createOwnerNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 7,
        propertyId: 10,
        companyId: 5,
        type: "ticket_update",
        isRead: false,
        emailSent: false,
      })
    );
  });

  it("notification title includes the new status label", async () => {
    mockEmailSuccess();
    await notifyTicketUpdate(BASE_PARAMS);
    const call = vi.mocked(createOwnerNotification).mock.calls[0][0];
    expect(call.title).toContain("In Progress");
  });

  it("notification body includes the ticket title", async () => {
    mockEmailSuccess();
    await notifyTicketUpdate(BASE_PARAMS);
    const call = vi.mocked(createOwnerNotification).mock.calls[0][0];
    expect(call.body).toContain("Leaking pipe in unit 3B");
  });

  it("notification body includes the property name", async () => {
    mockEmailSuccess();
    await notifyTicketUpdate(BASE_PARAMS);
    const call = vi.mocked(createOwnerNotification).mock.calls[0][0];
    expect(call.body).toContain("Maple Gardens");
  });

  it("skips in-app notification when ticketUpdateInApp is false", async () => {
    vi.mocked(getNotificationPrefs).mockResolvedValueOnce({ ...DEFAULT_PREFS, ticketUpdateInApp: false } as any);
    mockEmailSuccess();
    await notifyTicketUpdate(BASE_PARAMS);
    expect(createOwnerNotification).not.toHaveBeenCalled();
  });

  it("uses 'ticket_update' as the notification type", async () => {
    mockEmailSuccess();
    await notifyTicketUpdate(BASE_PARAMS);
    const call = vi.mocked(createOwnerNotification).mock.calls[0][0];
    expect(call.type).toBe("ticket_update");
  });
});

// ─── Email sending ────────────────────────────────────────────────────────────
describe("notifyTicketUpdate — email notifications", () => {
  it("sends an email when ticketUpdateEmail is true and owner has email", async () => {
    mockEmailSuccess();
    await notifyTicketUpdate(BASE_PARAMS);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.to).toBe("carol@example.com");
  });

  it("email subject includes ticket title and new status label", async () => {
    mockEmailSuccess();
    await notifyTicketUpdate(BASE_PARAMS);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.subject).toContain("Leaking pipe in unit 3B");
    expect(body.subject).toContain("In Progress");
  });

  it("email HTML includes old and new status labels", async () => {
    mockEmailSuccess();
    await notifyTicketUpdate(BASE_PARAMS);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.html).toContain("Open");       // old status
    expect(body.html).toContain("In Progress"); // new status
  });

  it("email HTML includes the ticket title", async () => {
    mockEmailSuccess();
    await notifyTicketUpdate(BASE_PARAMS);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.html).toContain("Leaking pipe in unit 3B");
  });

  it("skips email when ticketUpdateEmail is false", async () => {
    vi.mocked(getNotificationPrefs).mockResolvedValueOnce({ ...DEFAULT_PREFS, ticketUpdateEmail: false } as any);
    await notifyTicketUpdate(BASE_PARAMS);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips email when owner has no email address", async () => {
    vi.mocked(getUserById).mockResolvedValueOnce({ ...OWNER, email: null } as any);
    await notifyTicketUpdate(BASE_PARAMS);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("marks emailSent on the notification after successful email send", async () => {
    mockEmailSuccess();
    await notifyTicketUpdate(BASE_PARAMS);
    expect(markNotificationEmailSent).toHaveBeenCalledWith(99);
  });

  it("does not mark emailSent when email send fails", async () => {
    mockEmailFailure();
    await notifyTicketUpdate(BASE_PARAMS);
    expect(markNotificationEmailSent).not.toHaveBeenCalled();
  });
});

// ─── Owner-role guard ─────────────────────────────────────────────────────────
describe("notifyTicketUpdate — owner role guard", () => {
  it("skips notification when reporter is a manager (not an owner)", async () => {
    vi.mocked(getUserById).mockResolvedValueOnce({ ...OWNER, portierRole: "property_manager" } as any);
    await notifyTicketUpdate(BASE_PARAMS);
    expect(createOwnerNotification).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips notification when reporter is a resident (not an owner)", async () => {
    vi.mocked(getUserById).mockResolvedValueOnce({ ...OWNER, portierRole: "resident" } as any);
    await notifyTicketUpdate(BASE_PARAMS);
    expect(createOwnerNotification).not.toHaveBeenCalled();
  });

  it("sends notification when reporter is an owner", async () => {
    mockEmailSuccess();
    await notifyTicketUpdate(BASE_PARAMS);
    expect(createOwnerNotification).toHaveBeenCalledTimes(1);
  });
});

// ─── No-op conditions ─────────────────────────────────────────────────────────
describe("notifyTicketUpdate — no-op conditions", () => {
  it("does nothing when newStatus equals oldStatus", async () => {
    await notifyTicketUpdate({ ...BASE_PARAMS, newStatus: "open", oldStatus: "open" });
    expect(getTicketById).not.toHaveBeenCalled();
    expect(createOwnerNotification).not.toHaveBeenCalled();
  });

  it("does nothing when ticket is not found", async () => {
    vi.mocked(getTicketById).mockResolvedValueOnce(undefined);
    await expect(notifyTicketUpdate(BASE_PARAMS)).resolves.toBeUndefined();
    expect(createOwnerNotification).not.toHaveBeenCalled();
  });

  it("does nothing when ticket has no reportedById", async () => {
    vi.mocked(getTicketById).mockResolvedValueOnce({ ...TICKET, reportedById: null } as any);
    await expect(notifyTicketUpdate(BASE_PARAMS)).resolves.toBeUndefined();
    expect(createOwnerNotification).not.toHaveBeenCalled();
  });

  it("does nothing when reporter user is not found", async () => {
    vi.mocked(getUserById).mockResolvedValueOnce(undefined);
    await expect(notifyTicketUpdate(BASE_PARAMS)).resolves.toBeUndefined();
    expect(createOwnerNotification).not.toHaveBeenCalled();
  });
});

// ─── Graceful error handling ──────────────────────────────────────────────────
describe("notifyTicketUpdate — error isolation", () => {
  it("does not throw when createOwnerNotification throws", async () => {
    vi.mocked(createOwnerNotification).mockRejectedValueOnce(new Error("DB error"));
    mockEmailSuccess();
    await expect(notifyTicketUpdate(BASE_PARAMS)).resolves.toBeUndefined();
  });

  it("does not throw when fetch throws a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await expect(notifyTicketUpdate(BASE_PARAMS)).resolves.toBeUndefined();
  });

  it("does not throw when both in-app and email are disabled", async () => {
    vi.mocked(getNotificationPrefs).mockResolvedValueOnce({
      ...DEFAULT_PREFS,
      ticketUpdateInApp: false,
      ticketUpdateEmail: false,
    } as any);
    await expect(notifyTicketUpdate(BASE_PARAMS)).resolves.toBeUndefined();
    expect(createOwnerNotification).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
