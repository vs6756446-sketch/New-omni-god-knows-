// crawler.js
const fs = require("fs");
const cheerio = require("cheerio");

global.fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const sites = [
  "https://missav.live",
  "https://javseen.tv",
  "https://javgg.net",
  "https://jav.guru",
  "https://javdoe.com",
  "https://javhd.today",
  "https://tokyomotion.net",
  "https://7mmtv.sx",
  "https://javtiful.com",
  "https://javhay.net",
  "https://mythav.com",
  "https://abjav.com",
  "https://javbraze.com",
  "https://freejav.guru",
  "https://javwine.com",
  "https://avuncens.com",
  "https://arcjav.com",
  "https://javhdporn.com",
  "https://javbest.tv",
  "https://javtsunami.com"
];

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
};

function clean(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

async function crawl(url) {
  try {
    console.log("Crawling:", url);

    const res = await fetch(url, { headers });

    if (!res.ok) {
      console.log("Failed:", res.status);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const results = [];

    $("a").each((i, el) => {
      if (results.length >= 80) return false;

      const href = $(el).attr("href");
      const title =
        clean($(el).attr("title")) ||
        clean($(el).text());

      const img =
        $(el).find("img").attr("src") ||
        $(el).find("img").attr("data-src");

      if (!href || !title || title.length < 4) return;

      if (
        href.includes("login") ||
        href.includes("signup") ||
        href.includes("#")
      )
        return;

      let fullUrl;

      try {
        fullUrl = new URL(href, url).href;
      } catch {
        return;
      }

      results.push({
        domain: new URL(url).hostname,
        type: img ? "image" : "page",
        title,
        url: fullUrl,
        desc: title,
        thumb: img
          ? new URL(img, url).href
          : null
      });
    });

    return results;
  } catch (e) {
    console.log("ERROR:", url, e.message);
    return [];
  }
}

async function main() {
  let all = [];
  let id = 1;

  for (const site of sites) {
    const data = await crawl(site);

    data.forEach((x) => {
      x.id = id++;
    });

    all.push(...data);
  }

  const seen = new Set();

  all = all.filter((x) => {
    if (seen.has(x.url)) return false;
    seen.add(x.url);
    return true;
  });

  fs.writeFileSync(
    "index.json",
    JSON.stringify(all, null, 2)
  );

  console.log("DONE:", all.length, "results");
}

main();
