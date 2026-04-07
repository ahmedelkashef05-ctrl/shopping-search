// ── State ──
let allResults  = [];
let selectedSize  = "";
let selectedColor = "";

// ── Retailer config ──
const RETAILER = {
  nordstrom:     { label: "Nordstrom",         aliases: ["nordstrom"] },
  neiman:        { label: "Neiman Marcus",      aliases: ["neiman marcus", "neimanmarcus"] },
  saks:          { label: "Saks Fifth Avenue",  aliases: ["saks fifth avenue", "saks"] },
  bloomingdales: { label: "Bloomingdale's",     aliases: ["bloomingdale's", "bloomingdales", "bloomingdale"] },
};

function getRetailerKey(source) {
  const s = (source || "").toLowerCase();
  for (const [k, v] of Object.entries(RETAILER)) {
    if (v.aliases.some((a) => s.includes(a))) return k;
  }
  return "other";
}

// ── Hero → App transition ──
document.getElementById("hero-cta").addEventListener("click", () => {
  document.getElementById("hero").style.display = "none";
  document.getElementById("app-shell").classList.add("visible");
  document.getElementById("search-toggle").click();
});

// ── Header scroll effect ──
window.addEventListener("scroll", () => {
  document.getElementById("site-header").classList.toggle("scrolled", window.scrollY > 20);
});

// ── Search drawer ──
const drawer = document.getElementById("search-drawer");
document.getElementById("search-toggle").addEventListener("click", () => {
  drawer.classList.toggle("open");
  if (drawer.classList.contains("open")) setTimeout(() => document.getElementById("query").focus(), 100);
});
document.getElementById("close-search").addEventListener("click", () => drawer.classList.remove("open"));

// ── Nav buttons (header) ──
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    syncCategoryPill(btn.dataset.cat);
    document.getElementById("hero").style.display = "none";
    document.getElementById("app-shell").classList.add("visible");
  });
});

// ── Category pills (strip) ──
document.querySelectorAll(".cat-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".cat-pill").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
  });
});

function syncCategoryPill(cat) {
  document.querySelectorAll(".cat-pill").forEach((p) => {
    p.classList.toggle("active", p.dataset.cat === cat);
  });
}

// ── Mobile sidebar toggle ──
document.getElementById("filter-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

// ── Filter block accordion ──
document.querySelectorAll(".filter-block-title").forEach((btn) => {
  btn.addEventListener("click", () => {
    const body = document.getElementById(btn.dataset.target);
    if (!body) return;
    body.classList.toggle("hidden");
    btn.classList.toggle("collapsed");
  });
});

// ── Size buttons ──
document.querySelectorAll(".size-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const already = btn.classList.contains("active");
    document.querySelectorAll(".size-btn").forEach((b) => b.classList.remove("active"));
    if (!already) {
      btn.classList.add("active");
      selectedSize = btn.dataset.size;
      document.getElementById("size").value = selectedSize;
    } else {
      selectedSize = "";
      document.getElementById("size").value = "";
    }
  });
});
document.getElementById("size").addEventListener("input", (e) => {
  selectedSize = e.target.value.trim();
  document.querySelectorAll(".size-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.size === selectedSize);
  });
});

// ── Color dots ──
document.querySelectorAll(".color-dot").forEach((dot) => {
  dot.addEventListener("click", () => {
    const already = dot.classList.contains("active");
    document.querySelectorAll(".color-dot").forEach((d) => d.classList.remove("active"));
    if (!already) {
      dot.classList.add("active");
      selectedColor = dot.dataset.color;
      document.getElementById("color").value = selectedColor;
    } else {
      selectedColor = "";
      document.getElementById("color").value = "";
    }
  });
});
document.getElementById("color").addEventListener("input", (e) => {
  selectedColor = e.target.value.trim();
  document.querySelectorAll(".color-dot").forEach((d) => d.classList.remove("active"));
});

// ── Quick price buttons ──
document.querySelectorAll(".qp-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".qp-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("min-price").value = btn.dataset.min || "";
    document.getElementById("max-price").value = btn.dataset.max || "";
  });
});

