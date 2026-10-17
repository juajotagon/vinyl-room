import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  loadAlbum,
  frontCanvas,
  backCanvas,
  tracklistCanvas,
  innerPanelCanvas,
  discCanvas,
} from './art.js';
import './style.css';

// Sleeve is W x W units; a 12" record is ~96% of its sleeve.
const W = 3;
const THICK = 0.035;
const DISC_R = W * 0.48;
const DISC_T = 0.02;

const canvasEl = document.getElementById('scene');
const titleEl = document.getElementById('title');
const hintEl = document.getElementById('hint');
const creditEl = document.getElementById('credit');

const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0d0d0f');
scene.fog = new THREE.Fog('#0d0d0f', 14, 30);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

// Lights: warm key from the top left, cool rim from behind.
const key = new THREE.SpotLight('#ffe2b8', 60, 30, Math.PI / 5, 0.6, 1.4);
key.position.set(-4, 7, 7);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0004;
scene.add(key);
const rim = new THREE.DirectionalLight('#7fa8ff', 1.4);
rim.position.set(5, 3, -6);
scene.add(rim);
scene.add(new THREE.HemisphereLight('#3a3a48', '#0a0a0a', 0.6));

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.85 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -W * 0.62;
floor.receiveShadow = true;
scene.add(floor);

// ---------------------------------------------------------------------------
// The record: a gatefold sleeve (two hinged panels) with the disc inside.
//
//   stage  - centres the whole thing and does the slow idle spin
//   flap   - front cover panel, pivots on the left edge (the spine)
//   base   - back cover panel
//   disc   - the vinyl, peeks out of the right edge when closed
// ---------------------------------------------------------------------------
const stage = new THREE.Group();
scene.add(stage);

const tex = (c) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
};

const cardboard = new THREE.MeshStandardMaterial({ color: '#d8d2c2', roughness: 0.9 });
const printed = (map, roughness = 0.55) => new THREE.MeshStandardMaterial({ map, roughness });

// Box face order: +x, -x, +y, -y, +z, -z
const panelGeo = new THREE.BoxGeometry(W, W, THICK);

// The flap hangs off a hinge group so it can pivot on one edge. Wide screens
// hinge it on the left (opens like a book), tall screens on the top.
const hinge = new THREE.Group();
stage.add(hinge);
const flap = new THREE.Mesh(panelGeo);
flap.castShadow = true;
hinge.add(flap);

const base = new THREE.Mesh(panelGeo);
base.position.z = -THICK * 1.5;
base.castShadow = true;
stage.add(base);

const discMat = new THREE.MeshPhysicalMaterial({
  roughness: 0.32,
  metalness: 0.1,
  clearcoat: 1,
  clearcoatRoughness: 0.18,
});
const disc = new THREE.Mesh(new THREE.CylinderGeometry(DISC_R, DISC_R, DISC_T, 128), [
  new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.4 }),
  discMat,
  discMat,
]);
disc.castShadow = true;
// Cylinder axis is Y; tip it so the label faces the camera.
const discPivot = new THREE.Group();
discPivot.rotation.x = Math.PI / 2;
discPivot.add(disc);
stage.add(discPivot);

const clickable = [flap, base, disc];
let tracklistTex = null;

function applyArt(album) {
  tracklistTex = tex(tracklistCanvas(album));
  tracklistTex.center.set(0.5, 0.5);
  flap.material = [cardboard, cardboard, cardboard, cardboard, printed(tex(frontCanvas(album))), printed(tracklistTex, 0.8)];
  base.material = [cardboard, cardboard, cardboard, cardboard, printed(tex(innerPanelCanvas(album)), 0.8), printed(tex(backCanvas(album)))];
  discMat.map = tex(discCanvas(album));
  discMat.needsUpdate = true;

  titleEl.textContent = `${album.artist} — ${album.album}`;
  const src = {
    coverartarchive: ['Cover Art Archive', album.sourceUrl],
    discogs: ['Discogs', album.sourceUrl],
  }[album.source];
  creditEl.innerHTML = src ? `Artwork via <a href="${src[1]}" target="_blank" rel="noopener">${src[0]}</a>` : 'Placeholder artwork';
}

// ---------------------------------------------------------------------------
// Open / close
// ---------------------------------------------------------------------------
let open = false;
let progress = 0; // 0 closed .. 1 open
let spinAngle = 0;
let discSpin = 0;
const OPEN_SECONDS = 1.6;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const phase = (t, a, b) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);

