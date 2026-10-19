// 30-second audio preview for the album on show.
// Sources are official preview APIs only (Apple, Deezer), looked up by the
// server at /preview. Playback starts only after the visitor opens the sleeve.
// The Bandcamp embed is inserted only when the visitor asks for it.
const root = document.getElementById('audio');
const FADE_MS = 600;
const VOLUME = 0.7;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let audio = null;
let data = null; // result for the current album: { preview, bandcampId }
let token = 0; // bumps on every album change
let wanted = false; // sleeve is open
let muted = false;
let fadeTimer = 0;

const html = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids.filter(Boolean));
  return n;
};

function fade(to, ms, done) {
  clearInterval(fadeTimer);
  if (!audio) return done?.();
  const a = audio;
  if (reduceMotion() || !ms) {
    a.volume = to;
    return done?.();
  }
  const from = a.volume;
  const t0 = performance.now();
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    a.volume = from + (to - from) * k;
    if (k >= 1) {
      clearInterval(fadeTimer);
      done?.();
    }
  }, 30);
}

function stopAudio() {
  const a = audio;
  audio = null;
  clearInterval(fadeTimer);
  if (!a) return;
  const from = a.volume;
  const t0 = performance.now();
  const step = () => {
    const k = reduceMotion() ? 1 : Math.min(1, (performance.now() - t0) / 300);
    a.volume = from * (1 - k);
    if (k < 1) setTimeout(step, 30);
    else {
      a.pause();
      a.removeAttribute('src');
      a.load();
    }
  };
  step();
}

function render() {
  const p = data?.preview;
  const bc = data?.bandcampId;
  if (!p && !bc) {
    root.hidden = true;
    root.replaceChildren();
    return;
  }
  root.hidden = false;
  const row = html('div', { className: 'audio-row' });
  if (p) {
    const mute = html('button', { type: 'button', className: 'audio-mute', textContent: muted ? 'unmute' : 'mute', ariaLabel: muted ? 'Unmute preview' : 'Mute preview' });
    mute.onclick = () => {
      muted = !muted;
      if (audio) audio.muted = muted;
      mute.textContent = muted ? 'unmute' : 'mute';
      mute.ariaLabel = muted ? 'Unmute preview' : 'Mute preview';
    };
    const name = p.provider === 'apple' ? 'Apple Music' : 'Deezer';
    row.append(
      mute,
      html('span', { className: 'audio-credit', textContent: p.provider === 'apple' ? `Preview courtesy of ${name} · ` : `30 s preview from ${name} · ` }),
      html('a', { className: 'audio-link', href: p.link, target: '_blank', rel: 'noopener', textContent: `Listen on ${name}` }),
    );
  }
  root.replaceChildren(row);
  if (bc) {
    const slot = html('div', { className: 'audio-bc' });
    const btn = html('button', { type: 'button', className: 'audio-bc-btn', textContent: 'listen to the full album on Bandcamp' });
    btn.onclick = () => {
      // Pause our preview first: two players at once is noise.
      stopAudio();
      slot.replaceChildren(
        html('iframe', {
          title: 'Bandcamp player',
          src: `https://bandcamp.com/EmbeddedPlayer/album=${bc}/size=small/bgcol=222222/linkcol=ffffff/transparent=true/`,
          loading: 'lazy',
          allow: 'autoplay',
          height: 42,
        }),
      );
    };
    slot.append(btn);
    root.append(slot);
  }
}

function play() {
  const p = data?.preview;
  if (!wanted || !p || audio || root.querySelector('.audio-bc iframe')) return;
  const a = new Audio(p.url);
  a.volume = 0;
  a.muted = muted;
  audio = a;
  a.play().then(() => fade(VOLUME, FADE_MS)).catch(() => {
    if (audio === a) audio = null;
  });
  a.addEventListener('ended', () => audio === a && (audio = null));
}

// Called whenever a new album is shown: drop the old preview, prefetch the new.
export function setAlbum(pick) {
  const mine = ++token;
  stopAudio();
  data = null;
  render();
  const q = new URLSearchParams({ artist: pick.artist, album: pick.album });
  if (pick.links?.bandcamp) q.set('bandcamp', pick.links.bandcamp);
  fetch(`/preview?${q}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (mine !== token || !d) return;
      data = d;
      render();
      play(); // sleeve may have been opened while we were waiting
    })
    .catch(() => {});
}

// Sleeve opened (true) or closed (false).
export function setOpen(open) {
  wanted = open;
  if (open) play();
  else stopAudio();
}
