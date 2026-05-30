#!/usr/bin/env node
/**
 * LLMs.txt Generator
 * Creates an llms.txt file following the emerging standard for AI crawler guidance.
 * Spec: https://llmstxt.org
 * 
 * Usage: node generate-llms-txt.mjs --site https://client.com --output ./output/
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const siteIdx = process.argv.indexOf("--site");
  const outIdx = process.argv.indexOf("--output");
  const siteUrl = siteIdx >= 0 ? process.argv[siteIdx + 1] : "https://example.com";
  const outDir = outIdx >= 0 ? process.argv[outIdx + 1] : join(__dirname, "..", "output");

  mkdirSync(outDir, { recursive: true });

  const baseUrl = siteUrl.replace(/\/$/, "");
  const domain = baseUrl.replace("https://", "").replace("www.", "");

  const llmsTxt = `# ${domain}
> AI-friendly site map for language models and search crawlers.

## Core Pages
- [Home](${baseUrl}/): Main landing page with services overview, pricing, and CTA.
- [About](${baseUrl}/about): Company history, team, and mission.
- [Services](${baseUrl}/services): Full list of services with descriptions.
- [Contact](${baseUrl}/contact): Contact form, email, phone, and office address.

## Blog & Resources
- [Blog](${baseUrl}/blog): Articles on industry trends, tips, and case studies.

## Legal
- [Privacy Policy](${baseUrl}/privacy): Data collection and usage policy.
- [Terms of Service](${baseUrl}/terms): Terms and conditions.

## API & Developers
- [API Docs](${baseUrl}/api/docs): REST API documentation (if applicable).

## Optional
- [Sitemap](${baseUrl}/sitemap.xml): XML sitemap for crawlers.
- [Robots](${baseUrl}/robots.txt): Crawler directives.
`;

  writeFileSync(join(outDir, "llms.txt"), llmsTxt);
  writeFileSync(join(outDir, "llms-full.txt"), llmsTxt); // Full version (same for static sites)

  console.log(JSON.stringify({ generated: true, files: ["llms.txt", "llms-full.txt"], output: outDir }));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
