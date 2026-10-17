// Picks the album of the day and adds it to the archive.
//
//   node scripts/picker/pick.mjs                 # today
//   node scripts/picker/pick.mjs --date 2026-10-14
//   node scripts/picker/pick.mjs --backfill 7    # the last 7 days, oldest first
//   node scripts/picker/pick.mjs --force         # redo a day that already has a pick
//
// Output (DATA_DIR, default public/data):
//   archive.json          newest first: [{ date, artist, album, year, cover }]
//   picks/<date>.json     everything about that day's pick
//   covers/<date>.jpg
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { albumKey, bandcampAlbumUrl, collectCandidates } from './sources.mjs';
import { enrich } from './enrich.mjs';
import { describe } from './describe.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = resolve(process.env.DATA_DIR ?? join(ROOT, 'public', 'data'));
const FRESH_DAYS = 14;
const DAY = 86_400_000;

// "Today" in the configured time zone (TZ env), as YYYY-MM-DD.
export const today = () => new Date().toLocaleDateString('en-CA');

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeAtomic(path, data) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, path);
}

// Groups candidates by album, scores each group, and returns them best first.
// Score = sum of source weights, faded by age, so an album two sources liked
// this week beats one that a single source liked last week.
export function rank(candidates, date, exclude = new Set()) {
  const end = new Date(`${date}T23:59:59`).getTime();
  const groups = new Map();
  for (const c of candidates) {
    const t = c.published.getTime();
    if (Number.isNaN(t) || t > end || t < end - FRESH_DAYS * DAY) continue;
    const key = albumKey(c.artist, c.album);
    if (exclude.has(key)) continue;
    const g = groups.get(key) ?? { key, mentions: [], score: 0, newest: 0 };
    // One vote per source, even if a feed repeats itself.
    if (g.mentions.some((m) => m.source === c.source)) continue;
    const ageDays = (end - t) / DAY;
    g.mentions.push(c);
    g.score += c.weight / (1 + ageDays / 5);
    g.newest = Math.max(g.newest, t);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.score - a.score || b.newest - a.newest);
}

export async function pickDay(date = today(), { force = false, candidates, log = console } = {}) {
  const pickPath = join(DATA_DIR, 'picks', `${date}.json`);
  const existing = await readJson(pickPath, null);
  if (existing && !force) {
    log.info(`[pick] ${date} already picked: ${existing.artist} — ${existing.album}`);
    return existing;
  }

  const archive = (await readJson(join(DATA_DIR, 'archive.json'), [])).filter((e) => e.date !== date);
  const shown = new Set(archive.map((e) => albumKey(e.artist, e.album)));
  candidates ??= await collectCandidates(log);
  const ranked = rank(candidates, date, shown);
  if (!ranked.length) throw new Error(`no fresh candidates for ${date}`);

  const best = ranked[0];
  // Name it the way the most trusted (highest weight) source wrote it.
  const lead = [...best.mentions].sort((a, b) => b.weight - a.weight)[0];
  log.info(`[pick] ${date}: ${lead.artist} — ${lead.album} (score ${best.score.toFixed(2)}, ${best.mentions.length} source(s))`);

  const details = await enrich({ artist: lead.artist, album: lead.album, images: best.mentions.map((m) => m.image) }, log);
  const links = { ...details.links };
  const bc = best.mentions.find((m) => m.source === 'bandcamp-daily');
  if (bc) links.bandcamp = await bandcampAlbumUrl(bc.url, lead.album);

  const pick = {
    date,
    artist: lead.artist,
    album: lead.album,
    year: details.year,
    tracklist: details.tracklist,
    cover: null,
    sources: best.mentions.map((m) => ({
      name: m.sourceName,
      label: m.label,
      url: m.url,
      published: m.published.toISOString(),
      ...(m.blurb ? { blurb: m.blurb.replace(/\s*Read full story.*$/i, '') } : {}),
    })),
    links: Object.fromEntries(Object.entries(links).filter(([, v]) => v)),
  };

  if (details.cover) {
    pick.cover = `covers/${date}.jpg`;
    await writeAtomic(join(DATA_DIR, pick.cover), details.cover);
  }
  const description = await describe(pick, log);
  pick.description = description.text;
  pick.describedBy = description.by;
  pick.pickedAt = new Date().toISOString();

  await writeAtomic(pickPath, JSON.stringify(pick, null, 2) + '\n');
  archive.push({ date, artist: pick.artist, album: pick.album, year: pick.year, cover: pick.cover });
  archive.sort((a, b) => b.date.localeCompare(a.date));
  await writeAtomic(join(DATA_DIR, 'archive.json'), JSON.stringify(archive, null, 2) + '\n');
  return pick;
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : (args[i + 1] ?? true);
  };
  const force = args.includes('--force');
  const backfill = Number(opt('--backfill') ?? 0);
  const date = opt('--date') ?? today();

  if (backfill > 0) {
    // Fetch the feeds once and replay them day by day.
    const candidates = await collectCandidates();
    const end = new Date(`${date}T12:00:00`);
    for (let i = backfill - 1; i >= 0; i--) {
      const d = new Date(end.getTime() - i * DAY).toLocaleDateString('en-CA');
      try {
        await pickDay(d, { force, candidates });
      } catch (err) {
        console.warn(`[pick] ${d}: ${err.message}`);
      }
    }
  } else {
    await pickDay(date, { force });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
