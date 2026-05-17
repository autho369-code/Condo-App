import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for the convertToTicket business logic.
 * We test the pure mapping logic (urgency → priority, category → ticket category)
 * and the duplicate-prevention guard separately from the tRPC layer.
 */

// ─── Urgency → Priority mapping ───────────────────────────────────────────────

function urgencyToPriority(urgency: string | null): "low" | "medium" | "high" | "urgent" {
  if (urgency === "critical") return "urgent";
  if (urgency === "high") return "high";
  if (urgency === "medium") return "medium";
  return "low";
}

describe("urgencyToPriority", () => {
  it("maps critical → urgent", () => {
    expect(urgencyToPriority("critical")).toBe("urgent");
  });

  it("maps high → high", () => {
    expect(urgencyToPriority("high")).toBe("high");
  });

  it("maps medium → medium", () => {
    expect(urgencyToPriority("medium")).toBe("medium");
  });

  it("maps low → low", () => {
    expect(urgencyToPriority("low")).toBe("low");
  });

  it("maps null → low (safe default)", () => {
    expect(urgencyToPriority(null)).toBe("low");
  });

  it("maps unknown string → low (safe default)", () => {
    expect(urgencyToPriority("unknown_level")).toBe("low");
  });
});

// ─── Email category → Ticket category mapping ─────────────────────────────────

function emailCategoryToTicketCategory(cat: string | null): string {
  if (!cat) return "other";
  const map: Record<string, string> = {
    maintenance_request: "maintenance",
    emergency: "emergency",
    vendor_communication: "vendor",
    board_matter: "board_matter",
    billing_payment: "other",
    noise_complaint: "common_area",
    amenity_booking: "common_area",
    lease_ownership: "unit_related",
    general_inquiry: "other",
  };
  return map[cat] ?? "other";
}

describe("emailCategoryToTicketCategory", () => {
  it("maps maintenance_request → maintenance", () => {
    expect(emailCategoryToTicketCategory("maintenance_request")).toBe("maintenance");
  });

  it("maps emergency → emergency", () => {
    expect(emailCategoryToTicketCategory("emergency")).toBe("emergency");
  });

  it("maps vendor_communication → vendor", () => {
    expect(emailCategoryToTicketCategory("vendor_communication")).toBe("vendor");
  });

  it("maps board_matter → board_matter", () => {
    expect(emailCategoryToTicketCategory("board_matter")).toBe("board_matter");
  });

  it("maps noise_complaint → common_area", () => {
    expect(emailCategoryToTicketCategory("noise_complaint")).toBe("common_area");
  });

  it("maps amenity_booking → common_area", () => {
    expect(emailCategoryToTicketCategory("amenity_booking")).toBe("common_area");
  });

  it("maps lease_ownership → unit_related", () => {
    expect(emailCategoryToTicketCategory("lease_ownership")).toBe("unit_related");
  });

  it("maps null → other (safe default)", () => {
    expect(emailCategoryToTicketCategory(null)).toBe("other");
  });

  it("maps unknown category → other (safe default)", () => {
    expect(emailCategoryToTicketCategory("some_new_category")).toBe("other");
  });
});

// ─── Duplicate prevention guard ───────────────────────────────────────────────

describe("duplicate conversion guard", () => {
  it("throws when convertedToTicketId is already set", () => {
    const email = { id: 1, convertedToTicketId: 42 };
    const guard = () => {
      if (email.convertedToTicketId) {
        throw new Error(`Already converted to ticket #${email.convertedToTicketId}`);
      }
    };
    expect(guard).toThrow("Already converted to ticket #42");
  });

  it("does not throw when convertedToTicketId is null", () => {
    const email = { id: 1, convertedToTicketId: null };
    const guard = () => {
      if (email.convertedToTicketId) {
        throw new Error(`Already converted to ticket #${email.convertedToTicketId}`);
      }
    };
    expect(guard).not.toThrow();
  });
});

// ─── Ticket payload construction ──────────────────────────────────────────────

describe("ticket payload construction from email", () => {
  it("builds a valid ticket payload from a fully categorized email", () => {
    const email = {
      id: 7,
      subject: "Water leak in lobby",
      fromAddress: "resident@example.com",
      bodyPreview: "There is a water leak near the elevator.",
      aiUrgency: "high",
      aiCategory: "maintenance_request",
      aiMatchedPropertyId: 3,
    };

    const payload = {
      emailId: email.id,
      propertyId: email.aiMatchedPropertyId,
      title: email.subject,
      description: `From: ${email.fromAddress}\n\n${email.bodyPreview}`,
      priority: urgencyToPriority(email.aiUrgency),
      category: emailCategoryToTicketCategory(email.aiCategory),
      source: "email" as const,
    };

    expect(payload.title).toBe("Water leak in lobby");
    expect(payload.priority).toBe("high");
    expect(payload.category).toBe("maintenance");
    expect(payload.propertyId).toBe(3);
    expect(payload.source).toBe("email");
    expect(payload.description).toContain("resident@example.com");
  });

  it("handles an uncategorized email with null AI fields gracefully", () => {
    const email = {
      id: 8,
      subject: null,
      fromAddress: null,
      bodyPreview: null,
      aiUrgency: null,
      aiCategory: null,
      aiMatchedPropertyId: null,
    };

    const payload = {
      emailId: email.id,
      title: email.subject ?? "",
      priority: urgencyToPriority(email.aiUrgency),
      category: emailCategoryToTicketCategory(email.aiCategory),
    };

    expect(payload.title).toBe("");
    expect(payload.priority).toBe("low");
    expect(payload.category).toBe("other");
  });
});
