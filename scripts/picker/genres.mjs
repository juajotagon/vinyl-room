// Tags an album with a primary genre family, up to 2 secondary families and
// up to 3 subgenres from the site's own tree (taxonomy.mjs).
//
// Evidence, in order: Bandcamp Daily editorial genre, Bandcamp album tags,
// MusicBrainz release-group and artist genres, Deezer, iTunes. Raw tags are
// normalized and looked up in ALIAS; the family with the highest weighted
// score wins. Claude is asked only when the rules end up with low confidence.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { get } from './http.mjs';
import { mbThrottle } from './enrich.mjs';
import { ALIAS, BANDCAMP_FAMILY, FAMILIES, SUBGENRE, isNoise, normalize } from './taxonomy.mjs';

const MB = 'https://musicbrainz.org/ws/2';
const MODEL = process.env.CLAUDE_MODEL ?? 'claude-opus-5-5';

// --- fetching raw evidence --------------------------------------------------

async function safe(log, label, fn) {
  try {
    return await fn();
  } catch (err) {
    log.warn(`[genres] ${label}: ${err.message}`);
    return null;
  }
}

const unescapeHtml = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');

// Tags in the order the artist listed them, deduped case-insensitively.
async function bandcampTags(url) {
  const html = await get(url);
  let tags = [];
  for (const m of html.matchAll(/<a[^>]+class="tag"[^>]*>([^<]+)<\/a>/g)) tags.push(unescapeHtml(m[1]).trim());
  if (!tags.length) {
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
      try {
        const kw = JSON.parse(m[1]).keywords;
        if (Array.isArray(kw)) tags = kw.map(String);
        else if (typeof kw === 'string') tags = kw.split(',').map((t) => t.trim());
      } catch {
        // not the right block
      }
      if (tags.length) break;
    }
  }
  const seen = new Set();
  return tags.filter((t) => {
    const k = t.toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function musicBrainzGenres(mbid) {
  await mbThrottle();
  const rg = await get(`${MB}/release-group/${mbid}?inc=genres+artists&fmt=json`, { as: 'json' });
  const top = (list, n) => [...(list ?? [])].sort((a, b) => b.count - a.count).slice(0, n);
  const album = (rg.genres ?? []).map((g) => ({ name: g.name, count: g.count }));
  let artist = [];
  const artistId = rg['artist-credit']?.[0]?.artist?.id;
  if (artistId) {
    await mbThrottle();
    const a = await get(`${MB}/artist/${artistId}?inc=genres&fmt=json`, { as: 'json' });
    artist = top(a.genres, 5).map((g) => ({ name: g.name, count: g.count }));
  }
  return { album, artist };
}

const sameName = (a, b) => normalize(a) === normalize(b);

async function deezerGenres(artist, album) {
  const q = `artist:"${artist.replace(/"/g, '')}" album:"${album.replace(/"/g, '')}"`;
  const search = await get(`https://api.deezer.com/search/album?q=${encodeURIComponent(q)}`, {
    headers: { 'Accept-Language': 'en' },
    as: 'json',
  });
  const hit = (search.data ?? []).find((d) => sameName(d.artist?.name ?? '', artist));
  if (!hit) return [];
  const full = await get(`https://api.deezer.com/album/${hit.id}`, { headers: { 'Accept-Language': 'en' }, as: 'json' });
  return (full.genres?.data ?? []).map((g) => g.name);
}

async function itunesGenre(artist, album) {
  const term = encodeURIComponent(`${artist} ${album}`);
  const res = await get(`https://itunes.apple.com/search?entity=album&limit=5&term=${term}`, { as: 'json' });
  const want = normalize(album);
  const hit = (res.results ?? []).find((r) => {
    if (!sameName(r.artistName ?? '', artist)) return false;
    const got = normalize(r.collectionName ?? '');
    return got.includes(want) || want.includes(got);
  });
  return hit?.primaryGenreName ? [hit.primaryGenreName] : [];
}

// --- scoring ----------------------------------------------------------------

// Pick the entry to use for one tag when it names a single family.
function singleFamily(entries) {
  const families = new Set(entries.map((e) => e.family));
  if (families.size !== 1) return null;
  return entries.find((e) => e.subgenre) ?? entries[0];
}

const familyOfTag = (tag) => {
  const entries = ALIAS[normalize(tag)];
  return entries && new Set(entries.map((e) => e.family)).size === 1 ? entries[0].family : null;
};

export function scoreEvidence(items) {
  // items: [{ source, tag, weight, familyOnly }]
  const fam = {};
  const sub = {};
  const sources = {}; // family -> Set of sources
  const used = [];
  const unmatched = [];
  const ambiguous = [];

  // Artist-level genres describe the career, so one family can get at most
  // ARTIST_CAP from them however many tags it has.
  const ARTIST_CAP = 2;
  const artistSum = {};
  const add = (item, entry) => {
    const { source } = item;
    let weight = item.weight;
    if (source === 'musicbrainz-artist') {
      weight = Math.min(weight, ARTIST_CAP - (artistSum[entry.family] ?? 0));
      if (weight <= 0) return;
      artistSum[entry.family] = (artistSum[entry.family] ?? 0) + weight;
    }
    fam[entry.family] = (fam[entry.family] ?? 0) + weight;
    (sources[entry.family] ??= new Set()).add(source);
    if (entry.subgenre && !item.familyOnly) {
      sub[entry.subgenre] = (sub[entry.subgenre] ?? 0) + weight;
      for (const also of SUBGENRE[entry.subgenre].also) {
        fam[also] = (fam[also] ?? 0) + weight * 0.5;
        (sources[also] ??= new Set()).add(source);
      }
    }
    used.push({ source, tag: item.tag, weight });
  };

  for (const item of items) {
    if (item.family) {
      add(item, { family: item.family, subgenre: null });
      continue;
    }
    const key = normalize(item.tag);
    const entries = ALIAS[key];
    if (!entries) {
      if (key && !isNoise(key)) unmatched.push(key);
      continue;
    }
    const one = singleFamily(entries);
    if (one) add(item, one);
    else ambiguous.push({ item, entries });
  }
  // Ambiguous tags (hardcore, garage, ...) go to the family that already leads.
  for (const { item, entries } of ambiguous) {
    const best = [...entries].sort((a, b) => (fam[b.family] ?? 0) - (fam[a.family] ?? 0))[0];
    if ((fam[best.family] ?? 0) > 0) add(item, best);
  }

  const ranked = Object.entries(fam).sort((a, b) => b[1] - a[1]);
  const primary = ranked[0]?.[0] ?? null;
  const top = ranked[0]?.[1] ?? 0;
  const secondary = ranked
    .slice(1)
    .filter(([, s]) => s >= 0.45 * top)
    .slice(0, 2)
    .map(([f]) => f);
  const keep = new Set([primary, ...secondary]);
  const subgenres = Object.entries(sub)
    .filter(([id, s]) => s >= 1 && (keep.has(SUBGENRE[id].family) || SUBGENRE[id].also.some((f) => keep.has(f))))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  let confidence = 'low';
  if (primary && top >= 4 && sources[primary].size >= 2) confidence = 'high';
  else if (primary && top >= 2) confidence = 'medium';

  return { primary, secondary, subgenres, confidence, evidence: used, unmatched: [...new Set(unmatched)], score: top };
}

// --- Claude fallback ---------------------------------------------------------

async function askClaude({ artist, album, year, tags }, log) {
  let client;
  try {
    client = new Anthropic();
  } catch {
    return null;
  }
  const familyIds = FAMILIES.map((f) => f.id);
  const subIds = Object.keys(SUBGENRE);
  const schema = {
    type: 'object',
    properties: {
      primary: { type: 'string', enum: familyIds },
      subgenres: { type: 'array', items: { type: 'string', enum: subIds } },
    },
    required: ['primary', 'subgenres'],
    additionalProperties: false,
  };
  const tree = FAMILIES.map((f) => `${f.id}: ${f.subgenres.map((s) => s[0]).join(', ')}`).join('\n');
  const prompt = [
    'Classify this album into the site\'s genre tree. Pick one primary family and up to 3 subgenres (they should belong to the primary family).',
    `Artist: ${artist}`,
    `Album: ${album}${year ? ` (${year})` : ''}`,
    tags.length ? `Raw tags found: ${tags.join(', ')}` : 'No tags were found.',
    `Families and their subgenres:\n${tree}`,
  ].join('\n');
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: prompt }],
    });
    if (res.stop_reason === 'refusal') throw new Error('declined');
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const out = JSON.parse(text);
    const primary = familyIds.find((f) => f === String(out.primary).toLowerCase());
    if (!primary) throw new Error('unknown family');
    const subgenres = [...new Set((out.subgenres ?? []).map((s) => subIds.find((id) => id === String(s).toLowerCase())).filter(Boolean))].slice(0, 3);
    return { primary, subgenres };
  } catch (err) {
    // No credentials: stay quiet. Anything else is worth a warning.
    if (/authentication|credential|api[ _-]?key|auth_token/i.test(err.message)) {
      log.info?.('[genres] no Anthropic credentials, skipping Claude fallback');
    } else {
      log.warn(`[genres] Claude fallback failed: ${err.message}`);
    }
    return null;
  }
}

