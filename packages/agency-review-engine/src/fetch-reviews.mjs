#!/usr/bin/env node
/**
 * Fetch reviews from Google My Business API.
 * Usage: node fetch-reviews.mjs
 * 
 * Env vars:
 *   GMB_CLIENT_ID, GMB_CLIENT_SECRET, GMB_REFRESH_TOKEN — OAuth credentials
 *   GMB_ACCOUNT_ID, GMB_LOCATION_ID — the business location to fetch reviews for
 *   REVIEW_DB_PATH — path to reviews.jsonl file (default: ./data/reviews.jsonl)
 */

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.REVIEW_DB_PATH || join(__dirname, "..", "data");
const REVIEWS_FILE = join(DATA_DIR, "reviews.jsonl");

// ─── GMB Auth ──────────────────────────────────────────────────────
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
  if (!res.ok) throw new Error(`GMB auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ─── Fetch Reviews ──────────────────────────────────────────────────
async function fetchReviews(token) {
  const accountId = process.env.GMB_ACCOUNT_ID;
  const locationId = process.env.GMB_LOCATION_ID;
  
  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GMB API ${res.status}: ${err.slice(0, 200)}`);
  }
  
  const data = await res.json();
  return data.reviews || [];
}

// ─── Dedup & Store ──────────────────────────────────────────────────
function loadExistingIds() {
  if (!existsSync(REVIEWS_FILE)) return new Set();
  const ids = new Set();
  const lines = readFileSync(REVIEWS_FILE, "utf-8").trim().split("\n");
  for (const line of lines) {
    try {
      const r = JSON.parse(line);
      if (r.reviewId) ids.add(r.reviewId);
    } catch {}
  }
  return ids;
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  
  console.error("Fetching GMB reviews...");
  const token = await getAccessToken();
  const reviews = await fetchReviews(token);
  
  const existingIds = loadExistingIds();
  let newCount = 0;
  
  for (const review of reviews) {
    if (existingIds.has(review.reviewId)) continue;
    
    const record = {
      reviewId: review.reviewId,
      reviewer: review.reviewer?.displayName || "Anonymous",
      starRating: review.starRating,
      comment: review.comment || "",
      createTime: review.createTime,
      updateTime: review.updateTime,
      reply: review.reviewReply?.comment || null,
      fetchedAt: new Date().toISOString(),
    };
    
    appendFileSync(REVIEWS_FILE, JSON.stringify(record) + "\n");
    newCount++;
  }
  
  const total = existingIds.size + newCount;
  console.log(JSON.stringify({ fetched: reviews.length, new: newCount, total, file: REVIEWS_FILE }));
}

main().catch((err) => {
  console.error("fetch-reviews failed:", err.message);
  process.exit(1);
});
