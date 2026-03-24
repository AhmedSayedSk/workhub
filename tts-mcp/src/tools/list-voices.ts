const VOICES = [
  // Female voices (14)
  { name: 'Zephyr', gender: 'Female', trait: 'Bright', description: 'Cheerful narration, children\'s content, uplifting messages' },
  { name: 'Kore', gender: 'Female', trait: 'Firm', description: 'Authoritative storytelling, bedtime stories, clear narration' },
  { name: 'Leda', gender: 'Female', trait: 'Youthful', description: 'Young character voices, energetic content, kids\' shows' },
  { name: 'Aoede', gender: 'Female', trait: 'Breezy', description: 'Relaxed narration, casual content, light storytelling' },
  { name: 'Callirrhoe', gender: 'Female', trait: 'Easy-going', description: 'Conversational content, friendly tutorials, casual dialogue' },
  { name: 'Autonoe', gender: 'Female', trait: 'Bright', description: 'Lively narration, educational content, announcements' },
  { name: 'Despina', gender: 'Female', trait: 'Smooth', description: 'Elegant narration, romantic content, audiobooks' },
  { name: 'Erinome', gender: 'Female', trait: 'Clear', description: 'Professional narration, news, educational content' },
  { name: 'Laomedeia', gender: 'Female', trait: 'Upbeat', description: 'Excited narration, children\'s stories, playful content' },
  { name: 'Achernar', gender: 'Female', trait: 'Soft', description: 'Gentle whisper, ASMR, meditation, bedtime stories' },
  { name: 'Gacrux', gender: 'Female', trait: 'Mature', description: 'Wise characters, documentary, serious storytelling' },
  { name: 'Pulcherrima', gender: 'Female', trait: 'Forward', description: 'Bold narration, confident delivery, presentations' },
  { name: 'Vindemiatrix', gender: 'Female', trait: 'Gentle', description: 'Tender moments, emotional scenes, lullabies' },
  { name: 'Sulafat', gender: 'Female', trait: 'Warm', description: 'Motherly voice, heartfelt narration, comfort content' },
  // Male voices (16)
  { name: 'Puck', gender: 'Male', trait: 'Upbeat', description: 'Energetic narration, children\'s content, fun storytelling' },
  { name: 'Charon', gender: 'Male', trait: 'Informative', description: 'Documentary, educational, news-style narration' },
  { name: 'Fenrir', gender: 'Male', trait: 'Excitable', description: 'Action scenes, adventure stories, excited delivery' },
  { name: 'Orus', gender: 'Male', trait: 'Firm', description: 'Authoritative narration, announcements, serious content' },
  { name: 'Enceladus', gender: 'Male', trait: 'Breathy', description: 'Quiet emotions, intimate narration, suspense, horror' },
  { name: 'Iapetus', gender: 'Male', trait: 'Clear', description: 'Professional voiceover, instructions, tutorials' },
  { name: 'Umbriel', gender: 'Male', trait: 'Easy-going', description: 'Casual conversations, friendly guides, relaxed tone' },
  { name: 'Algieba', gender: 'Male', trait: 'Smooth', description: 'Audiobooks, elegant narration, storytelling' },
  { name: 'Algenib', gender: 'Male', trait: 'Gravelly', description: 'Dark characters, villains, intense dramatic scenes' },
  { name: 'Rasalgethi', gender: 'Male', trait: 'Informative', description: 'News, documentary, factual narration' },
  { name: 'Alnilam', gender: 'Male', trait: 'Firm', description: 'Strong characters, commands, decisive delivery' },
  { name: 'Schedar', gender: 'Male', trait: 'Even', description: 'Balanced narration, neutral content, consistent tone' },
  { name: 'Achird', gender: 'Male', trait: 'Friendly', description: 'Conversational, warm greeting, approachable content' },
  { name: 'Zubenelgenubi', gender: 'Male', trait: 'Casual', description: 'Laid-back narration, informal content, podcasts' },
  { name: 'Sadachbia', gender: 'Male', trait: 'Lively', description: 'Animated storytelling, children\'s content, entertainment' },
  { name: 'Sadaltager', gender: 'Male', trait: 'Knowledgeable', description: 'Expert narration, technical content, wise characters' },
];

export async function listVoices() {
  const females = VOICES.filter((v) => v.gender === 'Female');
  const males = VOICES.filter((v) => v.gender === 'Male');

  const formatVoice = (v: typeof VOICES[0]) => `**${v.name}** — ${v.trait} | ${v.description}`;

  const lines = [
    `## Gemini TTS Voices (30 available)`,
    '',
    `### Female (${females.length})`,
    ...females.map(formatVoice),
    '',
    `### Male (${males.length})`,
    ...males.map(formatVoice),
    '',
    '### Recommended by Use Case',
    '- **Children\'s stories**: Kore, Sulafat, Laomedeia, Puck, Sadachbia',
    '- **Bedtime/calm**: Achernar, Vindemiatrix, Sulafat, Enceladus',
    '- **Horror/suspense**: Enceladus, Algenib, Gacrux',
    '- **Documentary/news**: Charon, Rasalgethi, Iapetus, Erinome',
    '- **Audiobooks**: Algieba, Despina, Charon, Sulafat',
    '- **Professional**: Erinome, Iapetus, Schedar, Orus',
    '',
    '**Models:** gemini-2.5-flash-tts (fast), gemini-2.5-pro-tts (quality)',
    '**Languages:** en-US, ar-EG, fr-FR, de-DE, es-ES, ja-JP, ko-KR, hi-IN, and 80+ more',
  ];

  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
  };
}
