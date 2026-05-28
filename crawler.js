const cheerio = require("cheerio");
const fs = require("fs");

global.fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const MEILI_URL = "https://meilisearch-production-7a96.up.railway.app";
const MEILI_KEY = "strongpassword123";

const sites = [
  "https://missav.live",
  "https://javseen.tv",
  "https://javgg.net",
  "https://javhdporn.com",
  "https://jav.guru",
  "https://tokyomotion.net",
  "https://7mmtv.sx"
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/124 Safari/537.36"
};

function absolute(url, base) {
  try { return new URL(url, base).href; }
  catch { return null; }
}

function stripHtml(str) {
  return (str || '').replace(/<[^>]*>/g, '').trim();
}

function extractThumb(el, $, base) {
  // Try common thumb patterns
  const img = $(el).find("img").first();
  const src =
    img.attr("src") ||
    img.attr("data-src") ||
    img.attr("data-lazy-src") ||
    img.attr("data-original") ||
    $(el).find("[data-thumb]").attr("data-thumb") ||
    null;

  if (!src) return null;
  if (src.startsWith("data:")) return null;  // skip base64/SVG placeholders
  return absolute(src, base);
}

async function crawl(siteUrl) {
  try {
    console.log("Crawling:", siteUrl);

    const res = await fetch(siteUrl, { headers: HEADERS });
    const html = await res.text();
    const $ = cheerio.load(html);

    const results = [];
    const seen = new Set();
    let id = Date.now();

    $("a").each((i, el) => {
      const href  = $(el).attr("href");
      const text  = stripHtml($(el).text());

      if (!href || !text || text.length < 3) return;

      const full = absolute(href, siteUrl);
      if (!full) return;
      if (seen.has(full)) return;
      seen.add(full);

      const thumb = extractThumb(el, $, siteUrl);
      const type  = thumb ? "video" : "page";

      results.push({
        id:     id++,
        title:  text,
        desc:   text,
        url:    full,
        domain: new URL(siteUrl).hostname.replace("www.", ""),
        thumb:  thumb,
        type:   type
      });
    });

    console.log(`Found ${results.length} items from ${siteUrl}`);

    if (results.length > 0) {
      // Upload to Meilisearch using Bearer auth (not X-Meili-API-Key)
      const uploadRes = await fetch(`${MEILI_URL}/indexes/movies/documents`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${MEILI_KEY}`
        },
        body: JSON.stringify(results)
      });
      const uploadData = await uploadRes.json();
      console.log("Meilisearch response:", JSON.stringify(uploadData));
    }

    return results;

  } catch (e) {
    console.log("FAILED:", siteUrl, e.message);
    return [];
  }
}

(async () => {
  const allResults = [];

  for (const site of sites) {
    const r = await crawl(site);
    allResults.push(...r);
  }

  // Save combined index.json
  fs.writeFileSync("index.json", JSON.stringify(allResults, null, 2));
  console.log(`DONE — ${allResults.length} total items saved to index.json`);
})();
