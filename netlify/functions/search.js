const https = require("https");

exports.handler = async function (event) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const { q, retailers, min_price, max_price, num = "40" } = event.queryStringParameters || {};

  if (!q) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing query" }) };
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "API key not configured" }) };
  }

  // Build site: filter from comma-separated retailer list
  const retailerMap = {
    nordstrom: "nordstrom.com",
    neiman: "neimanmarcus.com",
    saks: "saksfifthavenue.com",
    bloomingdales: "bloomingdales.com",
  };

  let siteFilter = "";
  if (retailers) {
    const sites = retailers
      .split(",")
      .map((r) => retailerMap[r.trim()])
      .filter(Boolean)
      .map((s) => `site:${s}`)
      .join(" OR ");
    if (sites) siteFilter = ` (${sites})`;
  }

  const fullQuery = `${q}${siteFilter}`;

  // Build price filter (Google Shopping tbs param)
  let tbs = "";
  if (min_price || max_price) {
    const min = min_price || "0";
    const max = max_price || "";
    tbs = `&tbs=mr:1,price:1,ppr_min:${min}${max ? `,ppr_max:${max}` : ""}`;
  }

  const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(fullQuery)}&num=${num}&api_key=${apiKey}${tbs}`;

  try {
    const data = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error("Invalid JSON from SerpAPI")); }
        });
      }).on("error", reject);
    });

    const results = (data.shopping_results || []).map((item) => ({
      title: item.title || "",
      price: item.price || "",
      extracted_price: item.extracted_price || null,
      old_price: item.old_price || null,
      source: item.source || "",
      thumbnail: item.thumbnail || "",
      link: item.product_link || item.link || "",
      rating: item.rating || null,
      reviews: item.reviews || null,
      snippet: item.snippet || "",
    }));

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ results, total: results.length }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
