// ── State ──
let allResults = [];

// ── Retailer helpers ──
const RETAILER_KEYS = {
  nordstrom: ["nordstrom"],
  neiman: ["neiman marcus", "neimanmarcus"],
  saks: ["saks", "saks fifth avenue"],
  bloomingdales: ["bloomingdale", "bloomingdales"],
};

function getRetailerKey(source) {
  const s = (source || "").toLowerCase();
  for (const [key, aliases] of Object.entries(RETAILER_KEYS)) {
    if (aliases.some((a) => s.includes(a))) return key;
  }
  return "other";
}

function retailerLabel(key) {
  return { nordstrom: "Nordstrom", neiman: "Neiman Marcus", saks: "Saks", bloomingdales: "Bloomingdale's", other: "Other" }[key] || key;
}

// ── Build query from filters ──
function buildQuery() {
  const keyword = document.getElementById("query").value.trim();
  const category = document.getElementById("category").value;
  const size = document.getElementById("size").value.trim();
  const color = document.getElementById("color").value.trim();

  const parts = [];
  if (category) parts.push(category);
  if (color) parts.push(color);
  if (keyword) parts.push(keyword);
  if (size) parts.push(`size ${size}`);

  return parts.join(" ");
}

// ── Get selected retailers ──
function getRetailers() {
  return Array.from(document.querySelectorAll('input[name="retailer"]:checked'))
    .map((cb) => cb.value)
    .join(",");
}

// ── Fetch from serverless function ──
async function fetchResults() {
  const query = buildQuery();
  if (!query) return;

  const retailers = getRetailers();
  if (!retailers) {
    showError("Please select at least one store.");
    return;
  }

  const minPrice = document.getElementById("min-price").value;
  const maxPrice = document.getElementById("max-price").value;

  const params = new URLSearchParams({ q: query, retailers, num: "40" });
  if (minPrice) params.set("min_price", minPrice);
  if (maxPrice) params.set("max_price", maxPrice);

  setLoading(true);
  clearError();
  hideEmpty();

  try {
    const res = await fetch(`/.netlify/functions/search?${params}`);
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

// ── Sort results ──
function getSorted(results) {
  const sort = document.getElementById("sort").value;
  const copy = [...results];
  if (sort === "price-asc") {
    copy.sort((a, b) => (a.extracted_price || 9999) - (b.extracted_price || 9999));
  } else if (sort === "price-desc") {
    copy.sort((a, b) => (b.extracted_price || 0) - (a.extracted_price || 0));
  } else if (sort === "sale") {
    copy.sort((a, b) => (b.old_price ? 1 : 0) - (a.old_price ? 1 : 0));
  }
  return copy;
}

// ── Render product cards ──
function renderResults() {
  const grid = document.getElementById("results-grid");
  const header = document.getElementById("results-header");
  const count = document.getElementById("results-count");

  if (allResults.length === 0) {
    grid.innerHTML = "";
    header.style.display = "none";
    if (!document.getElementById("error-msg").style.display || document.getElementById("error-msg").style.display === "none") {
      showEmpty();
    }
    return;
  }

  const sorted = getSorted(allResults);
  header.style.display = "flex";
  count.textContent = `${sorted.length} result${sorted.length !== 1 ? "s" : ""}`;

  grid.innerHTML = sorted.map((item) => {
    const retailerKey = getRetailerKey(item.source);
    const label = retailerLabel(retailerKey);
    const isSale = !!item.old_price;
    const stars = item.rating ? "★".repeat(Math.round(item.rating)) + "☆".repeat(5 - Math.round(item.rating)) : "";

    return `
      <div class="product-card">
        <img
          class="card-image"
          src="${escHtml(item.thumbnail)}"
          alt="${escHtml(item.title)}"
          loading="lazy"
          onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23f0f0f0%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23aaa%22 font-size=%2212%22>No image</text></svg>'"
        />
        <div class="card-body">
          <div class="card-source">
            <span class="source-badge ${retailerKey}">${escHtml(label)}</span>
            ${isSale ? '<span class="sale-tag">SALE</span>' : ""}
          </div>
          <p class="card-title">${escHtml(item.title)}</p>
          <div class="card-price">
            <span class="price-current">${escHtml(item.price)}</span>
            ${isSale ? `<span class="price-old">${escHtml(item.old_price)}</span>` : ""}
          </div>
          ${item.rating ? `<div class="card-rating"><span class="stars">${stars}</span> ${item.rating} (${item.reviews || 0})</div>` : ""}
        </div>
        <div class="card-footer">
          <a class="view-btn" href="${escHtml(item.link)}" target="_blank" rel="noopener">View at ${escHtml(label)}</a>
        </div>
      </div>
    `;
  }).join("");
}

// ── UI helpers ──
function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setLoading(on) {
  document.getElementById("loading").style.display = on ? "block" : "none";
  document.getElementById("search-btn").disabled = on;
  if (on) {
    document.getElementById("results-grid").innerHTML = "";
    document.getElementById("results-header").style.display = "none";
  }
}

function showError(msg) {
  const el = document.getElementById("error-msg");
  el.textContent = msg;
  el.style.display = "block";
}

function clearError() {
  const el = document.getElementById("error-msg");
  el.textContent = "";
  el.style.display = "none";
}

function showEmpty() {
  document.getElementById("empty-state").style.display = "block";
}

function hideEmpty() {
  document.getElementById("empty-state").style.display = "none";
}

// ── Event Listeners ──
document.getElementById("search-btn").addEventListener("click", fetchResults);

document.getElementById("query").addEventListener("keydown", (e) => {
  if (e.key === "Enter") fetchResults();
});

document.getElementById("sort").addEventListener("change", () => {
  if (allResults.length > 0) renderResults();
});
