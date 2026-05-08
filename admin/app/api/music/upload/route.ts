import { NextRequest, NextResponse } from 'next/server';
import { AdminApiError, requireAdminPermission } from '@/lib/admin-api-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_MP3_SIZE_BYTES = 25 * 1024 * 1024;

const ACCEPTED_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/mpeg3',
  'audio/mpg', 'audio/x-mpeg-3', 'application/octet-stream',
]);

function isMp3(file: File): boolean {
  return file.name.toLowerCase().endsWith('.mp3') ||
    ACCEPTED_TYPES.has((file.type || '').toLowerCase());
}

function sanitize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'track';
}

async function uploadToCloudinary(buffer: Buffer, publicId: string): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials not configured. Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in admin/.env.local');
  }

  // Build signed upload params — must be alphabetically sorted, resource_type excluded from signature
  const timestamp = Math.floor(Date.now() / 1000);
  const folder    = 'mavrixfy/songs';
  // Cloudinary signature: alphabetically sorted params (excluding api_key, resource_type, file)
  const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`;

  // Generate SHA-1 signature
  const { createHash } = await import('crypto');
  const signature = createHash('sha1')
    .update(paramsToSign + apiSecret)
    .digest('hex');

  // Build multipart form
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: 'audio/mpeg' }), `${publicId}.mp3`);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('public_id', publicId);
  form.append('folder', folder);
  form.append('resource_type', 'video'); // Cloudinary uses 'video' for audio files

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    { method: 'POST', body: form }
  );

  const json = await res.json() as any;

  if (!res.ok || !json.secure_url) {
    throw new Error(json.error?.message || `Cloudinary upload failed: ${res.status}`);
  }

  return json.secure_url as string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminPermission(request, 'catalog.manage');

    const formData = await request.formData();
    const uploaded = formData.get('file');

    if (!(uploaded instanceof File)) {
      return NextResponse.json({ success: false, message: 'MP3 file is required.' }, { status: 400 });
    }
    if (uploaded.size === 0) {
      return NextResponse.json({ success: false, message: 'The selected file is empty.' }, { status: 400 });
    }
    if (uploaded.size > MAX_MP3_SIZE_BYTES) {
      return NextResponse.json({ success: false, message: 'MP3 file must be 25 MB or smaller.' }, { status: 400 });
    }
    if (!isMp3(uploaded)) {
      return NextResponse.json({ success: false, message: 'Only MP3 files are supported.' }, { status: 400 });
    }

    const originalName = uploaded.name || 'track.mp3';
    const baseName  = sanitize(originalName.replace(/\.mp3$/i, ''));
    const publicId  = `${Date.now()}-${baseName}`;
    const buffer    = Buffer.from(await uploaded.arrayBuffer());
    const uploadedAt = new Date().toISOString();

    const audioUrl = await uploadToCloudinary(buffer, publicId);

    return NextResponse.json({
      success: true,
      data: {
        audioUrl,
        streamUrl: audioUrl,
        storagePath: `mavrixfy/songs/${publicId}`,
        fileName: originalName,
        fileSize: uploaded.size,
        mimeType: 'audio/mpeg',
        bucket: 'cloudinary',
        uploadedAt,
      },
    });

  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error('[music/upload]', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to upload song file.' },
      { status: 500 }
    );
  }
}
