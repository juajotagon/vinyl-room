// Small fetch helpers shared by the picker: a polite User-Agent, retries on
// rate limits, and a minimal RSS/Atom reader (no XML dependency needed).

export const UA = 'vinyl-room/0.2 (+homelab daily album pick)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function get(url, { headers = {}, tries = 4, as = 'text' } = {}) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, ...headers },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return as === 'json' ? res.json() : as === 'buffer' ? Buffer.from(await res.arrayBuffer()) : res.text();
      last = new Error(`${res.status} ${url}`);
      // MusicBrainz answers 503 when you go over ~1 req/s.
      if (![429, 500, 502, 503].includes(res.status)) break;
    } catch (err) {
      last = new Error(`${err.cause?.code ?? err.name} ${url}`);
    }
    await sleep(1500 * i);
  }
  throw last;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decode(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m);
}

export const stripTags = (s = '') => decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Returns RSS <item>s or Atom <entry>s as { tag: rawInnerXml } objects.
// Repeated tags (e.g. several <category>) are collected under `${tag}[]`.
export function parseFeed(xml) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) ?? [];
  return blocks.map((block) => {
    const body = block.replace(/^<(item|entry)[^>]*>/, '').replace(/<\/(item|entry)>$/, '');
    const fields = {};
    // Walk every opening tag (nested ones too, e.g. media:group > media:description).
    for (const m of body.matchAll(/<([\w:]+)(\s[^>]*?)?(\/?)>/g)) {
      const [whole, tag, attrs = '', selfClosing] = m;
      let value = attrs;
      if (!selfClosing) {
        const end = body.indexOf(`</${tag}>`, m.index);
        if (end === -1) continue;
        value = body.slice(m.index + whole.length, end) || attrs;
      }
      (fields[`${tag}[]`] ??= []).push(value);
      fields[tag] ??= value;
    }
    return fields;
  });
}

export const attr = (s, name) => s?.match(new RegExp(`${name}="([^"]*)"`))?.[1];
