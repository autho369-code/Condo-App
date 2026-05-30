#!/usr/bin/env node
/**
 * Content Calendar Builder
 * Takes generated scripts and schedules them across a month on a posting calendar.
 * Outputs a JSON calendar that can be consumed by auto-posting pipeline.
 * 
 * Usage: node build-calendar.mjs --scripts scripts.json --start 2026-06-01
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PLATFORMS = ["tiktok", "instagram_reels", "youtube_shorts"];
const BEST_TIMES = {
  tiktok: ["07:00", "12:00", "18:00", "21:00"],
  instagram_reels: ["08:00", "12:30", "17:00", "20:00"],
  youtube_shorts: ["09:00", "13:00", "18:30"],
};

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function pickTime(platform, index) {
  const times = BEST_TIMES[platform];
  return times[index % times.length];
}

async function main() {
  const scriptsIdx = process.argv.indexOf("--scripts");
  const startIdx = process.argv.indexOf("--start");
  const scriptsPath = scriptsIdx >= 0 ? process.argv[scriptsIdx + 1] : join(__dirname, "..", "output", "scripts-latest.json");
  const startDate = startIdx >= 0 ? new Date(process.argv[startIdx + 1]) : new Date();

  const { scripts, brand } = JSON.parse(readFileSync(scriptsPath, "utf-8"));

  const calendar = [];
  let slotIndex = 0;

  for (let day = 0; day < 30; day++) {
    const date = addDays(startDate, day);
    const dateStr = date.toISOString().split("T")[0];

    // 1 post per day, rotating through scripts and platforms
    const script = scripts[day % scripts.length];
    const platform = PLATFORMS[day % PLATFORMS.length];
    const time = pickTime(platform, slotIndex);

    calendar.push({
      id: `slot-${String(slotIndex + 1).padStart(3, "0")}`,
      date: dateStr,
      time,
      platform,
      script: script.hook?.slice(0, 80) + "...",
      fullScript: script,
      hashtags: script.hashtags || [],
      status: "scheduled",
    });

    slotIndex++;
  }

  const outFile = join(dirname(scriptsPath), `calendar-${Date.now()}.json`);
  writeFileSync(outFile, JSON.stringify({
    generated: new Date().toISOString(),
    brand,
    startDate: startDate.toISOString().split("T")[0],
    endDate: addDays(startDate, 29).toISOString().split("T")[0],
    platforms: PLATFORMS,
    totalSlots: calendar.length,
    calendar,
  }, null, 2));

  console.log(JSON.stringify({ scheduled: calendar.length, days: 30, file: outFile }));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