// ── Clear all ──
document.getElementById("clear-all").addEventListener("click", () => {
  document.querySelectorAll('input[name="retailer"]').forEach((cb) => (cb.checked = true));
  document.getElementById("min-price").value = "";
  document.getElementById("max-price").value = "";
  document.getElementById("size").value = "";
  document.getElementById("color").value = "";
  selectedSize = ""; selectedColor = "";
  document.querySelectorAll(".size-btn, .color-dot, .qp-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll('input[name="sort"]')[0].checked = true;
});

// ── Build search query ──
function buildQuery() {
  const keyword  = document.getElementById("query").value.trim();
  const activePill = document.querySelector(".cat-pill.active");
  const category = activePill ? activePill.dataset.cat : "";
  const color    = document.getElementById("color").value.trim() || selectedColor;
  const size     = document.getElementById("size").value.trim() || selectedSize;

  const parts = [];
  if (category) parts.push(category);
  if (color)    parts.push(color);
  if (keyword)  parts.push(keyword);
  if (size)     parts.push(`size ${size}`);
  return parts.join(" ") || "luxury fashion";
}

function getRetailers() {
  return [...document.querySelectorAll('input[name="retailer"]:checked')]
    .map((cb) => cb.value).join(",");
}

function getSort() {
  return document.querySelector('input[name="sort"]:checked')?.value || "relevance";
}

// ── Fetch ──
async function fetchResults() {
  const query    = buildQuery();
  const retailers = getRetailers();
  if (!retailers) { showError("Please select at least one store."); return; }

  const minPrice = document.getElementById("min-price").value;
  const maxPrice = document.getElementById("max-price").value;
  const size     = document.getElementById("size").value.trim() || selectedSize;

  const params = new URLSearchParams({ q: query, retailers, num: "20" });
  if (minPrice) params.set("min_price", minPrice);
  if (maxPrice) params.set("max_price", maxPrice);
  if (size)     params.set("size", size);

  // Show app shell if hidden
  document.getElementById("hero").style.display = "none";
  document.getElementById("app-shell").classList.add("visible");
  document.getElementById("sidebar").classList.remove("open");
  drawer.classList.remove("open");

  setLoading(true); clearError(); hideEmpty();

  try {
    const res  = await fetch(`/.netlify/functions/search?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Search failed");
    allResults = data.results || [];
    renderResults();
  } catch (err) {
    showError(`Could not complete search: ${err.message}`);
    allResults = [];
  } finally {
    setLoading(false);
  }
}

// ── Sort ──
function getSorted(results) {
  const sort = getSort();
  const copy = [...results];
  if (sort === "price-asc")  copy.sort((a, b) => (a.extracted_price || 9999) - (b.extracted_price || 9999));
  if (sort === "price-desc") copy.sort((a, b) => (b.extracted_price || 0)    - (a.extracted_price || 0));
  if (sort === "sale")       copy.sort((a, b) => (b.old_price ? 1 : 0)       - (a.old_price ? 1 : 0));
  return copy;
}

// ── Render ──
function renderResults() {
  const grid  = document.getElementById("results-grid");
  const meta  = document.getElementById("results-meta");
  const count = document.getElementById("results-count");
  const storesEl = document.getElementById("active-stores");

  if (!allResults.length) {
    grid.innerHTML = ""; meta.style.display = "none";
    showEmpty(); return;
  }

  const sorted = getSorted(allResults);
  meta.style.display = "flex";
  count.textContent = `${sorted.length} results`;

  const keys = [...new Set(sorted.map((r) => r.retailer_key || getRetailerKey(r.source)).filter(Boolean))];
  storesEl.innerHTML = Object.keys(RETAILER).map((k) => {
    const on = keys.includes(k);
    return `<span class="store-pill${on ? " active-store" : ""}">${esc(RETAILER[k].label)}</span>`;
  }).join("");

  const sizeVal = document.getElementById("size").value.trim() || selectedSize;

  grid.innerHTML = sorted.map((item) => {
    const key    = item.retailer_key || getRetailerKey(item.source);
    const label  = RETAILER[key]?.label || item.source;
    const isSale = !!item.old_price;
    const rating = item.rating ? Math.round(item.rating) : 0;
    const stars  = rating ? "★".repeat(rating) + "☆".repeat(5 - rating) : "";

    return `
      <article class="product-card" onclick="window.open('${esc(item.link)}','_blank')">
        <div class="pc-img">
          ${isSale ? '<span class="pc-badge-sale">SALE</span>' : ""}
          <img
            src="${esc(item.thumbnail)}"
            alt="${esc(item.title)}"
            loading="lazy"
            onerror="this.style.display='none'"
          />
          <span class="pc-store-badge ${key}">${esc(label)}</span>
          <div class="pc-quick">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            VIEW AT ${esc(label.toUpperCase())}
          </div>
        </div>
        <div class="pc-body">
          <div class="pc-store-name">${esc(label.toUpperCase())}</div>
          <div class="pc-title">${esc(item.title)}</div>
          <div class="pc-price-row">
            <span class="pc-price${isSale ? " sale" : ""}">${esc(item.price)}</span>
            ${isSale ? `<span class="pc-price-old">${esc(item.old_price)}</span>` : ""}
          </div>
          ${rating ? `<div class="pc-rating"><span class="stars">${stars}</span>${item.rating}${item.reviews ? ` (${Number(item.reviews).toLocaleString()})` : ""}</div>` : ""}
          ${sizeVal && item.size_confirmed ? `<div class="pc-size-badge">SIZE ${esc(sizeVal)} AVAILABLE</div>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

// ── UI helpers ──
function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function setLoading(on) {
  document.getElementById("loading").style.display = on ? "block" : "none";
  document.getElementById("search-btn").disabled = on;
  if (on) { document.getElementById("results-grid").innerHTML = ""; document.getElementById("results-meta").style.display = "none"; }
}
function showError(msg) {
  const el = document.getElementById("error-msg");
  el.textContent = msg; el.style.display = "block";
}
function clearError() {
  const el = document.getElementById("error-msg");
  el.textContent = ""; el.style.display = "none";
}
function showEmpty()  { document.getElementById("empty-state").style.display = "block"; }
function hideEmpty()  { document.getElementById("empty-state").style.display = "none"; }

// ── Search triggers ──
document.getElementById("search-btn").addEventListener("click", fetchResults);
document.getElementById("query").addEventListener("keydown", (e) => { if (e.key === "Enter") fetchResults(); });
document.getElementById("apply-btn").addEventListener("click", fetchResults);
