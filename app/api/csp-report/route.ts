import { NextResponse } from 'next/server';

// Browsers POST here when the Content Security Policy blocks something
// (report-uri in lib/server/csp.ts). We only log a short summary so a real
// breakage after a release shows up in the Vercel logs; nothing is stored.
// Public (browsers may send reports without the session cookie) and capped.

const MAX_BYTES = 8_000;

function pick(report: Record<string, unknown>) {
  const s = (v: unknown) => (typeof v === 'string' ? v.slice(0, 200) : undefined);
  let page: string | undefined;
  try {
    page = new URL(String(report['document-uri'] ?? report.documentURL ?? '')).pathname;
  } catch {
    page = undefined;
  }
  return {
    page,
    directive: s(report['effective-directive'] ?? report['violated-directive'] ?? report.effectiveDirective),
    blocked: s(report['blocked-uri'] ?? report.blockedURL),
    source: s(report['source-file'] ?? report.sourceFile),
    line: typeof report['line-number'] === 'number' ? report['line-number'] : report.lineNumber,
  };
}

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BYTES) return new NextResponse(null, { status: 413 });
  const text = (await request.text()).slice(0, MAX_BYTES);
  try {
    const body = JSON.parse(text);
    const reports = Array.isArray(body) ? body.map((r) => r?.body ?? r) : [body?.['csp-report'] ?? body];
    for (const report of reports.slice(0, 5)) {
      if (report && typeof report === 'object') console.warn('[csp] blocked', JSON.stringify(pick(report)));
    }
  } catch {
    // Not JSON: ignore.
  }
  return new NextResponse(null, { status: 204 });
}
