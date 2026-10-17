// Serves the built site and the daily-pick data, and runs the picker once a
// day. One process, one volume: simple to run as a single k8s Deployment.
//
//   PORT=8080 DIST_DIR=dist DATA_DIR=/data PICK_TIME=06:00 TZ=Europe/Madrid node server/index.mjs
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { DATA_DIR, pickDay, today } from '../scripts/picker/pick.mjs';

const PORT = Number(process.env.PORT ?? 8080);
const DIST_DIR = resolve(process.env.DIST_DIR ?? 'dist');
const PICK_TIME = process.env.PICK_TIME ?? '06:00'; // local time, see TZ
const RETRY_MINUTES = 30;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Resolve a URL path inside `root`, refusing anything that escapes it.
function safePath(root, urlPath) {
  const p = resolve(root, '.' + normalize(decodeURIComponent(urlPath)));
  return p.startsWith(root + '/') || p === root ? p : null;
}

async function sendFile(res, path, cacheControl) {
  try {
    const s = await stat(path);
    if (!s.isFile()) return false;
    res.writeHead(200, {
      'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
      'Content-Length': s.size,
      'Cache-Control': cacheControl,
    });
    createReadStream(path).pipe(res);
    return true;
  } catch {
    return false;
  }
}

const state = { lastRun: null, lastError: null };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;

  if (path === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, today: today(), ...state }));
  }

  let ok = false;
  if (path.startsWith('/data/')) {
    const file = safePath(DATA_DIR, path.slice('/data'.length));
    // Covers never change for a given date; the archive and picks can.
    const cache = path.startsWith('/data/covers/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    ok = file ? await sendFile(res, file, cache) : false;
  } else {
    const file = safePath(DIST_DIR, path === '/' ? '/index.html' : path);
    const cache = path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    ok = file ? await sendFile(res, file, cache) : false;
  }
  if (!ok) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found\n');
  }
});

// ---------------------------------------------------------------------------
// Daily schedule
// ---------------------------------------------------------------------------
async function runPick() {
  try {
    const pick = await pickDay(today());
    state.lastRun = new Date().toISOString();
    state.lastError = null;
    console.info(`[server] today's pick: ${pick.artist} — ${pick.album}`);
    return true;
  } catch (err) {
    state.lastError = err.message;
    console.error(`[server] pick failed: ${err.message}`);
    return false;
  }
}

function msUntilNext(time) {
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

function scheduleNext() {
  const ms = msUntilNext(PICK_TIME);
  console.info(`[server] next pick in ${(ms / 3_600_000).toFixed(1)} h (${PICK_TIME} ${process.env.TZ ?? 'local time'})`);
  setTimeout(async () => {
    if (!(await runPick())) setTimeout(runPick, RETRY_MINUTES * 60_000);
    scheduleNext();
  }, ms);
}

server.listen(PORT, async () => {
  console.info(`[server] http://localhost:${PORT}  dist=${DIST_DIR}  data=${DATA_DIR}`);
  // Catch up if the pod was down at pick time (does nothing if today exists).
  if (!(await runPick())) setTimeout(runPick, RETRY_MINUTES * 60_000);
  scheduleNext();
});

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
