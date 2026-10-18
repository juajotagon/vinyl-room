// Picks the album of the day and adds it to the archive.
//
//   node scripts/picker/pick.mjs                 # today
//   node scripts/picker/pick.mjs --date 2026-10-14
//   node scripts/picker/pick.mjs --backfill 7    # the last 7 days, oldest first
//   node scripts/picker/pick.mjs --force         # redo a day that already has a pick
//   node scripts/picker/pick.mjs --retag         # redo genre tags for existing picks (same albums)
//   node scripts/picker/pick.mjs --migrate-covers  # old `cover` file fields -> `covers` URLs, delete covers/
//
// Output (DATA_DIR, default public/data):
//   archive.json          newest first: [{ date, artist, album, year, covers, genres, fromCatalogue? }]
//   picks/<date>.json     everything about that day's pick
//   catalogue.json        back catalogue (see seed.mjs catalogue), used when nothing fresh is left
// Cover images are never stored: `covers` is a list of remote URLs, best first.
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { albumKey, collectCandidates, fetchBandcampArticle } from './sources.mjs';
import { enrich } from './enrich.mjs';
import { caaUrl, coverList, ogImage } from './covers.mjs';
import { mergeUnmatched, tagAlbum } from './genres.mjs';

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

const archiveEntry = (p) => ({
  date: p.date,
  artist: p.artist,
  album: p.album,
  year: p.year,
  covers: p.covers ?? [],
  genres: { primary: p.genres.primary, secondary: p.genres.secondary, subgenres: p.genres.subgenres },
  ...(p.fromCatalogue ? { fromCatalogue: true } : {}),
});

