import { z } from 'zod';
import { readFileSync } from 'fs';
import { extname } from 'path';
import { apiPostBinary, apiGet } from '../api.js';

export const uploadAssetSchema = {
  filePath: z.string().describe('Local file path to the image to upload'),
  email: z.string().optional().describe('Specific account email (default: all accounts)'),
};

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

export async function uploadAsset(args: { filePath: string; email?: string }) {
  const ext = extname(args.filePath).toLowerCase();
  const mimeType = MIME_MAP[ext] || 'image/png';
  const buffer = Buffer.from(readFileSync(args.filePath));

  if (args.email) {
    const data = (await apiPostBinary(`/assets/${encodeURIComponent(args.email)}`, buffer, mimeType)) as Record<string, unknown>;
    const mgId = (data.mediaGenerationId as Record<string, unknown>)?.mediaGenerationId || data.mediaGenerationId;
    return {
      content: [{ type: 'text' as const, text: `Uploaded to **${args.email}**\nmediaGenerationId: \`${mgId}\`` }],
    };
  }

  // Upload to all accounts
  const accounts = (await apiGet('/accounts')) as Record<string, unknown>;
  const emails = Object.keys(accounts);

  if (emails.length === 0) {
    return {
      content: [{ type: 'text' as const, text: 'No accounts registered. Register an account first.' }],
      isError: true,
    };
  }

  const results = await Promise.allSettled(
    emails.map(async (email) => {
      const data = (await apiPostBinary(`/assets/${encodeURIComponent(email)}`, buffer, mimeType)) as Record<string, unknown>;
      const mgId = (data.mediaGenerationId as Record<string, unknown>)?.mediaGenerationId || data.mediaGenerationId;
      return { email, mediaGenerationId: mgId };
    })
  );

  const successes = results.filter((r): r is PromiseFulfilledResult<{ email: string; mediaGenerationId: unknown }> => r.status === 'fulfilled');

  if (successes.length === 0) {
    const firstErr = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    return {
      content: [{ type: 'text' as const, text: `Upload failed: ${firstErr?.reason?.message || 'Unknown error'}` }],
      isError: true,
    };
  }

  const lines = successes.map((s) => `**${s.value.email}**: \`${s.value.mediaGenerationId}\``);
  return {
    content: [{ type: 'text' as const, text: `Uploaded to ${successes.length}/${emails.length} account(s):\n\n${lines.join('\n')}` }],
  };
}
