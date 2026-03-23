import { z } from 'zod';
import { apiDelete } from '../api.js';

export const deleteAccountSchema = {
  email: z.string().describe('Email of the Google account to remove'),
};

export async function deleteAccount(args: { email: string }) {
  const data = await apiDelete(`/accounts/${encodeURIComponent(args.email)}`);
  return {
    content: [{ type: 'text' as const, text: `Account **${args.email}** deleted.\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }],
  };
}
