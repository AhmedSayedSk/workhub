import { apiGet } from '../api.js';

export async function listAccounts() {
  const data = (await apiGet('/accounts')) as Record<string, Record<string, unknown>>;
  const emails = Object.keys(data);

  if (emails.length === 0) {
    return {
      content: [{ type: 'text' as const, text: 'No Google accounts registered. Use `register_account` to add one.' }],
    };
  }

  const lines = emails.map((email) => {
    const acc = data[email];
    const parts = [`**${email}**`];
    if (acc.health) parts.push(`Health: ${acc.health}`);
    if (acc.sessionExpiry) parts.push(`Session expires: ${acc.sessionExpiry}`);
    if (acc.error) parts.push(`Error: ${acc.error}`);
    return parts.join(' | ');
  });

  return {
    content: [{ type: 'text' as const, text: `**${emails.length} account(s):**\n\n${lines.join('\n')}` }],
  };
}
