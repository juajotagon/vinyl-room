// Writes the short description shown next to the record.
// With ANTHROPIC_API_KEY (or another credential the SDK finds) Claude writes
// it; otherwise we build a plain one from the source details.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.CLAUDE_MODEL ?? 'claude-opus-5-5';

const SYSTEM = `You write the blurb for a daily album recommendation on a small personal music site.
Write 2 or 3 sentences, around 60 words, in plain, warm English. Say what the album sounds like and why it is worth a listen today.
Use only the facts given and what you reliably know about the artist. If you are unsure about a detail, leave it out rather than guess.
Do not quote the reviews; put things in your own words. No hype words like "masterpiece", no emoji, no headings. Reply with the blurb only.`;

function facts(pick) {
  const lines = [
    `Artist: ${pick.artist}`,
    `Album: ${pick.album}${pick.year ? ` (${pick.year})` : ''}`,
    pick.tracklist?.length ? `Tracks: ${pick.tracklist.slice(0, 20).join('; ')}` : null,
    'Recommended by:',
    ...pick.sources.map((s) => `- ${s.name}, ${s.label}${s.blurb ? `. Their one-line summary: ${s.blurb}` : ''}`),
  ];
  return lines.filter(Boolean).join('\n');
}

function plainDescription(pick) {
  const who = pick.sources.map((s) => `${s.name} (${s.label})`);
  const list = who.length > 1 ? `${who.slice(0, -1).join(', ')} and ${who.at(-1)}` : who[0];
  const blurb = pick.sources.find((s) => s.blurb)?.blurb;
  return [`${pick.album} by ${pick.artist} was picked by ${list}.`, blurb].filter(Boolean).join(' ');
}

export async function describe(pick, log = console) {
  let client;
  try {
    client = new Anthropic();
  } catch {
    log.info('[describe] no Anthropic credentials, using the plain description');
    return { text: plainDescription(pick), by: 'template' };
  }
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      // If a safety check declines, the API retries on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: facts(pick) }],
    });
    if (response.stop_reason === 'refusal') throw new Error('declined');
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (!text) throw new Error('empty reply');
    return { text, by: response.model };
  } catch (err) {
    log.warn(`[describe] Claude failed (${err.message}), using the plain description`);
    return { text: plainDescription(pick), by: 'template' };
  }
}
