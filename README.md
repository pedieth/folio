# folio

a reading layer for long-form writing on farcaster. it finds the articles people actually read, ranks them by real reading time, and opens them in a clean reader inside the farcaster mini app.

**live:** [folio.pedieth.workers.dev](https://folio.pedieth.workers.dev)

## what it does

- today, this week and latest feeds ranked by reads, not likes
- reader with translation, listen, reading speed and highlights
- writers tab, following, saved articles and stories
- daily "who wrote it?" game with a shareable card
- sticker packs you can drop into a cast
- report button and takedown flow

## stack

cloudflare workers · kv · d1 · workers ai · farcaster mini app sdk

## layout

- `src/build.js` the worker: api routes and the mini app page
- `src/card.mjs` share card rendering
- `src/stickers.mjs` sticker images and the sticker routes
- `src/series.mjs` series pages
- `src/resvg.mjs` svg to png (wasm not included in the repo)
- `check.py` regression checks, run before every deploy

secrets (`ADMIN_KEY`, `FC_API_KEY`, account association) live in worker settings and are not in this repo.
