const tabs = ["ios","android","epic","prime","psplus","gog"];
const state = { tab: "ios", items: [], query: "", onlyActive: true };

const $ = (s) => document.querySelector(s);
const list = $("#list");
const lastUpdated = $("#lastUpdated");

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    state.tab = btn.dataset.tab;
    loadTab();
  });
});

$("#search").addEventListener("input", (e) => { state.query = e.target.value.toLowerCase(); render(); });
$("#onlyActive").addEventListener("change", (e) => { state.onlyActive = e.target.checked; render(); });

function fmtDate(s) {
  if (!s) return "Unknown";
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleString();
}

function isActive(item) {
  if (!item.ends_at) return true;
  const now = Date.now();
  const end = Date.parse(item.ends_at);
  return isNaN(end) ? true : now < end;
}

function matchesQuery(item, q) {
  if (!q) return true;
  const hay = [
    item.title||"",
    item.subtitle||"",
    (item.tags||[]).join(" ")
  ].join(" ").toLowerCase();
  return hay.includes(q);
}

async function loadTab() {
  list.innerHTML = "<p class='empty'>Loading…</p>";
  try {
    const res = await fetch(`./data/${state.tab}.json?ts=${Date.now()}`);
    const items = await res.json();
    state.items = Array.isArray(items) ? items : [];
    // show last updated from newest verified_at
    const latest = state.items
      .map(x => Date.parse(x.verified_at||0))
      .filter(n => !isNaN(n))
      .sort((a,b)=>b-a)[0];
    if (latest) {
      lastUpdated.textContent = "Verified " + new Date(latest).toLocaleString();
    } else {
      lastUpdated.textContent = "";
    }
  } catch (e) {
    console.error(e);
    state.items = [];
  }
  render();
}

function render() {
  let items = state.items.slice();
  if (state.onlyActive) items = items.filter(isActive);
  if (state.query) items = items.filter(x => matchesQuery(x, state.query));

  // sort: time-limited first; then closest to end
  const rank = x => (x.is_time_limited ? 0 : 1);
  items.sort((a,b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    const ea = Date.parse(a.ends_at||0), eb = Date.parse(b.ends_at||0);
    if (!isNaN(ea) && !isNaN(eb)) return ea - eb;
    return (b.verified_at||"").localeCompare(a.verified_at||"");
  });

  if (!items.length) {
    list.innerHTML = "<p class='empty'>No items match. Try another tab or search.</p>";
    return;
  }

  list.innerHTML = items.map(card).join("");
}

function card(x) {
  const img = x.image_url ? `<img src="${x.image_url}" alt="">` : `<img src="" alt="" />`;
  const price = x.price_now ? `<span class="badge">Now: ${x.price_now} ${x.currency||""}</span>` : "";
  const was = x.price_before ? `<span class="badge">Was: ${x.price_before}</span>` : "";
  const reg = x.region_scope ? `<span class="badge">Region: ${x.region_scope}</span>` : "";
  const tl = x.is_time_limited ? `<span class="badge">Limited</span>` : `<span class="badge">Always Free</span>`;
  const until = x.ends_at ? `<span class="badge">Ends: ${fmtDate(x.ends_at)}</span>` : "";
  const tags = (x.tags||[]).map(t=>`<span class="badge">#${t}</span>`).join("");
  const rating = (x.rating!=null) ? `<span class="badge">★ ${x.rating}</span>` : "";
  const source = x.source_url ? `<a href="${x.source_url}" target="_blank" rel="noopener">source</a>` : "";
  const claim = x.store_product_url ? `<a href="${x.store_product_url}" target="_blank" rel="nofollow noopener"><button class="claimbtn">Claim</button></a>` : "";

  return `
  <article class="card">
    ${img}
    <div class="body">
      <h3>${x.title||"Untitled"}</h3>
      <div class="meta">${price}${was}${reg}${tl}${until}${rating}</div>
      <p>${x.subtitle||""}</p>
      <div class="badges">${tags}</div>
      <div class="claim">
        <small>${source} · Verified ${fmtDate(x.verified_at)}</small>
        ${claim||""}
      </div>
    </div>
  </article>`;
}

// boot
document.querySelector('.tab[data-tab="ios"]').classList.add("active");
loadTab();
