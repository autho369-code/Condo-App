import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({ error: "dev only" }, { status: 403 });
  const { filePath, content } = await req.json();
  const full = path.join(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  return NextResponse.json({ ok: true });
}
