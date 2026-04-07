const https = require("https");

const RETAILER_CONFIG = {
  nordstrom:      { name: "Nordstrom",          searchName: "Nordstrom" },
  neiman:         { name: "Neiman Marcus",       searchName: "Neiman Marcus" },
  saks:           { name: "Saks Fifth Avenue",   searchName: "Saks Fifth Avenue" },
  bloomingdales:  { name: "Bloomingdale's",      searchName: "Bloomingdales" },
};

function serpFetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error("Invalid JSON from SerpAPI")); }
      });
    }).on("error", reject);
  });
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

  const { q, retailers, min_price, max_price, num = "20" } = event.queryStringParameters || {};

  if (!q) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing query" }) };
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "API key not configured" }) };
  }

  const selectedKeys = retailers
    ? retailers.split(",").map((r) => r.trim()).filter((r) => RETAILER_CONFIG[r])
    : Object.keys(RETAILER_CONFIG);

  // Price filter
  let tbs = "";
  if (min_price || max_price) {
    const min = min_price || "0";
    const max = max_price || "";
    tbs = `&tbs=mr:1,price:1,ppr_min:${min}${max ? `,ppr_max:${max}` : ""}`;
  }

  // Run one search per selected retailer in parallel
  const searches = selectedKeys.map((key) => {
    const retailer = RETAILER_CONFIG[key];
    const query = `${q} ${retailer.searchName}`;
    const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&num=${num}&api_key=${apiKey}${tbs}`;
    return serpFetch(url)
      .then((data) =>
        (data.shopping_results || []).map((item) => ({
          title: item.title || "",
          price: item.price || "",
          extracted_price: item.extracted_price || null,
          old_price: item.old_price || null,
          source: retailer.name,
          retailer_key: key,
          thumbnail: item.thumbnail || "",
          link: item.product_link || item.link || "",
          rating: item.rating || null,
          reviews: item.reviews || null,
          snippet: item.snippet || "",
        }))
      )
      .catch(() => []); // if one retailer fails, don't block the others
  });

  try {
    const perRetailerResults = await Promise.all(searches);

    // Interleave results so cards from all retailers are mixed together
    const interleaved = [];
    const maxLen = Math.max(...perRetailerResults.map((r) => r.length));
    for (let i = 0; i < maxLen; i++) {
      for (const retailerResults of perRetailerResults) {
        if (retailerResults[i]) interleaved.push(retailerResults[i]);
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ results: interleaved, total: interleaved.length }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
