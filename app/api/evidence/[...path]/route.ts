import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "storage", "evidence");

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { path: parts } = await params;
  const filename = parts.join("/");
  // Prevent path traversal — only allow the exact filename pattern we generate on upload.
  if (filename.includes("..") || filename.includes("/")) {
    return new NextResponse("Invalid path", { status: 400 });
  }

  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    const buf = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `inline; filename="${filename}"` },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
