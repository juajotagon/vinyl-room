// Downloads album art into public/art/ and writes public/art/manifest.json.
// Source order: Discogs (needs DISCOGS_TOKEN) -> Cover Art Archive -> nothing
// (the app then draws a procedural placeholder).
//
//   DISCOGS_TOKEN=xxxx npm run fetch-art
//   ARTIST="Gorillaz" ALBUM="Demon Days" npm run fetch-art
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARTIST = process.env.ARTIST ?? 'Gorillaz';
const ALBUM = process.env.ALBUM ?? 'Demon Days';
const UA = 'vinyl-room/0.1 (+homelab hobby project)';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'art');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// MusicBrainz allows ~1 req/s and answers 503 when you go faster, so retry.
async function getJson(url, headers = {}, tries = 4) {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
    if (res.ok) return res.json();
    if (i >= tries || ![429, 503].includes(res.status)) throw new Error(`${res.status} ${url}`);
    await sleep(1500 * i);
  }
}

// Tries each URL in turn (CAA does not have every thumbnail size for every image).
async function download(urls, name, headers = {}) {
  let last;
  for (const url of [urls].flat().filter(Boolean)) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
      if (res.ok) {
        await writeFile(join(OUT, name), Buffer.from(await res.arrayBuffer()));
        return `art/${name}`;
      }
      last = new Error(`${res.status} ${url}`);
    } catch (err) {
      last = new Error(`${err.cause?.code ?? err.message} ${url}`);
    }
  }
  throw last;
}

async function fromDiscogs(token) {
  const auth = { Authorization: `Discogs token=${token}` };
  const q = new URLSearchParams({ type: 'master', artist: ARTIST, release_title: ALBUM });
  const search = await getJson(`https://api.discogs.com/database/search?${q}`, auth);
  const hit = search.results?.[0];
  if (!hit) throw new Error('no Discogs master found');
  const master = await getJson(`https://api.discogs.com/masters/${hit.id}`, auth);
  const images = master.images ?? [];
  const front = images.find((i) => i.type === 'primary') ?? images[0];
  const back = images.find((i) => i !== front);
  if (!front) throw new Error('Discogs master has no images');
  return {
    source: 'discogs',
    sourceUrl: master.uri,
    front: await download(front.uri, 'front.jpg', auth),
    back: back ? await download(back.uri, 'back.jpg', auth) : null,
    label: null,
    tracklist: (master.tracklist ?? []).filter((t) => t.type_ === 'track').map((t) => t.title),
  };
}

async function fromCoverArtArchive() {
  const q = encodeURIComponent(`releasegroup:"${ALBUM}" AND artist:"${ARTIST}" AND primarytype:album`);
  const mb = await getJson(`https://musicbrainz.org/ws/2/release-group/?query=${q}&fmt=json&limit=1`);
  const rg = mb['release-groups']?.[0];
  if (!rg) throw new Error('no MusicBrainz release group found');
  const caa = await getJson(`https://coverartarchive.org/release-group/${rg.id}`);
  const pick = (type) => caa.images.find((i) => i.types.includes(type));
  const url = (img) => [img.thumbnails['1200'], img.thumbnails.large, img.image];
  const front = pick('Front') ?? caa.images[0];
  const back = pick('Back');
  const medium = pick('Medium');

  // Tracklist from the release CAA picked as representative.
  const releaseId = caa.release.split('/').pop();
  const rel = await getJson(`https://musicbrainz.org/ws/2/release/${releaseId}?inc=recordings&fmt=json`);
  const tracklist = (rel.media ?? []).flatMap((m) => (m.tracks ?? []).map((t) => t.title));

  return {
    source: 'coverartarchive',
    sourceUrl: caa.release,
    front: await download(url(front), 'front.jpg'),
    back: back ? await download(url(back), 'back.jpg') : null,
    label: medium ? await download(url(medium), 'label.jpg') : null,
    tracklist,
  };
}

await mkdir(OUT, { recursive: true });
let manifest = null;
const attempts = [];
if (process.env.DISCOGS_TOKEN) attempts.push(['Discogs', () => fromDiscogs(process.env.DISCOGS_TOKEN)]);
attempts.push(['Cover Art Archive', fromCoverArtArchive]);

for (const [name, fn] of attempts) {
  try {
    manifest = await fn();
    console.log(`Got art from ${name}`);
    break;
  } catch (err) {
    console.warn(`${name} failed: ${err.message}`);
  }
}

if (!manifest) {
  console.warn('No art downloaded; the app will use its placeholder.');
  process.exit(0);
}
manifest = { artist: ARTIST, album: ALBUM, ...manifest };
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(manifest);