function toggle() {
  open = !open;
  hintEl.textContent = open ? 'Click again to put it away' : 'Click the record to open the sleeve';
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovering = false;

function pick(e) {
  const r = canvasEl.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(clickable, false).length > 0;
}

canvasEl.addEventListener('pointermove', (e) => {
  hovering = pick(e);
  canvasEl.style.cursor = hovering ? 'pointer' : 'default';
  parallax.set(pointer.x, pointer.y);
});
canvasEl.addEventListener('click', (e) => {
  if (pick(e)) toggle();
});
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') toggle();
});

// ---------------------------------------------------------------------------
// Camera framing: fit the closed or open layout to the viewport.
// ---------------------------------------------------------------------------
const parallax = new THREE.Vector2();
const camTarget = new THREE.Vector3();

function fitDistance(width, height) {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  return Math.max(height / 2 / Math.tan(vFov / 2), width / 2 / Math.tan(hFov / 2));
}

let portrait = false;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  portrait = camera.aspect < 0.85;
  // Tall layout drops the disc below the sleeve, so the floor goes lower too.
  floor.position.y = portrait ? -W * 1.6 : -W * 0.62;
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document);
const TAU = Math.PI * 2;

function frame(now) {
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();

  progress = THREE.MathUtils.clamp(progress + (open ? dt : -dt) / OPEN_SECONDS, 0, 1);
  // Opening runs in phases: turn to face us, swing the flap, slide the disc out.
  const pTurn = ease(phase(progress, 0, 0.35));
  const pFlap = ease(phase(progress, 0.2, 0.75));
  const pDisc = ease(phase(progress, 0.45, 1));

  // Idle: slow spin, paused while hovered. When opening, settle on the front.
  if (progress === 0) {
    if (!hovering) spinAngle += dt * 0.35;
  } else {
    const front = Math.round(spinAngle / TAU) * TAU;
    spinAngle = THREE.MathUtils.damp(spinAngle, front, 6, dt);
  }
  stage.rotation.y = spinAngle;
  stage.rotation.x = THREE.MathUtils.lerp(Math.sin(t * 0.6) * 0.04, -0.05, pTurn);
  // Shift so the open spread is centred.
  const bob = Math.sin(t * 0.9) * 0.05 * (1 - pTurn);
  stage.position.x = portrait ? 0 : W * 0.15 * pTurn;
  stage.position.y = bob + (portrait ? -W * 0.22 * pTurn : 0);

  // Flap swings toward the camera and lays open (left, or up on tall screens).
  const swing = -Math.PI * 0.97 * pFlap;
  hinge.position.set(portrait ? 0 : -W / 2, portrait ? W / 2 : 0, THICK * 1.5 + pFlap * 0.01);
  hinge.rotation.set(portrait ? swing : 0, portrait ? 0 : swing, 0);
  flap.position.set(portrait ? 0 : W / 2, portrait ? -W / 2 : 0, 0);
  // Flipping over the top edge turns the inside print upside down; undo that.
  if (tracklistTex) tracklistTex.rotation = portrait ? Math.PI : 0;

  // Disc: peeks out of the right edge, then slides fully out and lifts forward.
  const peek = W * 0.28;
  const out = portrait ? [0, -W * 0.72] : [W * 0.62, 0.05];
  discPivot.position.set(
    THREE.MathUtils.lerp(peek, out[0], pDisc),
    THREE.MathUtils.lerp(0, out[1], pDisc),
    THREE.MathUtils.lerp(0, 0.35, pDisc),
  );
  discPivot.rotation.y = portrait ? 0 : THREE.MathUtils.lerp(0, -0.12, pDisc);
  // Disc turns slowly at rest and spins up to ~33 rpm once it is out.
  discSpin += dt * THREE.MathUtils.lerp(0.25, TAU * (33.3 / 60), pDisc);
  disc.rotation.y = -discSpin;

  // Camera: frame the closed record or the whole open spread.
  const closedD = portrait ? fitDistance(W * 1.5, W * 1.6) : fitDistance(W * 1.9, W * 1.6);
  const openD = portrait ? fitDistance(W * 1.3, W * 3.4) : fitDistance(W * 3.4, W * 1.5);
  const d = THREE.MathUtils.lerp(closedD, openD, ease(progress));
  scene.fog.near = d + 4;
  scene.fog.far = d + 22;
  camTarget.set(parallax.x * 0.6, 0.25 + parallax.y * 0.35, d);
  camera.position.lerp(camTarget, 1 - Math.exp(-4 * dt));
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

camera.position.set(0, 0.3, 12);
if (location.hash === '#open') toggle();
applyArt({ artist: 'Gorillaz', album: 'Demon Days', source: 'placeholder', tracklist: [] });
requestAnimationFrame(frame);
loadAlbum().then(applyArt);

if (import.meta.env.DEV) Object.assign(window, { __vinyl: { scene, camera, renderer, stage, toggle } });
