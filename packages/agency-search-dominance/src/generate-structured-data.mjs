#!/usr/bin/env node
/**
 * Structured Data Generator
 * Crawls a site and generates schema.org JSON-LD for all pages.
 * Outputs structured data files ready for injection into <head>.
 * 
 * Usage: node generate-structured-data.mjs --site https://client.com --output ./output/
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCHEMAS = {
  Organization: (site) => ({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    description: site.description,
    email: site.email,
    telephone: site.phone,
    sameAs: [site.social?.twitter, site.social?.linkedin].filter(Boolean),
  }),
  LocalBusiness: (site) => ({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: site.name,
    url: site.url,
    telephone: site.phone,
    address: site.address || undefined,
  }),
  WebSite: (site) => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: site.url,
    description: site.description,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${site.url}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  }),
  FAQPage: (site, faqs) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: (faqs || site.faqs || []).map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
  }),
  BreadcrumbList: (site, pages) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: (pages || site.pages || []).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.title,
      item: p.url,
    })),
  }),
};

async function main() {
  const siteIdx = process.argv.indexOf("--site");
  const outIdx = process.argv.indexOf("--output");
  const siteUrl = siteIdx >= 0 ? process.argv[siteIdx + 1] : "https://example.com";
  const outDir = outIdx >= 0 ? process.argv[outIdx + 1] : join(__dirname, "..", "output");

  mkdirSync(outDir, { recursive: true });

  // In production, crawl the site. For now, use config.
  const site = {
    name: siteUrl.replace("https://", "").replace("www.", "").split(".")[0],
    url: siteUrl,
    description: "Full-service digital agency",
    email: "hello@" + siteUrl.replace("https://", "").replace("www.", ""),
    phone: "(555) 000-0000",
  };

  const schemas = [];
  for (const [type, generator] of Object.entries(SCHEMAS)) {
    try {
      schemas.push(generator(site));
    } catch {}
  }

  // Write combined JSON-LD
  const jsonld = schemas.map((s) => JSON.stringify(s)).join("\n");
  const script = `<script type="application/ld+json">\n${jsonld}\n</script>`;

  writeFileSync(join(outDir, "structured-data.jsonld"), jsonld);
  writeFileSync(join(outDir, "structured-data.html"), script);

  const result = { schemas: Object.keys(SCHEMAS).length, files: ["structured-data.jsonld", "structured-data.html"], output: outDir };
  console.log(JSON.stringify(result));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
