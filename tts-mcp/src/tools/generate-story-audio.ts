import { z } from 'zod';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { generateSpeech, formatToEncoding, encodingToExt, estimateCost } from '../api.js';
import { logGeneration } from '../log.js';

export const generateStoryAudioSchema = {
  storyJsonPath: z.string().describe('Absolute path to story JSON file'),
  voice: z.enum([
    'Zephyr','Kore','Leda','Aoede','Callirrhoe','Autonoe','Despina','Erinome',
    'Laomedeia','Achernar','Gacrux','Pulcherrima','Vindemiatrix','Sulafat',
    'Puck','Charon','Fenrir','Orus','Enceladus','Iapetus','Umbriel','Algieba',
    'Algenib','Rasalgethi','Alnilam','Schedar','Achird','Zubenelgenubi',
    'Sadachbia','Sadaltager'
  ]).default('Kore').describe('Default voice for narration (30 available)'),
  model: z.enum(['gemini-2.5-flash-tts', 'gemini-2.5-pro-tts'])
    .default('gemini-2.5-flash-tts').describe('TTS model'),
  language: z.string().default('en-US').describe('Language code'),
  outputFormat: z.enum(['wav', 'mp3', 'ogg']).default('mp3').describe('Audio format'),
  outputDir: z.string().optional().describe('Output directory (default: same dir as JSON)'),
  stylePrompt: z.string().optional().describe('Default style prompt for narration'),
};

interface StoryPage {
  page?: number;
  narration?: string;
  text?: string;
  voice?: string;
  voiceTone?: string;
  stylePrompt?: string;
  scene?: string;
}

interface StoryJson {
  title?: string;
  pages: StoryPage[];
}

export async function generateStoryAudio(args: {
  storyJsonPath: string;
  voice: string;
  model: string;
  language: string;
  outputFormat: string;
  outputDir?: string;
  stylePrompt?: string;
}) {
  const jsonContent = readFileSync(args.storyJsonPath, 'utf-8');
  const story: StoryJson = JSON.parse(jsonContent);

  if (!story.pages || !Array.isArray(story.pages) || story.pages.length === 0) {
    return {
      content: [{ type: 'text' as const, text: 'Error: JSON file must have a "pages" array with narration text.' }],
      isError: true,
    };
  }

  const title = story.title || basename(args.storyJsonPath, '.json');
  const safeTitle = title.replace(/[^a-zA-Z0-9\u0600-\u06FF -]/g, '').replace(/\s+/g, '-').toLowerCase();
  const baseDir = args.outputDir || dirname(args.storyJsonPath);
  const outputDir = join(baseDir, `${safeTitle}-audio`);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const encoding = formatToEncoding(args.outputFormat);
  const ext = encodingToExt(encoding);
  const results: { page: number; file: string; duration: number; cost: number; error?: string }[] = [];
  let totalDuration = 0;
  let totalCost = 0;

  for (let i = 0; i < story.pages.length; i++) {
    const page = story.pages[i];
    const narration = page.narration || page.text;
    const pageNum = page.page || i + 1;

    if (!narration) {
      results.push({ page: pageNum, file: '(skipped — no narration)', duration: 0, cost: 0 });
      continue;
    }

    const pageVoice = page.voice || args.voice;
    const pageStyle = page.stylePrompt || page.voiceTone || args.stylePrompt;

    try {
      const result = await generateSpeech({
        text: narration,
        voiceName: pageVoice,
        model: args.model,
        languageCode: args.language,
        stylePrompt: pageStyle,
        audioEncoding: encoding,
        sampleRate: 24000,
      });

      const filename = `page_${String(pageNum).padStart(2, '0')}.${ext}`;
      const filePath = join(outputDir, filename);
      writeFileSync(filePath, result.audioBuffer);

      const cost = estimateCost(narration.length, args.model);
      totalDuration += result.durationSec;
      totalCost += cost;

      results.push({ page: pageNum, file: filePath, duration: result.durationSec, cost });

      logGeneration({
        timestamp: new Date().toISOString(),
        text: narration.length > 100 ? narration.slice(0, 100) + '...' : narration,
        voice: pageVoice,
        model: args.model,
        languageCode: args.language,
        durationSec: result.durationSec,
        audioEncoding: encoding,
        hadStylePrompt: !!pageStyle,
        savedPath: filePath,
        costEstimate: cost,
      });

      // Rate limiting delay
      if (i < story.pages.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      results.push({ page: pageNum, file: '(failed)', duration: 0, cost: 0, error: msg });
    }
  }

  const successCount = results.filter((r) => !r.error && r.file !== '(skipped — no narration)').length;
  const mins = Math.floor(totalDuration / 60);
  const secs = Math.round(totalDuration % 60);

  const lines = [
    `## Story Audio: "${title}"`,
    `**${successCount}/${story.pages.length}** pages generated | **${mins}m ${secs}s** total | **$${totalCost.toFixed(4)}** est. cost`,
    `Output: ${outputDir}`,
    '',
  ];

  for (const r of results) {
    if (r.error) {
      lines.push(`- Page ${r.page}: ERROR — ${r.error}`);
    } else {
      lines.push(`- Page ${r.page}: ${r.duration}s — ${r.file}`);
    }
  }

  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
  };
}
