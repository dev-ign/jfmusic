import { readFile, stat } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

// Frontend protection is not DRM: if the browser can play this audio, it can be
// extracted. Real protection: only a short 30-second preview is stored here;
// the full master is never added to the project. In production, replace local
// file serving with a redirect to a signed Cloudinary/S3 URL with a short TTL:
//   return NextResponse.redirect(await getSignedAudioUrl(), { status: 302 });

const AUDIO_PATH = path.join(process.cwd(), 'private', 'audio', 'caramelo-preview.mp3');
const CONTENT_TYPE = 'audio/mpeg';

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export async function GET(req: NextRequest) {
  let fileBuffer: Buffer;
  let fileSize: number;

  try {
    const stats = await stat(AUDIO_PATH);
    fileSize = stats.size;
    fileBuffer = await readFile(AUDIO_PATH);
  } catch {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const rangeHeader = req.headers.get('range');

  if (rangeHeader) {
    // Safely parse the Range header; fall back to full response if malformed.
    const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

      if (
        !isNaN(start) &&
        !isNaN(end) &&
        start >= 0 &&
        end < fileSize &&
        start <= end
      ) {
        const chunkBuffer = bufferToArrayBuffer(fileBuffer).slice(start, end + 1);
        return new NextResponse(chunkBuffer, {
          status: 206,
          headers: {
            'Content-Type': CONTENT_TYPE,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': String(chunkBuffer.byteLength),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'private, no-store',
          },
        });
      }
    }
    // Malformed Range header — fall through to full response
  }

  return new NextResponse(bufferToArrayBuffer(fileBuffer), {
    status: 200,
    headers: {
      'Content-Type': CONTENT_TYPE,
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store',
    },
  });
}
