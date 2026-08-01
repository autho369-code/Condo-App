// Canonical entrypoint required by the Portier369 stabilization audit.
// The imported script owns staging-ref validation, deterministic IDs, and error handling.
await import('./seed-staging-verification.mjs')
