// The info panel: date navigation, description, who recommended it, links,
// and the archive of past days.

const el = (tag, { dataset, ...props } = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  Object.assign(node.dataset, dataset);
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
};

const LINK_NAMES = { bandcamp: 'Listen on Bandcamp', musicbrainz: 'MusicBrainz', discogs: 'Discogs' };

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function createPanel({ onNavigate }) {
  const root = document.getElementById('panel');
  let archiveOpen = false;
  let current = null;
  let archive = [];

  root.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-date]');
    if (nav) {
      archiveOpen = false;
      onNavigate(nav.dataset.date);
    } else if (e.target.closest('[data-action="archive"]')) {
      archiveOpen = !archiveOpen;
      draw();
    } else if (e.target.closest('[data-action="expand"]')) {
      root.classList.toggle('expanded');
    }
  });

  function navButton(label, date, title) {
    return el('button', { className: 'nav', textContent: label, title, disabled: !date, ...(date ? { dataset: { date } } : {}) });
  }

  function draw() {
    const pick = current;
    const i = archive.findIndex((a) => a.date === pick.date);
    const older = i >= 0 ? archive[i + 1]?.date : null;
    const newer = i > 0 ? archive[i - 1]?.date : null;

    const head = pick.date
      ? el(
          'div',
          { className: 'datebar' },
          navButton('‹', older, 'Previous day (←)'),
          el('span', { className: 'date', textContent: i === 0 ? `Today · ${formatDate(pick.date)}` : formatDate(pick.date) }),
          navButton('›', newer, 'Next day (→)'),
          el('button', { className: 'archive-btn', textContent: archiveOpen ? 'Close' : `Archive (${archive.length})`, dataset: { action: 'archive' } }),
        )
      : el('div', { className: 'datebar' }, el('span', { className: 'date', textContent: 'No picks yet · showing a classic' }));

    const body = archiveOpen ? archiveList() : details(pick);
    root.replaceChildren(head, body);
  }

  function details(pick) {
    const sources = (pick.sources ?? []).map((s) =>
      el('a', { className: 'chip', href: s.url, target: '_blank', rel: 'noopener', textContent: `${s.name} · ${s.label}` }),
    );
    const links = Object.entries(pick.links ?? {}).map(([k, href]) =>
      el('a', { className: `link ${k}`, href, target: '_blank', rel: 'noopener', textContent: LINK_NAMES[k] ?? k }),
    );
    return el(
      'div',
      { className: 'details' },
      el('h2', {}, el('span', { className: 'album', textContent: pick.album }), el('span', { className: 'artist', textContent: ` ${pick.artist}${pick.year ? ` · ${pick.year}` : ''}` })),
      pick.description && el('p', { className: 'desc', textContent: pick.description, dataset: { action: 'expand' }, title: 'Tap to expand' }),
      sources.length > 0 && el('div', { className: 'chips' }, el('span', { className: 'muted', textContent: 'Picked by' }), ...sources),
      links.length > 0 && el('div', { className: 'links' }, ...links),
    );
  }

  function archiveList() {
    return el(
      'ol',
      { className: 'archive' },
      ...archive.map((a) =>
        el(
          'li',
          {},
          el(
            'button',
            { className: a.date === current.date ? 'current' : '', dataset: { date: a.date } },
            a.cover ? el('img', { src: `data/${a.cover}`, alt: '', loading: 'lazy', width: 40, height: 40 }) : el('span', { className: 'nocover' }),
            el('span', { className: 'meta' }, el('strong', { textContent: a.album }), el('span', { textContent: `${a.artist} · ${formatDate(a.date)}` })),
          ),
        ),
      ),
    );
  }

  return {
    render(pick, list) {
      current = pick;
      archive = list;
      root.hidden = false;
      root.classList.remove('expanded');
      draw();
    },
  };
}
