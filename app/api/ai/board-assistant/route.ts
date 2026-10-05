/**
 * POST /api/ai/board-assistant — retired.
 *
 * The board portal is a read-only view of basic financials, meeting minutes
 * and governing documents. The board AI assistant read operational data
 * (vendors, owners, work orders) that boards no longer see, so it is off.
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'The board assistant is not available.' }, { status: 410 });
}
