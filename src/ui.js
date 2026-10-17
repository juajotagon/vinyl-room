// The info window (today's pick, the archive, an about page), the status-bar
// ticker and the skin switcher. Markup is skin-neutral; skins/*.css style it.

const el = (tag, { dataset, ...props } = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  Object.assign(node.dataset, dataset);
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
};

const LINK_NAMES = { bandcamp: 'Listen on Bandcamp', musicbrainz: 'MusicBrainz', discogs: 'Discogs' };
const VIEWS = { pick: ['01', 'Now spinning'], archive: ['02', 'Archive'], about: ['03', 'About'] };

export function createPanel({ onNavigate, onSkin }) {
  const root = document.getElementById('panel');
  const ticker = document.getElementById('ticker');
  const skinSelect = document.getElementById('skin');
  let view = 'pick';
  let current = null;
  let archive = [];

  skinSelect.value = document.documentElement.dataset.skin;
  skinSelect.addEventListener('change', () => {
    document.documentElement.dataset.skin = skinSelect.value;
    try {
      localStorage.setItem('skin', skinSelect.value);
    } catch {}
    onSkin?.(skinSelect.value);
  });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-date], [data-view], [data-today], [data-action]');
    if (!t) return;
    if (t.dataset.date) {
      e.preventDefault();
      view = 'pick';
      onNavigate(t.dataset.date);
      draw();
    } else if (t.dataset.today !== undefined) {
      e.preventDefault();
      view = 'pick';
      if (archive[0]) onNavigate(archive[0].date);
      draw();
    } else if (t.dataset.view) {
      e.preventDefault();
      view = view === t.dataset.view ? 'pick' : t.dataset.view;
      draw();
    } else if (t.dataset.action === 'expand') {
      root.classList.toggle('expanded');
    }
  });

  function titlebar() {
    const [n, name] = VIEWS[view];
    return el(
      'div',
      { className: 'titlebar' },
      el('span', { className: 'n', textContent: n }),
      el('span', { className: 'name', textContent: name }),
      el('span', { className: 'meta', textContent: view === 'pick' && current?.date ? current.date : '' }),
      el('button', { className: 'tb-btn', textContent: '–', title: 'Expand / shrink', ariaLabel: 'Expand or shrink', dataset: { action: 'expand' } }),
    );
  }

  function menubar() {
    const i = archive.findIndex((a) => a.date === current?.date);
    const older = i >= 0 ? archive[i + 1]?.date : null;
    const newer = i > 0 ? archive[i - 1]?.date : null;
    const btn = (label, date, title) =>
      el('button', { textContent: label, title, disabled: !date, ...(date ? { dataset: { date } } : {}) });
    return el(
      'div',
      { className: 'menubar' },
      btn('‹ prev', older, 'Previous day (←)'),
      btn('next ›', newer, 'Next day (→)'),
      el('button', { textContent: 'archive', className: view === 'archive' ? 'on' : '', dataset: { view: 'archive' } }),
      el('span', { className: 'spacer' }),
      el('span', { className: 'pos', textContent: i === 0 ? 'today' : i > 0 ? `day ${archive.length - i}/${archive.length}` : '' }),
    );
  }

  function pickDoc(pick) {
    const facts = [
      ['Artist', pick.artist],
      ['Album', pick.album],
      ['Year', pick.year],
      ['Tracks', pick.tracklist?.length || null],
    ].filter(([, v]) => v);
    const sources = (pick.sources ?? []).map((s) =>
      el('li', {}, el('a', { href: s.url, target: '_blank', rel: 'noopener' }, el('span', { textContent: s.name }), el('em', { textContent: s.label }))),
    );
    const links = Object.entries(pick.links ?? {}).map(([k, href]) =>
      el('a', { className: `btn ${k}`, href, target: '_blank', rel: 'noopener', textContent: LINK_NAMES[k] ?? k }),
    );
    return [
      el('h1', { className: 'album', textContent: pick.album }),
      el('div', { className: 'artist', textContent: pick.artist }),
      el('dl', { className: 'facts' }, ...facts.map(([k, v]) => el('div', {}, el('dt', { textContent: k }), el('dd', { textContent: v })))),
      pick.description && el('p', { className: 'desc', textContent: pick.description }),
      sources.length > 0 && el('h2', { textContent: 'Recommended by' }),
      sources.length > 0 && el('ul', { className: 'sources' }, ...sources),
      links.length > 0 && el('div', { className: 'links' }, ...links),
      !pick.date && el('p', { className: 'desc', textContent: 'No daily picks yet, so here is a classic. Run `npm run pick` to start the archive.' }),
    ];
  }

  function archiveDoc() {
    return [
      el('h1', { className: 'album', textContent: 'Archive' }),
      el('div', { className: 'artist', textContent: `${archive.length} day${archive.length === 1 ? '' : 's'} of picks` }),
      el(
        'ol',
        { className: 'archive' },
        ...archive.map((a) =>
          el(
            'li',
            {},
            el(
              'a',
              { href: `#${a.date}`, className: a.date === current?.date ? 'current' : '', dataset: { date: a.date } },
              a.cover ? el('img', { src: `data/${a.cover}`, alt: '', loading: 'lazy', width: 36, height: 36 }) : el('span', { className: 'nocover' }),
              el('span', { className: 'meta' }, el('strong', { textContent: a.album }), el('span', { textContent: `${a.artist} · ${a.date}` })),
            ),
          ),
        ),
      ),
    ];
  }

  function aboutDoc() {
    return [
      el('h1', { className: 'album', textContent: 'About' }),
      el('div', { className: 'artist', textContent: 'vinyl room' }),
      el('p', {
        className: 'desc',
        textContent:
          'Every morning this page picks one fresh album from what Bandcamp Daily, Stereogum and The Needle Drop recommended in the last two weeks. Albums more than one of them liked win, and nothing repeats.',
      }),
      el('p', { className: 'desc', textContent: 'Click the record to open the sleeve. Use the arrow keys or the archive to visit earlier days. Every day has its own link.' }),
      el('p', { className: 'desc', textContent: 'Covers and tracklists come from MusicBrainz and the Cover Art Archive. Try the skin menu up top.' }),
    ];
  }

  function draw() {
    if (!current) return;
    const body = view === 'archive' ? archiveDoc() : view === 'about' ? aboutDoc() : pickDoc(current);
    const doc = el('div', { className: 'doc', tabIndex: 0 }, ...body.filter(Boolean));
    root.replaceChildren(titlebar(), menubar(), doc);
  }

  return {
    render(pick, list) {
      current = pick;
      archive = list;
      root.hidden = false;
      // Re-trigger the entrance animation for the new day.
      root.style.animation = 'none';
      void root.offsetWidth;
      root.style.animation = '';
      draw();
      const tracks = pick.tracklist?.length ? pick.tracklist.map((t, n) => `${String(n + 1).padStart(2, '0')} ${t}`).join('  ·  ') : '';
      ticker.textContent = `now spinning: ${pick.artist} – ${pick.album}${tracks ? `  ·  ${tracks}` : ''}`;
    },
  };
}
