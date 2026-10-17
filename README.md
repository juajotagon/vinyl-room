# Vinyl Room

A fresh album pick every day, shown on a spinning record (Vite + Three.js).
Click the record (or press Space/Enter) and the gatefold opens: the
tracklist is inside and the vinyl slides out and spins at 33⅓ rpm. Use ← / →
or the archive list to browse earlier days; each day has its own link
(`/#2026-10-18`). On tall screens the sleeve opens upward.

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
- `picks/<date>.json`: the full pick (sources, links, description, tracklist)
- `covers/<date>.jpg`

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

- `src/main.js` scene, gatefold animation, camera framing, day navigation
- `src/ui.js` info panel and archive list
- `src/art.js` loads picks and draws the canvas textures
- `scripts/picker/` sources, scoring, enrichment, description, CLI
- `server/index.mjs` static server, `/healthz` and the daily schedule
