// GET /preview?artist=&album=&bandcamp=<album page url>
//   -> { bandcampId: number|null }
//
// Only the numeric album id is read from the Bandcamp album page, for
// Bandcamp's own embedded player. One polite request per album, cached in
// DATA_DIR/previews.json (hits 30 days, misses 1 day). No bandcamp param means
// no network request at all.
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

const norm = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');

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
let disk = null; // { "<artist|album>": { bc?: {at, v} } }
let writing = Promise.resolve();
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

async function lookup(artist, album, page) {
  const key = `${norm(artist)}|${norm(album)}`;
  const store = await loadDisk();
  const entry = (store[key] ??= {});

  if (!fresh(entry.bc)) {
    try {
      entry.bc = { at: Date.now(), v: await bandcampAlbumId(page) };
      saveDisk();
    } catch (err) {
      console.warn(`[preview] bandcamp: ${err.message}`);
    }
  }
  return { bandcampId: entry.bc?.v ?? null };
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

  const page = bandcamp && bandcampUrl(bandcamp);
  if (!page) return send(res, 200, { bandcampId: null });

  const key = `${norm(artist)}|${norm(album)}|${bandcamp}`;
  let job = inflight.get(key);
  if (!job) {
    job = lookup(artist, album, page).finally(() => inflight.delete(key));
    inflight.set(key, job);
  }
  try {
    return send(res, 200, await job);
  } catch {
    return send(res, 200, { bandcampId: null });
  }
}
