import { createClient } from "@supabase/supabase-js";

const s = createClient(
  "https://termxngysvotnfbzbgrv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlcm14bmd5c3ZvdG5mYnpiZ3J2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTcwNDc5MiwiZXhwIjoyMDkxMjgwNzkyfQ.JDP-aAoL6MKrU_e4h0M6Ngjv-86RrQZvgElTaDClsIo"
);

const tables = ["properties", "vendors", "owners", "transactions", "gl_accounts", "bank_accounts", "companies"];
for (const t of tables) {
  const { count, error } = await s.from(t).select("*", { count: "exact", head: true });
  console.log(`${t}: ${error ? "ERROR: " + error.message : count + " rows"}`);
}

// Check properties columns
console.log("\n--- properties sample ---");
const { data: props } = await s.from("properties").select("*").limit(3);
if (props?.length) {
  console.log("columns:", Object.keys(props[0]).join(", "));
  props.forEach(p => console.log(" -", p.id, p.name, p.companyId));
} else {
  console.log("(empty)");
}

// Check vendors columns
console.log("\n--- vendors sample ---");
const { data: vendors } = await s.from("vendors").select("*").limit(2);
if (vendors?.length) {
  console.log("columns:", Object.keys(vendors[0]).join(", "));
  vendors.forEach(v => console.log(" -", v.id, v.name, "portfolio_id:", v.portfolio_id, "association_id:", v.association_id));
} else {
  console.log("(empty)");
}

// Check owners columns
console.log("\n--- owners sample ---");
const { data: owners } = await s.from("owners").select("*").limit(2);
if (owners?.length) {
  console.log("columns:", Object.keys(owners[0]).join(", "));
  owners.forEach(o => console.log(" -", o.id, o.full_name, "portfolio_id:", o.portfolio_id, "association_id:", o.association_id));
} else {
  console.log("(empty)");
}

// Check transactions columns
console.log("\n--- transactions sample ---");
const { data: txns } = await s.from("transactions").select("*").limit(2);
if (txns?.length) {
  console.log("columns:", Object.keys(txns[0]).join(", "));
} else {
  console.log("(empty)");
}
