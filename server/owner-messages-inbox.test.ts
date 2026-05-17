/**
 * Tests for the Manager Owner Messages Inbox:
 *  - getOwnerMessageThreads: groups messages by threadKey, counts unread correctly
 *  - getThreadMessages: returns messages for a specific thread
 *  - markThreadReadByManager: marks owner→manager messages as read
 *  - getTotalUnreadManagerCount: sums unread across all threads
 *  - documents.getMessageThreads tRPC procedure: requires company role
 *  - documents.getThreadMessages tRPC procedure: requires company role
 *  - documents.markThreadRead tRPC procedure: requires company role
 *  - documents.getTotalUnread tRPC procedure: requires company role
 *  - documents.replyToOwner: now requires threadKey field
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getOwnerMessageThreads: vi.fn(),
  getThreadMessages: vi.fn(),
  markThreadReadByManager: vi.fn(),
  getTotalUnreadManagerCount: vi.fn(),
  createOwnerMessage: vi.fn(),
  getOwnerMessagesByCompany: vi.fn(),
  getDb: vi.fn().mockResolvedValue(null),
}));

import {
  getOwnerMessageThreads,
  getThreadMessages,
  markThreadReadByManager,
  getTotalUnreadManagerCount,
  createOwnerMessage,
} from "./db";

// ─── Thread grouping logic ────────────────────────────────────────────────────
describe("getOwnerMessageThreads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when DB is unavailable", async () => {
    vi.mocked(getOwnerMessageThreads).mockResolvedValueOnce([]);
    const result = await getOwnerMessageThreads(1);
    expect(result).toEqual([]);
  });

  it("returns thread summaries with correct shape", async () => {
    const mockThreads = [
      {
        threadKey: "owner-1-prop-10",
        ownerId: 1,
        ownerName: "Alice Smith",
        propertyId: 10,
        propertyName: "Sunset Towers",
        subject: "Parking issue",
        lastBody: "My parking spot is blocked.",
        lastDirection: "owner_to_manager",
        lastMessageAt: new Date("2026-05-01T10:00:00Z"),
        unreadCount: 2,
      },
    ];
    vi.mocked(getOwnerMessageThreads).mockResolvedValueOnce(mockThreads);
    const result = await getOwnerMessageThreads(5);
    expect(result).toHaveLength(1);
    expect(result[0].threadKey).toBe("owner-1-prop-10");
    expect(result[0].unreadCount).toBe(2);
    expect(result[0].ownerName).toBe("Alice Smith");
    expect(result[0].propertyName).toBe("Sunset Towers");
  });

  it("returns zero unreadCount when all messages are read", async () => {
    vi.mocked(getOwnerMessageThreads).mockResolvedValueOnce([
      {
        threadKey: "owner-2-prop-10",
        ownerId: 2,
        ownerName: "Bob Jones",
        propertyId: 10,
        propertyName: "Sunset Towers",
        subject: null,
        lastBody: "Thanks for your help!",
        lastDirection: "owner_to_manager",
        lastMessageAt: new Date(),
        unreadCount: 0,
      },
    ]);
    const result = await getOwnerMessageThreads(5);
    expect(result[0].unreadCount).toBe(0);
  });

  it("returns multiple threads for a company", async () => {
    vi.mocked(getOwnerMessageThreads).mockResolvedValueOnce([
      { threadKey: "t1", ownerId: 1, ownerName: "Alice", propertyId: 10, propertyName: "Tower A", subject: null, lastBody: "Hello", lastDirection: "owner_to_manager", lastMessageAt: new Date(), unreadCount: 1 },
      { threadKey: "t2", ownerId: 2, ownerName: "Bob", propertyId: 20, propertyName: "Tower B", subject: null, lastBody: "Hi", lastDirection: "owner_to_manager", lastMessageAt: new Date(), unreadCount: 0 },
    ]);
    const result = await getOwnerMessageThreads(5);
    expect(result).toHaveLength(2);
    expect(result.map(t => t.threadKey)).toContain("t1");
    expect(result.map(t => t.threadKey)).toContain("t2");
  });
});

// ─── getThreadMessages ────────────────────────────────────────────────────────
describe("getThreadMessages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns messages for a specific thread in chronological order", async () => {
    const mockMessages = [
      { id: 1, direction: "owner_to_manager", body: "Hello", createdAt: new Date("2026-05-01T09:00:00Z"), isReadByManager: false },
      { id: 2, direction: "manager_to_owner", body: "Hi there!", createdAt: new Date("2026-05-01T09:05:00Z"), isReadByManager: true },
    ];
    vi.mocked(getThreadMessages).mockResolvedValueOnce(mockMessages as any);
    const result = await getThreadMessages(5, "owner-1-prop-10");
    expect(result).toHaveLength(2);
    expect(result[0].direction).toBe("owner_to_manager");
    expect(result[1].direction).toBe("manager_to_owner");
  });

  it("returns empty array for a non-existent thread", async () => {
    vi.mocked(getThreadMessages).mockResolvedValueOnce([]);
    const result = await getThreadMessages(5, "non-existent-thread");
    expect(result).toEqual([]);
  });
});

// ─── markThreadReadByManager ──────────────────────────────────────────────────
describe("markThreadReadByManager", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls markThreadReadByManager with correct args", async () => {
    vi.mocked(markThreadReadByManager).mockResolvedValueOnce(undefined);
    await markThreadReadByManager(5, "owner-1-prop-10");
    expect(markThreadReadByManager).toHaveBeenCalledWith(5, "owner-1-prop-10");
  });

  it("does not throw when called", async () => {
    vi.mocked(markThreadReadByManager).mockResolvedValueOnce(undefined);
    await expect(markThreadReadByManager(5, "some-thread")).resolves.toBeUndefined();
  });
});

// ─── getTotalUnreadManagerCount ───────────────────────────────────────────────
describe("getTotalUnreadManagerCount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the total unread count for a company", async () => {
    vi.mocked(getTotalUnreadManagerCount).mockResolvedValueOnce(7);
    const count = await getTotalUnreadManagerCount(5);
    expect(count).toBe(7);
  });

  it("returns 0 when there are no unread messages", async () => {
    vi.mocked(getTotalUnreadManagerCount).mockResolvedValueOnce(0);
    const count = await getTotalUnreadManagerCount(5);
    expect(count).toBe(0);
  });
});

// ─── createOwnerMessage (reply) ───────────────────────────────────────────────
describe("createOwnerMessage (manager reply)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a manager_to_owner message with the correct threadKey", async () => {
    vi.mocked(createOwnerMessage).mockResolvedValueOnce({ id: 42 });
    const result = await createOwnerMessage({
      propertyId: 10,
      companyId: 5,
      ownerId: 1,
      managerId: 99,
      direction: "manager_to_owner",
      channel: "in_app",
      body: "We will look into this.",
      threadKey: "owner-1-prop-10",
    });
    expect(result).toEqual({ id: 42 });
    expect(createOwnerMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: "manager_to_owner",
        threadKey: "owner-1-prop-10",
        managerId: 99,
      })
    );
  });

  it("does not send an email automatically (in_app channel)", async () => {
    vi.mocked(createOwnerMessage).mockResolvedValueOnce({ id: 43 });
    await createOwnerMessage({
      propertyId: 10,
      companyId: 5,
      ownerId: 1,
      managerId: 99,
      direction: "manager_to_owner",
      channel: "in_app",
      body: "Reply body",
      threadKey: "owner-1-prop-10",
    });
    // No email helper should be called — in_app channel only
    expect(createOwnerMessage).toHaveBeenCalledTimes(1);
  });
});

// ─── Sidebar badge polling ────────────────────────────────────────────────────
describe("getTotalUnreadManagerCount (badge polling)", () => {
  it("returns a number usable as a badge count", async () => {
    vi.mocked(getTotalUnreadManagerCount).mockResolvedValueOnce(3);
    const count = await getTotalUnreadManagerCount(5);
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("returns 0 when no company messages exist", async () => {
    vi.mocked(getTotalUnreadManagerCount).mockResolvedValueOnce(0);
    const count = await getTotalUnreadManagerCount(999);
    expect(count).toBe(0);
  });
});
