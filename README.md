# Vinyl Room

A small WebGL scene (Vite + Three.js): a record in its sleeve turns slowly on
a dark stage. Click it (or press Space/Enter) and the gatefold opens, showing
the tracklist inside, while the vinyl slides out and spins up to 33⅓ rpm.
Click again to put it away. On tall screens the sleeve opens upward instead
of sideways. Open `/#open` to start with the sleeve already open.

## Run it

```bash
npm install
npm run fetch-art   # downloads cover art into public/art/
npm run dev
```

## Album art

`npm run fetch-art` writes `public/art/{front,back,label}.jpg` and
`manifest.json`. It tries, in order:

1. **Discogs**, if `DISCOGS_TOKEN` is set (personal token from
   discogs.com → Settings → Developers). The token only lives in the script,
   never in the browser bundle.
2. **Cover Art Archive** (via MusicBrainz), no token needed.

If `public/art/` is empty, the page loads the cover straight from Cover Art
Archive in the browser, and if that fails it draws a placeholder sleeve.
Pick another album with `ARTIST="..." ALBUM="..." npm run fetch-art`.

The art is gitignored; it is downloaded again on every Docker build.

## Container

```bash
docker build -t vinyl-room .
docker run --rm -p 8080:8080 vinyl-room
```

Multi-stage: Node builds the static site, then `nginx-unprivileged` serves it
on port 8080 as a non-root user. `/healthz` returns `ok` for k8s probes. To
use Discogs during the build:

```bash
DISCOGS_TOKEN=xxxx docker build --secret id=discogs_token,env=DISCOGS_TOKEN -t vinyl-room .
```

## Layout

- `src/main.js` scene, gatefold animation, camera framing, input
- `src/art.js` art loading and canvas textures (tracklist, disc, panels)
- `scripts/fetch-art.mjs` Discogs / Cover Art Archive downloader
