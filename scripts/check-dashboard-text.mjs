import { readFileSync } from 'node:fs';

const dashboardPath = 'app/(app)/dashboard/page.tsx';
const source = readFileSync(dashboardPath, 'utf8');

const mojibakePatterns = [
  /[\u00c2\u00c3\u00c5\u00e2\u00f0]/u,
];

const lines = source.split(/\r?\n/);
const hits = lines
  .map((line, index) => ({ line, number: index + 1 }))
  .filter(({ line }) => mojibakePatterns.some((pattern) => pattern.test(line)));

if (hits.length > 0) {
  console.error(`${dashboardPath} contains likely mojibake text:`);
  for (const hit of hits) {
    console.error(`${hit.number}: ${hit.line.trim()}`);
  }
  process.exit(1);
}

console.log(`${dashboardPath} text looks clean.`);
