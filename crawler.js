const cheerio = require("cheerio");

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
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

async function crawl(url) {
  try {
    console.log("Crawling:", url);

    const res = await fetch(url, {
      headers: HEADERS
    });

    const html = await res.text();

    const $ = cheerio.load(html);

    const results = [];
    let id = Date.now();

    $("a").each((i, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim();

      if (!href || !text) return;
      if (text.length < 3) return;

      const full = absolute(href, url);

      if (!full) return;

      const img =
        $(el).find("img").attr("src") ||
        $(el).find("img").attr("data-src") ||
        "";

      results.push({
        id: id++,
        title: text,
        url: full,
        domain: new URL(url).hostname,
        thumb: absolute(img, url),
        type: "video"
      });
    });

    const clean = [];
    const seen = new Set();

    for (const item of results) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      clean.push(item);
    }

    console.log("Found:", clean.length);

    if (clean.length > 0) {
      await fetch(`${MEILI_URL}/indexes/movies/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MEILI_KEY}`
        },
        body: JSON.stringify(clean)
      });

      console.log("Uploaded to Meilisearch");
    }
  } catch (e) {
    console.log("FAILED:", url, e.message);
  }
}

(async () => {
  for (const site of sites) {
    await crawl(site);
  }

  console.log("DONE");
})();
