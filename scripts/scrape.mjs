// Scrapers for: iOS, Android, Epic, Prime Gaming, PS Plus, GOG
// NOTE: These scrapers are *best-effort* and may require tweaks if DOM changes.
// Always respect robots.txt and each site's Terms.

import fetch from "node-fetch";
import cheerio from "cheerio";
import dayjs from "dayjs";
import { XMLParser } from "fast-xml-parser";

const UA = "Mozilla/5.0 (compatible; FreebieHubBot/1.0; +https://github.com/)";

// ---------------- helpers ----------------
async function httpGet(url, type = "text") {
  const res = await fetch(url, { headers: { "user-agent": UA, "accept": "*/*" } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  if (type === "json") return res.json();
  if (type === "buffer") return res.arrayBuffer();
  return res.text();
}

function norm(item, extra = {}) {
  const base = {
    platform: "",
    title: "",
    subtitle: "",
    source_url: "",
    store_product_url: "",
    image_url: "",
    price_before: "",
    price_now: "",
    currency: "",
    region_scope: "Global",
    starts_at: null,
    ends_at: null,
    is_time_limited: true,
    tags: [],
    rating: null,
    verified_at: new Date().toISOString()
  };
  return { ...base, ...item, ...extra };
}

// --------------- EPIC: official JSON ---------------
async function fetchEpic() {
  const url = "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US";
  const data = await httpGet(url, "json");
  const now = new Date();
  const out = [];
  for (const e of data.data.Catalog.searchStore.elements) {
    const title = e.title;
    const img = (e.keyImages || [])[0]?.url || "";
    const offers = e.promotions?.promotionalOffers?.[0]?.promotionalOffers || [];
    const upcoming = e.promotions?.upcomingPromotionalOffers?.[0]?.promotionalOffers || [];
    const activeOffer = offers.find(o => new Date(o.startDate) <= now && now < new Date(o.endDate));
    const promo = activeOffer || null;
    if (!promo) continue;

    out.push(norm({
      platform: "epic",
      title,
      subtitle: e.publisher || "Epic Games Store",
      source_url: "https://store.epicgames.com/en-US/free-games",
      store_product_url: `https://store.epicgames.com/p/${(e.productSlug || e.urlSlug || title).toString().toLowerCase().replace(/\s+/g,'-')}`,
      image_url: img,
      price_before: e.price?.totalPrice?.fmtPrice?.originalPrice || "",
      price_now: "0",
      currency: e.price?.totalPrice?.currencyCode || "USD",
      region_scope: "Global",
      starts_at: promo.startDate,
      ends_at: promo.endDate,
      is_time_limited: true,
      tags: e.categories?.map(c=>c.path || c.name).filter(Boolean) || []
    }));
  }
  return out;
}

// --------------- PS PLUS: PlayStation Blog tag ---------------
async function fetchPSPlus() {
  const listURL = "https://blog.playstation.com/tag/playstation-plus/";
  const html = await httpGet(listURL);
  const $ = cheerio.load(html);
  const first = $("article a[href]").first().attr("href");
  if (!first) return [];
  const postHtml = await httpGet(first);
  const $$ = cheerio.load(postHtml);

  // grab bullet points and strongs as rough "game titles"
  const items = [];
  $$(".entry-content li, .entry-content strong").each((_, el) => {
    const t = $$(el).text().trim();
    if (t && /\w/.test(t) && t.length <= 120) items.push(t);
  });

  const uniqueTitles = [...new Set(items)].slice(0, 15);
  const dateMatch = $$(".entry-header time").attr("datetime") || new Date().toISOString();

  return uniqueTitles.map(t => norm({
    platform: "psplus",
    title: t.replace(/^[•\-\s]+/, ""),
    subtitle: "PlayStation Plus monthly line-up",
    source_url: first,
    store_product_url: "",
    image_url: "",
    price_before: "",
    price_now: "Included",
    currency: "",
    region_scope: "Varies by region",
    starts_at: dateMatch,
    ends_at: null,
    is_time_limited: true,
    tags: ["PlayStation", "PS Plus"]
  }));
}

// --------------- GOG: free catalog ---------------
async function fetchGOG() {
  // Popular always-free titles; time-limited giveaways may appear on homepage.
  const url = "https://www.gog.com/en/games?priceRange=0,0&sort=popularity";
  const html = await httpGet(url);
  const $ = cheerio.load(html);
  const out = [];
  $('a[href^="/en/game/"]').each((_, a) => {
    const href = $(a).attr("href");
    const title = $(a).find("[class*=product-title], [data-product-tile-title]").text().trim() || $(a).attr("title") || "Free game";
    if (!title) return;
    out.push(norm({
      platform: "gog",
      title,
      subtitle: "Always free on GOG",
      source_url: url,
      store_product_url: "https://www.gog.com" + href,
      image_url: "",
      price_before: "",
      price_now: "0",
      currency: "USD",
      region_scope: "Global",
      starts_at: null,
      ends_at: null,
      is_time_limited: false,
      tags: ["GOG", "PC"]
    }));
  });
  return out.slice(0, 40);
}

// --------------- Prime Gaming: monthly roundup (third-party summary) ---------------
async function fetchPrime() {
  // Uses a reputable news roundup. Adjust selector if DOM changes.
  const url = "https://www.pcgamer.com/prime-gaming-free-games/";
  const html = await httpGet(url);
  const $ = cheerio.load(html);
  const out = [];
  // Look for headings that contain game titles within the article
  $("h2, h3").each((_, el) => {
    const t = $(el).text().trim();
    if (/free games? with prime/i.test(t)) return; // skip headers
    if (t && t.length < 120 && /[a-zA-Z]/.test(t)) {
      out.push(norm({
        platform: "prime",
        title: t,
        subtitle: "Prime Gaming - monthly freebies (check region/account)",
        source_url: url,
        store_product_url: "https://gaming.amazon.com/home",
        image_url: "",
        price_before: "",
        price_now: "Included",
        currency: "",
        region_scope: "Varies by region",
        starts_at: null,
        ends_at: null,
        is_time_limited: true,
        tags: ["Prime Gaming","PC"]
      }));
    }
  });
  // Deduplicate
  const uniq = [];
  const seen = new Set();
  for (const it of out) {
    const k = it.title.toLowerCase();
    if (!seen.has(k)) { seen.add(k); uniq.push(it); }
  }
  return uniq.slice(0, 20);
}

// --------------- iOS: Appsliced "Free" recent ---------------
async function fetchIOSFree() {
  const url = "https://appsliced.co/apps?sort=recent&l=free";
  const html = await httpGet(url);
  const $ = cheerio.load(html);
  const items = [];
  $(".app-list .app").each((_, el) => {
    const title = $(el).find(".name").text().trim();
    const href = $(el).find("a[href]").attr("href");
    const img = $(el).find("img").attr("src") || "";
    const was = $(el).find(".pricestrike").text().trim();
    if (!title || !href) return;
    items.push(norm({
      platform: "ios",
      title,
      subtitle: "Paid → Free (Appsliced)",
      source_url: url,
      store_product_url: href.startsWith("http") ? href : ("https://appsliced.co" + href),
      image_url: img,
      price_before: was || "",
      price_now: "0",
      currency: "USD",
      region_scope: "Varies",
      starts_at: null,
      ends_at: null,
      is_time_limited: true,
      tags: ["iOS","iPhone","iPad"]
    }));
  });
  return items.slice(0, 50);
}

// --------------- Android: AppAgg hot deals (best-effort) ---------------
async function fetchAndroidFree() {
  const url = "https://appagg.com/hot?platform=android";
  const html = await httpGet(url);
  const $ = cheerio.load(html);
  const out = [];
  $(".app-card, .item, article").each((_, el) => {
    const t = $(el).find(".title, h3, .name").first().text().trim();
    const href = $(el).find("a[href]").first().attr("href");
    const img = $(el).find("img").attr("src") || "";
    const priceNow = $(el).text().match(/\$?0(\.00)?|free/i) ? "0" : "";
    if (!t || !href || !priceNow) return;
    out.push(norm({
      platform: "android",
      title: t,
      subtitle: "Paid → Free (AppAgg Hot)",
      source_url: url,
      store_product_url: href.startsWith("http") ? href : ("https://appagg.com" + href),
      image_url: img,
      price_before: "",
      price_now: "0",
      currency: "USD",
      region_scope: "Varies",
      starts_at: null,
      ends_at: null,
      is_time_limited: true,
      tags: ["Android"]
    }));
  });
  return out.slice(0, 60);
}

// ---------------- run all & write files ----------------
import fs from "node:fs/promises";

const writers = [
  ["ios", fetchIOSFree],
  ["android", fetchAndroidFree],
  ["epic", fetchEpic],
  ["prime", fetchPrime],
  ["psplus", fetchPSPlus],
  ["gog", fetchGOG],
];

const all = {};
for (const [name, fn] of writers) {
  try {
    const items = await fn();
    all[name] = items.map(x => ({ ...x, verified_at: new Date().toISOString() }));
  } catch (e) {
    console.error("Failed", name, e.message);
    all[name] = []; // keep empty to avoid crashing
  }
  await fs.writeFile(`docs/data/${name}.json`, JSON.stringify(all[name], null, 2));
  console.log("Wrote", name, all[name].length);
}

console.log("Done.");
