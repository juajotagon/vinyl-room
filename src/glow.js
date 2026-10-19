// The RGB border around "dig the crates": a conic gradient that spins a few
// times to catch the eye, then fades back to the static border. Plays at most
// once per visit (sessionStorage), when the section scrolls into view or when
// the sleeve is closed while the section is already on screen.
const KEY = 'crates-glow';
let box = null;
let played = false;

const seen = () => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
const remember = () => {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {}
};

const onScreen = () => {
  const r = box.getBoundingClientRect();
  return r.top < innerHeight * 0.85 && r.bottom > innerHeight * 0.15;
};

export function glow(reason) {
  if (!box || played || seen()) return;
  // Closing the sleeve only counts when the visitor can actually see the crates.
  if (reason === 'sleeve' && !onScreen()) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; // static border only
  played = true;
  remember();
  box.classList.add('glow');
}

export function initGlow(el) {
  box = el;
  if (!box) return;
  box.addEventListener('animationend', (e) => {
    if (e.animationName === 'crates-fade') box.classList.remove('glow');
  });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          io.disconnect();
          glow('scroll');
        }
      },
      { threshold: 0.2 },
    );
    io.observe(box);
  }
}
