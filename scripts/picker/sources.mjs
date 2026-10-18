// Each source returns candidates:
//   { artist, album, source, sourceName, url, published: Date, weight, score?, blurb?, image? }
// `weight` is how much one mention from that source counts in the daily pick.
import { attr, decode, get, parseFeed, stripTags } from './http.mjs';

const BANDCAMP_DAILY = 'https://daily.bandcamp.com/feed';
const STEREOGUM_AOTW = 'https://www.stereogum.com/category/reviews/album-of-the-week/feed/';
const NEEDLE_DROP = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCt7fwAhXDy3oNFTAzF2o8Pw';

// Bandcamp Daily, "Album of the Day". Titles look like: Artist, “Album”
async function bandcampDaily() {
  const items = parseFeed(await get(BANDCAMP_DAILY));
  return items
    .filter((i) => (i['category[]'] ?? []).some((c) => decode(c).trim() === 'Album of the Day'))
    .map((i) => {
      const title = decode(i.title).trim();
      const m = title.match(/^(.*),\s*[“"](.+)[”"]\s*$/);
      if (!m) return null;
      const html = decode(i.description);
      return {
        artist: m[1].trim(),
        album: m[2].trim(),
        source: 'bandcamp-daily',
        sourceName: 'Bandcamp Daily',
        label: 'Album of the Day',
        url: decode(i.link).trim(),
        published: new Date(decode(i.pubDate)),
        weight: 3,
        blurb: stripTags(html),
        image: html.match(/<img[^>]+src="([^"]+)"/)?.[1],
      };
    })
    .filter(Boolean);
}

// Stereogum, "Album Of The Week". The description wraps the album in <em>.
async function stereogum() {
  const items = parseFeed(await get(STEREOGUM_AOTW));
  return items
    .map((i) => {
      const desc = decode(i.description);
      const m = desc.match(/Album Of The Week:\s*(.+?)\s*<em>(.+?)<\/em>/i);
      if (!m) return null;
      return {
        artist: stripTags(m[1]),
        album: stripTags(m[2]),
        source: 'stereogum',
        sourceName: 'Stereogum',
        label: 'Album of the Week',
        url: decode(i.link).trim(),
        published: new Date(decode(i.pubDate)),
        weight: 3,
      };
    })
    .filter(Boolean);
}

// The Needle Drop on YouTube. Titles: "Artist - Album ALBUM REVIEW",
// score ("8/10") in the video description. Only 7/10 and up count.
async function needleDrop() {
  const entries = parseFeed(await get(NEEDLE_DROP));
  return entries
    .map((e) => {
      const title = decode(e.title).trim();
      const m = title.match(/^(.+?)\s+-\s+(.+?)\s+ALBUM REVIEW$/i);
      if (!m) return null;
      const desc = decode(e['media:description'] ?? '');
      const score = Number(desc.match(/\b(10|[0-9])\/10\b/)?.[1]);
      if (!(score >= 7)) return null;
      return {
        artist: m[1].trim(),
        album: m[2].trim(),
        source: 'needle-drop',
        sourceName: 'The Needle Drop',
        label: `${score}/10`,
        url: attr(e['link'], 'href') ?? `https://www.youtube.com/watch?v=${decode(e['yt:videoId'])}`,
        published: new Date(decode(e.published)),
        weight: score >= 8 ? score - 6 : 1, // 7 -> 1, 8 -> 2, 9 -> 3, 10 -> 4
        score,
      };
    })
    .filter(Boolean);
}

export const SOURCES = { bandcampDaily, stereogum, needleDrop };

export async function collectCandidates(log = console) {
  const results = await Promise.allSettled(Object.values(SOURCES).map((fn) => fn()));
  const all = [];
  results.forEach((r, i) => {
    const name = Object.keys(SOURCES)[i];
    if (r.status === 'fulfilled') {
      log.info(`[sources] ${name}: ${r.value.length} candidates`);
      all.push(...r.value);
    } else {
      log.warn(`[sources] ${name} failed: ${r.reason.message}`);
    }
  });
  return all;
}

// One request per Bandcamp Daily article: the album page it links to, and the
// editorial genre (JSON-LD "genre" URL like .../genres/metal, or an article:tag).
export async function fetchBandcampArticle(reviewUrl, album) {
  try {
    const html = await get(reviewUrl);
    const links = [...new Set(html.match(/https:\/\/[a-z0-9-]+\.bandcamp\.com\/album\/[a-z0-9-]+/g) ?? [])];
    const slug = slugify(album);
    const albumUrl = links.find((l) => l.endsWith(`/album/${slug}`)) ?? links.find((l) => l.includes(slug.slice(0, 12))) ?? null;

    let genreSlug = null;
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
      try {
        const nodes = [JSON.parse(m[1])].flatMap((d) => d['@graph'] ?? d);
        for (const n of nodes) {
          const g = [n.genre].flat().find((x) => typeof x === 'string' && x);
          const slugMatch = g?.match(/\/genres\/([a-z0-9-]+)/i);
          if (slugMatch) genreSlug = slugMatch[1].toLowerCase();
          else if (g && !genreSlug) genreSlug = slugify(g);
        }
      } catch {
        // ignore malformed JSON-LD
      }
      if (genreSlug) break;
    }
    genreSlug ??= html.match(/<meta[^>]+property="article:tag"[^>]+content="([^"]+)"/i)?.[1];
    genreSlug = genreSlug ? slugify(decode(genreSlug)) : null;
    return { albumUrl, genreSlug };
  } catch {
    return { albumUrl: null, genreSlug: null };
  }
}

export function slugify(s) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Key used to spot the same album across sources.
export function albumKey(artist, album) {
  const norm = (s) =>
    slugify(s.replace(/\((deluxe|expanded|remaster(ed)?)[^)]*\)/gi, ''))
      .replace(/^the-/, '')
      .replace(/-/g, '');
  return `${norm(artist)}|${norm(album)}`;
}
