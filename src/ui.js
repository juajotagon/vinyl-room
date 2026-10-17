// The "now_spinning.txt" window: a plain-text page about the day's pick, the
// archive of past days, and a short about page. Plus the status-bar ticker.

const el = (tag, { dataset, ...props } = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  Object.assign(node.dataset, dataset);
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
};

const LINK_NAMES = { bandcamp: 'listen on bandcamp', musicbrainz: 'musicbrainz entry', discogs: 'discogs entry' };
const FILE_NAMES = { pick: 'now_spinning.txt', archive: 'archive.txt', about: 'readme.txt' };

const rule = () => el('div', { className: 'rule', textContent: '='.repeat(80), ariaHidden: 'true' });

export function createPanel({ onNavigate }) {
  const root = document.getElementById('panel');
  const ticker = document.getElementById('ticker');
  let view = 'pick';
  let current = null;
  let archive = [];

  // One click handler for the window, the top bar and anything else with
  // data-date / data-view / data-today.
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
    const date = current?.date ? ` - ${current.date}` : '';
    return el(
      'div',
      { className: 'titlebar' },
      el('span', { className: 'name', textContent: `${FILE_NAMES[view]}${view === 'pick' ? date : ''}` }),
      el('button', { textContent: '_', title: 'Expand / shrink', dataset: { action: 'expand' } }),
      el('button', { textContent: 'x', title: 'Back to today', dataset: { today: '' } }),
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
      btn('< prev', older, 'Previous day (←)'),
      btn('next >', newer, 'Next day (→)'),
      el('button', { textContent: 'archive', dataset: { view: 'archive' } }),
      el('span', { className: 'spacer' }),
      el('span', { className: 'date', textContent: i === 0 ? 'today' : current?.date ? `day ${archive.length - i} of ${archive.length}` : '' }),
    );
  }

  function pickDoc(pick) {
    const facts = [
      ['ARTIST', pick.artist],
      ['ALBUM', pick.album],
      ['YEAR', pick.year],
      ['PICKED', pick.date],
      ['TRACKS', pick.tracklist?.length || null],
    ].filter(([, v]) => v);
    const sources = (pick.sources ?? []).map((s) =>
      el('li', {}, el('a', { href: s.url, target: '_blank', rel: 'noopener', textContent: `${s.name.toLowerCase()} (${s.label.toLowerCase()})` })),
    );
    const links = Object.entries(pick.links ?? {}).map(([k, href]) =>
      el('li', {}, el('a', { href, target: '_blank', rel: 'noopener', textContent: LINK_NAMES[k] ?? k })),
    );
    return [
      el('h1', { textContent: `${pick.artist} - ${pick.album}` }),
      rule(),
      el('dl', { className: 'facts' }, ...facts.map(([k, v]) => el('div', {}, el('dt', { textContent: k }), el('dd', { textContent: v })))),
      pick.description && el('p', { textContent: pick.description }),
      sources.length > 0 && el('div', { textContent: 'RECOMMENDED BY:' }),
      sources.length > 0 && el('ul', { className: 'cmds' }, ...sources),
      links.length > 0 && el('div', { textContent: 'LINKS:' }),
      links.length > 0 && el('ul', { className: 'cmds' }, ...links),
      !pick.date && el('p', { textContent: 'No daily picks yet, so here is a classic. Run `npm run pick` to start the archive.' }),
    ];
  }

  function archiveDoc() {
    return [
      el('h1', { textContent: `archive - ${archive.length} day${archive.length === 1 ? '' : 's'}` }),
      rule(),
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
              el('span', { textContent: a.date }),
              el('span', { className: 't', textContent: `${a.artist} - ${a.album}` }),
            ),
          ),
        ),
      ),
    ];
  }

  function aboutDoc() {
    return [
      el('h1', { textContent: 'readme' }),
      rule(),
      el('p', {
        textContent:
          'Every morning this page picks one fresh album from what Bandcamp Daily, Stereogum and The Needle Drop recommended in the last two weeks. Albums more than one of them liked win, and nothing repeats.',
      }),
      el('p', { textContent: 'Click the record to open the sleeve. Use the arrow keys or the archive to visit earlier days. Every day has its own link.' }),
      el('p', { textContent: 'Covers and tracklists come from MusicBrainz and the Cover Art Archive.' }),
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
      // Re-trigger the settle animation for the new day.
      root.style.animation = 'none';
      void root.offsetWidth;
      root.style.animation = '';
      draw();
      const tracks = pick.tracklist?.length ? pick.tracklist.map((t, n) => `${String(n + 1).padStart(2, '0')}. ${t}`).join('   ·   ') : '';
      ticker.textContent = `now spinning: ${pick.artist} - ${pick.album}${tracks ? `   ·   ${tracks}` : ''}`;
    },
  };
}
