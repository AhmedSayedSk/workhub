import { z } from 'zod';
import { apiPost } from '../api.js';

export const registerAccountSchema = {
  cookies: z.string().describe('Google session cookies string'),
};

export async function registerAccount(args: { cookies: string }) {
  const data = (await apiPost('/accounts', { cookies: args.cookies })) as Record<string, unknown>;

  const lines = ['Account registered successfully.'];
  if (data.email) lines.push(`Email: **${data.email}**`);
  lines.push('```json\n' + JSON.stringify(data, null, 2) + '\n```');

  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
  };
}
