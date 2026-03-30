import { z } from 'zod';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { generateSpeech, estimateCost } from '../api.js';
import { logGeneration } from '../log.js';

export const generateMultivoiceStorySchema = {
  storyJsonPath: z.string().describe('Path to story JSON with "segments" array (each has "speaker" and "text") and a "characters" map'),
  model: z.enum(['gemini-2.5-flash-tts', 'gemini-2.5-pro-tts'])
    .default('gemini-2.5-flash-tts').describe('TTS model'),
  language: z.string().default('ar-EG').describe('Language code'),
  fromSegment: z.number().optional().describe('Start from this segment number (1-based). Use to test a range.'),
  toSegment: z.number().optional().describe('End at this segment number (inclusive). Use to test a range.'),
  skipMerge: z.boolean().default(false).describe('If true, keep individual segment WAV files without merging — useful for testing.'),
};

interface CharacterConfig {
  voice: string;
  description?: string;
  stylePrompt?: string;
  name_ar?: string;
}

interface ResolvedSegment {
  text: string;
  voice: string;
  character: string;
  stylePrompt: string;
}

interface StoryJson {
  title?: string;
  characters?: Record<string, CharacterConfig>;
  // New format: direct segments array
  segments?: { speaker: string; text: string }[];
  // Legacy format: pages with [tag] markers
  pages?: { narration?: string; text?: string }[];
}

/**
 * Merge consecutive segments from the same speaker into one.
 * This avoids unnecessary TTS calls and sounds more natural.
 */
