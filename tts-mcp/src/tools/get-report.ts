import { z } from 'zod';
import { getLog } from '../log.js';

export const getReportSchema = {
  period: z.enum(['all', 'today', 'week', 'month']).default('all').describe('Report period'),
};

export async function getReport(args: { period: string }) {
  const log = getLog();

  if (log.entries.length === 0) {
    return {
      content: [{ type: 'text' as const, text: 'No TTS generation history yet.' }],
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
  const totalDuration = filtered.reduce((sum, e) => sum + e.durationSec, 0);
  const totalCost = filtered.reduce((sum, e) => sum + e.costEstimate, 0);

  // Model breakdown
  const byModel: Record<string, { requests: number; duration: number; cost: number }> = {};
  for (const e of filtered) {
    const key = e.model.replace('gemini-2.5-', '');
    if (!byModel[key]) byModel[key] = { requests: 0, duration: 0, cost: 0 };
    byModel[key].requests++;
    byModel[key].duration += e.durationSec;
    byModel[key].cost += e.costEstimate;
  }

  // Voice breakdown
  const byVoice: Record<string, number> = {};
  for (const e of filtered) {
    byVoice[e.voice] = (byVoice[e.voice] || 0) + 1;
  }

  const mins = Math.floor(totalDuration / 60);
  const secs = Math.round(totalDuration % 60);

  const lines = [
    `## TTS Generation Report (${args.period})`,
    '',
    `**Total requests:** ${totalRequests}`,
    `**Total duration:** ${mins}m ${secs}s`,
    `**Est. cost:** $${totalCost.toFixed(4)}`,
    '',
    '### By Model',
  ];

  for (const [model, stats] of Object.entries(byModel)) {
    const m = Math.floor(stats.duration / 60);
    const s = Math.round(stats.duration % 60);
    lines.push(`- **${model}**: ${stats.requests} requests, ${m}m ${s}s, $${stats.cost.toFixed(4)}`);
  }

  lines.push('', '### By Voice');
  for (const [voice, count] of Object.entries(byVoice)) {
    lines.push(`- **${voice}**: ${count} requests`);
  }

  // Recent 10
  const recent = filtered.slice(-10).reverse();
  if (recent.length > 0) {
    lines.push('', '### Recent Generations');
    for (const e of recent) {
      const time = new Date(e.timestamp).toLocaleString();
      const text = e.text.length > 50 ? e.text.slice(0, 50) + '...' : e.text;
      lines.push(`- ${time} | ${e.voice} | ${e.durationSec}s | "${text}"`);
    }
  }

  if (args.period !== 'all') {
    const allMins = Math.floor(log.totalDurationSec / 60);
    const allSecs = Math.round(log.totalDurationSec % 60);
    lines.push('', `### All-time: ${log.totalRequests} requests, ${allMins}m ${allSecs}s, $${log.totalCostEstimate.toFixed(4)}`);
  }

  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
  };
}
