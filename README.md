# Freebie Games (GitHub Pages + Actions)

- Frontend: static in `/docs` (serve via GitHub Pages).
- Backend: GitHub Actions runs scrapers and writes `/docs/data/*.json`.
- Tabs: iOS, Android, Epic Games, Prime Gaming, PS Plus, GOG.

## Quick start
1) Upload all files to your repo (root).
2) Settings → Pages → Source: `main` / `/docs`.
3) Settings → Actions → General → Workflow permissions: **Read and write**.
4) Actions → **Scrape & Update JSON** → Run workflow (main).

## Local run (optional)
```
npm i
node scripts/scrape.mjs
```
