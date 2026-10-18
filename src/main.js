// Page logic: load the archive and the day's pick, render the text right away,
// then load the 3D record (three.js is most of the bundle) in the background.
import { loadArchive, loadPick, loadFallbackAlbum, placeholderAlbum, paletteFrom } from './art.js';
import { renderPick, setGenre } from './ui.js';
import './style.css';

const canvasEl = document.getElementById('scene');
const hintEl = document.getElementById('hint');

let scene = null;
let album = placeholderAlbum();
let archive = [];
let showing = null;

function show(pick) {
  album = pick;
  renderPick(pick, archive);
  document.title = `${pick.album} – ${pick.artist} · vinyl room`;
  // Page colours follow the cover (animated in CSS).
  paletteFrom(pick.front).forEach((c, i) => document.documentElement.style.setProperty(`--g${i + 1}`, c));
  scene?.applyArt(pick);
}

async function showDate(date) {
  if (!archive.length) return;
  const entry = archive.find((e) => e.date === date) ?? archive[0];
  if (entry.date === showing) return;
  showing = entry.date;
  try {
    const pick = await loadPick(entry.date);
    if (showing === entry.date) show(pick); // ignore if a newer navigation won
  } catch (err) {
    console.warn(`[pick] ${entry.date}: ${err.message}`);
  }
}

const go = (date) => {
  if (date) location.hash = date;
};
const neighbour = (step) => {
  const i = archive.findIndex((a) => a.date === showing);
  return archive[i + step]?.date; // archive is newest first
};

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-genre], [data-date], [data-today], [data-nav], [data-action], [data-scroll], [data-look]');
  if (!t) return;
  if (t.dataset.genre !== undefined) {
    e.preventDefault();
    setGenre(t.dataset.genre);
    document.getElementById('history').scrollIntoView({ behavior: 'smooth' });
  } else if (t.dataset.date) {
    e.preventDefault();
    go(t.dataset.date);
    document.querySelector('.page').scrollIntoView({ behavior: 'smooth' });
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

window.addEventListener('hashchange', () => showDate(location.hash.match(/\d{4}-\d{2}-\d{2}/)?.[0]));

// ---------------------------------------------------------------------------
// Boot: text first, record second.
// ---------------------------------------------------------------------------
async function boot() {
  archive = await loadArchive();
  if (archive.length) await showDate(location.hash.match(/\d{4}-\d{2}-\d{2}/)?.[0]);
  else show(await loadFallbackAlbum()); // fresh checkout: Demon Days
}

boot();

import('./scene.js').then(({ createScene }) => {
  scene = createScene(canvasEl, {
    onToggle: (open) => {
      hintEl.textContent = open ? 'click again to put it away' : 'click the record to open the sleeve';
      document.documentElement.classList.toggle('sleeve-open', open);
    },
  });
  scene.applyArt(album);
  if (new URLSearchParams(location.search).has('open')) scene.toggle();
  document.documentElement.classList.add('scene-ready');
});