function mergeConsecutiveSpeakers(segments: ResolvedSegment[]): ResolvedSegment[] {
  if (segments.length === 0) return [];

  const merged: ResolvedSegment[] = [{ ...segments[0] }];

  for (let i = 1; i < segments.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = segments[i];

    if (curr.character === prev.character) {
      // Same speaker — merge text
      prev.text += ' ' + curr.text;
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}

/**
 * Parse legacy [tag] format into segments (backward compatibility).
 */
function parseTaggedText(
  text: string,
  characters: Record<string, CharacterConfig>
): ResolvedSegment[] {
  const segments: ResolvedSegment[] = [];
  const narratorConfig = characters['narrator'] || { voice: 'Sulafat', stylePrompt: '' };

  const parts = text.split(/\[([a-zA-Z_]+)\]/);

  for (let i = 1; i < parts.length; i += 2) {
    const tag = parts[i].toLowerCase();
    const content = (parts[i + 1] || '').trim();
    if (!content) continue;

    const charConfig = characters[tag];
    segments.push({
      text: content,
      voice: charConfig?.voice || narratorConfig.voice,
      character: tag,
      stylePrompt: charConfig?.stylePrompt || charConfig?.description || narratorConfig.stylePrompt || '',
    });
  }

  return segments;
}

/**
 * Resolve segments from story JSON — supports both new and legacy formats.
 */
function resolveSegments(story: StoryJson): ResolvedSegment[] {
  const characters = story.characters || {};
  const narratorConfig = characters['narrator'] || { voice: 'Sulafat', stylePrompt: '' };

  // New format: direct segments array
  if (story.segments && Array.isArray(story.segments) && story.segments.length > 0) {
    return story.segments.map(seg => {
      const charConfig = characters[seg.speaker];
      return {
        text: seg.text,
        voice: charConfig?.voice || narratorConfig.voice,
        character: seg.speaker,
        stylePrompt: charConfig?.stylePrompt || charConfig?.description || narratorConfig.stylePrompt || '',
      };
    }).filter(seg => seg.text.trim().length > 0);
  }

  // Legacy format: pages with [tag] markers
  if (story.pages && Array.isArray(story.pages) && story.pages.length > 0) {
    const fullNarration = story.pages.map(p => p.narration || p.text || '').join('\n\n');
    if (/\[[a-zA-Z_]+\]/.test(fullNarration)) {
      return parseTaggedText(fullNarration, characters);
    }
  }

  return [];
}

function generateSilenceWav(durationMs: number, sampleRate: number): Buffer {
  const numSamples = Math.floor((durationMs / 1000) * sampleRate);
  const dataLength = numSamples * 2;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);

  return Buffer.concat([header, Buffer.alloc(dataLength)]);
}

export async function generateMultivoiceStory(args: {
  storyJsonPath: string;
  model: string;
  language: string;
  fromSegment?: number;
  toSegment?: number;
  skipMerge: boolean;
}) {
  const jsonContent = readFileSync(args.storyJsonPath, 'utf-8');
  const story: StoryJson = JSON.parse(jsonContent);

  if (!story.characters) {
    return { content: [{ type: 'text' as const, text: 'Error: JSON must have a "characters" map with voice assignments.' }], isError: true };
  }

  // Resolve segments from either new or legacy format
  const rawSegments = resolveSegments(story);
  if (rawSegments.length === 0) {
    return {
      content: [{ type: 'text' as const, text: 'Error: No segments found. JSON must have either a "segments" array or "pages" with [speaker] tags.' }],
      isError: true,
    };
  }

  // Merge consecutive same-speaker segments
  const allSegments = mergeConsecutiveSpeakers(rawSegments);

  // Apply range filter (1-based)
  const from = args.fromSegment ? args.fromSegment - 1 : 0;
  const to = args.toSegment ? args.toSegment : allSegments.length;
  const segments = allSegments.slice(from, to);
  const rangeInfo = (args.fromSegment || args.toSegment)
    ? ` (range: ${from + 1}-${to} of ${allSegments.length} total)`
    : '';

  const title = story.title || 'multivoice-story';
  const safeTitle = title.replace(/[^a-zA-Z0-9\u0600-\u06FF -]/g, '').replace(/\s+/g, '-').substring(0, 50);
  const baseDir = dirname(args.storyJsonPath);
  const outputDir = args.skipMerge ? join(baseDir, `${safeTitle}-segments`) : join(baseDir, `_temp_multivoice`);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const silenceFile = join(outputDir, 'silence.wav');
  writeFileSync(silenceFile, generateSilenceWav(300, 24000));

  const segFiles: { path: string; character: string }[] = [];
  let totalDuration = 0;
  let totalCost = 0;
  const voiceUsage: Record<string, number> = {};

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segNum = from + i;
    const segFile = join(outputDir, `seg_${String(segNum + 1).padStart(3, '0')}_${seg.character}.wav`);

    try {
      const result = await generateSpeech({
        text: seg.text,
        voiceName: seg.voice,
        model: args.model,
        languageCode: args.language,
        stylePrompt: seg.stylePrompt,
        audioEncoding: 'LINEAR16',
        sampleRate: 24000,
      });

      writeFileSync(segFile, result.audioBuffer);
      segFiles.push({ path: segFile, character: seg.character });
      totalDuration += result.durationSec;
      totalCost += estimateCost(seg.text.length, args.model);

      const key = `${seg.character} (${seg.voice})`;
      voiceUsage[key] = (voiceUsage[key] || 0) + 1;

      const preview = seg.text.length > 35 ? seg.text.slice(0, 35) + '...' : seg.text;
      process.stderr.write(`  [${i + 1}/${segments.length}] [${seg.character}] ${seg.voice} — "${preview}"\n`);

      if (i < segments.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      process.stderr.write(`  [${i + 1}/${segments.length}] ERROR: ${msg}\n`);
    }
  }

  if (segFiles.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No audio segments generated.' }], isError: true };
  }

  // Skip merge mode
  if (args.skipMerge) {
    try { unlinkSync(silenceFile); } catch {}
    const mins = Math.floor(totalDuration / 60);
    const secs = Math.round(totalDuration % 60);
    const lines = [
      `## Segments Generated${rangeInfo}`,
      `Folder: ${outputDir}`,
      `Segments: **${segFiles.length}** | Duration: **${mins}m ${secs}s** | Cost: **$${totalCost.toFixed(4)}**`,
      '',
      ...segFiles.map((s, i) => `- ${i + 1}. [${s.character}] ${segments[i].text.substring(0, 40)}...`),
    ];
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  }

  // Build concat list with silence between speaker changes
  const concatFile = join(outputDir, 'concat.txt');
  const concatLines: string[] = [];
  let prevChar = '';

  for (const seg of segFiles) {
    if (prevChar && seg.character !== prevChar) {
      concatLines.push(`file '${silenceFile}'`);
    }
    concatLines.push(`file '${seg.path}'`);
    prevChar = seg.character;
  }

  writeFileSync(concatFile, concatLines.join('\n'));

  const rangeSuffix = rangeInfo ? `_${from + 1}-${to}` : '';
  const mergedFile = join(baseDir, `${safeTitle}_multivoice${rangeSuffix}.wav`);

  try {
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -ar 24000 -ac 1 -c:a pcm_s16le "${mergedFile}"`,
      { stdio: 'pipe' }
    );
  } catch (e) {
    return { content: [{ type: 'text' as const, text: `Merge failed: ${e}` }], isError: true };
  }

  // Clean up
  for (const seg of segFiles) {
    try { unlinkSync(seg.path); } catch {}
  }
  try { unlinkSync(silenceFile); } catch {}
  try { unlinkSync(concatFile); } catch {}
  try { execSync(`rmdir "${outputDir}" 2>/dev/null`); } catch {}

  const mins = Math.floor(totalDuration / 60);
  const secs = Math.round(totalDuration % 60);

  const lines = [
    `## Multi-Voice Story: "${title}"${rangeInfo}`,
    `Saved: ${mergedFile}`,
    `Duration: **${mins}m ${secs}s** | Segments: **${segFiles.length}** | Cost: **$${totalCost.toFixed(4)}**`,
    '',
    '### Voice Usage',
    ...Object.entries(voiceUsage).map(([k, v]) => `- **${k}**: ${v} segments`),
  ];

  logGeneration({
    timestamp: new Date().toISOString(),
    text: `[Multivoice] ${title} — ${segFiles.length} segments`,
    voice: 'multivoice',
    model: args.model,
    languageCode: args.language,
    durationSec: totalDuration,
    audioEncoding: 'LINEAR16',
    hadStylePrompt: true,
    savedPath: mergedFile,
    costEstimate: totalCost,
  });

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
}
