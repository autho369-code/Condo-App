import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

describe("Supabase connection", () => {
  it("should connect to Supabase and list tables", async () => {
    const url = process.env.SUPABASE_URL ?? "https://termxngysvotnfbzbgrv.supabase.co";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    expect(url).toBeTruthy();
    expect(key).toBeTruthy();

    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Query the users table — should exist after migration
    const { data, error } = await client.from("users").select("id").limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
