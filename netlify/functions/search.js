const https = require("https");

const RETAILER_CONFIG = {
  nordstrom:     { name: "Nordstrom",         searchName: "Nordstrom" },
  neiman:        { name: "Neiman Marcus",      searchName: "Neiman Marcus" },
  saks:          { name: "Saks Fifth Avenue",  searchName: "Saks Fifth Avenue" },
  bloomingdales: { name: "Bloomingdale's",     searchName: "Bloomingdales" },
};

function serpFetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error("Invalid JSON")); }
      });
    }).on("error", reject);
  });
}

// Build retailer-specific deep link with size pre-selected
function buildSizedUrl(link, retailerKey, size) {
  if (!size || !link) return link;
  try {
    const u = new URL(link);
    switch (retailerKey) {
      case "nordstrom": {
        // /s/product-name/1234567 → dwvar_1234567_size
        const m = u.pathname.match(/\/(\d{5,})\/?$/);
        if (m) u.searchParams.set(`dwvar_${m[1]}_size`, size);
        break;
      }
      case "neiman":
        u.searchParams.set("selectedSize", size);
        break;
      case "saks": {
        // /product/name-SKU.html → dwvar_SKU_size
        const m = u.pathname.match(/([A-Z0-9\-]{6,})\.html$/i);
        if (m) u.searchParams.set(`dwvar_${m[1]}_size`, size);
        break;
      }
      case "bloomingdales":
        u.searchParams.set("SIZE", size);
        break;
    }
    return u.toString();
  } catch (_) {
    return link;
  }
}

// Check if size appears available from SerpAPI product detail
async function checkSizeAvailable(productId, size, apiKey) {
  if (!productId || !size) return true; // can't check — allow through
  try {
    const url = `https://serpapi.com/search.json?engine=google_product&product_id=${encodeURIComponent(productId)}&api_key=${apiKey}`;
    const data = await serpFetch(url);
    const specs = data.product_results?.specs || [];
    const buyingOptions = data.sellers_results?.online_sellers || [];

    // Check specs for size mention
    const specsText = JSON.stringify(specs).toLowerCase();
    if (specsText.includes("size") && !specsText.includes(size.toLowerCase())) {
      return false;
    }

    // Check sellers for availability
    if (buyingOptions.length > 0) {
      return buyingOptions.some((s) => {
        const details = JSON.stringify(s).toLowerCase();
        return !details.includes("out of stock") && !details.includes("unavailable");
      });
    }
    return true;
  } catch (_) {
    return true; // on error, allow through
  }
}

// Lightweight availability check via snippet + extensions + title
function quickSizeCheck(item, size) {
  if (!size) return true;
  const haystack = [
    item.title || "",
    item.snippet || "",
    JSON.stringify(item.extensions || []),
  ].join(" ").toLowerCase();

  const s = size.toLowerCase();
  const outOfStock = haystack.includes("out of stock") || haystack.includes("sold out");
  if (outOfStock) return false;

  // If size is specifically mentioned as unavailable
  const unavailPattern = new RegExp(`size\\s*${s}\\s*(unavailable|out of stock|sold out)`, "i");
  if (unavailPattern.test(haystack)) return false;

  return true;
}

exports.handler = async function (event) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const { q, retailers, min_price, max_price, size, num = "20" } = event.queryStringParameters || {};

  if (!q) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing query" }) };

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "API key not configured" }) };

  const selectedKeys = retailers
    ? retailers.split(",").map((r) => r.trim()).filter((r) => RETAILER_CONFIG[r])
    : Object.keys(RETAILER_CONFIG);

  let tbs = "";
  if (min_price || max_price) {
    const min = min_price || "0";
    const max = max_price || "";
    tbs = `&tbs=mr:1,price:1,ppr_min:${min}${max ? `,ppr_max:${max}` : ""}`;
  }

  // Run one search per retailer in parallel — include size in query for relevance
  const sizeQuery = size ? ` size ${size}` : "";

  const searches = selectedKeys.map((key) => {
    const retailer = RETAILER_CONFIG[key];
    const query = `women's ${q}${sizeQuery} ${retailer.searchName}`;
    const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&num=${num}&api_key=${apiKey}${tbs}`;

    return serpFetch(url)
      .then((data) =>
        (data.shopping_results || [])
          .filter((item) => quickSizeCheck(item, size))
          .map((item) => {
            const directLink = item.product_link || item.link || "";
            return {
              title: item.title || "",
              price: item.price || "",
              extracted_price: item.extracted_price || null,
              old_price: item.old_price || null,
              source: retailer.name,
              retailer_key: key,
              thumbnail: item.thumbnail || "",
              // Deep link with size pre-selected where possible
              link: buildSizedUrl(directLink, key, size),
              product_id: item.product_id || null,
              rating: item.rating || null,
              reviews: item.reviews || null,
              snippet: item.snippet || "",
              size_confirmed: !!size,
            };
          })
      )
      .catch(() => []);
  });

  try {
    const perRetailer = await Promise.all(searches);

    // Interleave so all retailers are represented
    const interleaved = [];
    const maxLen = Math.max(...perRetailer.map((r) => r.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const list of perRetailer) {
        if (list[i]) interleaved.push(list[i]);
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ results: interleaved, total: interleaved.length }),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
