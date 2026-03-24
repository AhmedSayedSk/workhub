import { z } from 'zod';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { GoogleGenAI } from '@google/genai';

const DESKTOP_PATH = '/mnt/c/Users/Ahmed Sayed/Desktop';

// Reuse the same credentials approach - Lyria needs API key
function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY environment variable is not set for Lyria.');
  return key;
}

export const generateMusicSchema = {
  prompt: z.string().describe('Music description (e.g. "gentle magical lullaby, soft piano and strings, children fairy tale")'),
  duration: z.number().min(5).max(120).default(30).describe('Duration in seconds (5-120)'),
  bpm: z.number().min(60).max(200).default(90).describe('Beats per minute (60-200)'),
  brightness: z.number().min(0).max(1).default(0.5).describe('Tone brightness (0=dark, 1=bright)'),
  density: z.number().min(0).max(1).default(0.3).describe('Musical density (0=sparse, 1=busy)'),
  outputPath: z.string().optional().describe('Output directory (default: Desktop)'),
  filename: z.string().optional().describe('Output filename (default: auto-generated)'),
};

function createWavHeader(dataLength: number, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}

export async function generateMusic(args: {
  prompt: string;
  duration: number;
  bpm: number;
  brightness: number;
  density: number;
  outputPath?: string;
  filename?: string;
}) {
  const apiKey = getApiKey();
  const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });

  const audioChunks: Buffer[] = [];
  let finished = false;

  return new Promise<{ content: { type: 'text'; text: string }[] }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      finished = true;
      finalize();
    }, (args.duration + 5) * 1000); // extra 5s buffer

    async function finalize() {
      clearTimeout(timeout);

      if (audioChunks.length === 0) {
        resolve({
          content: [{ type: 'text' as const, text: 'No audio generated. Try a different prompt.' }],
        });
        return;
      }

      const rawAudio = Buffer.concat(audioChunks);
      const sampleRate = 48000;
      const channels = 2;
      const bitsPerSample = 16;

      // Add WAV header
      const wavHeader = createWavHeader(rawAudio.length, sampleRate, channels, bitsPerSample);
      const wavBuffer = Buffer.concat([wavHeader, rawAudio]);

      const durationSec = rawAudio.length / (sampleRate * channels * (bitsPerSample / 8));
      const outputDir = args.outputPath || DESKTOP_PATH;
      const slug = args.prompt
        .replace(/[^\w\s]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 4)
        .join('_')
        .substring(0, 30);
      const filename = args.filename || `music_${slug}.wav`;
      const filePath = join(outputDir, filename);

      writeFileSync(filePath, wavBuffer);

      const lines = [
        `**Music generated**`,
        `Saved: ${filePath}`,
        `Duration: ${Math.round(durationSec)}s | BPM: ${args.bpm}`,
        `Prompt: "${args.prompt}"`,
        `Format: WAV 48kHz stereo`,
      ];

      resolve({
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      });
    }

    (async () => {
      try {
        const session = await client.live.music.connect({
          model: 'models/lyria-realtime-exp',
          callbacks: {
            onmessage: (message: any) => {
              if (message.serverContent?.audioChunks) {
                for (const chunk of message.serverContent.audioChunks) {
                  if (chunk.data) {
                    audioChunks.push(Buffer.from(chunk.data, 'base64'));
                  }
                }
              }
            },
            onerror: (error: any) => {
              if (!finished) {
                finished = true;
                clearTimeout(timeout);
                reject(new Error(`Lyria error: ${error}`));
              }
            },
            onclose: () => {
              if (!finished) {
                finished = true;
                finalize();
              }
            },
          },
        });

        await session.setWeightedPrompts({
          weightedPrompts: [{ text: args.prompt, weight: 1.0 }],
        });

        await session.setMusicGenerationConfig({
          musicGenerationConfig: {
            bpm: args.bpm,
            brightness: args.brightness,
            density: args.density,
            temperature: 1.0,
          },
        });

        await session.play();

        // Wait for desired duration then stop
        await new Promise((r) => setTimeout(r, args.duration * 1000));

        if (!finished) {
          finished = true;
          await session.stop();
          await finalize();
        }
      } catch (err) {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          reject(err);
        }
      }
    })();
  });
}
