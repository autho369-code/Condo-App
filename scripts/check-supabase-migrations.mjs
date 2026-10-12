#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(projectRoot, "supabase", "migrations");
const argumentsSet = new Set(process.argv.slice(2));
const allowedArguments = new Set(["--audit", "--json", "--help"]);

if (argumentsSet.has("--help")) {
  console.log(`Usage: node scripts/check-supabase-migrations.mjs [--audit] [--json]

Default mode is strict and exits 1 when a migration filename is invalid or a
version prefix is duplicated.

--audit  Report the current legacy findings but exit 0. This is temporary and
         must not be used as the post-reconciliation CI gate.
--json   Emit machine-readable JSON.
--help   Show this help.`);
  process.exit(0);
}

const unknownArguments = [...argumentsSet].filter(
  (argument) => !allowedArguments.has(argument),
);
if (unknownArguments.length > 0) {
  console.error(`Unknown argument(s): ${unknownArguments.join(", ")}`);
  process.exit(2);
}

const auditMode = argumentsSet.has("--audit");
const jsonMode = argumentsSet.has("--json");

// Supabase normally uses a fourteen-digit UTC timestamp. The linked production
// ledger also contains the historic version "0001"; migration fetch must be
// able to preserve that exact version during reconciliation.
const validFilenamePattern = /^(?<version>(?:\d{14}|0001))_(?<name>[a-z0-9][a-z0-9_-]*)\.sql$/;
const numericPrefixPattern = /^(?<version>\d+)_/;

const reviewPatterns = [
  {
    kind: "drop-table",
    severity: "critical",
    expression: /\bdrop\s+table\b/gi,
  },
  {
    kind: "drop-schema",
    severity: "critical",
    expression: /\bdrop\s+schema\b/gi,
  },
  {
    kind: "truncate-table",
    severity: "critical",
    expression: /\btruncate\s+(?:table\s+)?/gi,
  },
  {
    kind: "drop-column",
    severity: "high",
    expression: /\balter\s+table\b[\s\S]{0,500}?\bdrop\s+column\b/gi,
  },
  {
    kind: "delete-rows",
    severity: "review",
    expression: /\bdelete\s+from\b/gi,
  },
  {
    kind: "production-like-seed",
    severity: "high",
    expression: /\binsert\s+into\s+(?:public\.)?payable_bills\b/gi,
  },
];

// From this version on, every CREATE POLICY must name its roles. A policy
// with no TO clause applies to every role, signed-out (anon) included
// (20261012010000_policies_signed_in_only.sql).
const policyRolesRequiredFrom = "20261012010000";
const createPolicyExpression = /\bcreate\s+policy\b[\s\S]*?;/gi;
const policyRolesExpression = /\bto\s+(?:authenticated|anon|service_role)\b/i;

function isRealUtcTimestamp(version) {
  if (version === "0001") return true;
  if (!/^\d{14}$/.test(version)) return false;

  const year = Number(version.slice(0, 4));
  const month = Number(version.slice(4, 6));
  const day = Number(version.slice(6, 8));
  const hour = Number(version.slice(8, 10));
  const minute = Number(version.slice(10, 12));
  const second = Number(version.slice(12, 14));
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day &&
    parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute &&
    parsed.getUTCSeconds() === second
  );
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

// Blanks out -- and /* */ comments (keeping newlines, so line numbers hold)
// and leaves '...' string literals alone.
function withoutSqlComments(source) {
  let result = "";
  let index = 0;
  while (index < source.length) {
    const two = source.slice(index, index + 2);
    if (source[index] === "'") {
      const end = source.indexOf("'", index + 1);
      const stop = end === -1 ? source.length : end + 1;
      result += source.slice(index, stop);
      index = stop;
    } else if (two === "--") {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end;
      result += " ".repeat(stop - index);
      index = stop;
    } else if (two === "/*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end + 2;
      result += source.slice(index, stop).replace(/[^\n]/g, " ");
      index = stop;
    } else {
      result += source[index];
      index += 1;
    }
  }
  return result;
}

function formatRelative(filename) {
  return path.posix.join("supabase", "migrations", filename);
}

