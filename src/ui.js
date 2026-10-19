// Fills the page with the day's pick (title, genre tags, older/newer links),
// the week strip, the crates wall with its genre filter, the full history list
// and the collage of past covers.
// Plain DOM, no framework, so the text is up before the 3D record loads.
import { coversOf } from './art.js';
import { tagsOf, hasGenres, resolveFilter, inFamily, inSub } from './genres.js';
import { FAMILY, SUBGENRE } from '../scripts/picker/taxonomy.mjs';

const FAMILY_NAME = (id) => FAMILY[id]?.name ?? id;
const SUBGENRE_NAME = (id) => SUBGENRE[id]?.name ?? id;

const el = (tag, { dataset, ...props } = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  Object.assign(node.dataset, dataset);
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
};

const $ = (id) => document.getElementById(id);

export function longDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
const monthName = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const shortDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const tag = (t, extra = '') =>
  el('button', { type: 'button', className: `tag ${t.kind} ${extra}`.trim(), textContent: t.name, dataset: { genre: t.id }, title: `Show ${t.name} picks` });

// ---------------------------------------------------------------------------
// Page state: the daily archive, the catalogue, and the crates (both merged,
// one entry per album, daily picks winning). The genre filter lives in the URL
// as ?genre=<familyId|subgenreId> (kept with replaceState).
// ---------------------------------------------------------------------------
const CHUNK = 60; // tiles per chunk of the wall
const WEEK = 7;
let archive = [];
let catalogue = [];
let crates = []; // merged, newest first
let current = null; // hash value of the album showing: "2026-10-18" or "c/<key>"
let filter = resolveFilter(new URLSearchParams(location.search).get('genre'));
let observer = null;

// Same normalisation as albumKey() in scripts/picker/sources.mjs.
const slug = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const norm = (s) =>
  slug(s.replace(/\((deluxe|expanded|remaster(ed)?)[^)]*\)/gi, ''))
    .replace(/^the-/, '')
    .replace(/-/g, '');
export const albumKey = (artist, album) => `${norm(artist)}|${norm(album)}`;

// Where an entry lives in the URL hash.
export const hashOf = (a) => (a.date ? a.date : `c/${encodeURIComponent(a.key)}`);

function merge() {
  const seen = new Set();
  const out = [];
  for (const a of archive) {
    const key = a.key ?? albumKey(a.artist, a.album);
    seen.add(key);
    out.push({ ...a, key, daily: true });
  }
  for (const a of catalogue) {
    if (seen.has(a.key) || seen.has(albumKey(a.artist, a.album))) continue;
    out.push({ ...a, daily: false });
  }
  // newest first by the day it was picked / first recommended (stable)
  out.sort((x, y) => (y.date ?? y.first ?? '').localeCompare(x.date ?? x.first ?? ''));
  return out;
}

