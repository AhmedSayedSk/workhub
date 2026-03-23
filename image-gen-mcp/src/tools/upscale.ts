import { z } from 'zod';
import { apiPost } from '../api.js';

export const upscaleImageSchema = {
  mediaGenerationId: z.string().describe('The mediaGenerationId from a generated image'),
  resolution: z.enum(['2k', '4k']).default('2k').describe('Target resolution'),
};

export async function upscaleImage(args: { mediaGenerationId: string; resolution: string }) {
  const data = (await apiPost('/images/upscale', {
    mediaGenerationId: args.mediaGenerationId,
    resolution: args.resolution,
  })) as Record<string, unknown>;

  const lines = [`Upscaled to **${args.resolution}**`];
  if (data.url) lines.push(`URL: ${data.url}`);
  else lines.push('```json\n' + JSON.stringify(data, null, 2) + '\n```');

  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
  };
}
