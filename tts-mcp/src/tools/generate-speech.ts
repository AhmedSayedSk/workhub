import { z } from 'zod';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { generateSpeech, formatToEncoding, encodingToExt, estimateCost } from '../api.js';
import { logGeneration } from '../log.js';

const DESKTOP_PATH = '/mnt/c/Users/Ahmed Sayed/Desktop';

export const generateSpeechSchema = {
  text: z.string().max(4000).describe('Text to convert to speech (max 4000 bytes)'),
  voice: z.enum([
    'Zephyr','Kore','Leda','Aoede','Callirrhoe','Autonoe','Despina','Erinome',
    'Laomedeia','Achernar','Gacrux','Pulcherrima','Vindemiatrix','Sulafat',
    'Puck','Charon','Fenrir','Orus','Enceladus','Iapetus','Umbriel','Algieba',
    'Algenib','Rasalgethi','Alnilam','Schedar','Achird','Zubenelgenubi',
    'Sadachbia','Sadaltager'
  ]).default('Puck').describe('Voice name (30 available — use list_voices to see all)'),
  language: z.string().default('en-US').describe('Language code (e.g. en-US, ar-EG)'),
  model: z.enum(['gemini-2.5-flash-tts', 'gemini-2.5-pro-tts'])
    .default('gemini-2.5-flash-tts').describe('TTS model'),
  speakingRate: z.number().min(0.25).max(2.0).default(1.0).describe('Speaking rate (0.25-2.0)'),
  stylePrompt: z.string().optional().describe('Style/emotion instructions (e.g. "Speak warmly and slowly")'),
  outputFormat: z.enum(['wav', 'mp3', 'ogg']).default('wav').describe('Output audio format'),
  outputPath: z.string().optional().describe('Output directory (default: Desktop)'),
};

export async function generateSpeechTool(args: {
  text: string;
  voice: string;
  language: string;
  model: string;
  speakingRate: number;
  stylePrompt?: string;
  outputFormat: string;
  outputPath?: string;
}) {
  const encoding = formatToEncoding(args.outputFormat);
  const ext = encodingToExt(encoding);

  const result = await generateSpeech({
    text: args.text,
    voiceName: args.voice,
    model: args.model,
    languageCode: args.language,
    stylePrompt: args.stylePrompt,
    speakingRate: args.speakingRate,
    audioEncoding: encoding,
    sampleRate: 24000,
  });

  const outputDir = args.outputPath || DESKTOP_PATH;
  // Generate a readable filename from the first words of text
  const slug = args.text
    .replace(/[^\w\u0600-\u06FF\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('_')
    .substring(0, 40)
    .replace(/_+$/, '');
  const modelShort = args.model.includes('pro') ? 'pro' : 'flash';
  const filename = `${slug}_${args.voice.toLowerCase()}_${modelShort}.${ext}`;
  const filePath = join(outputDir, filename);
  writeFileSync(filePath, result.audioBuffer);

  const cost = estimateCost(args.text.length, args.model);

  logGeneration({
    timestamp: new Date().toISOString(),
    text: args.text.length > 100 ? args.text.slice(0, 100) + '...' : args.text,
    voice: args.voice,
    model: args.model,
    languageCode: args.language,
    durationSec: result.durationSec,
    audioEncoding: encoding,
    hadStylePrompt: !!args.stylePrompt,
    savedPath: filePath,
    costEstimate: cost,
  });

  const lines = [
    `**Speech generated**`,
    `Saved: ${filePath}`,
    `Voice: ${args.voice} | Model: ${args.model.replace('gemini-2.5-', '')}`,
    `Duration: ${result.durationSec}s | Format: ${ext.toUpperCase()}`,
    `Est. cost: $${cost.toFixed(6)}`,
  ];

  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
  };
}