function setParam(name, value) {
  const url = new URL(location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  history.replaceState(null, '', url);
}

export function setGenre(id) {
  filter = resolveFilter(id);
  setParam('genre', filter?.id);
  renderCrates();
}

export function setCatalogue(list, daily = archive) {
  archive = daily;
  catalogue = list;
  crates = merge();
  renderWeek();
  renderCrates();
  renderHistory();
  markCurrent();
}

const matches = (a) => (!filter ? true : filter.sub ? inSub(a, filter.sub) : inFamily(a, filter.family));
// The albums in the current crate (what older/newer and the dice step through).
export const cratesShown = () => crates.filter(matches);
export const cratesAll = () => crates;

// A random album from the current crate, as a hash value (or null).
export function randomHash() {
  const list = cratesShown().filter((a) => hashOf(a) !== current);
  if (!list.length) return null;
  return hashOf(list[Math.floor(Math.random() * list.length)]);
}

function chip(label, id, active, count) {
  return el(
    'button',
    { type: 'button', className: `chip-f${active ? ' on' : ''}`, dataset: { genre: id }, ariaPressed: String(active) },
    label,
    count != null && el('span', { className: 'n', textContent: count }),
  );
}

function filterBar(list) {
  const famCount = new Map();
  for (const a of list) {
    const t = tagsOf(a.genres);
    for (const f of [t.primary, ...t.secondary]) if (f) famCount.set(f.id, { name: f.name, n: (famCount.get(f.id)?.n ?? 0) + 1 });
  }
  if (!famCount.size) return null;
  const fams = [...famCount].sort((a, b) => b[1].n - a[1].n || a[1].name.localeCompare(b[1].name));

  const bar = el('div', { className: 'filters' }, el('div', { className: 'frow' }, chip('all', '', !filter, list.length), ...fams.map(([id, f]) => chip(f.name, id, filter?.family === id, f.n))));

  if (filter) {
    const subs = new Map();
    for (const a of list.filter((x) => inFamily(x, filter.family))) {
      for (const s of tagsOf(a.genres).subs) if (s.family === filter.family) subs.set(s.id, { name: s.name, n: (subs.get(s.id)?.n ?? 0) + 1 });
    }
    if (subs.size) {
      bar.append(
        el(
          'div',
          { className: 'frow sub' },
          ...[...subs].sort((a, b) => b[1].n - a[1].n || a[1].name.localeCompare(b[1].name)).map(([id, s]) => chip(s.name, id, filter.sub === id, s.n)),
        ),
      );
    }
  }
  return bar;
}

// A cover straight from its source (no proxy needed for <img>). If one URL
// fails, try the next; with none left, `onNone` gets the broken <img>.
function coverImg(a, size, onNone) {
  const urls = coversOf(a);
  if (!urls.length) return null;
  let i = 0;
  const img = el('img', { src: urls[0], alt: '', loading: 'lazy', decoding: 'async', width: size, height: size, referrerPolicy: 'no-referrer' });
  img.onerror = () => {
    if (++i < urls.length) img.src = urls[i];
    else onNone(img);
  };
  return img;
}

function row(a) {
  const t = tagsOf(a.genres);
  const tags = [t.primary, ...t.subs].filter(Boolean).slice(0, 4);
  const img = coverImg(a, 44, (i) => i.replaceWith(el('span', { className: 'nocover' }))) ?? el('span', { className: 'nocover' });
  return el(
    'li',
    { className: 'row' },
    el(
      'a',
      { href: `#${a.date}`, dataset: { open: a.date } },
      el('time', { dateTime: a.date, textContent: shortDate(a.date) }),
      img,
      el('span', { className: 'what' }, el('strong', { textContent: a.album }), el('span', { textContent: a.artist })),
    ),
    tags.length > 0 && el('span', { className: 'tags' }, ...tags.map((x, n) => tag(x, n === 0 && x.kind === 'family' ? 'primary' : ''))),
  );
}

// ---- this week: the last seven daily picks --------------------------------
function renderWeek() {
  const box = $('week-list');
  if (!box) return;
  box.replaceChildren(
    ...archive.slice(0, WEEK).map((a, i) => {
      const img = coverImg(a, 160, (im) => im.replaceWith(el('span', { className: 'nocover', textContent: `${a.artist} – ${a.album}` })));
      return el(
        'li',
        {},
        el(
          'a',
          { href: `#${a.date}`, className: `wk${i === 0 ? ' today' : ''}`, dataset: { open: a.date }, title: `${a.album} – ${a.artist}`, ariaLabel: `${a.album} by ${a.artist}, ${shortDate(a.date)}` },
          el('span', { className: 'cv' }, img ?? el('span', { className: 'nocover', textContent: `${a.artist} – ${a.album}` })),
          el('time', { dateTime: a.date, textContent: i === 0 ? 'today' : shortDate(a.date) }),
        ),
      );
    }),
  );
}

// ---- dig the crates: one wall, everything ---------------------------------
function tile(a) {
  const title = `${a.album} – ${a.artist}`;
  const a_ = el(
    'a',
    { href: `#${hashOf(a)}`, className: `tile${a.daily ? ' pick' : ''}`, dataset: { open: hashOf(a) }, title, ariaLabel: `${title}${a.daily ? ' (pick of the day)' : ''}` },
  );
  const plain = () => {
    a_.classList.add('plain');
    a_.querySelector('img')?.remove();
  };
  const img = coverImg(a, 200, plain);
  if (img) a_.append(img);
  else a_.classList.add('plain');
  a_.append(el('span', { className: 'cap' }, el('strong', { textContent: a.album }), el('span', { textContent: a.artist })));
  if (a.daily) a_.append(el('span', { className: 'mark', textContent: '★ pick', title: 'pick of the day' }));
  return a_;
}

function renderCrates() {
  const box = $('crates-body');
  if (!box) return;
  observer?.disconnect();
  const list = cratesShown();
  const wall = el('div', { className: 'wall', id: 'crate-wall' });
  const more = el('button', { type: 'button', className: 'more dig' });
  let pos = 0;
  const load = () => {
    const end = Math.min(pos + CHUNK, list.length);
    const frag = document.createDocumentFragment();
    for (; pos < end; pos++) frag.append(tile(list[pos]));
    wall.append(frag);
    more.hidden = pos >= list.length;
    more.textContent = `dig deeper (${list.length - pos} more)`;
    markCurrent();
  };
  more.onclick = load;
  load();
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && !more.hidden && load(), { rootMargin: '600px 0px' });
    observer.observe(more);
  }
  box.replaceChildren(
    ...[
      filterBar(crates),
      el('p', { className: 'crate-count', textContent: `${list.length} album${list.length === 1 ? '' : 's'}${filter ? ` in ${filter.sub ? SUBGENRE_NAME(filter.sub) : FAMILY_NAME(filter.family)}` : ' in the crates'}` }),
      list.length === 0 && el('p', { className: 'empty-note', textContent: 'Nothing here yet.' }),
      wall,
      more,
    ].filter(Boolean),
  );
}

