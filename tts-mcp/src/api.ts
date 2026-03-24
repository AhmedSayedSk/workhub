import { GoogleAuth } from 'google-auth-library';

const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1beta1/text:synthesize';

// Service account credentials path + project ID
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || '/home/ahmedsk/projects/Yarwy/yarwy-tts-studio/credentials/upsmart-22108-7a77f2302e02-gemini-tts.json';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'upsmart-22108';

let auth: GoogleAuth | null = null;

async function getAccessToken(): Promise<string> {
  if (!auth) {
    auth = new GoogleAuth({
      keyFilename: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('Failed to get access token from service account.');
  return token.token;
}

export interface TTSRequest {
  text: string;
  voiceName: string;
  model: string;
  languageCode: string;
  stylePrompt?: string;
  speakingRate?: number;
  audioEncoding: string;
  sampleRate: number;
}

export interface TTSResponse {
  audioBuffer: Buffer;
  mimeType: string;
  durationSec: number;
}

const ENCODING_MAP: Record<string, string> = {
  wav: 'LINEAR16',
  mp3: 'MP3',
  ogg: 'OGG_OPUS',
};

const EXT_MAP: Record<string, string> = {
  LINEAR16: 'wav',
  MP3: 'mp3',
  OGG_OPUS: 'ogg',
};

export function formatToEncoding(format: string): string {
  return ENCODING_MAP[format] || 'LINEAR16';
}

export function encodingToExt(encoding: string): string {
  return EXT_MAP[encoding] || 'wav';
}

function createWavHeader(dataLength: number, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}

export function estimateCost(textLength: number, model: string): number {
  const ratePerChar = model.includes('pro') ? 0.000125 : 0.0000625;
  return textLength * ratePerChar;
}

export async function generateSpeech(request: TTSRequest): Promise<TTSResponse> {
  const accessToken = await getAccessToken();

  const body: Record<string, unknown> = {
    input: {
      text: request.text,
      ...(request.stylePrompt && { prompt: request.stylePrompt }),
    },
    voice: {
      languageCode: request.languageCode,
      name: request.voiceName,
      model_name: request.model,
    },
    audioConfig: {
      audioEncoding: request.audioEncoding,
      ...(request.speakingRate && request.speakingRate !== 1.0 && { speakingRate: request.speakingRate }),
    },
  };

  const res = await fetch(TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-goog-user-project': PROJECT_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err?.error?.message || JSON.stringify(err);
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(detail || `Cloud TTS request failed (${res.status})`);
  }

  const data = (await res.json()) as { audioContent?: string };

  if (!data.audioContent) {
    throw new Error('No audio data in TTS response.');
  }

  let audioBuffer = Buffer.from(data.audioContent, 'base64');

  // For LINEAR16: prepend WAV header
  if (request.audioEncoding === 'LINEAR16') {
    const wavHeader = createWavHeader(audioBuffer.length, request.sampleRate);
    audioBuffer = Buffer.concat([wavHeader, audioBuffer]);
  }

  // Calculate duration
  let durationSec: number;
  if (request.audioEncoding === 'LINEAR16') {
    durationSec = (audioBuffer.length - 44) / (request.sampleRate * 2);
  } else {
    // Rough estimate for compressed formats
    durationSec = (request.text.length / 5 / 150) * 60;
  }

  return {
    audioBuffer,
    mimeType: request.audioEncoding === 'MP3' ? 'audio/mp3' : request.audioEncoding === 'OGG_OPUS' ? 'audio/ogg' : 'audio/wav',
    durationSec: Math.round(durationSec * 10) / 10,
  };
}
