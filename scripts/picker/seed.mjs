// Seeds the back catalogue: collects ~2 years of past picks from Bandcamp Daily
// (Album of the Day), Stereogum (Album Of The Week) and The Needle Drop
// (Loved List 8/10+ plus recent 7/10s), then tags them with genres.
//
//   node scripts/picker/seed.mjs collect [--since 2024-10-01]
//   node scripts/picker/seed.mjs tag [--limit N] [--source bandcamp-daily|stereogum|needle-drop]
//   node scripts/picker/seed.mjs summary
//
// Output (DATA_DIR, default public/data) in <DATA_DIR>/seed/:
//   candidates.json, tagged.jsonl, summary.json, summary.md, genre-unmatched.json
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, get, parseFeed, stripTags } from './http.mjs';
import { SOURCES, albumKey, fetchBandcampArticle } from './sources.mjs';
import { enrich } from './enrich.mjs';
import { mergeUnmatched, tagAlbum } from './genres.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = resolve(process.env.DATA_DIR ?? join(ROOT, 'public', 'data'));
const SEED_DIR = join(DATA_DIR, 'seed');
const CANDIDATES = join(SEED_DIR, 'candidates.json');
const TAGGED = join(SEED_DIR, 'tagged.jsonl');

const DEFAULT_SINCE = '2024-10-01';
const PAGE_DELAY_MS = 1600; // between Bandcamp / Stereogum / TND page fetches
const MAX_PAGES = 60;
const SOURCE_IDS = ['bandcamp-daily', 'stereogum', 'needle-drop'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (d) => d.toISOString().slice(0, 10);
const todayIso = () => new Date().toLocaleDateString('en-CA');

// Keeps >= PAGE_DELAY_MS between consecutive page fetches, wherever they come from.
let lastPage = 0;
async function politeGet(url, opts) {
  const wait = lastPage + PAGE_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  try {
    return await get(url, opts);
  } finally {
    lastPage = Date.now();
  }
}
async function politeWait() {
  const wait = lastPage + PAGE_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastPage = Date.now();
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeAtomic(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, data);
  await rename(`${path}.tmp`, path);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    else args._.push(argv[i]);
  }
  return args;
}

// --- collection ---------------------------------------------------------------

function candidate(artist, album, source, url, published, score) {
  const c = { key: albumKey(artist, album), artist, album, source, url, published };
  if (score != null) c.score = score;
  return c;
}

// Strips "(2024)", "(EP)", "(EPs)" markers the Loved List adds after titles.
const cleanTitle = (s) => s.replace(/\s*\((?:EPs?|\d{4})\)\s*$/i, '').trim();

async function collectBandcamp(since) {
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    let html;
    try {
      html = await politeGet(`https://daily.bandcamp.com/album-of-the-day?page=${page}`);
    } catch (err) {
      console.warn(`[collect] bandcamp-daily page ${page}: ${err.message}`);
      break;
    }
    const blocks = html.split('<div class="list-article').slice(1);
    let oldest = '9999';
    let n = 0;
    for (const b of blocks) {
      const dateText = b.match(/<\/span>\s*([A-Z][a-z]+ \d{1,2}, \d{4})\s*<\/div>/)?.[1];
      const t = b.match(/<a class="title" href="([^"]+)">([\s\S]*?)<\/a>/);
      if (!dateText || !t) continue;
      const d = new Date(`${dateText} 12:00 UTC`);
      if (Number.isNaN(d.getTime())) continue;
      const published = iso(d);
      n++;
      if (published < oldest) oldest = published;
      if (published < since) continue;
      const title = stripTags(t[2]);
      const m = title.match(/^(.*),\s*[“"‘'](.+)[”"’'](?:\s*\([^)]*\))?\s*$/);
      if (!m) {
        console.warn(`[collect] bandcamp-daily: cannot parse title ${JSON.stringify(title)}`);
        continue;
      }
      out.push(candidate(m[1].trim(), m[2].trim(), 'bandcamp-daily', new URL(decode(t[1]), 'https://daily.bandcamp.com').href, published));
    }
    console.log(`[collect] bandcamp-daily page ${page}: ${n} items, oldest ${oldest}`);
    if (!n || oldest < since) break;
  }
  return out;
}

