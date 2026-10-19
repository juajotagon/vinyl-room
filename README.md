# Vinyl Room

A fresh album pick every day, written up like a small personal blog post,
with the record turning in a square player (Vite + Three.js). Click the
record (or focus it and press Enter) and the gatefold opens: the tracklist is
inside and the vinyl slides out and spins at 33⅓ rpm. Use ← / → or the
archive to browse earlier days; each day has its own link (`/#2026-10-18`).

The text loads first (about 13 kB of JS); the 3D player (three.js) loads
right after and pauses when scrolled out of view. Three looks share the same
page and can be switched in the footer or with `?look=player|journal|collage`.

## How the daily pick works

Once a day the server builds a pool of fresh recommendations from three
official feeds (see `docs/recommendation-sources.md` for why these):

| Source | What counts | Weight |
|---|---|---|
| Bandcamp Daily, Album of the Day | every pick | 3 |
| Stereogum, Album of the Week | every pick | 3 |
| The Needle Drop (YouTube) | reviews scored 7/10 or more | 1 to 4 |

Mentions from the last 14 days are grouped by album and scored, fading with
age, so an album that two sources liked this week wins. Albums already in
the archive are skipped. The winner gets its cover, year and tracklist from
MusicBrainz / Cover Art Archive (Discogs too if `DISCOGS_TOKEN` is set), and
a short description from Claude if `ANTHROPIC_API_KEY` is set. Without a key
the description is built from the sources' own one-line summaries.

Data lives in `DATA_DIR`:

- `archive.json`: every day, newest first
- `picks/<date>.json`: the full pick (sources, links, tracklist)
- `catalogue.json`: the back catalogue, newest first. Build it with
  `node scripts/picker/seed.mjs catalogue` (reads `seed/tagged.jsonl`). When a
  day has no fresh candidates, the picker takes an album from here that was
  never picked (`fromCatalogue: true`).
- `seed/`: seed run files (`candidates.json`, `tagged.jsonl`, `og-images.json`)

The server stores no cover images. Picks, archive and catalogue entries have
`covers: [url, ...]`, remote image URLs with the best first (Cover Art Archive,
then Bandcamp). The page loads them through `GET /cover?u=<encoded url>`, a
pass-through proxy (no disk storage) that adds CORS headers, which the WebGL
record needs. It only allows https URLs on `coverartarchive.org`,
`*.archive.org` and `*.bcbits.com`, and caps images at 5 MB. The code is in
`server/cover-proxy.mjs`; `npm run dev` has the same route through a Vite plugin.

To convert old data (`cover: "covers/<date>.jpg"`), run
`node scripts/picker/pick.mjs --migrate-covers`. It also deletes `covers/`.

## Run it locally

```bash
npm install
npm run pick -- --backfill 7   # fill the last week into public/data/
npm run dev
```

Other picker options: `--date 2026-10-14`, `--force` (redo a day).

To run it like production (serves `dist/`, picks daily at `PICK_TIME`):

```bash
npm run build
DATA_DIR=public/data TZ=Europe/Madrid npm start
```

## Audio previews

When a visitor opens the sleeve, a 30-second preview of the album plays. It
never plays on page load. Previews come only from official preview APIs: the
Apple iTunes Search API first, the Deezer API as a fallback. The server looks
them up at `GET /preview?artist=&album=&bandcamp=` (`server/preview.mjs`). While
a preview is available, the page shows the provider's attribution ("Preview
courtesy of Apple Music", "Listen on Apple Music" or "Listen on Deezer") with a
link to the album, and a mute button. No audio is taken from Bandcamp pages.

If the album has a Bandcamp page, the server reads only its numeric album id
(one request, cached). The page then offers a "listen to the full album on
Bandcamp" button. Only a click inserts Bandcamp's official embedded player, so
Bandcamp gets no request from the visitor before that.

Apple and Bandcamp results are cached in `DATA_DIR/previews.json` for 30 days
(misses for 1 day). Deezer preview URLs expire, so they are cached in memory
for 1 hour at most.

## Container and Kubernetes

```bash
docker build -t vinyl-room:0.2.0 .
docker run --rm -p 8080:8080 -v vinyl-data:/data -e TZ=Europe/Madrid vinyl-room:0.2.0
```

One Node process serves the site and runs the daily pick, so a single
Deployment with one volume is all it needs. `k8s/` has a kustomization
(namespace, PVC, Deployment, Service) with a non-root, read-only root
filesystem setup. It has no Ingress, so point your own ingress or gateway at
the `vinyl-room` Service. Optional secrets:

```bash
kubectl -n vinyl-room create secret generic vinyl-room-secrets \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-...
```

Set the image in `k8s/kustomization.yaml`, then `kubectl apply -k k8s/`.

## Layout

- `src/main.js` page logic: loading days, navigation, lazy-loading the player
- `src/scene.js` the 3D record, gatefold animation and camera framing
- `src/ui.js` renders the post, sources, tracklist, archive and collage
- `src/art.js` loads picks, draws the canvas textures, cover palette
- `src/looks/` the three looks (player, journal, collage)
- `scripts/picker/` sources, scoring, enrichment, description, CLI
- `server/index.mjs` static server, `/healthz` and the daily schedule
- `server/cover-proxy.mjs` the `/cover` image proxy
