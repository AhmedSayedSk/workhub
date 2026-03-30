import { z } from 'zod';
import { writeFileSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

export const generateTaggedStorySchema = {
  concept: z.string().describe('Story concept/theme/instructions. Be detailed about what kind of story you want.'),
  characters: z.record(z.object({
    name_ar: z.string().describe('Character name in Arabic'),
    description: z.string().describe('Character description (age, personality, role)'),
    voice: z.string().describe('Gemini voice name (e.g. Sulafat, Leda, Sadachbia)'),
    stylePrompt: z.string().optional().describe('TTS style instructions for this character'),
  })).describe('Character map keyed by tag name (e.g. narrator, karim, yasmin). Must include "narrator".'),
  language: z.string().default('ar-EG').describe('Story language (ar-EG for Egyptian Arabic, en-US for English)'),
  outputPath: z.string().describe('Absolute path to save the story JSON file'),
};

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY environment variable is not set.');
  return key;
}

export async function generateTaggedStory(args: {
  concept: string;
  characters: Record<string, { name_ar: string; description: string; voice: string; stylePrompt?: string }>;
  language: string;
  outputPath: string;
}) {
  if (!args.characters['narrator']) {
    return {
      content: [{ type: 'text' as const, text: 'Error: characters must include a "narrator" key.' }],
      isError: true,
    };
  }

  const client = new GoogleGenAI({ apiKey: getApiKey() });

  const charList = Object.entries(args.characters)
    .map(([key, c]) => `- ${key}: ${c.name_ar} — ${c.description}`)
    .join('\n');

  const charKeys = Object.keys(args.characters);
  const nonNarrator = charKeys.filter(k => k !== 'narrator');

  const langName = args.language.startsWith('ar') ? 'Egyptian Arabic (عامية مصرية)' : 'English';

  const prompt = `You are a professional story writer. Write a story in ${langName}.

## Characters
${charList}

## Output Format
Output ONLY a JSON array of segments. Each segment is an object with "speaker" and "text" keys.
The "speaker" value MUST be one of these exact keys: ${charKeys.join(', ')}

## STRICT Rules:
1. Output MUST be a valid JSON array. No markdown, no code blocks, no extra text.
2. "narrator" segments describe actions, scenes, settings, and transitions. The narrator NEVER speaks dialogue.
3. Character segments (${nonNarrator.join(', ')}) contain ONLY their spoken dialogue. Characters NEVER describe their own actions.
4. NEVER combine narrator description and character dialogue in the same segment.
5. Characters should speak in long detailed dialogue — not just one short sentence. Make their conversations feel real and natural.
6. Write the story as a continuous novel — not divided into pages or chapters.
7. Include lots of dialogue between characters — back and forth conversations.
8. The story should be detailed and engaging with rich descriptions.

## Example output format:
[
  {"speaker": "narrator", "text": "في يوم من الأيام كانت ياسمين قاعدة في البيت لوحدها. كان الجو حر والشمس بتضرب على الشبابيك."},
  {"speaker": "yasmin", "text": "أنا زهقانة أوي النهارده! مش عارفة أعمل إيه. يا ترى لو رحت عند تيتا هتفرح بيا؟ أكيد هتعملي كيكة زي كل مرة!"},
  {"speaker": "narrator", "text": "وفجأة سمعت صوت غريب جاي من الحديقة. صوت زي حد بيطبل على طبلة قديمة."},
  {"speaker": "yasmin", "text": "إيه الصوت الغريب ده؟ لازم أروح أشوف! بس يا ترى أروح لوحدي ولا أنادي على عمر يجي معايا؟"}
]

## Story Concept
${args.concept}

Write the story now. Output ONLY the JSON array.`;

  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  const text = response.text;
  if (!text) {
    return {
      content: [{ type: 'text' as const, text: 'Error: Gemini returned no text.' }],
      isError: true,
    };
  }

  // Parse JSON — handle markdown code blocks if Gemini wraps it
  let cleanJson = text.trim();
  if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let segments: { speaker: string; text: string }[];
  try {
    segments = JSON.parse(cleanJson);
  } catch {
    // Fallback: try to extract JSON array from the text
    const match = cleanJson.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        segments = JSON.parse(match[0]);
      } catch {
        return {
          content: [{ type: 'text' as const, text: 'Error: Could not parse Gemini response as JSON segments.' }],
          isError: true,
        };
      }
    } else {
      return {
        content: [{ type: 'text' as const, text: 'Error: Could not parse Gemini response as JSON segments.' }],
        isError: true,
      };
    }
  }

  if (!Array.isArray(segments) || segments.length === 0) {
    return {
      content: [{ type: 'text' as const, text: 'Error: Gemini returned empty or invalid segments array.' }],
      isError: true,
    };
  }

  // Build story JSON
  const storyJson = {
    title: args.concept.substring(0, 80),
    language: args.language,
    characters: Object.fromEntries(
      Object.entries(args.characters).map(([key, c]) => [
        key,
        {
          voice: c.voice,
          description: c.description,
          stylePrompt: c.stylePrompt || c.description,
          name_ar: c.name_ar,
        },
      ])
    ),
    segments,
  };

  writeFileSync(args.outputPath, JSON.stringify(storyJson, null, 2), 'utf-8');

  // Count speakers
  const speakerCounts: Record<string, number> = {};
  for (const seg of segments) {
    speakerCounts[seg.speaker] = (speakerCounts[seg.speaker] || 0) + 1;
  }

  const totalChars = segments.reduce((sum, s) => sum + s.text.length, 0);

  const lines = [
    `## Story Generated`,
    `Saved: ${args.outputPath}`,
    `Segments: **${segments.length}** | Characters: **${totalChars}** chars | Language: ${args.language}`,
    '',
    '### Speakers',
    ...Object.entries(speakerCounts).map(([s, count]) => `- **${s}**: ${count} segments`),
  ];

  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
  };
}
