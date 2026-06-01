import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({ error: "dev only" }, { status: 403 });
  const { filePath } = await req.json();
  const full = path.join(process.cwd(), filePath);
  if (!fs.existsSync(full)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const content = fs.readFileSync(full, "utf8");
  return NextResponse.json({ content });
}