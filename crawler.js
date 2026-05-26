const fs = require("fs");
const cheerio = require("cheerio");

// fetch support for GitHub Actions node
global.fetch=(...args)=>
import("node-fetch").then(({default:fetch})=>fetch(...args));

// Add websites here later
const sites = [
  "wwe.com",
  "reddit.com",
  "youtube.com",
  "github.com/blog"
];

async function buildIndex(){

let index=[];
let id=1;

for(const site of sites){

try{

const baseUrl=site.startsWith("http")
? site
: `https://${site}`;

console.log("Crawling:",baseUrl);

const res=await fetch(baseUrl,{
headers:{
"User-Agent":"Mozilla/5.0"
}
});

if(!res.ok) continue;

const html=await res.text();
const $=cheerio.load(html);

const title=
$("title").text() ||
$('meta[property="og:title"]').attr("content") ||
site;

const desc=
$('meta[name="description"]').attr("content") ||
$('meta[property="og:description"]').attr("content") ||
"No description";

const thumb=
$('meta[property="og:image"]').attr("content") ||
null;

// Main page
index.push({
id:id++,
domain:site,
type:"page",
title:title.trim(),
url:baseUrl,
desc:desc.trim(),
thumb
});

// Images
$("img").slice(0,5).each((i,el)=>{

let src=$(el).attr("src");

if(!src || src.startsWith("data:")) return;

try{

src=new URL(src,baseUrl).href;

index.push({
id:id++,
domain:site,
type:"image",
title:
$(el).attr("alt")
||`${site} image`,
url:src,
desc:"",
thumb:src
});

}catch{}

});

// Videos
$("iframe").slice(0,5).each((i,el)=>{

const src=$(el).attr("src");

if(
src &&
(src.includes("youtube")
|| src.includes("vimeo"))
){

index.push({
id:id++,
domain:site,
type:"video",
title:`${site} video`,
url:src,
desc:"Embedded video",
thumb:null,
duration:"Video"
});

}

});

}catch(e){

console.log(
"Skipped:",
site,
e.message
);

}

}

fs.writeFileSync(
"index.json",
JSON.stringify(index,null,2)
);

console.log(
`Done: ${index.length} indexed`
);

}

buildIndex();
