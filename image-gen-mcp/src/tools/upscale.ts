import { z } from 'zod';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { apiPost } from '../api.js';

const DESKTOP_PATH = '/mnt/c/Users/Ahmed Sayed/Desktop';

export const upscaleImageSchema = {
  mediaGenerationId: z.string().describe('The mediaGenerationId from a generated image'),
  resolution: z.enum(['2k', '4k']).default('2k').describe('Target resolution'),
  outputPath: z.string().optional().describe('Output directory (default: Desktop)'),
  filename: z.string().optional().describe('Output filename (default: auto-generated)'),
};

export async function upscaleImage(args: { mediaGenerationId: string; resolution: string; outputPath?: string; filename?: string }) {
  const data = (await apiPost('/images/upscale', {
    mediaGenerationId: args.mediaGenerationId,
    resolution: args.resolution,
  })) as Record<string, unknown>;

  const outputDir = args.outputPath || DESKTOP_PATH;
  const idParts = args.mediaGenerationId.split('-');
  const shortId = idParts.slice(-1)[0]?.substring(0, 8) || Date.now().toString();
  const filename = args.filename || `upscaled_${args.resolution}_${shortId}.png`;
  const filePath = join(outputDir, filename);

  // Try top-level encodedImage first (most common response)
  if (data.encodedImage && typeof data.encodedImage === 'string') {
    const buffer = Buffer.from(data.encodedImage as string, 'base64');
    writeFileSync(filePath, buffer);
    const sizeKB = Math.round(buffer.length / 1024);
    return {
      content: [{ type: 'text' as const, text: `Upscaled to **${args.resolution}**\nSaved: ${filePath}\nSize: ${sizeKB}KB` }],
    };
  }

  // Try nested media[].image.generatedImage.encodedImage
  const media = (data.media || []) as Record<string, unknown>[];
  if (media.length > 0) {
    const item = media[0] as Record<string, Record<string, Record<string, string>>>;
    const encoded = item?.image?.generatedImage?.encodedImage;
    if (encoded) {
      const buffer = Buffer.from(encoded, 'base64');
      writeFileSync(filePath, buffer);
      const sizeKB = Math.round(buffer.length / 1024);
      return {
        content: [{ type: 'text' as const, text: `Upscaled to **${args.resolution}**\nSaved: ${filePath}\nSize: ${sizeKB}KB` }],
      };
    }
  }

  // Fallback: URL-based response
  if (data.url) {
    return {
      content: [{ type: 'text' as const, text: `Upscaled to **${args.resolution}**\nURL: ${data.url}` }],
    };
  }

  return {
    content: [{ type: 'text' as const, text: `Upscaled but could not extract image. Response keys: ${Object.keys(data).join(', ')}` }],
    isError: true,
  };
}