async function collectStereogum(since) {
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    let items;
    try {
      items = parseFeed(await politeGet(`https://www.stereogum.com/category/reviews/album-of-the-week/feed/?paged=${page}`));
    } catch (err) {
      // Past the last page the feed answers 404.
      console.warn(`[collect] stereogum page ${page}: ${err.message}`);
      break;
    }
    let oldest = '9999';
    for (const i of items) {
      const d = new Date(decode(i.pubDate ?? ''));
      if (Number.isNaN(d.getTime())) continue;
      const published = iso(d);
      if (published < oldest) oldest = published;
      if (published < since) continue;
      const desc = decode(i.description ?? '');
      const m = desc.match(/Album Of The Week:\s*(.+?)\s*<em>(.+?)<\/em>/i);
      if (!m) {
        console.warn(`[collect] stereogum: cannot parse ${decode(i.title ?? '').trim()}`);
        continue;
      }
      out.push(candidate(stripTags(m[1]), stripTags(m[2]), 'stereogum', decode(i.link).trim(), published));
    }
    console.log(`[collect] stereogum page ${page}: ${items.length} items, oldest ${oldest}`);
    if (!items.length || oldest < since) break;
  }
  return out;
}

async function collectNeedleDrop(since) {
  const out = [];
  const sinceYear = Number(since.slice(0, 4));
  const thisYear = Number(todayIso().slice(0, 4));
  for (let year = sinceYear; year <= thisYear; year++) {
    let html;
    try {
      html = await politeGet(`https://theneedledrop.com/loved-list/${year}/`);
    } catch (err) {
      console.warn(`[collect] needle-drop ${year}: ${err.message}`);
      continue;
    }
    // Only "Anthony's 8/10+ Albums": from its <h3> to the next <h3>.
    const start = html.search(/<h3[^>]*>\s*(?:<strong>)?\s*Anthony(?:’|'|&#8217;|&rsquo;)s 8\/10\+ Albums/i);
    if (start < 0) {
      console.warn(`[collect] needle-drop ${year}: section "Anthony's 8/10+ Albums" not found`);
      continue;
    }
    const rest = html.slice(start + 10);
    const section = rest.slice(0, rest.search(/<h3[\s>]/) >= 0 ? rest.search(/<h3[\s>]/) : undefined);
    // Year-only dates: Dec 31, or today for the running year.
    const fallbackDate = year >= thisYear ? todayIso() : `${year}-12-31`;
    let n = 0;
    for (const m of section.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)) {
      const text = stripTags(m[2]);
      const idx = text.indexOf(' - ');
      if (idx < 0) continue;
      const artist = text.slice(0, idx).trim();
      const album = cleanTitle(text.slice(idx + 3));
      if (!artist || !album) continue;
      const url = decode(m[1]);
      n++;
      out.push(candidate(artist, album, 'needle-drop', url, fallbackDate, 8));
    }
    console.log(`[collect] needle-drop ${year}: ${n} loved-list items`);
  }

  // Recent 7/10s (and 8s with an exact score) from the channel feed.
  try {
    const recent = await SOURCES.needleDrop();
    for (const r of recent) {
      const published = iso(r.published);
      if (published < since) continue;
      out.push(candidate(r.artist, cleanTitle(r.album), 'needle-drop', r.url, published, r.score));
    }
    console.log(`[collect] needle-drop channel feed: ${recent.length} items`);
  } catch (err) {
    console.warn(`[collect] needle-drop feed: ${err.message}`);
  }
  return out;
}

async function collect(args) {
  const since = typeof args.since === 'string' ? args.since : DEFAULT_SINCE;
  const all = [...(await collectBandcamp(since)), ...(await collectStereogum(since)), ...(await collectNeedleDrop(since))];

  // Dedupe by key+source. Needle Drop: prefer the entry with a dated review/video
  // (feed entry has an exact date and score) over the year-only Loved List one.
  const byKS = new Map();
  for (const c of all) {
    const k = `${c.key}|${c.source}`;
    const prev = byKS.get(k);
    if (!prev) byKS.set(k, c);
    else if (c.source === 'needle-drop' && c.url.includes('youtube.com')) byKS.set(k, { ...c, score: c.score ?? prev.score });
  }
  const list = [...byKS.values()].sort((a, b) => b.published.localeCompare(a.published) || a.key.localeCompare(b.key));
  await writeAtomic(CANDIDATES, JSON.stringify(list, null, 2) + '\n');

  console.log(`\nWrote ${list.length} candidates to ${CANDIDATES} (since ${since})`);
  for (const s of SOURCE_IDS) {
    const l = list.filter((c) => c.source === s);
    const dates = l.map((c) => c.published).sort();
    console.log(`  ${s}: ${l.length}${l.length ? `  (${dates[0]} .. ${dates.at(-1)})` : ''}`);
  }
  const keys = new Set(list.map((c) => c.key));
  console.log(`  unique albums: ${keys.size}`);
}

// --- tagging ------------------------------------------------------------------

async function readTagged() {
  const rows = [];
  try {
    for (const line of (await readFile(TAGGED, 'utf8')).split('\n')) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line));
      } catch {
        // a torn last line from an interrupted run; ignore it
      }
    }
  } catch {
    // no file yet
  }
  return rows;
}

