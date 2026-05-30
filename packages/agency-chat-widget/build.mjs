// Simple build — copy + minify the widget
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const src = readFileSync("src/widget.js", "utf-8");

// Basic minification: strip comments, collapse whitespace
let min = src
  .replace(/\/\*[\s\S]*?\*\//g, "")  // block comments
  .replace(/\/\/.*$/gm, "")           // line comments
  .replace(/^\s+|\s+$/gm, "")         // trim lines
  .replace(/\n\s*\n/g, "\n")          // collapse blank lines
  .replace(/\s{2,}/g, " ");           // collapse spaces

mkdirSync("dist", { recursive: true });
writeFileSync("dist/widget.js", min);
writeFileSync("dist/widget.debug.js", src);

const kb = (min.length / 1024).toFixed(1);
console.log(`Built: dist/widget.js (${kb} KB), dist/widget.debug.js (${(src.length / 1024).toFixed(1)} KB)`);
