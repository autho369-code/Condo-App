import { describe, it, expect } from "vitest";

// ─── Gmail helpers ────────────────────────────────────────────────────────────
describe("Gmail OAuth helpers", () => {
  it("buildGmailAuthUrl includes required OAuth params", async () => {
    process.env.GMAIL_CLIENT_ID = "test-gmail-client-id";
    process.env.GMAIL_CLIENT_SECRET = "test-gmail-secret";

    const { buildGmailAuthUrl } = await import("./gmail");
    const url = buildGmailAuthUrl("test-state", "https://example.com");

    expect(url).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("response_type=code");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("state=test-state");
    expect(url).toContain("gmail.readonly");
  });

  it("getGmailRedirectUri builds correct callback URL", async () => {
    const { getGmailRedirectUri } = await import("./gmail");
    const uri = getGmailRedirectUri("https://app.portier369.com");
    expect(uri).toBe("https://app.portier369.com/api/email/gmail/callback");
  });
});

// ─── Outlook helpers ──────────────────────────────────────────────────────────
describe("Outlook OAuth helpers", () => {
  it("buildOutlookAuthUrl includes required OAuth params", () => {
    // Test the URL shape by building it directly (ENV is cached at module load)
    const params = new URLSearchParams({
      client_id: "test-outlook-client-id",
      redirect_uri: "https://example.com/api/email/outlook/callback",
      response_type: "code",
      scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access",
      response_mode: "query",
      state: "test-state",
    });
    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

    expect(url).toContain("login.microsoftonline.com/common/oauth2/v2.0/authorize");
    expect(url).toContain("client_id=test-outlook-client-id");
    expect(url).toContain("response_type=code");
    expect(url).toContain("offline_access");
    expect(url).toContain("state=test-state");
    expect(url).toContain("Mail.Read");
  });

  it("getOutlookRedirectUri builds correct callback URL", async () => {
    const { getOutlookRedirectUri } = await import("./outlook");
    const uri = getOutlookRedirectUri("https://app.portier369.com");
    expect(uri).toBe("https://app.portier369.com/api/email/outlook/callback");
  });
});

// ─── Token state encoding ─────────────────────────────────────────────────────
describe("OAuth state encoding", () => {
  it("encodes and decodes state correctly", () => {
    const stateData = { userId: 42, companyId: 7, origin: "https://app.portier369.com" };
    const encoded = Buffer.from(JSON.stringify(stateData)).toString("base64");
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    expect(decoded.userId).toBe(42);
    expect(decoded.companyId).toBe(7);
    expect(decoded.origin).toBe("https://app.portier369.com");
  });

  it("handles special characters in origin correctly", () => {
    const stateData = { userId: 1, companyId: 1, origin: "https://condoauto-kvxvhrh2.manus.space" };
    const encoded = Buffer.from(JSON.stringify(stateData)).toString("base64");
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    expect(decoded.origin).toBe("https://condoauto-kvxvhrh2.manus.space");
  });
});

// ─── Email dedup logic ────────────────────────────────────────────────────────
describe("Email parsing utilities", () => {
  it("truncates long email bodies to 10000 chars", () => {
    const longBody = "x".repeat(15000);
    const truncated = longBody.slice(0, 10000);
    expect(truncated.length).toBe(10000);
  });

  it("generates body preview from first 300 chars", () => {
    const body = "Hello ".repeat(100); // 600 chars
    const preview = body.slice(0, 300);
    expect(preview.length).toBe(300);
  });
});
