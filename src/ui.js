// Fills the page with the day's pick: heading, write-up, sources, links,
// tracklist, older/newer links, the archive and the collage of past covers.
// Plain DOM, no framework, so the text is up before the 3D record loads.

const el = (tag, { dataset, ...props } = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  Object.assign(node.dataset, dataset);
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
};

const $ = (id) => document.getElementById(id);
const LINK_NAMES = { bandcamp: 'Listen on Bandcamp', musicbrainz: 'MusicBrainz', discogs: 'Discogs' };

export function longDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const initials = (name) =>
  name
    .replace(/^the\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export function renderPick(pick, archive) {
  const i = archive.findIndex((a) => a.date === pick.date);
  const day = i >= 0 ? archive.length - i : null;

  $('post-head').replaceChildren(
    el('p', { className: 'dateline' }, pick.date ? `${i === 0 ? 'Today · ' : ''}${longDate(pick.date)}${day ? ` · day ${day}` : ''}` : 'A classic, while the archive is empty'),
    el('h1', { className: 'title', textContent: pick.album }),
    el('p', { className: 'byline' }, el('span', { className: 'artist', textContent: pick.artist }), pick.year && el('span', { className: 'year', textContent: pick.year })),
  );

  const sources = (pick.sources ?? []).map((s) =>
    el(
      'li',
      {},
      el('span', { className: 'avatar', textContent: initials(s.name), ariaHidden: 'true' }),
      el('a', { href: s.url, target: '_blank', rel: 'noopener' }, el('strong', { textContent: s.name }), el('span', { className: 'label', textContent: s.label })),
    ),
  );
  const links = Object.entries(pick.links ?? {}).map(([k, href]) =>
    el('a', { className: `pill ${k}`, href, target: '_blank', rel: 'noopener', textContent: LINK_NAMES[k] ?? k }),
  );
  const tracks = pick.tracklist ?? [];

  $('post-body').replaceChildren(
    ...[
      pick.description && el('p', { className: 'lede', textContent: pick.description }),
      sources.length > 0 && el('h2', { textContent: 'why it’s here' }),
      sources.length > 0 && el('ul', { className: 'sources' }, ...sources),
      links.length > 0 && el('p', { className: 'links' }, ...links),
      tracks.length > 0 && el('h2', { textContent: `tracklist · ${tracks.length}` }),
      tracks.length > 0 && el('ol', { className: 'tracks' }, ...tracks.map((t) => el('li', { textContent: t }))),
    ].filter(Boolean),
  );

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

  $('archive-list').replaceChildren(
    ...archive.map((a, n) =>
      el(
        'li',
        {},
        el(
          'a',
          { href: `#${a.date}`, className: a.date === pick.date ? 'current' : '', dataset: { date: a.date } },
          el('span', { className: 'num', textContent: String(archive.length - n).padStart(2, '0') }),
          a.cover ? el('img', { src: `data/${a.cover}`, alt: '', loading: 'lazy', width: 40, height: 40 }) : el('span', { className: 'nocover' }),
          el('span', { className: 'what' }, el('strong', { textContent: a.album }), el('span', { textContent: a.artist })),
          el('time', { dateTime: a.date, textContent: a.date.slice(5).replace('-', '.') }),
        ),
      ),
    ),
  );

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

  const t = tracks.length ? `  ·  ${tracks.map((x, n) => `${n + 1}. ${x}`).join('  ·  ')}` : '';
  $('ticker').textContent = `${pick.artist} – ${pick.album}${t}`;
}
