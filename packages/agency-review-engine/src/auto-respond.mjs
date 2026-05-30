#!/usr/bin/env node
/**
 * Auto-respond to positive reviews using AI.
 * Reads reviews without replies, generates responses, posts via GMB API.
 * 
 * Env vars:
 *   OPENAI_API_KEY — for AI response generation
 *   GMB_* — OAuth credentials (same as fetch-reviews)
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.REVIEW_DB_PATH || join(__dirname, "..", "data");
const REVIEWS_FILE = join(DATA_DIR, "reviews.jsonl");

async function getAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMB_CLIENT_ID,
      client_secret: process.env.GMB_CLIENT_SECRET,
      refresh_token: process.env.GMB_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token;
}

async function generateReply(review) {
  const prompt = `You are a business owner responding to a Google review. Write a warm, personalized 2-3 sentence reply. Be genuine, thank the reviewer, and mention something specific from their review if possible.

Reviewer: ${review.reviewer}
Rating: ${"⭐".repeat(review.starRating)} (${review.starRating}/5)
Review: "${review.comment}"

Reply:`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function postReply(token, reviewId, reply) {
  const accountId = process.env.GMB_ACCOUNT_ID;
  const locationId = process.env.GMB_LOCATION_ID;
  
  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment: reply }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Reply failed for ${reviewId}: ${err.slice(0, 200)}`);
  }
  return true;
}

async function main() {
  const lines = readFileSync(REVIEWS_FILE, "utf-8").trim().split("\n");
  const reviews = lines.map((l) => JSON.parse(l));
  
  // Find unreplied positive reviews (4-5 stars)
  const toReply = reviews.filter(
    (r) => !r.reply && r.starRating >= 4 && r.starRating <= 5
  );

  if (toReply.length === 0) {
    console.log(JSON.stringify({ responded: 0, message: "No unreplied reviews to respond to" }));
    return;
  }

  console.error(`Generating responses for ${toReply.length} reviews...`);
  const token = await getAccessToken();
  let count = 0;

  for (const review of toReply) {
    try {
      const reply = await generateReply(review);
      await postReply(token, review.reviewId, reply);
      
      // Update local record
      review.reply = reply;
      review.repliedAt = new Date().toISOString();
      count++;
      
      console.error(`  ✅ Replied to ${review.reviewer} (${review.starRating}★)`);
    } catch (err) {
      console.error(`  ❌ Failed for ${review.reviewer}: ${err.message}`);
    }
  }

  // Rewrite the reviews file with updated records
  writeFileSync(REVIEWS_FILE, reviews.map((r) => JSON.stringify(r)).join("\n") + "\n");

  console.log(JSON.stringify({ responded: count, total: toReply.length }));
}

main().catch((err) => {
  console.error("auto-respond failed:", err.message);
  process.exit(1);
});
