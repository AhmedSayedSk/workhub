import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { generateSpeechSchema, generateSpeechTool } from './tools/generate-speech.js';
import { listVoices } from './tools/list-voices.js';
import { generateStoryAudioSchema, generateStoryAudio } from './tools/generate-story-audio.js';
import { getReportSchema, getReport } from './tools/get-report.js';
import { generateMusicSchema, generateMusic } from './tools/generate-music.js';
import { generateMultivoiceStorySchema, generateMultivoiceStory } from './tools/generate-multivoice-story.js';
import { generateTaggedStorySchema, generateTaggedStory } from './tools/generate-tagged-story.js';

const server = new McpServer({
  name: 'tts-gen',
  version: '1.0.0',
});

server.tool(
  'generate_speech',
  'Generate speech audio from text using Google Gemini TTS. Saves audio file to Desktop.',
  generateSpeechSchema,
  async (args) => generateSpeechTool(args)
);

server.tool(
  'list_voices',
  'List all available Gemini TTS voices with descriptions.',
  {},
  async () => listVoices()
);

server.tool(
  'generate_story_audio',
  'Generate audio for all pages of a story JSON file. Reads narration from each page and creates audio files.',
  generateStoryAudioSchema,
  async (args) => generateStoryAudio(args)
);

server.tool(
  'get_report',
  'Get TTS usage report — total requests, duration, cost, voice/model breakdown.',
  getReportSchema,
  async (args) => getReport(args)
);

server.tool(
  'generate_music',
  'Generate background music using Google Lyria RealTime. Creates instrumental music from text prompts (mood, genre, instruments). Perfect for story backgrounds, scenes, and ambience.',
  generateMusicSchema,
  async (args) => generateMusic(args)
);

server.tool(
  'generate_multivoice_story',
  'Generate multi-voice audio from a tagged story JSON. Each narration line must start with [speaker_tag] like [narrator], [yasmin]. Use generate_tagged_story to create properly tagged stories.',
  generateMultivoiceStorySchema,
  async (args) => generateMultivoiceStory(args)
);

server.tool(
  'generate_tagged_story',
  'Generate a children\'s story with [speaker_tag] markers using Gemini AI. Creates a story JSON ready for multi-voice TTS with generate_multivoice_story.',
  generateTaggedStorySchema,
  async (args) => generateTaggedStory(args)
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('TTS MCP Server failed to start:', error);
  process.exit(1);
});
