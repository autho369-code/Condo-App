import { createClient } from "@supabase/supabase-js";

const s = createClient(
  "https://termxngysvotnfbzbgrv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlcm14bmd5c3ZvdG5mYnpiZ3J2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTcwNDc5MiwiZXhwIjoyMDkxMjgwNzkyfQ.JDP-aAoL6MKrU_e4h0M6Ngjv-86RrQZvgElTaDClsIo"
);

// Check if associations table exists
const { data: assocData, error: assocError } = await s.from("associations").select("*").limit(5);
if (assocError) {
  console.log("associations table error:", assocError.message);
} else {
  console.log("associations rows:", assocData?.length);
  if (assocData?.length) {
    console.log("columns:", Object.keys(assocData[0]).join(", "));
    assocData.forEach(a => console.log(" -", a.id, a.name, "portfolio_id:", a.portfolio_id));
  }
}

// Check portfolios table
const { data: portData, error: portError } = await s.from("portfolios").select("*").limit(5);
if (portError) {
  console.log("portfolios table error:", portError.message);
} else {
  console.log("\nportfolios rows:", portData?.length);
  if (portData?.length) {
    console.log("columns:", Object.keys(portData[0]).join(", "));
    portData.forEach(p => console.log(" -", p.id, p.name));
  }
}

// Check distinct association_ids in bank_accounts
const { data: bankAssocs } = await s.from("bank_accounts").select("association_id, portfolio_id").neq("association_id", null);
const uniqueAssocs = [...new Set((bankAssocs || []).map(b => b.association_id))];
const uniquePortfolios = [...new Set((bankAssocs || []).map(b => b.portfolio_id))];
console.log("\nUnique association_ids in bank_accounts:", uniqueAssocs.length, uniqueAssocs.slice(0, 5));
console.log("Unique portfolio_ids in bank_accounts:", uniquePortfolios.length, uniquePortfolios.slice(0, 5));
