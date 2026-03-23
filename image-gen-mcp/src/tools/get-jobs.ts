import { z } from 'zod';
import { apiGet } from '../api.js';

export const getJobsSchema = {
  options: z.enum(['history', 'executing']).default('history').describe('Job listing mode'),
};

export async function getJobs(args: { options: string }) {
  const data = await apiGet(`/jobs/?options=${args.options}`);
  return {
    content: [{ type: 'text' as const, text: '```json\n' + JSON.stringify(data, null, 2) + '\n```' }],
  };
}
