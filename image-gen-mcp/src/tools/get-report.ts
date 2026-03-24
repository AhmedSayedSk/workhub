import { z } from 'zod';
import { getLog } from '../log.js';

export const getReportSchema = {
  period: z.enum(['all', 'today', 'week', 'month']).default('all').describe('Report period'),
};

export async function getReport(args: { period: string }) {
  const log = getLog();

  if (log.entries.length === 0) {
    return {
      content: [{ type: 'text' as const, text: 'No generation history yet.' }],
    };
  }

  const now = new Date();
  let filtered = log.entries;

  if (args.period === 'today') {
    const todayStr = now.toISOString().slice(0, 10);
    filtered = log.entries.filter((e) => e.timestamp.startsWith(todayStr));
  } else if (args.period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filtered = log.entries.filter((e) => new Date(e.timestamp) >= weekAgo);
  } else if (args.period === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    filtered = log.entries.filter((e) => new Date(e.timestamp) >= monthAgo);
  }

  const totalRequests = filtered.length;
  const totalImages = filtered.reduce((sum, e) => sum + e.imagesGenerated, 0);

  // Model breakdown
  const byModel: Record<string, { requests: number; images: number }> = {};
  for (const e of filtered) {
    if (!byModel[e.model]) byModel[e.model] = { requests: 0, images: 0 };
    byModel[e.model].requests++;
    byModel[e.model].images += e.imagesGenerated;
  }

  // Reference usage
  const withRefs = filtered.filter((e) => e.hadReferences).length;

  const lines = [
    `## Image Generation Report (${args.period})`,
    '',
    `**Total requests:** ${totalRequests}`,
    `**Total images generated:** ${totalImages}`,
    `**With references:** ${withRefs}`,
    '',
    '### By Model',
  ];

  for (const [model, stats] of Object.entries(byModel)) {
    lines.push(`- **${model}**: ${stats.requests} requests, ${stats.images} images`);
  }

  // Recent 10 entries
  const recent = filtered.slice(-10).reverse();
  if (recent.length > 0) {
    lines.push('', '### Recent Generations');
    for (const e of recent) {
      const time = new Date(e.timestamp).toLocaleString();
      const prompt = e.prompt.length > 60 ? e.prompt.slice(0, 60) + '...' : e.prompt;
      lines.push(`- ${time} | ${e.model} | ${e.imagesGenerated} img | "${prompt}"`);
    }
  }

  // All-time totals
  if (args.period !== 'all') {
    lines.push('', `### All-time Totals`);
    lines.push(`- **${log.totalRequests}** requests, **${log.totalImagesGenerated}** images`);
  }

  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
  };
}
