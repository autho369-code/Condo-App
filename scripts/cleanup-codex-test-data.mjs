// Canonical entrypoint required by the Portier369 stabilization audit.
// The imported script owns staging-ref validation, fixture ownership checks, and exact-ID cleanup.
await import('./cleanup-staging-verification.mjs')
