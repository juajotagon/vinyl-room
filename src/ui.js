// Fills the page with the day's pick (title, genre tags, older/newer links),
// the history list with its genre filter, and the collage of past covers.
// Plain DOM, no framework, so the text is up before the 3D record loads.
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
// History state: the archive, which day is showing, and the genre filter
// (?genre=<familyId|subgenreId>, kept in the URL with replaceState).
// ---------------------------------------------------------------------------
let archive = [];
let current = null;
let filter = resolveFilter(new URLSearchParams(location.search).get('genre'));

export function setGenre(id) {
  filter = resolveFilter(id);
  const url = new URL(location.href);
  if (filter) url.searchParams.set('genre', filter.id);
  else url.searchParams.delete('genre');
  history.replaceState(null, '', url);
  renderHistory();
}

function chip(label, id, active, count) {
  return el(
    'button',
    { type: 'button', className: `chip-f${active ? ' on' : ''}`, dataset: { genre: id }, ariaPressed: String(active) },
    label,
    count != null && el('span', { className: 'n', textContent: count }),
  );
}

function filterBar() {
  const famCount = new Map();
  for (const a of archive) {
    const t = tagsOf(a.genres);
    for (const f of [t.primary, ...t.secondary]) if (f) famCount.set(f.id, { name: f.name, n: (famCount.get(f.id)?.n ?? 0) + 1 });
  }
  if (!famCount.size) return null;
  const fams = [...famCount].sort((a, b) => b[1].n - a[1].n || a[1].name.localeCompare(b[1].name));

  const bar = el('div', { className: 'filters' }, el('div', { className: 'frow' }, chip('all', '', !filter, archive.length), ...fams.map(([id, f]) => chip(f.name, id, filter?.family === id, f.n))));

  if (filter) {
    const subs = new Map();
    for (const a of archive.filter((x) => inFamily(x, filter.family))) {
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

function row(a) {
  const t = tagsOf(a.genres);
  const tags = [t.primary, ...t.subs].filter(Boolean).slice(0, 4);
  return el(
    'li',
    { className: `row${a.date === current ? ' current' : ''}` },
    el(
      'a',
      { href: `#${a.date}`, dataset: { date: a.date } },
      el('time', { dateTime: a.date, textContent: shortDate(a.date) }),
      a.cover ? el('img', { src: `data/${a.cover}`, alt: '', loading: 'lazy', width: 44, height: 44 }) : el('span', { className: 'nocover' }),
      el('span', { className: 'what' }, el('strong', { textContent: a.album }), el('span', { textContent: a.artist })),
    ),
    tags.length > 0 && el('span', { className: 'tags' }, ...tags.map((x, n) => tag(x, n === 0 && x.kind === 'family' ? 'primary' : ''))),
  );
}

export function renderHistory() {
  const shown = archive.filter((a) => (!filter ? true : filter.sub ? inSub(a, filter.sub) : inFamily(a, filter.family)));
  const months = new Map();
  for (const a of shown) {
    const m = monthName(a.date);
    if (!months.has(m)) months.set(m, []);
    months.get(m).push(a);
  }
  $('archive-list').replaceChildren(
    ...[
      filterBar(),
      shown.length === 0 && el('p', { className: 'empty-note', textContent: 'Nothing here yet.' }),
      ...[...months].map(([m, list]) => el('section', { className: 'month' }, el('h3', { textContent: m }), el('ol', {}, ...list.map(row)))),
    ].filter(Boolean),
  );
}

export function renderPick(pick, all) {
  archive = all;
  current = pick.date ?? null;
  const i = archive.findIndex((a) => a.date === pick.date);
  const day = i >= 0 ? archive.length - i : null;
  const t = tagsOf(pick.genres ?? archive[i]?.genres);

  $('post-head').replaceChildren(
    el('p', { className: 'dateline' }, pick.date ? `${i === 0 ? 'Today · ' : ''}${longDate(pick.date)}${day ? ` · day ${day}` : ''}` : 'A classic, while the archive is empty'),
    el('h1', { className: 'title', textContent: pick.album }),
    el('p', { className: 'byline' }, el('span', { className: 'artist', textContent: pick.artist }), pick.year && el('span', { className: 'year', textContent: pick.year })),
    hasGenres(t) && el('p', { className: 'tags' }, t.primary && tag(t.primary, 'primary'), ...t.subs.map((s) => tag(s)), ...t.secondary.map((s) => tag(s))),
  );

  const bandcamp = pick.links?.bandcamp;
  $('post-body').replaceChildren(...(bandcamp ? [el('a', { className: 'listen', href: bandcamp, target: '_blank', rel: 'noopener', textContent: 'Listen on Bandcamp' })] : []));

  const older = i >= 0 ? archive[i + 1] : null;
  const newer = i > 0 ? archive[i - 1] : null;
  const navLink = (a, dir) =>
    a
      ? el(
          'a',
          { href: `#${a.date}`, className: dir, dataset: { date: a.date } },
          el('span', { className: 'dir', textContent: dir === 'older' ? '← older' : 'newer →' }),
          el('span', { className: 'what', textContent: `${a.artist} – ${a.album}` }),
        )
      : el('span', { className: `${dir} empty` });
  $('post-nav').replaceChildren(navLink(older, 'older'), navLink(newer, 'newer'));
  document.querySelector('[data-nav="older"]').disabled = !older;
  document.querySelector('[data-nav="newer"]').disabled = !newer;

  renderHistory();

  // Collage: the current cover plus past ones, scattered (collage look only).
  const covers = archive.filter((a) => a.cover).slice(0, 9);
  $('collage').replaceChildren(
    ...covers.map((a, n) =>
      el(
        'a',
        { href: `#${a.date}`, className: 'chip', dataset: { date: a.date }, style: `--r:${((n * 37) % 15) - 7}deg;--n:${n}`, tabIndex: -1 },
        el('img', { src: `data/${a.cover}`, alt: '', loading: 'lazy' }),
      ),
    ),
  );

  const names = [t.primary, ...t.subs].filter(Boolean).map((x) => x.name);
  $('ticker').textContent = `${pick.artist} – ${pick.album}${names.length ? `  ·  ${names.join(' · ')}` : ''}`;
}