// Picks an album nobody has been shown yet from the back catalogue. Prefers
// ones with covers, and a primary genre unlike the last 3 picks.
function chooseFromCatalogue(catalogue, archive, date) {
  const shown = new Set(archive.map((e) => albumKey(e.artist, e.album)));
  const recent = archive.filter((e) => e.date < date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const recentGenres = new Set(recent.map((e) => e.genres?.primary).filter(Boolean));
  const fresh = catalogue.filter((a) => a.genres?.primary && !shown.has(a.key) && !shown.has(albumKey(a.artist, a.album)));
  const tiers = [
    (a) => a.covers?.length && !recentGenres.has(a.genres.primary),
    (a) => a.covers?.length,
    (a) => !recentGenres.has(a.genres.primary),
    () => true,
  ];
  for (const ok of tiers) {
    const pool = fresh.filter(ok);
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}

async function pickFromCatalogue(date, archive, log) {
  const catalogue = await readJson(join(DATA_DIR, 'catalogue.json'), []);
  const c = chooseFromCatalogue(catalogue, archive, date);
  if (!c) return null;
  log.info(`[pick] ${date}: nothing fresh, from the catalogue: ${c.artist} — ${c.album}`);
  let details = null;
  try {
    details = await enrich({ artist: c.artist, album: c.album }, log);
  } catch (err) {
    log.warn(`[pick] catalogue enrich failed: ${err.message}`);
  }
  return {
    date,
    artist: c.artist,
    album: c.album,
    year: c.year ?? details?.year ?? null,
    tracklist: details?.tracklist ?? [],
    covers: c.covers?.length ? c.covers : (details?.covers ?? []),
    fromCatalogue: true,
    firstRecommended: c.first,
    sources: [],
    links: { ...(details?.links ?? {}), ...c.links },
    genres: { ...c.genres, confidence: 'medium', by: 'catalogue' },
  };
}

// Rewrites old `cover: "covers/<date>.jpg"` fields as `covers: [url, ...]` and
// removes the stored images.
export async function migrateCovers(log = console) {
  const archivePath = join(DATA_DIR, 'archive.json');
  const archive = await readJson(archivePath, []);
  for (const entry of archive) {
    const pickPath = join(DATA_DIR, 'picks', `${entry.date}.json`);
    const pick = await readJson(pickPath, null);
    if (!pick) continue;
    if (!pick.covers?.length) {
      const bandcamp = pick.links?.bandcamp ? await ogImagePolite(pick.links.bandcamp) : null;
      pick.covers = coverList(caaUrl(pick.mbid), bandcamp);
    }
    delete pick.cover;
    await writeAtomic(pickPath, JSON.stringify(pick, null, 2) + '\n');
    delete entry.cover;
    entry.covers = pick.covers;
    log.info(`[migrate] ${entry.date}: ${pick.covers.length} cover URL(s)`);
  }
  await writeAtomic(archivePath, JSON.stringify(archive, null, 2) + '\n');
  await rm(join(DATA_DIR, 'covers'), { recursive: true, force: true });
}

let lastOg = 0;
async function ogImagePolite(url) {
  const wait = lastOg + 1500 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  try {
    return await ogImage(url);
  } finally {
    lastOg = Date.now();
  }
}

// Runs the genre tagger and stores the result on the pick.
async function applyTags(pick, { bandcampGenreSlug = null } = {}, log = console) {
  const t = await tagAlbum({
    artist: pick.artist,
    album: pick.album,
    year: pick.year,
    mbid: pick.mbid,
    bandcampAlbumUrl: pick.links?.bandcamp,
    bandcampGenreSlug,
    log,
  });
  pick.genres = { primary: t.primary, secondary: t.secondary, subgenres: t.subgenres, confidence: t.confidence, by: t.by };
  pick.genreEvidence = t.evidence;
  await mergeUnmatched(DATA_DIR, t.unmatched);
  log.info(`[genres] ${pick.artist} — ${pick.album}: ${t.primary ?? 'none'} [${t.subgenres.join(', ')}] (${t.confidence}, ${t.by})`);
}

// Re-tags every existing pick without changing which album was picked.
export async function retagAll(log = console) {
  const archivePath = join(DATA_DIR, 'archive.json');
  const archive = await readJson(archivePath, []);
  for (const entry of archive) {
    const pickPath = join(DATA_DIR, 'picks', `${entry.date}.json`);
    const pick = await readJson(pickPath, null);
    if (!pick) continue;
    let genreSlug = null;
    const reviewUrl = pick.sources?.find((s) => s.name === 'Bandcamp Daily')?.url;
    if (reviewUrl) {
      const article = await fetchBandcampArticle(reviewUrl, pick.album);
      genreSlug = article.genreSlug;
      if (!pick.links?.bandcamp && article.albumUrl) pick.links = { ...pick.links, bandcamp: article.albumUrl };
    }
    if (!pick.mbid || !pick.links?.bandcamp) {
      const d = await enrich({ artist: pick.artist, album: pick.album }, log);
      pick.mbid ??= d.mbid;
      if (!pick.links?.bandcamp && d.bandcampUrl) pick.links = { ...pick.links, bandcamp: d.bandcampUrl };
      if (d.links.musicbrainz && !pick.links.musicbrainz) pick.links.musicbrainz = d.links.musicbrainz;
    }
    pick.year ??= null;
    await applyTags(pick, { bandcampGenreSlug: genreSlug }, log);
    delete pick.description;
    delete pick.describedBy;
    await writeAtomic(pickPath, JSON.stringify(pick, null, 2) + '\n');
    Object.assign(entry, archiveEntry(pick));
  }
  await writeAtomic(archivePath, JSON.stringify(archive, null, 2) + '\n');
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
  if (!ranked.length) {
    const pick = await pickFromCatalogue(date, archive, log);
    if (!pick) throw new Error(`no fresh candidates for ${date}, and nothing left in the catalogue`);
    pick.pickedAt = new Date().toISOString();
    return savePick(pick, archive, pickPath);
  }

  const best = ranked[0];
  // Name it the way the most trusted (highest weight) source wrote it.
  const lead = [...best.mentions].sort((a, b) => b.weight - a.weight)[0];
  log.info(`[pick] ${date}: ${lead.artist} — ${lead.album} (score ${best.score.toFixed(2)}, ${best.mentions.length} source(s))`);

  const details = await enrich({ artist: lead.artist, album: lead.album, images: best.mentions.map((m) => m.image) }, log);
  const links = { ...details.links };
  const bc = best.mentions.find((m) => m.source === 'bandcamp-daily');
  let bandcampUrl = details.bandcampUrl;
  let genreSlug = null;
  if (bc) {
    const article = await fetchBandcampArticle(bc.url, lead.album);
    bandcampUrl = article.albumUrl ?? bandcampUrl;
    genreSlug = article.genreSlug;
  }
  if (bandcampUrl) links.bandcamp = bandcampUrl;

  const pick = {
    date,
    artist: lead.artist,
    album: lead.album,
    year: details.year,
    mbid: details.mbid,
    tracklist: details.tracklist,
    covers: details.covers,
    sources: best.mentions.map((m) => ({
      name: m.sourceName,
      label: m.label,
      url: m.url,
      published: m.published.toISOString(),
      ...(m.blurb ? { blurb: m.blurb.replace(/\s*Read full story.*$/i, '') } : {}),
    })),
    links: Object.fromEntries(Object.entries(links).filter(([, v]) => v)),
  };

  if (bandcampUrl && !pick.covers.some((u) => !u.includes('coverartarchive.org'))) {
    const img = await ogImage(bandcampUrl);
    pick.covers = coverList(pick.covers, img);
  }
  await applyTags(pick, { bandcampGenreSlug: genreSlug }, log);
  pick.pickedAt = new Date().toISOString();
  return savePick(pick, archive, pickPath);
}

async function savePick(pick, archive, pickPath) {
  await writeAtomic(pickPath, JSON.stringify(pick, null, 2) + '\n');
  archive.push(archiveEntry(pick));
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

  if (args.includes('--migrate-covers')) {
    await migrateCovers();
  } else if (args.includes('--retag')) {
    await retagAll();
  } else if (backfill > 0) {
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
