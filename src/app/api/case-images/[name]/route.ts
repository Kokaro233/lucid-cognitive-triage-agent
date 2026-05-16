import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;

  if (!/^[a-z0-9-]+\.png$/i.test(name)) {
    return NextResponse.json({ error: "Invalid image name" }, { status: 400 });
  }

  const imagePath = path.join(process.cwd(), "public", "cases", name);

  try {
    const image = await readFile(imagePath);

    return new NextResponse(image, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "image/png",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
