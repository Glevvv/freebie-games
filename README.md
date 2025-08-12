# Freebie Tabs Site (GitHub Pages + Actions)

A zero-cost stack to publish time-sensitive **freebies/promos** across six tabs:

- iOS: Apps Gone Free
- Android: Paid Apps → ₱0
- Epic Games: Free This Week
- Prime Gaming: Monthly Freebies
- PS Plus: Monthly Games
- GOG: Free & Giveaways

**Hosting:** GitHub Pages (static)**Updating:** GitHub Actions cron scrapers that fetch sources and write JSON into `docs/data/*.json`.

---

## Quick start

1. **Download the ZIP**, extract, and push to a new GitHub repo.
2. In your repo: Settings → Pages → **Build and deployment** → **Branch**: `main` → **/docs` folder**.
3. Enable Actions (if prompted). The workflow runs on a schedule and on manual dispatch.
4. Your site will be available at `https://<user>.github.io/<repo>/`.

> The site loads JSON from `docs/data/`. Initial sample data is included so it renders immediately.
> The scrapers then replace the JSON on schedule.

---

## Project layout

```
/docs/
  index.html
  style.css
  /js/app.js
  /data/ios.json, android.json, epic.json, prime.json, psplus.json, gog.json
/scripts/
  scrape.mjs
.github/workflows/
  scrape.yml
package.json
README.md
```

---

## Legal & ethics

- **Respect robots.txt** and site Terms of Service.
- Link to original sources; show timestamps.
- Avoid copying full descriptions; summarize instead.
- This repo includes **polite scrapers**. You own the responsibility to operate them compliantly.

---

## Local run (optional)

```bash
npm i
node scripts/scrape.mjs
# JSON will update in docs/data/
```

Commit & push to see the site update on Pages.