// One entry per album, with every source that picked it.
function groupCandidates(list) {
  const groups = new Map();
  for (const c of list) {
    const g = groups.get(c.key) ?? { key: c.key, artist: c.artist, album: c.album, sources: [], items: [], published: c.published };
    if (!g.sources.includes(c.source)) g.sources.push(c.source);
    g.items.push(c);
    if (c.published > g.published) g.published = c.published;
    groups.set(c.key, g);
  }
  return [...groups.values()].sort((a, b) => b.published.localeCompare(a.published));
}

async function tag(args) {
  const candidates = await readJson(CANDIDATES, null);
  if (!candidates) throw new Error(`No ${CANDIDATES}. Run "collect" first.`);
  const limit = args.limit ? Number(args.limit) : Infinity;
  const only = typeof args.source === 'string' ? args.source : null;
  if (only && !SOURCE_IDS.includes(only)) throw new Error(`--source must be one of ${SOURCE_IDS.join(', ')}`);

  const done = new Set((await readTagged()).map((r) => r.key));
  const todo = groupCandidates(candidates).filter((g) => !done.has(g.key) && (!only || g.sources.includes(only)));
  const batch = todo.slice(0, limit);
  console.log(`[tag] ${done.size} already tagged, ${todo.length} to do${Number.isFinite(limit) ? `, running ${batch.length}` : ''}`);

  await mkdir(SEED_DIR, { recursive: true });
  const t0 = Date.now();
  let ok = 0;
  let failed = 0;
  for (const [i, g] of batch.entries()) {
    const t1 = Date.now();
    try {
      const daily = g.items.find((c) => c.source === 'bandcamp-daily');
      let article = { albumUrl: null, genreSlug: null };
      if (daily) {
        await politeWait();
        article = await fetchBandcampArticle(daily.url, g.album);
      }
      const details = await enrich({ artist: g.artist, album: g.album }, { cover: false });
      const bandcampUrl = article.albumUrl ?? details.bandcampUrl ?? null;
      if (bandcampUrl) await politeWait(); // tagAlbum fetches the Bandcamp album page
      const genres = await tagAlbum({
        artist: g.artist,
        album: g.album,
        year: details.year,
        mbid: details.mbid,
        bandcampAlbumUrl: bandcampUrl,
        bandcampGenreSlug: article.genreSlug,
      });
      const row = {
        key: g.key,
        artist: g.artist,
        album: g.album,
        sources: g.sources,
        published: g.published,
        mbid: details.mbid,
        bandcampUrl,
        year: details.year,
        genres: {
          primary: genres.primary,
          secondary: genres.secondary,
          subgenres: genres.subgenres,
          confidence: genres.confidence,
          by: genres.by,
        },
      };
      await appendFile(TAGGED, JSON.stringify(row) + '\n');
      await mergeUnmatched(SEED_DIR, genres.unmatched);
      ok++;
      console.log(
        `[tag ${i + 1}/${batch.length}] ${g.artist} - ${g.album} [${g.sources.join('+')}] -> ${genres.primary ?? 'none'} ` +
          `(${genres.subgenres.join(', ') || '-'}; ${genres.confidence}, ${genres.by}${article.genreSlug ? `, bc:${article.genreSlug}` : ''}) ` +
          `${((Date.now() - t1) / 1000).toFixed(1)}s`,
      );
    } catch (err) {
      failed++;
      console.warn(`[tag ${i + 1}/${batch.length}] FAILED ${g.artist} - ${g.album}: ${err.message}`);
    }
  }
  const secs = (Date.now() - t0) / 1000;
  console.log(`[tag] done: ${ok} tagged, ${failed} failed in ${secs.toFixed(0)}s${ok ? ` (${(secs / ok).toFixed(1)}s per album)` : ''}`);
}

