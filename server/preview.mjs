// GET /preview?artist=&album=&bandcamp=<album page url>
//   -> { preview: { url, provider: 'apple'|'deezer', track, link } | null, bandcampId: number|null }
//
// Audio previews come only from the providers' official preview APIs:
// Apple iTunes Search first, Deezer as fallback. Nothing is taken from
// Bandcamp pages except the numeric album id (for Bandcamp's own embedded
// player); that costs one polite request per album, cached.
//
// Caching: Apple and Bandcamp results go to DATA_DIR/previews.json (30 days,
// misses 1 day). Deezer preview URLs are signed and expire, so those results
// are only kept in memory, for at most 1 hour.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = resolve(process.env.DATA_DIR ?? join(ROOT, 'public', 'data'));
const FILE = join(DATA_DIR, 'previews.json');
const UA = 'vinyl-room/0.2 (+https://github.com/juajotagon/vinyl-room)';
const DAY = 86_400_000;
const HIT_TTL = 30 * DAY;
const MISS_TTL = DAY;
const DEEZER_TTL = 3_600_000;

const norm = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
// "Album (Deluxe Edition)" / "Album - EP" -> "album"
const titleCore = (s) => norm(String(s).replace(/\s*[([][^)\]]*[)\]]/g, '').replace(/\s+-\s+(ep|single|deluxe.*|remaster.*)$/i, ''));

const sameArtist = (a, b) => {
  const x = norm(a);
  const y = norm(b);
  return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 5 && (x.includes(y) || y.includes(x))));
};
const sameAlbum = (a, b) => {
  const x = titleCore(a);
  const y = titleCore(b);
  return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 5 && (x.startsWith(y) || y.startsWith(x))));
};

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${res.status} ${new URL(url).host}`);
  return res.json();
}

async function apple(artist, album) {
  const q = new URLSearchParams({ entity: 'album', term: `${artist} ${album}`, limit: '5' });
  const found = await getJson(`https://itunes.apple.com/search?${q}`);
  const hit = (found.results ?? []).find((r) => r.collectionId && sameArtist(r.artistName, artist) && sameAlbum(r.collectionName, album));
  if (!hit) return null;
  const songs = await getJson(`https://itunes.apple.com/lookup?id=${hit.collectionId}&entity=song&limit=50`);
  const track = (songs.results ?? []).find((r) => r.wrapperType === 'track' && r.previewUrl);
  if (!track) return null;
  return { url: track.previewUrl, provider: 'apple', track: track.trackName ?? '', link: hit.collectionViewUrl };
}

async function deezer(artist, album) {
  const clean = (s) => s.replace(/"/g, ' ');
  const q = new URLSearchParams({ q: `artist:"${clean(artist)}" album:"${clean(album)}"`, limit: '5' });
  const found = await getJson(`https://api.deezer.com/search/album?${q}`);
  const hit = (found.data ?? []).find((r) => r.id && sameArtist(r.artist?.name ?? '', artist) && sameAlbum(r.title, album));
  if (!hit) return null;
  const tracks = await getJson(`https://api.deezer.com/album/${hit.id}/tracks?limit=50`);
  const track = (tracks.data ?? []).find((t) => t.preview);
  if (!track) return null;
  return { url: track.preview, provider: 'deezer', track: track.title ?? '', link: hit.link };
}

// Only https://<something>.bandcamp.com/... pages; one request, no redirects off Bandcamp.
function bandcampUrl(u) {
  try {
    const url = new URL(u);
    const h = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    return h === 'bandcamp.com' || h.endsWith('.bandcamp.com') ? url : null;
  } catch {
    return null;
  }
}

async function bandcampAlbumId(pageUrl) {
  let url = pageUrl;
  let res;
  for (let hop = 0; hop < 3; hop++) {
    res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(10_000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      await res.body?.cancel();
      const next = bandcampUrl(new URL(res.headers.get('location'), url).href);
      if (!next) return null;
      url = next;
      continue;
    }
    break;
  }
  if (!res.ok) {
    await res.body?.cancel();
    return null;
  }
  const html = (await res.text()).slice(0, 2_000_000);
  const props = html.match(/<meta\s+name="bc-page-properties"\s+content=(?:'([^']*)'|"([^"]*)")/i);
  if (props) {
    try {
      const data = JSON.parse((props[1] ?? props[2]).replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      if (data.item_type === 'a' && Number.isInteger(data.item_id)) return data.item_id;
    } catch {}
  }
  const embed = html.match(/EmbeddedPlayer\/album=(\d+)/);
  return embed ? Number(embed[1]) : null;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------
let disk = null; // { "<artist|album>": { apple?: {at, v}, bc?: {at, v} } }
let writing = Promise.resolve();
const deezerCache = new Map(); // key -> { at, v }
const inflight = new Map();

async function loadDisk() {
  if (disk) return disk;
  try {
    disk = JSON.parse(await readFile(FILE, 'utf8'));
  } catch {
    disk = {};
  }
  return disk;
}
function saveDisk() {
  writing = writing
    .then(async () => {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(`${FILE}.tmp`, JSON.stringify(disk));
      await rename(`${FILE}.tmp`, FILE);
    })
    .catch(() => {});
}
const fresh = (e) => e && Date.now() - e.at < (e.v ? HIT_TTL : MISS_TTL);

async function lookup(artist, album, bandcamp) {
  const key = `${norm(artist)}|${norm(album)}`;
  const store = await loadDisk();
  const entry = (store[key] ??= {});
  let changed = false;

  if (!fresh(entry.apple)) {
    try {
      entry.apple = { at: Date.now(), v: await apple(artist, album) };
      changed = true;
    } catch (err) {
      console.warn(`[preview] apple: ${err.message}`);
    }
  }
  let preview = entry.apple?.v ?? null;

  if (!preview) {
    const d = deezerCache.get(key);
    if (d && Date.now() - d.at < DEEZER_TTL) preview = d.v;
    else {
      try {
        preview = await deezer(artist, album);
        deezerCache.set(key, { at: Date.now(), v: preview });
      } catch (err) {
        console.warn(`[preview] deezer: ${err.message}`);
      }
    }
  }

  const page = bandcamp && bandcampUrl(bandcamp);
  if (page && !fresh(entry.bc)) {
    try {
      entry.bc = { at: Date.now(), v: await bandcampAlbumId(page) };
      changed = true;
    } catch (err) {
      console.warn(`[preview] bandcamp: ${err.message}`);
    }
  }
  if (changed) saveDisk();
  return { preview, bandcampId: entry.bc?.v ?? null };
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
  return true;
}

export async function handlePreview(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return true;
  }
  const q = new URL(req.url, 'http://x').searchParams;
  const artist = (q.get('artist') ?? '').trim();
  const album = (q.get('album') ?? '').trim();
  const bandcamp = (q.get('bandcamp') ?? '').trim();
  if (!artist || !album || artist.length > 150 || album.length > 150 || bandcamp.length > 300) return send(res, 400, { error: 'bad request' });

  const key = `${norm(artist)}|${norm(album)}|${bandcamp}`;
  let job = inflight.get(key);
  if (!job) {
    job = lookup(artist, album, bandcamp).finally(() => inflight.delete(key));
    inflight.set(key, job);
  }
  try {
    return send(res, 200, await job);
  } catch {
    return send(res, 200, { preview: null, bandcampId: null });
  }
}
