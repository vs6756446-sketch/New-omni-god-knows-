const fs = require("fs");
const cheerio = require("cheerio");

global.fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// ─── CONFIG ────────────────────────────────────────────────
const sites = [
  {
    domain: "github.blog",
    url: "https://github.blog",
    // CSS selectors for article cards on this site
    articleSel: "article, .post-card, .article-card, .gh-card",
    titleSel: "h2, h3, .post-title, .article-title",
    descSel: "p, .post-excerpt, .article-excerpt",
    thumbSel: "img",
    linkSel: "a"
  },
  {
    domain: "reddit.com",
    url: "https://old.reddit.com/r/programming/",  // old.reddit = static HTML, no JS wall
    articleSel: ".thing.link",
    titleSel: "a.title",
    descSel: ".tagline",
    thumbSel: "img.thumbnail",
    linkSel: "a.title"
  }
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9"
};

// ─── HELPERS ───────────────────────────────────────────────
function cleanTitle(t) {
  if (!t) return "";
  return t
    .replace(/More Share Options/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isJunkTitle(t) {
  if (!t || t.length < 5) return true;
  if (t.toLowerCase().includes("share options")) return true;
  if (t.toLowerCase().includes("sign in")) return true;
  if (t.toLowerCase().includes("log in")) return true;
  return false;
}

function isJunkUrl(u) {
  if (!u) return true;
  if (u.includes("youtube.com/embed")) return true;
  if (u.includes("accounts.google.com")) return true;
  if (u.includes("ServiceLogin")) return true;
  if (u.includes("logo.svg")) return true;
  if (u.startsWith("data:")) return true;
  return false;
}

function resolveUrl(src, base) {
  if (!src) return null;
  try { return new URL(src, base).href; } catch { return null; }
}

// ─── MAIN ──────────────────────────────────────────────────
async function crawlSite(site) {
  console.log("Crawling:", site.url);
  const results = [];

  let html;
  try {
    const res = await fetch(site.url, { headers: HEADERS });
    if (!res.ok) { console.log("HTTP error:", res.status, site.url); return []; }
    html = await res.text();
  } catch (e) {
    console.log("Fetch failed:", site.domain, e.message);
    return [];
  }

  const $ = cheerio.load(html);

  // ── 1. Structured article extraction ──
  let articleCount = 0;
  $(site.articleSel).each((i, el) => {
    if (articleCount >= 20) return false; // limit per site

    const $el = $(el);

    // Title
    let title = cleanTitle(
      $el.find(site.titleSel).first().text() ||
      $el.find("h1,h2,h3").first().text()
    );
    if (isJunkTitle(title)) return;

    // URL
    let url = resolveUrl(
      $el.find(site.linkSel).first().attr("href") ||
      $el.find("a").first().attr("href"),
      site.url
    );
    if (!url || isJunkUrl(url)) return;

    // Desc
    let desc = $el.find(site.descSel).first().text().trim().slice(0, 200) || "";

    // Thumb — only real article images, not icons/logos
    let thumb = null;
    $el.find(site.thumbSel).each((_, img) => {
      const src = resolveUrl($(img).attr("src") || $(img).attr("data-src"), site.url);
      const w = parseInt($(img).attr("width") || "0");
      const h = parseInt($(img).attr("height") || "0");
      // skip tiny icons (< 80px)
      if (src && !src.includes("logo") && !src.includes("icon") && !src.startsWith("data:")) {
        if (w === 0 || w >= 80) { thumb = src; return false; }
      }
    });

    // Type
    const type = thumb ? "image" : "page";

    results.push({ domain: site.domain, type, title, url, desc, thumb });
    articleCount++;
  });

  // ── 2. Fallback: og:meta for the homepage itself ──
  if (results.length === 0) {
    const title = cleanTitle(
      $('meta[property="og:title"]').attr("content") || $("title").text() || site.domain
    );
    const desc = (
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") || ""
    ).slice(0, 200);
    const thumb = $('meta[property="og:image"]').attr("content") || null;
    if (!isJunkTitle(title)) {
      results.push({ domain: site.domain, type: "page", title, url: site.url, desc, thumb });
    }
  }

  console.log(`  → ${results.length} results from ${site.domain}`);
  return results;
}

async function buildIndex() {
  let index = [];
  let id = 1;

  for (const site of sites) {
    const items = await crawlSite(site);
    items.forEach(item => { item.id = id++; });
    index = index.concat(items);
  }

  // Final dedupe by URL
  const seen = new Set();
  index = index.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  fs.writeFileSync("index.json", JSON.stringify(index, null, 2));
  console.log(`\nDone: ${index.length} clean results indexed`);
}

buildIndex();
