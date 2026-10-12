---
name: csp
description: Enforced nonce CSP from middleware (lib/server/csp.ts, 2026-10-11) -- what breaks under it and what to check
metadata:
  type: project
---

- Enforced policy set per request in `middleware.ts` (nonce, no 'unsafe-inline'); marketing + public assets keep report-only. Paths skipped by the middleware matcher (`*.png` etc.) get NO CSP.
- Blob/data/about:blank documents INHERIT the creator page's CSP. `window.open(URL.createObjectURL(html))` print docs with an inline `<script>` (letters preview, `components/letters/batch-letters.tsx`) need their script allowed: the only allowed one is `PRINT_ON_LOAD_SCRIPT` (`lib/print-script.ts`) via `PRINT_SCRIPT_HASH`, interpolated byte-exact as `<script>${PRINT_ON_LOAD_SCRIPT}</script>` (any whitespace breaks the hash). Pattern reused by `components/export/export-actions.tsx` printFromTables; check every value goes through `escapeHtmlText`.
- Prerendered HTML (e.g. `/_not-found`) served under the enforced policy has no nonce: scripts blocked. Any new static/ISR app page breaks the same way.
- Offline SW (`app/(app)/violations/sw.js`) caches the page with its headers, so cached nonce + CSP stay a matching pair.
- New inline `<script>` / `next/script` in app pages: needs the nonce (`x-nonce` request header).
