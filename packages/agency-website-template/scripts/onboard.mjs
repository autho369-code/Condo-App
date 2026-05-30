#!/usr/bin/env node
/**
 * Client Onboarding Script
 * 
 * Spins up a new client website from the agency template:
 * 1. Clone template
 * 2. Customize site-config.ts with client details
 * 3. Create GitHub repo
 * 4. Deploy to Vercel (via GitHub Actions trigger)
 * 
 * Usage: node onboard.mjs --name "Client Name" --domain client.com --email hello@client.com
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_REPO = "https://github.com/autho369-code/agency-website-template.git";
const WORK_DIR = process.env.AGENCY_WORK_DIR || join(process.env.HOME || "/tmp", "agency-clients");

// ─── Parse CLI args ──────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { name: "", domain: "", email: "", phone: "", tagline: "", description: "", dryRun: false };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const val = args[i + 1];
    if (arg === "--name") { opts.name = val; i++; }
    else if (arg === "--domain") { opts.domain = val; i++; }
    else if (arg === "--email") { opts.email = val; i++; }
    else if (arg === "--phone") { opts.phone = val; i++; }
    else if (arg === "--tagline") { opts.tagline = val; i++; }
    else if (arg === "--description") { opts.description = val; i++; }
    else if (arg === "--dry-run") { opts.dryRun = true; }
  }
  
  if (!opts.name || !opts.domain) {
    console.error("Usage: node onboard.mjs --name 'Client Name' --domain client.com [--email ...] [--phone ...] [--tagline ...] [--description ...] [--dry-run]");
    process.exit(1);
  }
  
  return opts;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  const slug = opts.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const clientDir = join(WORK_DIR, slug);
  const repoName = `${slug}-site`;
  
  console.log(`\n🚀 Onboarding: ${opts.name} (${opts.domain})\n`);
  
  if (opts.dryRun) {
    console.log("[DRY RUN] Would create:");
    console.log(`  Directory: ${clientDir}`);
    console.log(`  Repo: autho369-code/${repoName}`);
    console.log(`  Domain: ${opts.domain}`);
    console.log(`  Email: ${opts.email || "(not set)"}`);
    return;
  }
  
  // Step 1: Clone template
  console.log("1/4 Cloning template...");
  mkdirSync(WORK_DIR, { recursive: true });
  if (existsSync(clientDir)) {
    console.log(`  Directory ${clientDir} exists, removing...`);
    execSync(`rm -rf "${clientDir}"`);
  }
  execSync(`git clone ${TEMPLATE_REPO} "${clientDir}"`, { stdio: "inherit" });
  
  // Step 2: Customize site config
  console.log("2/4 Customizing site config...");
  const configPath = join(clientDir, "src", "lib", "site-config.ts");
  let config = readFileSync(configPath, "utf-8");
  
  config = config.replace(/name: ".*?"/, `name: "${opts.name}"`);
  config = config.replace(/domain: ".*?"/, `domain: "${opts.domain}"`);
  if (opts.email) config = config.replace(/email: ".*?"/, `email: "${opts.email}"`);
  if (opts.phone) config = config.replace(/phone: ".*?"/, `phone: "${opts.phone}"`);
  if (opts.tagline) config = config.replace(/tagline: ".*?"/, `tagline: "${opts.tagline}"`);
  if (opts.description) config = config.replace(/description: ".*?"/, `description: "${opts.description}"`);
  
  writeFileSync(configPath, config);
  
  // Step 3: Create GitHub repo and push
  console.log("3/4 Creating GitHub repo...");
  execSync("git add -A && git commit -m 'chore: customize for client' --allow-empty", { cwd: clientDir });
  execSync(`gh repo create autho369-code/${repoName} --public --source=. --remote=origin --push`, {
    cwd: clientDir,
    stdio: "inherit",
  });
  console.log(`  Repo: https://github.com/autho369-code/${repoName}`);
  
  // Step 4: Deploy instructions
  console.log("4/4 Deployment ready!");
  console.log(`  ✅ Template customized for ${opts.name}`);
  console.log(`  ✅ Repo created: github.com/autho369-code/${repoName}`);
  console.log(`  📋 Next: Connect repo to Vercel and configure domain ${opts.domain}`);
  console.log(`  📋 Vercel: vercel.com/import/git → select ${repoName}`);
  console.log(`  📋 GitHub Action auto-deploys on push to main (set VERCEL_TOKEN in secrets)`);
  console.log(`\n🎉 ${opts.name} is onboarding complete!\n`);
}

main().catch((err) => {
  console.error("Onboarding failed:", err.message);
  process.exit(1);
});
