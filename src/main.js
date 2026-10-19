// Page logic: load the archive and the day's pick, render the text right away,
// then load the 3D record (three.js is most of the bundle) in the background.
import { loadArchive, loadPick, loadCatalogue, loadCatalogueAlbum, loadFallbackAlbum, placeholderAlbum, paletteFrom } from './art.js';
import { renderPick, renderCatalogueAlbum, cratesShown, cratesAll, hashOf, randomHash, setGenre, setCatalogue } from './ui.js';
import { initGlow, glow } from './glow.js';
import { setAlbum, setOpen } from './preview.js';
import './style.css';

const canvasEl = document.getElementById('scene');
const hintEl = document.getElementById('hint');

let scene = null;
let album = placeholderAlbum();
let archive = [];
let catalogue = [];
let showing = null;
let wasOpen = false;

function show(pick, cat = null) {
  album = pick;
  if (cat) renderCatalogueAlbum(pick, cat);
  else renderPick(pick, archive);
  document.title = `${pick.album} – ${pick.artist} · vinyl room`;
  // Page colours follow the cover (animated in CSS).
  paletteFrom(pick.front).forEach((c, i) => document.documentElement.style.setProperty(`--g${i + 1}`, c));
  scene?.applyArt(pick);
  setAlbum(pick);
}

async function showDate(date) {
  if (!archive.length) return;
  const entry = archive.find((e) => e.date === date) ?? archive[0];
  if (`d:${entry.date}` === showing) return;
  showing = `d:${entry.date}`;
  try {
    const pick = await loadPick(entry.date);
    if (showing === `d:${entry.date}`) show(pick); // ignore if a newer navigation won
  } catch (err) {
    console.warn(`[pick] ${entry.date}: ${err.message}`);
  }
}

// The list older/newer step through while a crate album is open: the current
// crate (the whole crates if the album is outside the filter).
const catList = (key) => {
  const f = cratesShown();
  return f.some((a) => a.key === key) ? f : cratesAll();
};

async function showKey(key) {
  const entry = catalogue.find((e) => e.key === key);
  if (!entry) return showDate(null);
  if (`c:${key}` === showing) return;
  showing = `c:${key}`;
  const full = await loadCatalogueAlbum(entry);
  if (showing === `c:${key}`) show(full, catList(key));
}

function route() {
  const h = location.hash;
  if (h.startsWith('#c/')) {
    try {
      return showKey(decodeURIComponent(h.slice(3)));
    } catch {}
  }
  return showDate(h.match(/\d{4}-\d{2}-\d{2}/)?.[0]);
}

const go = (hash) => {
  if (hash && location.hash !== `#${hash}`) location.hash = hash;
};
const neighbour = (step) => {
  if (showing?.startsWith('c:')) {
    const list = catList(showing.slice(2));
    const a = list[list.findIndex((x) => x.key === showing.slice(2)) + step];
    return a && hashOf(a);
  }
  const i = archive.findIndex((a) => `d:${a.date}` === showing);
  return archive[i + step]?.date; // archive is newest first
};

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-genre], [data-open], [data-dice], [data-today], [data-nav], [data-action], [data-scroll], [data-look]');
  if (!t) return;
  if (t.dataset.genre !== undefined) {
    e.preventDefault();
    setGenre(t.dataset.genre);
    document.getElementById('crates').scrollIntoView({ behavior: 'smooth' });
  } else if (t.dataset.open) {
    e.preventDefault();
    go(t.dataset.open);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (t.dataset.dice !== undefined) {
    go(randomHash());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (t.dataset.today !== undefined) {
    e.preventDefault();
    go(archive[0]?.date);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (t.dataset.nav) {
    go(neighbour(t.dataset.nav === 'older' ? 1 : -1));
  } else if (t.dataset.action === 'toggle') {
    scene?.toggle();
  } else if (t.dataset.scroll) {
    e.preventDefault();
    document.getElementById(t.dataset.scroll).scrollIntoView({ behavior: 'smooth' });
  } else if (t.dataset.look) {
    e.preventDefault();
    document.documentElement.dataset.look = t.dataset.look;
    try {
      localStorage.setItem('look', t.dataset.look);
    } catch {}
  }
});

window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea, select')) return;
  if (e.key === 'ArrowLeft') go(neighbour(1));
  else if (e.key === 'ArrowRight') go(neighbour(-1));
  else if ((e.key === 'Enter' || e.key === ' ') && e.target === canvasEl) {
    e.preventDefault();
    scene?.toggle();
  }
});

window.addEventListener('hashchange', route);

// ---------------------------------------------------------------------------
// Boot: text first, record second.
// ---------------------------------------------------------------------------
async function boot() {
  [archive, catalogue] = await Promise.all([loadArchive(), loadCatalogue()]);
  setCatalogue(catalogue, archive);
  initGlow(document.getElementById('crates'));
  if (archive.length || catalogue.length) await route();
  else show(await loadFallbackAlbum()); // fresh checkout: Demon Days
}

boot();

import('./scene.js').then(({ createScene }) => {
  scene = createScene(canvasEl, {
    onToggle: (open) => {
      hintEl.textContent = open ? 'click again to put it away' : 'click the record to open the sleeve';
      document.documentElement.classList.toggle('sleeve-open', open);
      setOpen(open);
      if (wasOpen && !open) glow('sleeve');
      wasOpen = open;
    },
  });
  scene.applyArt(album);
  if (new URLSearchParams(location.search).has('open')) scene.toggle();
  document.documentElement.classList.add('scene-ready');
});
