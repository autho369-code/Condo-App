// The one inline script our print windows run (letters preview and batch
// letters). Those windows are blob: documents, which take on the opening
// page's Content Security Policy, so the policy allows exactly this text by
// its hash (PRINT_SCRIPT_HASH in lib/server/csp.ts; a test keeps them equal).
export const PRINT_ON_LOAD_SCRIPT = "window.addEventListener('load', function () { window.print(); });";
