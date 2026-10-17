// Loads the day's album and draws every texture the record needs onto canvases.
//
// Picks come from data/archive.json and data/picks/<date>.json, written daily
// by scripts/picker. Without them (e.g. a fresh dev checkout) we fall back to
// Demon Days straight from Cover Art Archive, then to a placeholder sleeve.

const DEFAULT_ALBUM = {
  artist: 'Gorillaz',
  album: 'Demon Days',
  year: '2005',
  // MusicBrainz release used for the in-browser fallback.
  release: '2968b394-7ca8-3b6a-a3ec-a0239adb01c9',
  tracklist: [
    'Intro', 'Last Living Souls', 'Kids With Guns', 'O Green World', 'Dirty Harry',
    'Feel Good Inc.', 'El mañana', 'Every Planet We Reach Is Dead', 'November Has Come',
    'All Alone', 'White Light', 'DARE', 'Fire Coming Out of the Monkey’s Head',
    'Don’t Get Lost in Heaven', 'Demon Days',
  ],
  sources: [],
  links: {},
};

const SIZE = 1024;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

const tryImage = (src) => (src ? loadImage(src).catch(() => null) : Promise.resolve(null));

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// Newest first. Empty when there is no archive yet.
export async function loadArchive() {
  try {
    return await getJson('data/archive.json');
  } catch {
    return [];
  }
}

export async function loadPick(date) {
  const pick = await getJson(`data/picks/${date}.json`);
  const front = await tryImage(pick.cover && `data/${pick.cover}`);
  return { ...pick, front, back: null, label: null };
}

// The CAA JSON index redirects to archive.org without CORS headers, but the
// image shortcuts (front-500, back-500) are CORS-enabled, so use those.
export async function loadFallbackAlbum() {
  const base = `https://coverartarchive.org/release/${DEFAULT_ALBUM.release}`;
  const [front, back] = await Promise.all([tryImage(`${base}/front-500`), tryImage(`${base}/back-500`)]);
  return { ...DEFAULT_ALBUM, front, back, label: null };
}

export const placeholderAlbum = () => ({ ...DEFAULT_ALBUM, front: null, back: null, label: null });

function canvas(w = SIZE, h = SIZE) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// Draws an image to fill the square, cropping whatever overflows.
function drawCover(ctx, img, size = SIZE) {
  const s = Math.max(size / img.width, size / img.height);
  const w = img.width * s;
  const h = img.height * s;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
}

function paperNoise(ctx, w, h, alpha = 0.05) {
  const data = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * alpha;
    data.data[i] += n;
    data.data[i + 1] += n;
    data.data[i + 2] += n;
  }
  ctx.putImageData(data, 0, 0);
}

function placeholderFront(album) {
  const [c, ctx] = canvas();
  // Four tinted squares, in the spirit of the real Demon Days grid.
  const tints = ['#c9a227', '#7d8c3c', '#3f6a8a', '#8a3f3f'];
  tints.forEach((tint, i) => {
    const x = (i % 2) * (SIZE / 2);
    const y = Math.floor(i / 2) * (SIZE / 2);
    const g = ctx.createLinearGradient(x, y, x + SIZE / 2, y + SIZE / 2);
    g.addColorStop(0, tint);
    g.addColorStop(1, '#151515');
    ctx.fillStyle = g;
    ctx.fillRect(x + 8, y + 8, SIZE / 2 - 16, SIZE / 2 - 16);
  });
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, SIZE * 0.42, SIZE, SIZE * 0.16);
  ctx.fillStyle = '#f2f0e8';
  ctx.textAlign = 'center';
  ctx.font = `700 ${SIZE * 0.07}px system-ui, sans-serif`;
  ctx.fillText(album.album.toUpperCase(), SIZE / 2, SIZE * 0.5);
  ctx.font = `400 ${SIZE * 0.035}px system-ui, sans-serif`;
  ctx.fillText(album.artist.toUpperCase(), SIZE / 2, SIZE * 0.55);
  return c;
}

export function frontCanvas(album) {
  if (!album.front) return placeholderFront(album);
  const [c, ctx] = canvas();
  drawCover(ctx, album.front);
  return c;
}

export function backCanvas(album) {
  const [c, ctx] = canvas();
  if (album.back) {
    drawCover(ctx, album.back);
  } else {
    // No back scan: a dark, blurred take on the front with the details on top.
    ctx.fillStyle = '#1b1b1d';
    ctx.fillRect(0, 0, SIZE, SIZE);
    if (album.front) {
      ctx.save();
      ctx.filter = 'blur(28px) brightness(0.35) saturate(1.2)';
      drawCover(ctx, album.front);
      ctx.restore();
    }
    ctx.fillStyle = '#ecebe6';
    ctx.textAlign = 'center';
    ctx.font = `700 ${SIZE * 0.06}px system-ui, sans-serif`;
    ctx.fillText(album.album.toUpperCase(), SIZE / 2, SIZE * 0.47, SIZE * 0.86);
    ctx.font = `400 ${SIZE * 0.035}px system-ui, sans-serif`;
    ctx.fillText(album.artist.toUpperCase(), SIZE / 2, SIZE * 0.54, SIZE * 0.86);
    if (album.date) {
      ctx.fillStyle = '#a8a69e';
      ctx.font = `400 ${SIZE * 0.025}px system-ui, sans-serif`;
      ctx.fillText(`ALBUM OF THE DAY · ${album.date}`, SIZE / 2, SIZE * 0.9);
    }
  }
  return c;
}

