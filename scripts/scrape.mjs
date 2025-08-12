// Scrapers for: iOS, Android, Epic, Prime Gaming, PS Plus, GOG
// Respect robots.txt and Terms.

import fetch from "node-fetch";
import { load } from "cheerio";
import fs from "node:fs/promises";

const UA = "Mozilla/5.0 (compatible; FreebieHubBot/1.0; +https://github.com/)";

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

// EPIC — official JSON
async function fetchEpic() {
  const url = "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US";
  const data = await httpGet(url, "json");
  const now = new Date();
  const out = [];
  for (const e of data.data.Catalog.searchStore.elements) {
    const title = e.title;
    const img = (e.keyImages || [])[0]?.url || "";
    const offers = e.promotions?.promotionalOffers?.[0]?.promotionalOffers || [];
    const activeOffer = offers.find(o => new Date(o.startDate) <= now && now < new Date(o.endDate));
    if (!activeOffer) continue;
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
      starts_at: activeOffer.startDate,
      ends_at: activeOffer.endDate,
      is_time_limited: true,
      tags: e.categories?.map(c=>c.path || c.name).filter(Boolean) || []
    }));
  }
  return out;
}

// PS PLUS — PlayStation Blog
async function fetchPSPlus() {
  const listURL = "https://blog.playstation.com/tag/playstation-plus/";
  const html = await httpGet(listURL);
  const $ = load(html);
  const first = $("article a[href]").first().attr("href");
  if (!first) return [];
  const postHtml = await httpGet(first);
  const $$ = load(postHtml);

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

// GOG — always-free listing
async function fetchGOG() {
  const url = "https://embed.gog.com/games/ajax/filtered?mediaType=game&price=free&sort=popularity";
  const data = await httpGet(url, "json");
  const out = (data.products || []).map(p => norm({
    platform: "gog",
    title: p.title,
    subtitle: "Always free on GOG",
    source_url: "https://www.gog.com/en/games?price=free&sort=popularity",
    store_product_url: "https://www.gog.com/en/game/" + p.slug,
    image_url: p.image || "",
    price_now: "0",
    currency: "USD",
    region_scope: "Global",
    is_time_limited: false,
    tags: ["GOG","PC"]
  }));
  return out.slice(0, 60);
}


// Prime Gaming — monthly roundup
async function fetchPrime() {
  const url = "https://www.pcgamer.com/prime-gaming-free-games/";
  const html = await httpGet(url);
  const $ = load(html);
  const out = [];
  $("h2, h3").each((_, el) => {
    const t = $(el).text().trim();
    if (/free games? with prime/i.test(t)) return;
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
  const uniq = [];
  const seen = new Set();
  for (const it of out) {
    const k = it.title.toLowerCase();
    if (!seen.has(k)) { seen.add(k); uniq.push(it); }
  }
  return uniq.slice(0, 20);
}

// iOS — Appsliced "Free" recent
async function fetchIOSFree() {
  const url = "https://appsliced.co/apps?price=0&sort=recent";
  const html = await httpGet(url);
  const $ = load(html);
  const out = [];
  $(".app-list .app").each((_, el) => {
    const title = $(el).find(".name").text().trim();
    const href = $(el).find("a[href]").attr("href");
    const img = $(el).find("img").attr("src") || "";
    const was = $(el).find(".pricestrike").text().trim();
    if (!title || !href) return;
    out.push(norm({
      platform: "ios",
      title,
      subtitle: "Paid → Free (AppSliced)",
      source_url: url,
      store_product_url: href.startsWith("http") ? href : ("https://appsliced.co" + href),
      image_url: img,
      price_before: was || "",
      price_now: "0",
      currency: "USD",
      region_scope: "Varies",
      is_time_limited: true,
      tags: ["iOS","iPhone","iPad"]
    }));
  });
  return out.slice(0, 50);
}

// Android — AppAgg hot deals (best-effort)
async function fetchAndroidFree() {
  const url = "https://appsfree.app/";
  const html = await httpGet(url);
  const $ = load(html);
  const out = [];
  $("article.post").each((_, el) => {
    const title = $(el).find("h2.entry-title a").text().trim();
    const play = $(el).find('a[href*="play.google.com"]').attr("href");
    const img = $(el).find("img").attr("src") || "";
    if (!title || !play) return;
    out.push(norm({
      platform: "android",
      title,
      subtitle: "Paid → Free (AppsFree)",
      source_url: url,
      store_product_url: play,
      image_url: img,
      price_now: "0",
      currency: "",
      region_scope: "Varies",
      is_time_limited: true,
      tags: ["Android"]
    }));
  });
  return out.slice(0, 50);
}


const writers = [
  ["ios", fetchIOSFree],
  ["android", fetchAndroidFree],
  ["epic", fetchEpic],
  ["prime", fetchPrime],
  ["psplus", fetchPSPlus],
  ["gog", fetchGOG],
];

for (const [name, fn] of writers) {
  try {
    const items = await fn();
    const withStamp = items.map(x => ({ ...x, verified_at: new Date().toISOString() }));
    await fs.writeFile(`docs/data/${name}.json`, JSON.stringify(withStamp, null, 2));
    console.log("Wrote", name, withStamp.length);
  } catch (e) {
    console.error("Failed", name, e.message);
    await fs.writeFile(`docs/data/${name}.json`, "[]");
  }
}
console.log("Done.");
