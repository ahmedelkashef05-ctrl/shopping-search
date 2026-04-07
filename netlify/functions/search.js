const https = require("https");

// Maps retailer keys to display names and source-matching aliases
const RETAILER_CONFIG = {
  nordstrom: {
    name: "Nordstrom",
    aliases: ["nordstrom"],
  },
  neiman: {
    name: "Neiman Marcus",
    aliases: ["neiman marcus", "neimanmarcus"],
  },
  saks: {
    name: "Saks Fifth Avenue",
    aliases: ["saks fifth avenue", "saks"],
  },
  bloomingdales: {
    name: "Bloomingdale's",
    aliases: ["bloomingdale's", "bloomingdales", "bloomingdale"],
  },
};

function matchesRetailer(source, selectedKeys) {
  const s = (source || "").toLowerCase();
  return selectedKeys.some((key) => {
    const config = RETAILER_CONFIG[key];
    return config && config.aliases.some((alias) => s.includes(alias));
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

  const { q, retailers, min_price, max_price, num = "60" } = event.queryStringParameters || {};

  if (!q) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing query" }) };
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "API key not configured" }) };
  }

  const selectedKeys = retailers ? retailers.split(",").map((r) => r.trim()).filter(Boolean) : [];

  // Build price filter (Google Shopping tbs param)
  let tbs = "";
  if (min_price || max_price) {
    const min = min_price || "0";
    const max = max_price || "";
    tbs = `&tbs=mr:1,price:1,ppr_min:${min}${max ? `,ppr_max:${max}` : ""}`;
  }

  // Search broadly — filter by retailer on the backend after results come in
  const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(q)}&num=${num}&api_key=${apiKey}${tbs}`;

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

    let results = (data.shopping_results || []).map((item) => ({
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

    // Filter to selected retailers if any were specified
    if (selectedKeys.length > 0) {
      results = results.filter((item) => matchesRetailer(item.source, selectedKeys));
    }

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
