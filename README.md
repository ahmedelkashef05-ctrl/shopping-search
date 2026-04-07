# ShopSearch

Search Nordstrom, Neiman Marcus, Saks, and Bloomingdale's all at once.

## Setup (one time)

### 1. Get a SerpAPI key
- Sign up free at https://serpapi.com
- Copy your API key from the dashboard
- Free tier = 100 searches/month

### 2. Deploy to Netlify
1. Push this repo to GitHub
2. Go to https://netlify.com and click "Add new site" → "Import from Git"
3. Select this repo, leave all build settings as-is, click Deploy
4. Once deployed, go to **Site Settings → Environment Variables**
5. Add: `SERPAPI_KEY` = your key from step 1
6. Trigger a redeploy (Deploys → Trigger deploy)

Your app is live. Share the Netlify URL with anyone.

### 3. Local development (optional)
```bash
npm install -g netlify-cli
# Create a .env file with: SERPAPI_KEY=your_key
netlify dev
# Opens at http://localhost:8888
```

## How it works
- You enter a search + filters → the frontend calls a serverless function
- The function securely calls SerpAPI (your API key never touches the browser)
- SerpAPI queries Google Shopping filtered to the selected retailer sites
- Results come back as product cards with images, prices, and direct links

## Filters
- **Stores** — pick which retailers to include
- **Category** — shoes, boots, clothing, bags, etc.
- **Size** — any size (shoe, clothing, etc.)
- **Price range** — min and max
- **Color** — text match
- **Sort** — relevance, price low/high, sale items first