// --- main entry ---------------------------------------------------------------

export async function tagAlbum({ artist, album, year, mbid, bandcampAlbumUrl, bandcampGenreSlug, log = console }) {
  const items = [];
  const rawTags = [];

  const daily = BANDCAMP_FAMILY[bandcampGenreSlug];
  if (daily) items.push({ source: 'bandcamp-daily', tag: bandcampGenreSlug, weight: 3, family: daily });

  if (bandcampAlbumUrl) {
    const tags = await safe(log, 'Bandcamp page', () => bandcampTags(bandcampAlbumUrl));
    (tags ?? []).forEach((tag, i) => {
      rawTags.push(tag);
      items.push({ source: 'bandcamp', tag, weight: Math.max(1, 2.2 - 0.2 * i) });
    });
  }

  if (mbid) {
    const mb = await safe(log, 'MusicBrainz', () => musicBrainzGenres(mbid));
    for (const g of mb?.album ?? []) {
      rawTags.push(g.name);
      items.push({ source: 'musicbrainz', tag: g.name, weight: g.count >= 2 ? 2 : 1 });
    }
    for (const g of mb?.artist ?? []) {
      rawTags.push(g.name);
      items.push({ source: 'musicbrainz-artist', tag: g.name, weight: 1 });
    }
  }

  for (const [source, fn] of [
    ['deezer', () => deezerGenres(artist, album)],
    ['itunes', () => itunesGenre(artist, album)],
  ]) {
    const names = (await safe(log, source, fn)) ?? [];
    for (const name of names) {
      rawTags.push(name);
      const family = familyOfTag(name);
      if (family) items.push({ source, tag: name, weight: 1, family });
      else if (!isNoise(normalize(name)) && !ALIAS[normalize(name)]) items.push({ source, tag: name, weight: 0 });
    }
  }

  const r = scoreEvidence(items);
  const result = {
    primary: r.primary,
    secondary: r.secondary,
    subgenres: r.subgenres,
    confidence: r.confidence,
    by: r.primary ? 'rules' : 'none',
    evidence: r.evidence,
    unmatched: r.unmatched,
  };

  if (result.confidence === 'low') {
    const ai = await askClaude({ artist, album, year, tags: [...new Set(rawTags)] }, log);
    if (ai) {
      const agrees = ai.primary === result.primary;
      result.secondary = result.secondary.filter((f) => f !== ai.primary);
      result.primary = ai.primary;
      result.subgenres = ai.subgenres;
      result.confidence = agrees ? 'medium' : 'low';
      result.by = 'claude';
    }
  }
  return result;
}

// Keeps running counts of tags we could not map, most common first.
export async function mergeUnmatched(dataDir, tags) {
  if (!tags?.length) return;
  const path = join(dataDir, 'genre-unmatched.json');
  let list = [];
  try {
    list = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    // first run
  }
  const counts = new Map(list.map((e) => [e.tag, e.count]));
  for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const out = [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, JSON.stringify(out, null, 2) + '\n');
  await rename(`${path}.tmp`, path);
}
