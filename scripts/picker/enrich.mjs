// Fills in cover URLs, tracklist and year for a picked album.
// MusicBrainz first (no key), Discogs if DISCOGS_TOKEN is set.
import { get } from './http.mjs';
import { caaUrl, coverList } from './covers.mjs';

const MB = 'https://musicbrainz.org/ws/2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// MusicBrainz allows ~1 request a second; every caller waits on this.
let lastMb = 0;
export async function mbThrottle() {
  const wait = lastMb + 1100 - Date.now();
  lastMb = Date.now() + Math.max(wait, 0);
  if (wait > 0) await sleep(wait);
}

const luceneEscape = (s) => s.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, '\\$1');

async function musicBrainz(artist, album) {
  const q = `releasegroup:"${luceneEscape(album)}" AND artist:"${luceneEscape(artist)}"`;
  await mbThrottle();
  const search = await get(`${MB}/release-group/?query=${encodeURIComponent(q)}&fmt=json&limit=3`, { as: 'json' });
  const rg = search['release-groups']?.find((g) => g.score >= 90);
  if (!rg) return null;

  await mbThrottle();
  const rels = await get(`${MB}/release?release-group=${rg.id}&inc=recordings+url-rels&fmt=json&limit=5`, { as: 'json' });
  // Prefer an official release with the most tracks listed.
  const release = (rels.releases ?? [])
    .filter((r) => r.status !== 'Bootleg')
    .sort((a, b) => trackCount(b) - trackCount(a))[0];

  // Bandcamp album page, from the url relationships of any release in the group.
  const bandcampUrl = (rels.releases ?? [])
    .flatMap((r) => r.relations ?? [])
    .map((rel) => rel.url?.resource)
    .find((u) => /bandcamp\.com\/album\//.test(u ?? '')) ?? null;

  return {
    mbid: rg.id,
    bandcampUrl,
    musicbrainz: `https://musicbrainz.org/release-group/${rg.id}`,
    year: rg['first-release-date']?.slice(0, 4) || null,
    type: rg['primary-type'] ?? null,
    tracklist: release ? release.media.flatMap((m) => (m.tracks ?? []).map((t) => t.title)) : [],
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
  return {
    discogs: master.uri,
    year: master.year ? String(master.year) : null,
    tracklist: (master.tracklist ?? []).filter((t) => t.type_ === 'track').map((t) => t.title),
  };
}

// Returns { year, tracklist, mbid, bandcampUrl, links: {...}, covers: [url] }
// `covers` are remote image URLs, best first (Cover Art Archive, then the feed image).
// Second argument: a logger, or options { log }. Nothing is downloaded.
export async function enrich({ artist, album, images = [] }, opts = console) {
  const log = typeof opts.warn === 'function' ? opts : (opts.log ?? console);
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

  return {
    year: found.find((f) => f.year)?.year ?? null,
    tracklist: found.find((f) => f.tracklist?.length)?.tracklist ?? [],
    mbid: found.find((f) => f.mbid)?.mbid ?? null,
    bandcampUrl: found.find((f) => f.bandcampUrl)?.bandcampUrl ?? null,
    links: Object.fromEntries(
      [['musicbrainz', found.find((f) => f.musicbrainz)?.musicbrainz], ['discogs', found.find((f) => f.discogs)?.discogs]].filter(
        ([, v]) => v,
      ),
    ),
    covers: coverList(caaUrl(found.find((f) => f.mbid)?.mbid), images),
  };
}
