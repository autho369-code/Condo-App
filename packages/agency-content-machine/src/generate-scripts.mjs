#!/usr/bin/env node
/**
 * AI Video Script Generator
 * Takes a brand template and generates 30 short-form video scripts for a month.
 * 
 * Env: OPENAI_API_KEY
 * Usage: node generate-scripts.mjs --brand brand.json --output scripts/
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPENAI_KEY=proces...

async function generateScripts(brand, count = 30) {
  const prompt = `You are a social media content strategist for ${brand.brand.name}, a ${brand.brand.industry} company.

Brand tone: ${brand.brand.tone}
Target audience: ${brand.brand.targetAudience}
Content pillars: ${brand.brand.contentPillars.join(", ")}

Generate ${count} short-form video scripts (TikTok/Reels/Shorts format — 15-60 seconds each).
Each script should include:
1. Hook (first 3 seconds — grab attention)
2. Body (main content — 10-40 seconds)
3. CTA (call to action — last 5 seconds)
4. Suggested hashtags (3-5)
5. Visual notes (what to show on screen)

Format as JSON array. Spread across all content pillars evenly. Make them practical and valuable — not generic marketing fluff.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
      temperature: 0.8,
      response_format: { type: "json_object" },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(data)}`);

  const result = JSON.parse(data.choices[0].message.content);
  return result.scripts || [];
}

async function main() {
  if (!OPENAI_KEY) {
    console.error("Set OPENAI_API_KEY");
    process.exit(1);
  }

  const brandIdx = process.argv.indexOf("--brand");
  const outIdx = process.argv.indexOf("--output");
  const brandPath = brandIdx >= 0 ? process.argv[brandIdx + 1] : join(__dirname, "brand-template.schema.json");
  const outDir = outIdx >= 0 ? process.argv[outIdx + 1] : join(__dirname, "..", "output");

  const brand = JSON.parse(readFileSync(brandPath, "utf-8"));
  mkdirSync(outDir, { recursive: true });

  console.error(`Generating 30 scripts for ${brand.brand.name}...`);
  const scripts = await generateScripts(brand);

  const outFile = join(outDir, `scripts-${Date.now()}.json`);
  writeFileSync(outFile, JSON.stringify({ generated: new Date().toISOString(), brand: brand.brand.name, count: scripts.length, scripts }, null, 2));

  console.log(JSON.stringify({ generated: scripts.length, file: outFile }));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