// ---- full history: month-grouped list of the daily picks --------------------
function renderHistory() {
  const box = $('archive-list');
  if (!box) return;
  const body = el('div', { className: 'hist-body' });
  const moreBtn = el('button', { type: 'button', className: 'more' });
  let pos = 0;
  let lastMonth = null;
  let ol = null;
  const more = () => {
    const end = Math.min(pos + CHUNK, archive.length);
    for (; pos < end; pos++) {
      const a = archive[pos];
      const m = monthName(a.date);
      if (m !== lastMonth) {
        lastMonth = m;
        ol = el('ol');
        body.insertBefore(el('section', { className: 'month' }, el('h3', { textContent: m }), ol), moreBtn);
      }
      ol.append(row(a));
    }
    moreBtn.hidden = pos >= archive.length;
    moreBtn.textContent = `show more (${archive.length - pos} left)`;
    markCurrent();
  };
  moreBtn.onclick = more;
  body.append(moreBtn);
  more();
  box.replaceChildren(archive.length === 0 ? el('p', { className: 'empty-note', textContent: 'Nothing here yet.' }) : body);
}

// Highlight whatever is open in the strip, the wall and the history list.
function markCurrent() {
  for (const n of document.querySelectorAll('[data-open]')) {
    const on = n.dataset.open === current;
    n.classList.toggle('current', on);
    n.closest('.row')?.classList.toggle('current', on);
    if (on) n.setAttribute('aria-current', 'true');
    else n.removeAttribute('aria-current');
  }
}

const tagsBlock = (t) => hasGenres(t) && el('p', { className: 'tags' }, t.primary && tag(t.primary, 'primary'), ...t.subs.map((s) => tag(s)), ...t.secondary.map((s) => tag(s)));
const listenLink = (pick) => {
  const bandcamp = pick.links?.bandcamp;
  $('post-body').replaceChildren(...(bandcamp ? [el('a', { className: 'listen', href: bandcamp, target: '_blank', rel: 'noopener', textContent: 'Listen on Bandcamp' })] : []));
};
const navLinks = (older, newer) => {
  const link = (a, dir) =>
    a
      ? el(
          'a',
          { href: `#${hashOf(a)}`, className: dir, dataset: { open: hashOf(a) } },
          el('span', { className: 'dir', textContent: dir === 'older' ? '← older' : 'newer →' }),
          el('span', { className: 'what', textContent: `${a.artist} – ${a.album}` }),
        )
      : el('span', { className: `${dir} empty` });
  $('post-nav').replaceChildren(link(older, 'older'), link(newer, 'newer'));
  document.querySelector('[data-nav="older"]').disabled = !older;
  document.querySelector('[data-nav="newer"]').disabled = !newer;
};

function afterRender(pick, t) {
  markCurrent();
  // Collage: the current cover plus past ones, scattered (collage look only).
  const covers = archive.filter((a) => coversOf(a).length).slice(0, 9);
  $('collage').replaceChildren(
    ...covers.map((a, n) =>
      el(
        'a',
        { href: `#${a.date}`, className: 'chip', dataset: { open: a.date }, style: `--r:${((n * 37) % 15) - 7}deg;--n:${n}`, tabIndex: -1 },
        el('img', { src: coversOf(a)[0], alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }),
      ),
    ),
  );
  const names = [t.primary, ...t.subs].filter(Boolean).map((x) => x.name);
  $('ticker').textContent = `${pick.artist} – ${pick.album}${names.length ? `  ·  ${names.join(' · ')}` : ''}`;
}

// An album from the catalogue. `list` is the (filtered) list to step through.
export function renderCatalogueAlbum(pick, list) {
  current = `c/${encodeURIComponent(pick.key)}`;
  const i = list.findIndex((a) => a.key === pick.key);
  const t = tagsOf(pick.genres);
  $('post-head').replaceChildren(
    el('p', { className: 'dateline' }, el('span', { className: 'from-cat', textContent: 'from the catalogue' }), pick.first ? ` · first recommended ${monthName(pick.first)}` : ''),
    el('h1', { className: 'title', textContent: pick.album }),
    el('p', { className: 'byline' }, el('span', { className: 'artist', textContent: pick.artist }), pick.year && el('span', { className: 'year', textContent: pick.year })),
    tagsBlock(t),
  );
  listenLink(pick);
  navLinks(i >= 0 ? list[i + 1] : null, i > 0 ? list[i - 1] : null);
  afterRender(pick, t);
}

export function renderPick(pick, all) {
  archive = all;
  current = pick.date ?? null;
  const i = archive.findIndex((a) => a.date === pick.date);
  const day = i >= 0 ? archive.length - i : null;
  const t = tagsOf(pick.genres ?? archive[i]?.genres);

  $('post-head').replaceChildren(
    el(
      'p',
      { className: 'dateline' },
      pick.date ? `${i === 0 ? 'Today · ' : ''}${longDate(pick.date)}${day ? ` · day ${day}` : ''}` : 'A classic, while the archive is empty',
      pick.fromCatalogue && el('span', { className: 'from-cat', textContent: ' · from the catalogue' }),
    ),
    el('h1', { className: 'title', textContent: pick.album }),
    el('p', { className: 'byline' }, el('span', { className: 'artist', textContent: pick.artist }), pick.year && el('span', { className: 'year', textContent: pick.year })),
    tagsBlock(t),
  );
  listenLink(pick);
  navLinks(i >= 0 ? archive[i + 1] : null, i > 0 ? archive[i - 1] : null);
  afterRender(pick, t);
}
