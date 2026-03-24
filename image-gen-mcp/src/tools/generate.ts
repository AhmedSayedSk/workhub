import { z } from 'zod';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { apiPost } from '../api.js';
import { logGeneration } from '../log.js';

const DESKTOP_PATH = '/mnt/c/Users/Ahmed Sayed/Desktop';

export const generateImageSchema = {
  prompt: z.string().describe('The image generation prompt'),
  model: z.string().default('nano-banana-pro').describe('Model: nano-banana-pro, nano-banana-2, imagen-4'),
  aspectRatio: z.enum(['16:9', '4:3', '1:1', '3:4', '9:16']).default('16:9').describe('Image aspect ratio'),
  count: z.number().min(1).max(4).default(4).describe('Number of images to generate (1-4)'),
  seed: z.number().optional().describe('Seed for reproducible generation'),
  email: z.string().optional().describe('Specific Google account email to use'),
  references: z.array(z.string()).optional().describe('Array of mediaGenerationIds to use as reference images'),
};

export async function generateImage(args: {
  prompt: string;
  model: string;
  aspectRatio: string;
  count: number;
  seed?: number;
  email?: string;
  references?: string[];
}) {
  const body: Record<string, unknown> = {
    prompt: args.prompt,
    model: args.model,
    count: args.count,
    captchaRetry: 5,
  };

  if (args.aspectRatio) {
    body.aspectRatio = args.aspectRatio;
  }
  if (args.seed !== undefined) body.seed = args.seed;
  if (args.email) body.email = args.email;
  if (args.references) {
    args.references.forEach((ref, i) => {
      if (i < 10) body[`reference_${i + 1}`] = ref;
    });
  }

  const data = (await apiPost('/images', body)) as Record<string, unknown>;
  const media = (data.media || []) as Record<string, unknown>[];
  const images = media
    .filter((item) => item?.image)
    .map((item) => {
      const typed = item as {
        image: { generatedImage: { fifeUrl: string; seed?: number; mediaGenerationId?: string } };
      };
      return {
        url: typed.image.generatedImage.fifeUrl,
        seed: typed.image.generatedImage.seed,
        mediaGenerationId: typed.image.generatedImage.mediaGenerationId,
      };
    });

  if (images.length === 0) {
    return {
      content: [{ type: 'text' as const, text: 'No images generated. Try a different prompt.' }],
      isError: true,
    };
  }

  // Download images to Desktop
  const timestamp = Date.now();
  const savedPaths: string[] = [];
  for (let i = 0; i < images.length; i++) {
    try {
      const res = await fetch(images[i].url);
      const buffer = Buffer.from(await res.arrayBuffer());
      const filename = `image_${timestamp}_${i + 1}.png`;
      const filePath = join(DESKTOP_PATH, filename);
      writeFileSync(filePath, buffer);
      savedPaths.push(filePath);
    } catch {
      savedPaths.push('(download failed)');
    }
  }

  // Log the generation
  logGeneration({
    timestamp: new Date().toISOString(),
    prompt: args.prompt,
    model: args.model,
    aspectRatio: args.aspectRatio,
    count: args.count,
    imagesGenerated: images.length,
    seed: args.seed,
    email: args.email,
    hadReferences: !!(args.references && args.references.length > 0),
    savedPaths,
  });

  const lines = images.map((img, i) => {
    const parts = [`**Image ${i + 1}**`];
    parts.push(`Saved: ${savedPaths[i]}`);
    if (img.seed !== undefined) parts.push(`Seed: ${img.seed}`);
    if (img.mediaGenerationId) parts.push(`ID: ${img.mediaGenerationId}`);
    return parts.join('\n');
  });

  return {
    content: [{ type: 'text' as const, text: `Generated ${images.length} image(s):\n\n${lines.join('\n\n')}` }],
  };
}