async function inspect() {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const valid = [];
  const invalid = [];
  const filesByVersion = new Map();
  const reviewFlags = [];
  const policiesWithoutRoles = [];

  for (const filename of filenames) {
    const validMatch = filename.match(validFilenamePattern);
    const prefixMatch = filename.match(numericPrefixPattern);

    if (
      validMatch?.groups &&
      isRealUtcTimestamp(validMatch.groups.version)
    ) {
      valid.push({
        filename,
        version: validMatch.groups.version,
        name: validMatch.groups.name,
      });
    } else {
      invalid.push(filename);
    }

    if (prefixMatch?.groups) {
      const version = prefixMatch.groups.version;
      const versionFiles = filesByVersion.get(version) ?? [];
      versionFiles.push(filename);
      filesByVersion.set(version, versionFiles);
    }

    const absolutePath = path.join(migrationsDirectory, filename);
    const source = await readFile(absolutePath, "utf8");

    if (validMatch?.groups && validMatch.groups.version >= policyRolesRequiredFrom) {
      const code = withoutSqlComments(source);
      const policies = new RegExp(createPolicyExpression.source, createPolicyExpression.flags);
      let policy;
      while ((policy = policies.exec(code)) !== null) {
        if (!policyRolesExpression.test(policy[0])) {
          policiesWithoutRoles.push({ filename, line: lineNumberAt(code, policy.index) });
        }
      }
    }

    for (const pattern of reviewPatterns) {
      const expression = new RegExp(pattern.expression.source, pattern.expression.flags);
      let match;
      let matchesForPattern = 0;

      while ((match = expression.exec(source)) !== null && matchesForPattern < 5) {
        reviewFlags.push({
          filename,
          line: lineNumberAt(source, match.index),
          kind: pattern.kind,
          severity: pattern.severity,
        });
        matchesForPattern += 1;

        // Defensive guard for a future zero-width expression.
        if (match.index === expression.lastIndex) expression.lastIndex += 1;
      }
    }
  }

  const duplicateVersions = [...filesByVersion.entries()]
    .filter(([, versionFiles]) => versionFiles.length > 1)
    .map(([version, versionFiles]) => ({ version, files: versionFiles.sort() }))
    .sort((left, right) => left.version.localeCompare(right.version));

  return {
    mode: auditMode ? "audit" : "strict",
    migrationsDirectory: path.relative(projectRoot, migrationsDirectory),
    summary: {
      sqlFiles: filenames.length,
      validFilenames: valid.length,
      invalidFilenames: invalid.length,
      uniqueNumericVersions: filesByVersion.size,
      duplicateVersions: duplicateVersions.length,
      destructiveReviewFlags: reviewFlags.length,
      policiesWithoutRoles: policiesWithoutRoles.length,
    },
    invalidFilenames: invalid,
    duplicateVersions,
    destructiveReviewFlags: reviewFlags,
    policiesWithoutRoles,
    failed: invalid.length > 0 || duplicateVersions.length > 0 || policiesWithoutRoles.length > 0,
  };
}

function printText(report) {
  console.log(`Supabase migration check (${report.mode} mode)`);
  console.log(`Directory: ${report.migrationsDirectory}`);
  console.log(
    `SQL files: ${report.summary.sqlFiles}; valid names: ${report.summary.validFilenames}; ` +
      `invalid names: ${report.summary.invalidFilenames}`,
  );
  console.log(
    `Unique numeric versions: ${report.summary.uniqueNumericVersions}; ` +
      `duplicate version groups: ${report.summary.duplicateVersions}`,
  );

  if (report.invalidFilenames.length > 0) {
    console.log("\nInvalid migration filenames:");
    for (const filename of report.invalidFilenames) {
      console.log(`- ${formatRelative(filename)}`);
    }
  }

  if (report.duplicateVersions.length > 0) {
    console.log("\nDuplicate version prefixes:");
    for (const duplicate of report.duplicateVersions) {
      console.log(`- ${duplicate.version}`);
      for (const filename of duplicate.files) {
        console.log(`  - ${formatRelative(filename)}`);
      }
    }
  }

  if (report.policiesWithoutRoles.length > 0) {
    console.log("\nCREATE POLICY without a TO clause (it applies to signed-out callers too; add `to authenticated`):");
    for (const policy of report.policiesWithoutRoles) {
      console.log(`- ${formatRelative(policy.filename)}:${policy.line}`);
    }
  }

  if (report.destructiveReviewFlags.length > 0) {
    console.log("\nSQL requiring manual review (warning only):");
    for (const flag of report.destructiveReviewFlags) {
      console.log(
        `- [${flag.severity}] ${formatRelative(flag.filename)}:${flag.line} (${flag.kind})`,
      );
    }
  }

  if (report.failed && report.mode === "strict") {
    console.error(
      "\nFAILED: active migration history has invalid filenames, duplicate versions " +
        "or a new CREATE POLICY without a TO clause. " +
        "Use --audit only to inventory the pre-reconciliation legacy state.",
    );
  } else if (report.failed) {
    console.log(
      "\nAUDIT ONLY: legacy integrity findings were reported without failing the command.",
    );
  } else {
    console.log("\nPASSED: migration filenames and version prefixes are valid and unique.");
  }
}

try {
  const report = await inspect();

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printText(report);
  }

  process.exitCode = report.failed && !auditMode ? 1 : 0;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonMode) {
    console.error(JSON.stringify({ error: message }, null, 2));
  } else {
    console.error(`Migration check could not run: ${message}`);
  }
  process.exitCode = 2;
}
