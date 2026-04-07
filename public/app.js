// ── State ──
let allResults = [];
let selectedColor = "";

// ── Retailer key from source string ──
const RETAILER_ALIASES = {
  nordstrom:      ["nordstrom"],
  neiman:         ["neiman marcus", "neimanmarcus"],
  saks:           ["saks fifth avenue", "saks"],
  bloomingdales:  ["bloomingdale's", "bloomingdales", "bloomingdale"],
};
const RETAILER_LABELS = {
  nordstrom: "Nordstrom", neiman: "Neiman Marcus",
  saks: "Saks Fifth Avenue", bloomingdales: "Bloomingdale's",
};

function getRetailerKey(source) {
  const s = (source || "").toLowerCase();
  for (const [key, aliases] of Object.entries(RETAILER_ALIASES)) {
    if (aliases.some((a) => s.includes(a))) return key;
  }
  return "other";
}

// ── Build query ──
function buildQuery() {
  const keyword = document.getElementById("query").value.trim();
  const size    = document.getElementById("size").value.trim();
  const color   = document.getElementById("color").value.trim() || selectedColor;
  const catEl   = document.querySelector(".nav-pill.active");
  const category = catEl ? catEl.dataset.cat : "";

  const parts = [];
  if (category) parts.push(category);
  if (color)    parts.push(color);
  if (keyword)  parts.push(keyword);
  if (size)     parts.push(`size ${size}`);
  return parts.join(" ") || "shoes";
}

function getRetailers() {
  return Array.from(document.querySelectorAll('input[name="retailer"]:checked'))
    .map((cb) => cb.value).join(",");
}

function getSort() {
  const r = document.querySelector('input[name="sort"]:checked');
  return r ? r.value : "relevance";
}

// ── Fetch ──
async function fetchResults() {
  const query    = buildQuery();
  const retailers = getRetailers();
  if (!retailers) { showError("Please select at least one store."); return; }

  const minPrice = document.getElementById("min-price").value;
  const maxPrice = document.getElementById("max-price").value;

  const params = new URLSearchParams({ q: query, retailers, num: "20" });
  if (minPrice) params.set("min_price", minPrice);
  if (maxPrice) params.set("max_price", maxPrice);

  setLoading(true);
  clearError();
  hideEmpty();

  try {
    const res  = await fetch(`/.netlify/functions/search?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Search failed");
    allResults = data.results || [];
    renderResults();
  } catch (err) {
    showError(`Search error: ${err.message}`);
    allResults = [];
    renderResults();
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
  const grid   = document.getElementById("results-grid");
  const bar    = document.getElementById("results-bar");
  const count  = document.getElementById("results-count");
  const tags   = document.getElementById("store-tags");

  if (!allResults.length) {
    grid.innerHTML = "";
    bar.style.display = "none";
    showEmpty();
    return;
  }

  const sorted = getSorted(allResults);
  bar.style.display = "flex";
  count.textContent = `${sorted.length} product${sorted.length !== 1 ? "s" : ""} found`;

  // Build store tags from unique retailers in results
  const keys = [...new Set(sorted.map((r) => getRetailerKey(r.source)).filter((k) => k !== "other"))];
  tags.innerHTML = keys.map((k) =>
    `<span class="store-tag ${k}">${esc(RETAILER_LABELS[k] || k)}</span>`
  ).join("");

  grid.innerHTML = sorted.map((item) => {
    const key    = getRetailerKey(item.source);
    const label  = RETAILER_LABELS[key] || item.source;
    const isSale = !!item.old_price;
    const stars  = item.rating
      ? "★".repeat(Math.round(item.rating)) + "☆".repeat(5 - Math.round(item.rating))
      : "";
    // Try to extract brand from title (first word(s) before a space-dash pattern)
    const brandMatch = item.title.match(/^([A-Z][A-Za-z&\s]{2,20}?)(?:\s[-–]|\s\d|\s[a-z])/);
    const brand = brandMatch ? brandMatch[1].trim() : "";

    return `
      <div class="product-card">
        <div class="card-img-wrap">
          ${isSale ? '<span class="sale-ribbon">SALE</span>' : ""}
          <img
            src="${esc(item.thumbnail)}"
            alt="${esc(item.title)}"
            loading="lazy"
            onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Crect width=%22120%22 height=%22120%22 fill=%22%23f0f0f0%22/%3E%3C/svg%3E'"
          />
          <span class="card-store-badge ${key}">${esc(label)}</span>
        </div>
        <div class="card-body">
          ${brand ? `<div class="card-brand">${esc(brand)}</div>` : ""}
          <p class="card-title">${esc(item.title)}</p>
          <div class="card-price-row">
            <span class="price-now${isSale ? " is-sale" : ""}">${esc(item.price)}</span>
            ${isSale ? `<span class="price-was">${esc(item.old_price)}</span>` : ""}
          </div>
          ${item.rating ? `<div class="card-rating"><span class="stars">${stars}</span> ${item.rating}${item.reviews ? ` (${item.reviews})` : ""}</div>` : ""}
        </div>
        <div class="card-footer">
          <a class="shop-btn" href="${esc(item.link)}" target="_blank" rel="noopener">SHOP NOW</a>
        </div>
      </div>
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
  document.getElementById("loading").style.display = on ? "flex" : "none";
  document.getElementById("search-btn").disabled = on;
  if (on) { document.getElementById("results-grid").innerHTML = ""; document.getElementById("results-bar").style.display = "none"; }
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

// ── Category nav ──
document.querySelectorAll(".nav-pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-pill").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// ── Color swatches ──
document.querySelectorAll(".swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => {
    document.querySelectorAll(".swatch").forEach((s) => s.classList.remove("selected"));
    if (selectedColor === swatch.dataset.color) {
      selectedColor = "";
      document.getElementById("color").value = "";
    } else {
      swatch.classList.add("selected");
      selectedColor = swatch.dataset.color;
      document.getElementById("color").value = swatch.dataset.color;
    }
  });
});

// ── Sidebar toggles ──
document.querySelectorAll(".sidebar-title").forEach((title) => {
  title.addEventListener("click", () => {
    const id = title.dataset.toggle;
    const content = document.getElementById(`${id}-content`);
    if (content) {
      content.classList.toggle("hidden");
      title.classList.toggle("collapsed");
    }
  });
});

// ── Search triggers ──
document.getElementById("search-btn").addEventListener("click", fetchResults);
document.getElementById("query").addEventListener("keydown", (e) => { if (e.key === "Enter") fetchResults(); });
document.getElementById("apply-btn").addEventListener("click", fetchResults);
