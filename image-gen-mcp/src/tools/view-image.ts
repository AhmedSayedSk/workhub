import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { extname, basename } from 'path';

export const viewImageSchema = {
  filePath: z.string().describe('Absolute path to the image file on this machine'),
};

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

export async function viewImage(args: { filePath: string }) {
  if (!existsSync(args.filePath)) {
    return {
      content: [{ type: 'text' as const, text: `File not found: ${args.filePath}` }],
      isError: true,
    };
  }

  const ext = extname(args.filePath).toLowerCase();
  const mimeType = MIME_MAP[ext];
  if (!mimeType) {
    return {
      content: [{ type: 'text' as const, text: `Unsupported image format: ${ext}. Supported: ${Object.keys(MIME_MAP).join(', ')}` }],
      isError: true,
    };
  }

  const buffer = readFileSync(args.filePath);
  const base64 = buffer.toString('base64');
  const sizeKB = Math.round(buffer.length / 1024);

  return {
    content: [
      {
        type: 'image' as const,
        data: base64,
        mimeType,
      },
      {
        type: 'text' as const,
        text: `**${basename(args.filePath)}** (${sizeKB} KB, ${mimeType})`,
      },
    ],
  };
}
