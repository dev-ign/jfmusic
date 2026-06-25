import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'private', 'images', 'caramelo-cover.png');
    const file = await readFile(filePath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
        // Frontend protection is not DRM: if the browser can render this image,
        // it can be extracted. Real protection comes from not serving the full master
        // and switching to signed URLs with short TTLs (Cloudinary / S3) in production.
      },
    });
  } catch {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }
}