// Inside of the front flap: the tracklist, split into side A and side B.
export function tracklistCanvas(album) {
  const [c, ctx] = canvas();
  ctx.fillStyle = '#e9e4d6';
  ctx.fillRect(0, 0, SIZE, SIZE);
  paperNoise(ctx, SIZE, SIZE, 0.06);

  const ink = '#1a1a1a';
  const pad = SIZE * 0.09;
  ctx.fillStyle = ink;
  ctx.textAlign = 'left';
  ctx.font = `800 ${SIZE * 0.075}px system-ui, sans-serif`;
  ctx.fillText(album.album.toUpperCase(), pad, pad + SIZE * 0.05);
  ctx.font = `500 ${SIZE * 0.03}px system-ui, sans-serif`;
  ctx.fillStyle = '#5b574d';
  ctx.fillText(album.artist.toUpperCase(), pad, pad + SIZE * 0.1);

  const tracks = album.tracklist?.length ? album.tracklist : ['Side A', 'Side B'];
  const half = Math.ceil(tracks.length / 2);
  const sides = [tracks.slice(0, half), tracks.slice(half)];
  const top = pad + SIZE * 0.2;
  const lineH = Math.min(SIZE * 0.052, (SIZE - top - pad) / (tracks.length + 2.6));
  let n = 1;

  sides.forEach((side, s) => {
    const y0 = top + s * (half * lineH + lineH * 1.6);
    ctx.fillStyle = '#8a2b22';
    ctx.font = `700 ${lineH * 0.55}px system-ui, sans-serif`;
    ctx.fillText(`SIDE ${s === 0 ? 'A' : 'B'}`, pad, y0);
    ctx.fillStyle = ink;
    ctx.font = `500 ${lineH * 0.6}px system-ui, sans-serif`;
    side.forEach((title, i) => {
      const y = y0 + (i + 1) * lineH;
      ctx.fillStyle = '#7a756a';
      ctx.fillText(String(n++).padStart(2, '0'), pad, y);
      ctx.fillStyle = ink;
      ctx.fillText(title, pad + lineH * 1.3, y, SIZE - pad * 2 - lineH * 1.3);
    });
  });
  return c;
}

// Inside of the back panel: dark card with the disc art as a faded print.
export function innerPanelCanvas(album) {
  const [c, ctx] = canvas();
  ctx.fillStyle = '#18181a';
  ctx.fillRect(0, 0, SIZE, SIZE);
  if (album.label || album.front) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.filter = 'grayscale(1) contrast(1.4)';
    drawCover(ctx, album.label ?? album.front);
    ctx.restore();
  }
  paperNoise(ctx, SIZE, SIZE, 0.08);
  ctx.fillStyle = '#d9d6cc';
  ctx.textAlign = 'left';
  ctx.font = `300 ${SIZE * 0.03}px system-ui, sans-serif`;
  ctx.fillText(`${album.artist} — ${album.album}`.toUpperCase(), SIZE * 0.08, SIZE * 0.1);
  return c;
}

// Top face of the vinyl: grooves, run-out area and the centre label.
export function discCanvas(album) {
  const [c, ctx] = canvas();
  const r = SIZE / 2;
  ctx.translate(r, r);

  ctx.fillStyle = '#0b0b0c';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Grooves: lots of faint rings, with a few darker gaps between "tracks".
  const labelR = r * 0.34;
  const outer = r * 0.97;
  const gaps = [0.52, 0.63, 0.74, 0.86];
  for (let rr = labelR + r * 0.06; rr < outer; rr += 1.6) {
    const t = rr / r;
    const gap = gaps.some((g) => Math.abs(t - g) < 0.006);
    ctx.strokeStyle = gap ? 'rgba(0,0,0,0.9)' : `rgba(255,255,255,${0.02 + Math.random() * 0.035})`;
    ctx.lineWidth = gap ? 3 : 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Label.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, labelR, 0, Math.PI * 2);
  ctx.clip();
  const art = album.label ?? album.front;
  if (art) {
    // The disc scan has its own hole and rim; zoom in a bit so the label fills.
    const zoom = album.label ? 1.08 : 1;
    const d = labelR * 2 * zoom;
    const s = Math.max(d / art.width, d / art.height);
    ctx.drawImage(art, (-art.width * s) / 2, (-art.height * s) / 2, art.width * s, art.height * s);
  } else {
    ctx.fillStyle = '#c9a227';
    ctx.fill();
  }
  ctx.restore();

  // Spindle hole.
  ctx.fillStyle = '#050505';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.022, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// Three colours for the page gradient, taken from the cover: a light tint of
// its most vivid colour (top), a second vivid colour (middle) and a deep shade
// (bottom). Falls back to an early-2000s blue.
export function paletteFrom(img) {
  const fallback = ['#9cc3ea', '#2f6db5', '#0b1e3f'];
  if (!img) return fallback;
  const [, ctx] = canvas(24, 24);
  ctx.drawImage(img, 0, 0, 24, 24);
  const { data } = ctx.getImageData(0, 0, 24, 24);
  const px = [];
  for (let i = 0; i < data.length; i += 4) px.push(toHsl(data[i], data[i + 1], data[i + 2]));
  const vivid = (p) => p.s * (1 - Math.abs(p.l - 0.5) * 2);
  px.sort((a, b) => vivid(b) - vivid(a));
  const first = px[0];
  if (!first || vivid(first) < 0.08) return fallback; // greyscale cover
  // Second colour: the most vivid one with a clearly different hue.
  const hueGap = (a, b) => Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h));
  const second = px.find((p) => hueGap(p, first) > 40 && vivid(p) > 0.08) ?? { ...first, h: (first.h + 35) % 360 };
  return [
    hsl(first.h, Math.min(first.s, 0.75), 0.78),
    hsl(second.h, Math.min(Math.max(second.s, 0.45), 0.85), 0.5),
    hsl(first.h, Math.min(first.s, 0.6), 0.14),
  ];
}

function toHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

const hsl = (h, s, l) => `hsl(${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`;
