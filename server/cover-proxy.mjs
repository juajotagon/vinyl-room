// Pass-through image proxy: GET /cover?u=<encoded https url>.
// Streams the remote image with CORS enabled so the WebGL canvas can use it.
// Nothing is written to disk. Only a few image hosts are allowed.
import { Readable } from 'node:stream';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_HOPS = 5;

export function allowedCoverUrl(u) {
  let url;
  try {
    url = new URL(u);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
  const h = url.hostname.toLowerCase();
  const ok = h === 'coverartarchive.org' || h === 'archive.org' || h.endsWith('.archive.org') || h === 'bcbits.com' || h.endsWith('.bcbits.com');
  return ok ? url : null;
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
  res.end('not found\n');
}

// Handles one request; returns true (it always answers).
export async function handleCover(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return true;
  }
  let url = allowedCoverUrl(new URL(req.url, 'http://x').searchParams.get('u') ?? '');
  if (!url) return notFound(res), true;

  try {
    let upstream;
    for (let hop = 0; ; hop++) {
      upstream = await fetch(url, {
        redirect: 'manual',
        headers: { 'User-Agent': 'vinyl-room/0.2 cover-proxy', Accept: 'image/*' },
        signal: AbortSignal.timeout(15_000),
      });
      if (upstream.status >= 300 && upstream.status < 400 && upstream.headers.get('location')) {
        await upstream.body?.cancel();
        const next = allowedCoverUrl(new URL(upstream.headers.get('location'), url).href);
        if (!next || hop >= MAX_HOPS) return notFound(res), true;
        url = next;
        continue;
      }
      break;
    }
    const type = upstream.headers.get('content-type') ?? '';
    const len = Number(upstream.headers.get('content-length') ?? 0);
    if (!upstream.ok || !upstream.body || !type.startsWith('image/') || len > MAX_BYTES) {
      await upstream.body?.cancel();
      return notFound(res), true;
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...(len ? { 'Content-Length': len } : {}),
    });
    if (req.method === 'HEAD') {
      await upstream.body.cancel();
      res.end();
      return true;
    }
    // Stop at the size cap even when the upstream sent no Content-Length.
    let sent = 0;
    const body = Readable.fromWeb(upstream.body);
    body.on('data', (chunk) => {
      sent += chunk.length;
      if (sent > MAX_BYTES) {
        body.destroy();
        res.destroy();
      }
    });
    body.on('error', () => res.destroy());
    body.pipe(res);
  } catch {
    if (!res.headersSent) notFound(res);
    else res.destroy();
  }
  return true;
}
