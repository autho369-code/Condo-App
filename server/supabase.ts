import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://termxngysvotnfbzbgrv.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlcm14bmd5c3ZvdG5mYnpiZ3J2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTcwNDc5MiwiZXhwIjoyMDkxMjgwNzkyfQ.JDP-aAoL6MKrU_e4h0M6Ngjv-86RrQZvgElTaDClsIo";

// Server-side Supabase client with service role key (bypasses RLS)
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlcm14bmd5c3ZvdG5mYnpiZ3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDQ3OTIsImV4cCI6MjA5MTI4MDc5Mn0.placeholder";
