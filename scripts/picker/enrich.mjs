// Fills in cover art, tracklist and year for a picked album.
// MusicBrainz + Cover Art Archive first (no key), Discogs if DISCOGS_TOKEN is
// set, and finally whatever image the source feed had.
import { get } from './http.mjs';

const MB = 'https://musicbrainz.org/ws/2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const luceneEscape = (s) => s.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, '\\$1');

async function musicBrainz(artist, album) {
  const q = `releasegroup:"${luceneEscape(album)}" AND artist:"${luceneEscape(artist)}"`;
  const search = await get(`${MB}/release-group/?query=${encodeURIComponent(q)}&fmt=json&limit=3`, { as: 'json' });
  const rg = search['release-groups']?.find((g) => g.score >= 90);
  if (!rg) return null;

  await sleep(1100); // MusicBrainz rate limit
  const rels = await get(`${MB}/release?release-group=${rg.id}&inc=recordings&fmt=json&limit=5`, { as: 'json' });
  // Prefer an official release with the most tracks listed.
  const release = (rels.releases ?? [])
    .filter((r) => r.status !== 'Bootleg')
    .sort((a, b) => trackCount(b) - trackCount(a))[0];

  return {
    musicbrainz: `https://musicbrainz.org/release-group/${rg.id}`,
    year: rg['first-release-date']?.slice(0, 4) || null,
    type: rg['primary-type'] ?? null,
    tracklist: release ? release.media.flatMap((m) => (m.tracks ?? []).map((t) => t.title)) : [],
    coverUrls: [
      `https://coverartarchive.org/release-group/${rg.id}/front-1200`,
      `https://coverartarchive.org/release-group/${rg.id}/front-500`,
    ],
  };
}

const trackCount = (r) => (r.media ?? []).reduce((n, m) => n + (m['track-count'] ?? 0), 0);

async function discogs(artist, album, token) {
  const auth = { Authorization: `Discogs token=${token}` };
  const q = new URLSearchParams({ type: 'master', artist, release_title: album });
  const search = await get(`https://api.discogs.com/database/search?${q}`, { headers: auth, as: 'json' });
  const hit = search.results?.[0];
  if (!hit) return null;
  const master = await get(`https://api.discogs.com/masters/${hit.id}`, { headers: auth, as: 'json' });
  const front = (master.images ?? []).find((i) => i.type === 'primary') ?? master.images?.[0];
  return {
    discogs: master.uri,
    year: master.year ? String(master.year) : null,
    tracklist: (master.tracklist ?? []).filter((t) => t.type_ === 'track').map((t) => t.title),
    coverUrls: front ? [front.uri] : [],
    coverHeaders: auth,
  };
}

async function firstImage(urls, headers) {
  for (const url of urls.filter(Boolean)) {
    try {
      const buf = await get(url, { headers, as: 'buffer', tries: 2 });
      if (buf.length > 1000) return buf;
    } catch {
      // try the next one
    }
  }
  return null;
}

// Returns { year, tracklist, links: {...}, cover: Buffer|null }
export async function enrich({ artist, album, images = [] }, log = console) {
  const found = [];
  try {
    const mb = await musicBrainz(artist, album);
    if (mb) found.push(mb);
  } catch (err) {
    log.warn(`[enrich] MusicBrainz: ${err.message}`);
  }
  if (process.env.DISCOGS_TOKEN) {
    try {
      const dc = await discogs(artist, album, process.env.DISCOGS_TOKEN);
      if (dc) found.push(dc);
    } catch (err) {
      log.warn(`[enrich] Discogs: ${err.message}`);
    }
  }

  let cover = null;
  for (const f of found) {
    cover = await firstImage(f.coverUrls, f.coverHeaders);
    if (cover) break;
  }
  // Bandcamp Daily feed images are the album art at full size.
  cover ??= await firstImage(images);

  return {
    year: found.find((f) => f.year)?.year ?? null,
    tracklist: found.find((f) => f.tracklist?.length)?.tracklist ?? [],
    links: Object.fromEntries(
      [['musicbrainz', found.find((f) => f.musicbrainz)?.musicbrainz], ['discogs', found.find((f) => f.discogs)?.discogs]].filter(
        ([, v]) => v,
      ),
    ),
    cover,
  };
}
