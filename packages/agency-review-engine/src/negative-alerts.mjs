#!/usr/bin/env node
/**
 * Negative Review Alerts
 * Monitors for new negative reviews (1-2 stars) and sends Discord alerts.
 * 
 * Env vars:
 *   DISCORD_ALERTS_WEBHOOK — Discord webhook URL for alerts
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.REVIEW_DB_PATH || join(__dirname, "..", "data");
const REVIEWS_FILE = join(DATA_DIR, "reviews.jsonl");
const DISCORD_WEBHOOK = process.env.DISCORD_ALERTS_WEBHOOK || "";

async function sendAlert(review) {
  if (!DISCORD_WEBHOOK) return;

  const rating = "⭐".repeat(review.starRating);
  const message = {
    content: [
      `🚨 **Negative Review Alert**`,
      `**Rating:** ${rating} (${review.starRating}/5)`,
      `**From:** ${review.reviewer}`,
      `**Review:** ${review.comment.slice(0, 300)}`,
      `**Date:** ${review.createTime}`,
      `\n🔗 [Respond in GMB](https://business.google.com/reviews)`,
    ].join("\n"),
  };

  await fetch(DISCORD_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
}

async function main() {
  const lines = readFileSync(REVIEWS_FILE, "utf-8").trim().split("\n");
  const reviews = lines.map((l) => JSON.parse(l));

  // Find unreplied negative reviews (1-2 stars) from last 24 hours
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const negatives = reviews.filter(
    (r) => r.starRating <= 2 && r.fetchedAt >= dayAgo
  );

  if (negatives.length === 0) {
    console.log(JSON.stringify({ alerts: 0, message: "No negative reviews in last 24h" }));
    return;
  }

  for (const review of negatives) {
    await sendAlert(review);
  }

  console.log(JSON.stringify({ alerts: negatives.length, reviews: negatives.map((r) => r.reviewId) }));
}

main().catch((err) => {
  console.error("negative-alerts failed:", err.message);
  process.exit(1);
});
