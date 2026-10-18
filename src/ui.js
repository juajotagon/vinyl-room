// Fills the page with the day's pick (title, genre tags, older/newer links),
// the history list with its genre filter, and the collage of past covers.
// Plain DOM, no framework, so the text is up before the 3D record loads.
import { coversOf } from './art.js';
import { tagsOf, hasGenres, resolveFilter, inFamily, inSub } from './genres.js';

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
// History state: the daily archive, the catalogue, which one is showing, the
// genre filter (?genre=<familyId|subgenreId>) and the tab (?view=catalogue).
// Both are kept in the URL with replaceState.
// ---------------------------------------------------------------------------
const PAGE = 60; // catalogue/archive rows rendered per chunk
let archive = [];
let catalogue = [];
let current = null; // date of the daily pick showing
let currentKey = null; // key of the catalogue album showing
let view = new URLSearchParams(location.search).get('view') === 'catalogue' ? 'catalogue' : 'daily';
let filter = resolveFilter(new URLSearchParams(location.search).get('genre'));

const activeView = () => (view === 'catalogue' && catalogue.length ? 'catalogue' : 'daily');
const keyHref = (k) => `#c/${encodeURIComponent(k)}`;

function setParam(name, value) {
  const url = new URL(location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  history.replaceState(null, '', url);
}

export function setGenre(id) {
  filter = resolveFilter(id);
  setParam('genre', filter?.id);
  renderHistory();
}

export function setView(v) {
  view = v === 'catalogue' ? 'catalogue' : 'daily';
  setParam('view', view === 'catalogue' ? 'catalogue' : null);
  renderHistory();
}

export function setCatalogue(list, daily = archive) {
  archive = daily;
  catalogue = list;
  renderHistory();
}

const matches = (a) => (!filter ? true : filter.sub ? inSub(a, filter.sub) : inFamily(a, filter.family));
export const catalogueShown = () => catalogue.filter(matches);

function chip(label, id, active, count) {
  return el(
    'button',
    { type: 'button', className: `chip-f${active ? ' on' : ''}`, dataset: { genre: id }, ariaPressed: String(active) },
    label,
    count != null && el('span', { className: 'n', textContent: count }),
  );
}

function tabs() {
  if (!catalogue.length) return null;
  const tab = (v, label) =>
    el('button', { type: 'button', className: `chip-f tab${activeView() === v ? ' on' : ''}`, ariaPressed: String(activeView() === v), onclick: () => setView(v) }, label);
  return el('div', { className: 'frow tabs', role: 'group', ariaLabel: 'History view' }, tab('daily', 'daily picks'), tab('catalogue', `catalogue (${catalogue.length})`));
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

// Thumbnail straight from its source (no proxy needed for <img>). If one URL
// fails, try the next, then fall back to an empty square.
function thumb(a) {
  const urls = coversOf(a);
  if (!urls.length) return el('span', { className: 'nocover' });
  let i = 0;
  const img = el('img', { src: urls[0], alt: '', loading: 'lazy', width: 44, height: 44, referrerPolicy: 'no-referrer' });
  img.onerror = () => {
    if (++i < urls.length) img.src = urls[i];
    else img.replaceWith(el('span', { className: 'nocover' }));
  };
  return img;
}

function row(a, kind) {
  const t = tagsOf(a.genres);
  const tags = [t.primary, ...t.subs].filter(Boolean).slice(0, 4);
  const isCat = kind === 'catalogue';
  return el(
    'li',
    { className: `row${(isCat ? a.key === currentKey : a.date === current) ? ' current' : ''}` },
    el(
      'a',
      isCat ? { href: keyHref(a.key), dataset: { key: a.key } } : { href: `#${a.date}`, dataset: { date: a.date } },
      isCat ? el('time', { textContent: a.year ?? '' }) : el('time', { dateTime: a.date, textContent: shortDate(a.date) }),
      thumb(a),
      el('span', { className: 'what' }, el('strong', { textContent: a.album }), el('span', { textContent: a.artist })),
    ),
    tags.length > 0 && el('span', { className: 'tags' }, ...tags.map((x, n) => tag(x, n === 0 && x.kind === 'family' ? 'primary' : ''))),
  );
}

export function renderHistory() {
  const kind = activeView();
  const all = kind === 'catalogue' ? catalogue : archive;
  const list = all.filter(matches);
  const body = el('div', { className: 'hist-body', dataset: { view: kind } });
  const moreBtn = el('button', { type: 'button', className: 'more' });

  let pos = 0;
  let lastMonth = null;
  let ol = null;
  const more = () => {
    const end = Math.min(pos + PAGE, list.length);
    for (; pos < end; pos++) {
      const a = list[pos];
      const m = monthName(kind === 'catalogue' ? a.first : a.date);
      if (m !== lastMonth) {
        lastMonth = m;
        ol = el('ol');
        body.insertBefore(el('section', { className: 'month' }, el('h3', { textContent: m }), ol), moreBtn);
      }
      ol.append(row(a, kind));
    }
    moreBtn.hidden = pos >= list.length;
    moreBtn.textContent = `show more (${list.length - pos} left)`;
  };
  moreBtn.onclick = more;
  body.append(moreBtn);
  more();

  $('archive-list').replaceChildren(
    ...[tabs(), filterBar(all), list.length === 0 && el('p', { className: 'empty-note', textContent: 'Nothing here yet.' }), body].filter(Boolean),
  );
}

const tagsBlock = (t) => hasGenres(t) && el('p', { className: 'tags' }, t.primary && tag(t.primary, 'primary'), ...t.subs.map((s) => tag(s)), ...t.secondary.map((s) => tag(s)));
const listenLink = (pick) => {
  const bandcamp = pick.links?.bandcamp;
  $('post-body').replaceChildren(...(bandcamp ? [el('a', { className: 'listen', href: bandcamp, target: '_blank', rel: 'noopener', textContent: 'Listen on Bandcamp' })] : []));
};
const navLinks = (older, newer, href, attr, label) => {
  const link = (a, dir) =>
    a
      ? el(
          'a',
          { href: href(a), className: dir, dataset: { [attr]: label(a) } },
          el('span', { className: 'dir', textContent: dir === 'older' ? '← older' : 'newer →' }),
          el('span', { className: 'what', textContent: `${a.artist} – ${a.album}` }),
        )
      : el('span', { className: `${dir} empty` });
  $('post-nav').replaceChildren(link(older, 'older'), link(newer, 'newer'));
  document.querySelector('[data-nav="older"]').disabled = !older;
  document.querySelector('[data-nav="newer"]').disabled = !newer;
};

function afterRender(pick, t) {
  renderHistory();
  // Collage: the current cover plus past ones, scattered (collage look only).
  const covers = archive.filter((a) => coversOf(a).length).slice(0, 9);
  $('collage').replaceChildren(
    ...covers.map((a, n) =>
      el(
        'a',
        { href: `#${a.date}`, className: 'chip', dataset: { date: a.date }, style: `--r:${((n * 37) % 15) - 7}deg;--n:${n}`, tabIndex: -1 },
        el('img', { src: coversOf(a)[0], alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }),
      ),
    ),
  );
  const names = [t.primary, ...t.subs].filter(Boolean).map((x) => x.name);
  $('ticker').textContent = `${pick.artist} – ${pick.album}${names.length ? `  ·  ${names.join(' · ')}` : ''}`;
}

// An album from the catalogue. `list` is the (filtered) list to step through.
export function renderCatalogueAlbum(pick, list) {
  current = null;
  currentKey = pick.key;
  const i = list.findIndex((a) => a.key === pick.key);
  const t = tagsOf(pick.genres);
  $('post-head').replaceChildren(
    el('p', { className: 'dateline' }, el('span', { className: 'from-cat', textContent: 'from the catalogue' }), pick.first ? ` · first recommended ${monthName(pick.first)}` : ''),
    el('h1', { className: 'title', textContent: pick.album }),
    el('p', { className: 'byline' }, el('span', { className: 'artist', textContent: pick.artist }), pick.year && el('span', { className: 'year', textContent: pick.year })),
    tagsBlock(t),
  );
  listenLink(pick);
  navLinks(i >= 0 ? list[i + 1] : null, i > 0 ? list[i - 1] : null, (a) => keyHref(a.key), 'key', (a) => a.key);
  afterRender(pick, t);
}

export function renderPick(pick, all) {
  archive = all;
  current = pick.date ?? null;
  currentKey = null;
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
  navLinks(i >= 0 ? archive[i + 1] : null, i > 0 ? archive[i - 1] : null, (a) => `#${a.date}`, 'date', (a) => a.date);
  afterRender(pick, t);
}