// --- summary ------------------------------------------------------------------

const countBy = (arr, fn) => {
  const m = {};
  for (const x of arr) for (const k of [fn(x)].flat()) if (k != null) m[k] = (m[k] ?? 0) + 1;
  return m;
};
const sortCounts = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));

async function summary() {
  const rows = await readTagged();
  const unmatchedAll = await readJson(join(SEED_DIR, 'genre-unmatched.json'), []);
  const fam = (r) => r.genres?.primary ?? '(none)';

  const bySourceFamily = {};
  for (const s of SOURCE_IDS) {
    bySourceFamily[s] = sortCounts(countBy(rows.filter((r) => r.sources.includes(s)), fam));
  }
  const out = {
    generatedAt: new Date().toISOString(),
    albums: rows.length,
    bySource: Object.fromEntries(SOURCE_IDS.map((s) => [s, rows.filter((r) => r.sources.includes(s)).length])),
    multiSource: rows.filter((r) => r.sources.length > 1).length,
    byPrimaryFamily: sortCounts(countBy(rows, fam)),
    bySubgenre: sortCounts(countBy(rows, (r) => r.genres?.subgenres ?? [])),
    bySourceFamily,
    confidence: sortCounts(countBy(rows, (r) => r.genres?.confidence ?? 'none')),
    taggedBy: sortCounts(countBy(rows, (r) => r.genres?.by ?? 'none')),
    noGenre: rows.filter((r) => !r.genres?.primary).map((r) => ({ key: r.key, artist: r.artist, album: r.album, sources: r.sources })),
    topUnmatched: unmatchedAll.slice(0, 40),
  };
  await writeAtomic(join(SEED_DIR, 'summary.json'), JSON.stringify(out, null, 2) + '\n');

  const table = (o, h1, h2) => `| ${h1} | ${h2} |\n|---|---:|\n${Object.entries(o).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n`;
  const families = Object.keys(out.byPrimaryFamily);
  const md = [
    '# Seed summary',
    '',
    `${out.albums} tagged albums (${out.multiSource} picked by more than one source). Generated ${out.generatedAt}.`,
    '',
    '## By source',
    table(out.bySource, 'Source', 'Albums'),
    '## By primary family',
    table(out.byPrimaryFamily, 'Family', 'Albums'),
    '## By subgenre',
    table(out.bySubgenre, 'Subgenre', 'Albums'),
    '## Source x family',
    `| Family | ${SOURCE_IDS.join(' | ')} |\n|---|${SOURCE_IDS.map(() => '---:').join('|')}|\n` +
      families.map((f) => `| ${f} | ${SOURCE_IDS.map((s) => bySourceFamily[s][f] ?? 0).join(' | ')} |`).join('\n') +
      '\n',
    '## Confidence',
    table(out.confidence, 'Confidence', 'Albums'),
    '## Tagged by',
    table(out.taggedBy, 'Method', 'Albums'),
    `## Albums with no genre (${out.noGenre.length})`,
    out.noGenre.map((r) => `- ${r.artist} - ${r.album} (${r.sources.join(', ')})`).join('\n') || '(none)',
    '',
    '## Top 40 unmatched tags',
    table(Object.fromEntries(out.topUnmatched.map((e) => [e.tag, e.count])), 'Tag', 'Count'),
  ].join('\n');
  await writeAtomic(join(SEED_DIR, 'summary.md'), md);

  console.log(`${out.albums} albums; by source ${JSON.stringify(out.bySource)}`);
  console.log(`families: ${JSON.stringify(out.byPrimaryFamily)}`);
  console.log(`confidence: ${JSON.stringify(out.confidence)}; no genre: ${out.noGenre.length}`);
  console.log(`Wrote ${join(SEED_DIR, 'summary.json')} and summary.md`);
}

// --- main ---------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const commands = { collect, tag, summary };
if (!commands[cmd]) {
  console.error('Usage: node scripts/picker/seed.mjs collect [--since YYYY-MM-DD] | tag [--limit N] [--source S] | summary');
  process.exit(1);
}
commands[cmd](args).catch((err) => {
  console.error(err);
  process.exit(1);
});
