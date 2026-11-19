import { render as renderCard, pixGrid, renderGameCard, gcScreen, gcSheet, gcHist, renderSealCard } from "./card.mjs";
import RESVG from "./resvg.wasm";
// Folio: Farcaster Articles, ranked and translated.
const FC = "https://api.farcaster.xyz";
const APP_NAME = "Folio";
const DAY = 86400000;

// Search is relevance-ranked and ignores stopwords ("the", "a", "of" return nothing), so we rotate
// many distinct content words in many languages. ALWAYS_Q run every time: they surface articles best.
const ALWAYS_Q = ["articles", "farcaster articles", "farticle"];
const KEYWORDS = [
  "article","why","how","my","building","writing","first","life","think","crypto","market",
  "story","essay","ai","founder","learn","lessons","guide","notes","thoughts","future","history","book",
  "music","art","design","product","startup","money","work","year","week","today","community","base",
  "ethereum","bitcoin","culture","love","family","travel","health","growth","onchain","protocol","open",
  "social","internet","build","creator","media","game","games","developer","code","agents","economy",
  "politics","philosophy","science","city","home","journey","reflection","letter","introducing","update",
  "announcing","part","chapter","review","report","analysis","case","deep dive","explained","truth",
  "power","time","world","people","new","old","best","why i","what i","how to","long read","thread",
  "nouns","degen","zora","clanker","defi","nft","wallet","token","dao","privacy","freedom","network",
  "poetry","poem","fiction","short story","photography","film","sports","football","food","education",
  "conclusion","introduction","framework","strategy","playbook","manifesto","memo","essay on","on writing",
  "lesson","mistakes","learned","years","career","burnout","identity","trust","attention","incentives",
  "tokenomics","stablecoin","layer","rollup","mini app","miniapp","snapchain","channel","creators","writers",
  "newsletter","paragraph","mirror","substack","blog","post","publish","published","draft","read",
  "llm","model","prompt","robot","climate","energy","china","europe","africa","india","latam","brazil",
  // Spanish / Portuguese / French / German / Italian / Dutch
  "historia","vida","futuro","pensamientos","porque","cómo","comunidad","história","sobre","porquê","como",
  "histoire","pourquoi","comment","pensées","avenir","warum","geschichte","gedanken","zukunft","leben",
  "storia","perché","futuro della","waarom","verhaal","toekomst",
  // Turkish / Russian / Ukrainian / Polish
  "neden","hikaye","hayat","gelecek","почему","история","жизнь","будущее","чому","історія","dlaczego","przyszłość",
  // Asian languages
  "的","文章","故事","未来","記事","について","物語","이야기","생각","미래","cerita","kenapa","masa depan",
  "câu chuyện","tại sao","เรื่อง","कहानी","क्यों","kwa nini","bakit",
  // Arabic / Hebrew
  "لماذا","قصة","مستقبل","למה","סיפור"
];
const TOPICS = {
  crypto: ["crypto","bitcoin","ethereum","token","defi","onchain","on-chain","wallet","nft","dao","base","zora","clanker","degen","usdc","stablecoin","airdrop","chain","web3","protocol","solana"],
  builders: ["build","building","startup","founder","developer","code","mini app","open source","devs","agent","agents","software","launch","ship","design","engineering","api","sdk"],
  money: ["money","market","markets","economy","finance","invest","investing","trading","price","income","business","revenue","fund"],
  culture: ["social media","attention","society","psychology","media","research","brain","teens","art","music","film","book","books","poetry","poem","fiction","culture","photography","history","philosophy","story","writing","essay"],
  life: ["life","family","love","health","travel","home","journey","reflection","personal","faith","kids","mental","moved","childhood","memory"],
  farcaster: ["farcaster","cast","casts","channel","warpcast","fid","snapchain","hypersnap","frames"]
};
const RTL = new Set(["ar","he","ur","ps","fa"]);
const LANGS = {es:"Spanish",pt:"Portuguese",fr:"French",de:"German",it:"Italian",tr:"Turkish",ru:"Russian",uk:"Ukrainian",zh:"Simplified Chinese",ja:"Japanese",ko:"Korean",hi:"Hindi",id:"Indonesian",vi:"Vietnamese",th:"Thai",pl:"Polish",nl:"Dutch",en:"English",ur:"Urdu",he:"Hebrew",bn:"Bengali",tl:"Filipino",sw:"Swahili",ms:"Malay",ar:"Arabic",fa:"Persian (Farsi)"};

const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", ...h } });

async function fcGet(path, sr, env, init) {
  // sr: optional subrequest counter { n, cap }. Throws instead of fetching once the cap is hit.
  if (sr) { if (sr.n >= sr.cap) throw new Error("subrequest cap"); sr.n++; }
  const headers = { "user-agent": "folio-reader/1.0", accept: "application/json" };
  if (init && init.auth && env && env.FC_API_KEY) headers.authorization = "Bearer " + env.FC_API_KEY;
  if (init && init.body) headers["content-type"] = "application/json";
  const r = await fetch(FC + path, { method: (init && init.method) || "GET", headers, body: init && init.body ? JSON.stringify(init.body) : undefined });
  if (!r.ok) { const er = new Error("fc " + r.status + " " + path); if (r.status === 404) er.nf = 1; throw er; }
  return r.json();
}

function topicOf(text, title) {
  if (title) text = (title + " ").repeat(3) + text;
  const t = " " + text.toLowerCase() + " ";
  let best = null, bestN = 0;
  for (const [k, words] of Object.entries(TOPICS)) {
    let n = 0;
    for (const w of words) { const re = new RegExp("[^a-z]" + w.replace(/[-]/g, "\\-") + "[^a-z]", "g"); const m = t.match(re); if (m) n += m.length; }
    if (n > bestN) { bestN = n; best = k; }
  }
  return bestN >= 2 ? best : (best || "life");
}

function slim(c) {
  const img = (c.embeds && c.embeds.images && c.embeds.images[0]) ? c.embeds.images[0].url : null;
  return {
    h: c.hash, ts: c.timestamp,
    title: (c.text || "").split("\n")[0].replace(/^#+\s*/, "").slice(0, 160),
    cover: img,
    a: { fid: c.author.fid, u: c.author.username, n: c.author.displayName, p: c.author.pfp && c.author.pfp.url, f: c.author.followerCount || 0, pro: (c.author.profile && c.author.profile.accountLevel) === "pro" },
    l: (c.reactions && c.reactions.count) || 0,
    r: c.combinedRecastCount || (c.recasts && c.recasts.count) || 0,
    rp: (c.replies && c.replies.count) || 0,
    q: c.quoteCount || 0,
    v: c.viewCount || 0
  };
}

async function loadIndex(env) { return (await env.KV.get("index", "json")) || { items: {}, authors: [], kw: 0, au: 0 }; }

// ---------- discovery ----------
// One cron run must stay well under the 50-subrequest limit (free plan). Every Farcaster call in a run
// goes through a counter capped at CRON_CAP; notifications/daily cast in the same run use at most a few more.
const CRON_CAP = 38;
const POOL_MAX = 3000, WRITERS_MAX = 2000;
const NQ = 3, NW = 8, NP = 14, NF = 10, FANS_MAX = 3000;

function isPreview(env) { return /preview/i.test(env.ORIGIN || ""); }

const PG_RE = /^https?:\/\/(?:www\.)?paragraph\.(?:com|xyz)\/@?([^\/?#]+)\/([^\/?#]+)/i;
const LC_WORDS = 250;
const wc = t => String(t || "").split(/\s+/).filter(Boolean).length;
function pgUrlOf(c) {
  for (const e of (c.embeds && c.embeds.urls) || []) { const u = (e.openGraph && e.openGraph.url) || e.url || ""; if (PG_RE.test(u)) return u.split(/[?#]/)[0]; }
  for (const u of String(c.text || "").match(/https?:\/\/(?:www\.)?paragraph\.(?:com|xyz)\/\S+/gi) || []) if (PG_RE.test(u)) return u.split(/[?#]/)[0];
  return null;
}
const tClean = t => String(t || "").replace(/[*_`#>]+/g, "").replace(/^(\s*@[\w.-]+[,:]?)+\s*/, "").replace(/\s+/g, " ").trim();
function lcSplit(text) {
  let t = String(text || "").trim();
  while (true) { const nl = t.indexOf("\n"); const f = tClean(nl > 0 ? t.slice(0, nl) : t); if (f.length >= 8 || nl < 0) break; t = t.slice(nl + 1).trim(); }
  const nl = t.indexOf("\n"); const first = tClean(nl > 0 ? t.slice(0, nl) : t);
  if (first.length <= 120 && nl > 0) return { title: first, body: t.slice(nl + 1).trim() };
  const tc = tClean(t); const m = tc.match(/^(.{20,110}?[.!?])\s/); return { title: m ? m[1] : tc.slice(0, 100).replace(/\s+\S*$/, "") + "\u2026", body: t };
}
const auObj = a => ({ fid: a.fid, username: a.u, displayName: a.n, pfp: { url: a.p } });
async function pgFetch(u, sr) {
  const m = u.match(PG_RE); if (!m) throw new Error("bad pg");
  if (sr) { if (sr.n >= sr.cap) throw new Error("subrequest cap"); sr.n++; }
  const r = await fetch("https://public.api.paragraph.com/api/v1/publications/slug/" + encodeURIComponent(m[1]) + "/posts/slug/" + encodeURIComponent(m[2]) + "?includeContent=true", { headers: { accept: "application/json", "user-agent": "folio-reader/1.0" } });
  if (!r.ok) throw new Error("pg " + r.status);
  return r.json();
}
function pgBody(x, p) {
  const body = String(p.markdown || "").trim() + "\n\n*Originally published on Paragraph: " + x.pg + "*";
  return { article: { title: p.title || x.title, body, cover: p.imageUrl ? { url: p.imageUrl } : null, previewText: p.subtitle || "", publishedAt: p.publishedAt ? new Date(+p.publishedAt).toISOString() : new Date(x.ts).toISOString() }, author: auObj(x.a) };
}
function lcBody(x, text) {
  const sp = lcSplit(text);
  return { article: { title: sp.title, body: sp.body, cover: x.cover ? { url: x.cover } : null, previewText: sp.body.replace(/\s+/g, " ").slice(0, 220), publishedAt: new Date(x.ts).toISOString() }, author: auObj(x.a) };
}

async function discover(env, dry, seed) {
  const idx = await loadIndex(env);
  const sr = { n: 0, cap: CRON_CAP };
  const now = Date.now();
  const found = [], stubs = {}, extra = [], extraSeen = new Set();
  const writers = new Set(idx.writers || []);
  for (const x of Object.values(idx.items)) if (x.a && x.a.fid) writers.add(x.a.fid);
  const pool = (idx.authors || []).filter(f => !writers.has(f));
  const poolSet = new Set(pool);
  const addFid = f => { if (f && !writers.has(f) && !poolSet.has(f) && !fanSet.has(f)) { poolSet.add(f); pool.push(f); } };
  const addWriter = f => { if (f && !writers.has(f)) { writers.add(f); poolSet.delete(f); fanSet.delete(f); } };
  // fans: people who like, recast, quote or reply to articles, and who writers follow. Most likely to write next, scanned first.
  const fans = (idx.fans || []).filter(f => !writers.has(f));
  const fanSet = new Set(fans);
  const addFan = f => { if (f && !writers.has(f) && !fanSet.has(f)) { fanSet.add(f); fans.push(f); } };
  const take = c => {
    if (!c || !c.author) return;
    if (c.chain) {
      addWriter(c.author.fid);
      if (c.chain.index === 0) found.push(c);
      else if (c.threadHash && !idx.items[c.threadHash]) stubs[c.threadHash] = c; // later piece of an article we have not seen
    } else {
      if (now - c.timestamp < 3 * DAY) addFid(c.author.fid); // recently active people are likely writers too
      // long reads beyond Articles: Pro long casts and Paragraph posts shared as casts (top-level casts only)
      if (!c.parentHash && now - c.timestamp < 30 * DAY && !extraSeen.has(c.hash)) {
        if (wc(c.text) >= LC_WORDS) { extraSeen.add(c.hash); extra.push({ k: "lc", c }); }
        else { const u = pgUrlOf(c); if (u) { extraSeen.add(c.hash); extra.push({ k: "pg", c, u }); } }
      }
    }
    for (const e of (c.embeds && c.embeds.casts) || []) {
      if (!e || !e.author) continue;
      if (e.chain) { addWriter(e.author.fid); addFan(c.author.fid); } // people who quote articles
      if (e.chain && e.chain.index === 0) { e._emb = 1; found.push(e); }
    }
  };
  const jobs = [];
  const only = !!(seed && seed.enrichOnly);
  if (seed) {
    for (const f of seed.writers || []) addWriter(+f);
    for (const f of seed.fans || []) addFan(+f);
    for (const c of seed.casts || []) take(c);
    for (const h of seed.hashes || []) if (/^0x[0-9a-f]{40}$/.test(h) && !idx.items[h]) idx.items[h] = { h, ts: now, title: "", cover: null, a: { fid: 0, u: "", n: "", p: null, f: 0, pro: false }, l: 0, r: 0, rp: 0, q: 0, v: 0, seen: now, emb: 1, stub: 1 };
  }
  if (!only) {
  // 1. searches: fixed article queries + a rotating slice of KEYWORDS (many languages)
  const kws = ALWAYS_Q.slice();
  for (let i = 0; i < NQ; i++) kws.push(KEYWORDS[((idx.kw || 0) + i) % KEYWORDS.length]);
  idx.kw = ((idx.kw || 0) + NQ) % KEYWORDS.length;
  for (const k of kws) jobs.push(fcGet("/v2/search-casts?q=" + encodeURIComponent(k) + "&limit=100", sr).then(d => d.result.casts.forEach(take)).catch(() => {}));
  // 2. optional authenticated feeds (only when FC_API_KEY is set)
  let np = NP;
  // body matches the farcaster.xyz web client (getFeedItems); "limit" is not part of it. A rejected key is retried every 6 h only.
  if (env.FC_API_KEY && !(idx.fkBad && now - idx.fkBad < 6 * 3600000)) {
    np -= 2;
    for (const feedKey of ["trending", "home"]) jobs.push(fcGet("/v2/feed-items", sr, env, { auth: 1, method: "POST", body: { feedKey, feedType: "default", updateState: false } })
      .then(d => { idx.fkOk = now; delete idx.fkBad; ((d.result && d.result.items) || []).forEach(it => take(it.cast || it)); })
      .catch(e => { if (/fc 40[13]/.test(String(e && e.message))) idx.fkBad = now; }));
  }
  // 3. known writers' recent casts (includes their recasts of other articles)
  const wl = [1, ...[...writers].filter(f => f !== 1)];
  const nw = Math.min(wl.length, NW);
  for (let i = 0; i < nw; i++) { const fid = wl[((idx.wr || 0) + i) % wl.length]; jobs.push(fcGet("/v2/casts?fid=" + fid + "&limit=50", sr).then(d => d.result.casts.forEach(take)).catch(() => {})); }
  idx.wr = wl.length ? ((idx.wr || 0) + nw) % wl.length : 0;
  // 4. fans (likely next writers), then the wider author pool, both on rotation
  const nf = Math.min(fans.length, NF);
  for (let i = 0; i < nf; i++) { const fid = fans[((idx.fa || 0) + i) % fans.length]; jobs.push(fcGet("/v2/casts?fid=" + fid + "&limit=50", sr).then(d => d.result.casts.forEach(take)).catch(() => {})); }
  idx.fa = fans.length ? ((idx.fa || 0) + nf) % fans.length : 0;
  const npp = Math.min(pool.length, Math.max(0, np - nf));
  for (let i = 0; i < npp; i++) { const fid = pool[((idx.au || 0) + i) % pool.length]; jobs.push(fcGet("/v2/casts?fid=" + fid + "&limit=50", sr).then(d => d.result.casts.forEach(take)).catch(() => {})); }
  idx.au = pool.length ? ((idx.au || 0) + npp) % pool.length : 0;
  // 5. grow the pool: repliers and quoters of a recent article, and who a writer follows
  const recent = Object.values(idx.items).filter(x => x.meta === 1 && now - x.ts < 4 * DAY).sort((a, b) => b.ts - a.ts);
  const g = idx.gr || 0; idx.gr = g + 1;
  if (recent.length) {
    const art = recent[g % recent.length];
    jobs.push(fcGet("/v2/thread-casts?castHash=" + art.h + "&limit=50", sr).then(d => d.result.casts.forEach(c => { take(c); if (c.author) addFan(c.author.fid); })).catch(() => {}));
    const art2 = recent[(g + 1) % recent.length];
    jobs.push(fcGet("/v2/cast-quotes?castHash=" + art2.h + "&limit=100", sr).then(d => ((d.result && d.result.quotes) || []).forEach(c => { take(c); if (c.author) addFan(c.author.fid); })).catch(() => {}));
    const art3 = recent[(g + 2) % recent.length];
    jobs.push(fcGet("/v2/cast-likes?castHash=" + art3.h + "&limit=100", sr).then(d => ((d.result && d.result.likes) || []).forEach(l => l.reactor && addFan(l.reactor.fid))).catch(() => {}));
    jobs.push(fcGet("/v2/cast-recasters?castHash=" + art3.h + "&limit=100", sr).then(d => ((d.result && d.result.users) || []).forEach(u => addFan(u.fid))).catch(() => {}));
  }
  if (wl.length) jobs.push(fcGet("/v2/following?fid=" + wl[g % wl.length] + "&limit=50", sr).then(d => ((d.result && d.result.users) || []).forEach(u => addFan(u.fid))).catch(() => {}));
  }
  await Promise.all(jobs);
  // merge
  const fresh = [];
  for (const c of found) {
    if (now - c.timestamp > 30 * DAY) continue;
    const s = slim(c);
    const old = idx.items[s.h];
    if (old && c._emb) { old.seen = now; }
    else if (old) { Object.assign(old, { l: s.l, r: s.r, rp: s.rp, q: s.q, v: s.v, a: s.a, cover: old.cover || s.cover }); old.seen = now; }
    else { s.seen = now; if (c._emb) s.emb = 1; idx.items[s.h] = s; fresh.push(s); }
  }
  for (const [h, c] of Object.entries(stubs)) {
    if (idx.items[h] || now - c.timestamp > 30 * DAY) continue;
    const s = slim(c); s.h = h; s.title = ""; s.l = s.r = s.rp = s.q = s.v = 0; s.seen = now; s.emb = 1; s.stub = 1;
    idx.items[h] = s; fresh.push(s);
  }
  const pgKnown = new Set(Object.values(idx.items).filter(x => x.pg).map(x => x.pg.toLowerCase()));
  for (const e of extra) {
    const c = e.c, s = slim(c), old = idx.items[s.h];
    if (old) { Object.assign(old, { l: s.l, r: s.r, rp: s.rp, q: s.q, v: s.v, a: s.a }); old.seen = now; continue; }
    if (e.k === "pg") {
      if (pgKnown.has(e.u.toLowerCase())) continue; pgKnown.add(e.u.toLowerCase());
      Object.assign(s, { k: "pg", pg: e.u, title: "", seen: now }); idx.items[s.h] = s; fresh.push(s);
    } else {
      const b = lcBody(s, c.text);
      Object.assign(s, { k: "lc", title: b.article.title, prev: b.article.previewText, words: wc(b.article.body), seen: now, meta: 1, tv: 3 });
      s.min = Math.max(1, Math.round(s.words / 230)); s.topic = topicOf(b.article.body.slice(0, 4000), s.title);
      idx.items[s.h] = s; fresh.push(s); addWriter(c.author.fid);
      if (!dry) await env.KV.put("body:" + s.h, JSON.stringify(b), { expirationTtl: 3 * 86400 });
    }
  }
  // enrich with article body, newest first, while subrequests remain (emb/stub items cost 2)
  const want = Object.values(idx.items).filter(x => !x.meta || x.meta < 1).filter(x => !x.dead).sort((a, b) => b.ts - a.ts);
  const toEnrich = []; let left = sr.cap - sr.n;
  for (const x of want) { const cost = x.emb ? 2 : 1; if (cost > left) break; left -= cost; toEnrich.push(x); }
  await Promise.all(toEnrich.map(async x => {
    if (x.k === "pg") {
      try {
        const p = await pgFetch(x.pg, sr); const b = pgBody(x, p);
        x.title = b.article.title; x.cover = b.article.cover && b.article.cover.url; x.prev = (b.article.previewText || p.markdown || "").replace(/[#*_>\[\]()]/g, "").replace(/\s+/g, " ").slice(0, 220);
        x.words = wc(p.markdown); x.min = Math.max(1, Math.round(x.words / 230)); x.topic = topicOf(String(p.markdown || "").slice(0, 4000), x.title);
        x.meta = 1; x.tv = 3; addWriter(x.a.fid);
        if (!dry) await env.KV.put("body:" + x.h, JSON.stringify(b), { expirationTtl: 3 * 86400 });
      } catch (e) { x.meta = (x.meta || 0) - 1; if (x.meta < -3) x.dead = 1; }
      return;
    }
    try {
      const d = await fcGet("/v2/user-article?castHash=" + x.h, sr);
      const art = d.result.article;
      const words = (art.body || "").split(/\s+/).filter(Boolean).length;
      x.title = art.title || x.title;
      x.cover = (art.cover && art.cover.url) || x.cover;
      x.prev = (art.previewText || "").replace(/\s+/g, " ").slice(0, 220);
      x.words = words;
      x.min = Math.max(1, Math.round(words / 230));
      x.topic = topicOf((art.body || "").slice(0, 4000), x.title); if (x.topic === "farcaster" && !/farcaster|cast|channel/i.test(x.title)) { const t2 = topicOf((art.body || "").slice(0, 4000).replace(/farcaster|casts?|channels?/gi, "")); x.topic = t2 === "farcaster" ? "life" : t2; }
      const au = d.result.author;
      if (au && au.fid) { x.a = { fid: au.fid, u: au.username, n: au.displayName, p: au.pfp && au.pfp.url, f: au.followerCount || (x.a && x.a.f) || 0, pro: (au.profile && au.profile.accountLevel) === "pro" || !!(x.a && x.a.pro) }; addWriter(au.fid); }
      if (art.publishedAt && x.stub) x.ts = Date.parse(art.publishedAt) || x.ts;
      if (x.emb) { try { const t = await fcGet("/v2/thread-casts?castHash=" + x.h + "&limit=5", sr); const c0 = t.result.casts.find(k => k.hash === x.h); if (c0) { const s2 = slim(c0); Object.assign(x, { l: s2.l, r: s2.r, rp: s2.rp, q: s2.q, v: s2.v, a: s2.a, ts: s2.ts }); } } catch (e) {} delete x.emb; delete x.stub; }
      x.meta = 1; x.tv = 3;
      if (!dry) await env.KV.put("body:" + x.h, JSON.stringify({ article: art, author: d.result.author }), { expirationTtl: 3 * 86400 });
    } catch (e) { x.meta = (x.meta || 0) - 1; if (x.meta < -3) x.dead = 1; }
  }));
  // topic refresh for older entries
  const stale = Object.values(idx.items).filter(x => x.meta === 1 && x.tv !== 3).slice(0, 10);
  await Promise.all(stale.map(async x => {
    const b = await env.KV.get("body:" + x.h, "json");
    const body = (b && b.article && b.article.body) || "";
    let t = topicOf(body.slice(0, 4000), x.title);
    if (t === "farcaster" && !/farcaster|cast|channel/i.test(x.title)) { const t2 = topicOf(body.slice(0, 4000).replace(/farcaster|casts?|channels?/gi, "")); t = t2 === "farcaster" ? "life" : t2; }
    x.topic = t; x.tv = 3;
  }));
  // reader counts from Folio itself (KV reads only, recent items)
  await Promise.all(Object.values(idx.items).filter(x => now - x.ts < 8 * DAY).slice(0, 600).map(async x => { const c = await env.KV.get("rd:" + x.h, "json"); if (c) { x.op = c.o || 0; x.rd = c.d || 0; x.rs = c.rs || 0; x.rn = c.rn || 0; x.hc = c.hc || 0; } }));
  for (const [k, x] of Object.entries(idx.items)) { if (now - x.ts > 30 * DAY || x.dead) delete idx.items[k]; }
  idx.writers = [...writers].slice(-WRITERS_MAX);
  idx.authors = pool.filter(f => !fanSet.has(f)).slice(-POOL_MAX);
  idx.fans = fans.filter(f => !writers.has(f)).slice(-FANS_MAX);
  idx.updated = now;
  if (!dry && !isPreview(env)) await env.KV.put("index", JSON.stringify(idx));
  return { fans: idx.fans.length, feedItems: idx.fkBad ? "rejected" : idx.fkOk ? "ok" : "off", found: found.length, stubs: Object.keys(stubs).length, fresh: fresh.length, enriched: toEnrich.length, total: Object.keys(idx.items).length, writers: idx.writers.length, pool: idx.authors.length, subrequests: sr.n, cap: sr.cap };
}

function score(x, now) {
  const eng = x.l + 2 * x.r + 1.5 * x.rp + 2 * x.q + 3 * (x.rd || 0) + 0.3 * (x.op || 0) + 2 * (x.hc || 0);
  const rf = 1 + 0.08 * ((17.5 + (x.rs || 0)) / (5 + (x.rn || 0)) - 3.5);
  const trust = 1 + Math.min(1, Math.log10(1 + x.a.f) / 5) + (x.a.pro ? 0.2 : 0);
  const len = x.words ? (x.words < 120 ? 0.4 : x.words < 300 ? 0.8 : 1) : 0.8;
  return { hot: (eng * trust * len * rf + 1) / Math.pow((now - x.ts) / 3600000 + 2, 0.9), top: eng * trust * len * rf };
}

const MIN_WORDS = 80; // short pieces are dropped everywhere
const RANKED = "Ranked daily by reads, ratings, highlights, likes, recasts, replies and quotes.";
// no engagement / low-trust accounts only show in Latest
const SPAM = /\b(airdrop|giveaway|free ?mint|whitelist|presale|claim (now|your)|100x|pump|guaranteed (profit|returns))\b/i;
const SPAM_X = /(pending rewards|announcement|promo ?code|referral|casino|gamdom|stake\.com|betting|bonus|airdrop|giveaway|claim (them|your|now)|\$\d[\d,]* in prizes|whitelist|presale)/i;
const capsy = t => { const L = String(t || "").replace(/[^A-Za-z]/g, ""); return L.length >= 10 && L.replace(/[^A-Z]/g, "").length / L.length > 0.7; };
const noLone = t => typeof t === "string" ? t.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, "") : t; // 2026-11-19: a preview cut mid-emoji broke the feed JSON for strict parsers
const weakX = x => !!x.k && (SPAM_X.test((x.title || "") + " " + (x.prev || "")) || capsy(x.title));
const spammy = x => weakX(x) || SPAM.test((x.title || "") + " " + (x.prev || "")) && !(x.a.pro || x.a.f >= 1000);
// engagement on Farcaster, or real Folio signal (good ratings, highlights, finished reads)
const good = x => (x.l + x.r + x.rp + (x.q || 0)) >= 3 || x.a.f >= 1000 || x.a.pro || (x.rn >= 2 && x.rs / x.rn >= 3.5) || (x.hc || 0) >= 2 || (x.rd || 0) >= 5;
function demoteFC(arr) { const out = arr.slice(); const fc = out.filter((x, i) => i < 3 && x.a && x.a.fid === 1); if (!fc.length) return out; const rest = out.filter(x => !fc.includes(x)); rest.splice(Math.min(3, rest.length), 0, ...fc); return rest; }
const PIN_FIDS = [1143161]; // @nikkiwordsmith, asked by Pedi 2026-11-15
function top1(arr, n) { const out = [], by = {}; for (const x of arr) { if (out.length >= n) break; const f = x.a && x.a.fid, o = by[f]; if (!o) { by[f] = x; out.push(x); } else if (x.ts > o.ts) { out.splice(out.indexOf(o), 1); by[f] = x; out.push(x); } } return out; }
const TEAM_FIDS = [1, 16447]; const isTeam = x => x.a && TEAM_FIDS.includes(x.a.fid);
function todayList(items, now) { return demoteFC(top1(items.filter(x => x._g && !isTeam(x) && now - x.ts < 3 * DAY).sort((a, b) => b.hot - a.hot), 10)); }

function publicItems(idx) {
  const now = Date.now();
  const out = Object.values(idx.items).map(x => { if (x.k === "lc") { const t = tClean(x.title); if (t !== x.title) x = { ...x, title: t.length >= 8 ? t : (x.prev || "").slice(0, 90).replace(/\s+\S*$/, "") + "\u2026" }; } return x; }).filter(x => x.meta === 1 && (x.words || 0) >= MIN_WORDS && (x.title || "").trim() && x.a && x.a.fid && !spammy(x)).map(x => {
    const s = score(x, now);
    return { h: x.h, ts: x.ts, title: noLone(x.title), cover: x.cover, prev: noLone(x.prev), min: x.min, topic: x.topic, a: x.a, l: x.l, r: x.r, rp: x.rp, q: x.q || 0, v: x.v || 0, rs: x.rs || 0, rn: x.rn || 0, ...(x.k === "pg" ? { pg: 1 } : {}), ...(x.k === "lc" ? { lc: 1 } : {}), hc: x.hc || 0, rd: x.rd || 0, hot: s.hot, top: s.top };
  });
  // one copy per title: drop reposted / copied duplicates, keep the best scored
  const seenT = new Map();
  const nat = x => !x.pg && !x.lc; // native Farcaster Article
  for (const x of out) { const k = x.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); const o = seenT.get(k); const same = o && o.a && x.a && o.a.fid === x.a.fid && nat(x) !== nat(o); if (!o || (same ? nat(x) : x.top > o.top)) seenT.set(k, x); } // same writer, same title: the Farcaster Article wins over its Paragraph or long-cast copy
  return [...seenT.values()].map(({ q, hc, rd, ...x }) => Object.assign(x, { _g: good({ ...x, q, hc, rd }) }));
}

async function feed(env, url, ctx) {
  const cache = caches.default;
  const ck = new Request(url.origin + "/api/feed?k=2");
  const hit = await cache.match(ck);
  if (hit) return hit;
  const idx = await loadIndex(env);
  const items = publicItems(idx);
  try { const ra = (await env.KV.get("rtall", "json")) || {}; for (const x of items) { const v = ra[x.h]; if (v) { x.rs = v[0]; x.rn = v[1]; } } } catch (e) {}
  for (const x of items) { if (x.rn > 0) { x.rs = Math.round(x.rs / x.rn * 10) / 10; x.rn = 1; } else { x.rs = 0; x.rn = 0; } }
  const now = Date.now();
  const capA = (arr, n) => { const c = {}; return arr.filter(x => (c[x.a.fid] = (c[x.a.fid] || 0) + 1) <= n); };
  const today = demoteFC(top1(items.filter(x => x._g && !isTeam(x) && now - x.ts < 3 * DAY).sort((a, b) => b.hot - a.hot), 10)).slice(0, 10);
  try { const sw = (await env.KV.get("stw", "json")) || {}; const lim = now - 7 * DAY; const bo = x => { const m = sw[x.a && x.a.fid] || {}; let n = 0; for (const d in m) if (Date.parse(d) >= lim) n += m[d]; return 1 + 0.04 * Math.min(n, 21) / 21; }; today.sort((a, b) => b.hot * bo(b) - a.hot * bo(a)); } catch (e) {}
  // pinned writers: keep their newest piece (last 7 days) somewhere in places 5 to 10, position varies by day
  for (const fid of PIN_FIDS) { if (today.some(x => x.a && x.a.fid === fid)) continue; const pn = items.filter(x => x.a && x.a.fid === fid && now - x.ts < 7 * DAY).sort((a, b) => b.ts - a.ts)[0]; if (!pn) continue; const d = Math.floor(now / DAY); const pos = Math.min(4 + (d % 6), today.length); today.splice(pos, 0, pn); if (today.length > 10) today.pop(); }
  const wSorted = items.filter(x => x._g && !isTeam(x) && now - x.ts < 7 * DAY).sort((a, b) => b.top - a.top); const wHead = top1(wSorted, 12), wIn = new Set(wHead.map(x => x.h)); const week = wHead.concat(capA(wSorted.filter(x => !wIn.has(x.h)), 3)).slice(0, 60);
  const latest = capA(items.slice().sort((a, b) => b.ts - a.ts), 3).slice(0, 120);
  const wmap = {};
  for (const x of items.filter(x => x._g)) {
    const w = wmap[x.a.fid] || (wmap[x.a.fid] = { a: x.a, n: 0, s: 0, best: null });
    w.n++; w.s += x.top; if (!w.best || x.top > w.best.top) w.best = { h: x.h, title: x.title, top: x.top };
  }
  const writers = Object.values(wmap).sort((a, b) => b.s - a.s).slice(0, 40).map(w => ({ a: w.a, n: w.n, best: w.best }));
  // New voices: a writer's first (only) article on Folio, last 3 days, not already in Today. Automatic, rotates every 3 hours.
  const perW = {}; for (const x of items) perW[x.a.fid] = (perW[x.a.fid] || 0) + 1;
  const inT = new Set(today.map(x => x.h));
  const nvPool = items.filter(x => x._g && now - x.ts < 3 * DAY && perW[x.a.fid] === 1 && !isTeam(x) && !inT.has(x.h)).sort((a, b) => b.ts - a.ts);
  const nvOff = nvPool.length ? Math.floor(now / (3 * 3600e3)) % nvPool.length : 0;
  const nv = nvPool.length <= 2 ? nvPool : [nvPool[nvOff], nvPool[(nvOff + 1) % nvPool.length]];
  const team = TEAM_FIDS.map(f => items.filter(x => x.a && x.a.fid === f && now - x.ts < 7 * DAY).sort((a, b) => b.ts - a.ts)[0]).filter(Boolean);
  const res = J({ today, nv, team, week, latest, writers, count: items.length, updated: idx.updated || now }, 200, { "cache-control": "public, max-age=30, s-maxage=120" });
  ctx.waitUntil(cache.put(ck, res.clone()));
  return res;
}

async function getBody(env, h) {
  let b = await env.KV.get("body:" + h, "json");
  if (!b) {
    const x = (await loadIndex(env)).items[h];
    if (x && x.k === "pg") { b = pgBody(x, await pgFetch(x.pg)); await env.KV.put("body:" + h, JSON.stringify(b), { expirationTtl: 3 * 86400 }); return b; }
    if (x && x.k === "lc") { const t = await fcGet("/v2/thread-casts?castHash=" + h + "&limit=1"); const c = ((t && t.result && t.result.casts) || []).find(k => k.hash === h); if (!c) { const er = new Error("not found"); er.nf = 1; throw er; } b = lcBody(x, c.text); await env.KV.put("body:" + h, JSON.stringify(b), { expirationTtl: 3 * 86400 }); return b; }
    const d = await fcGet("/v2/user-article?castHash=" + h);
    if (!d || !d.result || !d.result.article || !d.result.author) { const er = new Error("not found"); er.nf = 1; throw er; }
    b = { article: d.result.article, author: d.result.author };
    await env.KV.put("body:" + h, JSON.stringify(b), { expirationTtl: 3 * 86400 });
  }
  return b;
}

// split markdown into chunks on paragraph boundaries
function chunks(md, max = 1400, first = 700) {
  const parts = md.split(/\n(?=\n|#|- |\d+\. |> |\||!\[)/);
  const out = []; let cur = "";
  for (const p of parts) {
    const lim = out.length ? max : first;
    if ((cur + "\n" + p).length > lim && cur) { out.push(cur); cur = p; } else cur = cur ? cur + "\n" + p : p;
  }
  if (cur) out.push(cur);
  return out;
}

const MODEL = "@cf/openai/gpt-oss-120b";

const RATE = { in: 0.031818, out: 0.068182 }; // neurons per token for gpt-oss-120b
const BUDGET = 6500; // neurons/day for reader AI (translate/summary/quiz/Ask); + GC_CAP 3,000 for game share cards = 9,500 < 10,000 free

async function trU(env, text, lang, model) {
  const target = LANGS[lang] || lang;
  if (!text || !text.trim()) return { text: "", n: 0 };
  const sys = `You are a professional literary translator. Translate the user's Markdown into ${target}. Keep every Markdown symbol, line break, URL, image tag, @mention, $ticker and code block exactly as it is; translate only human-readable text. Translate every line, including headings and lines in italics or bold; never leave a sentence in English. Address the reader informally and consistently (for example du in German, tú in Spanish, tu in French). Keep proper nouns and product names in their original form. Write natural, fluent ${target} the way a native editor would, not word-for-word. For social-media and crypto vocabulary (feed, cast, recast, reply, like, thread, channel, wallet, token, onchain, mini app) use the words people in that language actually use online, usually the loanword, never a literal dictionary meaning. Output only the translation, with no notes or preamble.`;
  const base = { messages: [{ role: "system", content: sys }, { role: "user", content: text }], max_tokens: 3500, temperature: 0.2 };
  let r;
  try { r = await env.AI.run(model || MODEL, { ...base, reasoning: { effort: "low" } }); }
  catch (e) { if (/quota|limit|neuron|4006|capacity/i.test(String(e && e.message || e))) throw e; r = await env.AI.run(model || MODEL, base); }
  let out = (r && (r.response || (r.result && r.result.response) || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || "";
  if (typeof out !== "string") out = String(out);
  const u = r && (r.usage || (r.result && r.result.usage));
  const n = u && u.prompt_tokens != null ? u.prompt_tokens * RATE.in + (u.completion_tokens || 0) * RATE.out : (text.length / 3) * RATE.in + (out.length / 1.5) * RATE.out;
  return { text: out.replace(/^```(?:markdown)?\n?/, "").replace(/\n?```$/, ""), n, usage: u || null };
}
async function tr(env, text, lang, model) { return (await trU(env, text, lang, model)).text; }

// lines the model left in English get a second, line-by-line pass
function plainWords(l) { return (l.replace(/\(https?:[^)]*\)|https?:\S+|[#>*_`\[\]!-]/g, " ").match(/[A-Za-z]{2,}/g) || []).length; }
async function fixLines(env, src, out, lang) {
  if (lang === "en") return null;
  const srcSet = new Set(src.split("\n").map(l => l.trim()).filter(l => plainWords(l) >= 3));
  const lines = out.split("\n");
  const bad = [];
  lines.forEach((l, i) => { if (srcSet.has(l.trim())) bad.push(i); });
  if (!bad.length) return null;
  const rs = await Promise.all(bad.slice(0, 6).map(i => trU(env, lines[i], lang).catch(() => null)));
  rs.forEach((r, k) => { if (r && r.text && r.text.trim()) lines[bad[k]] = r.text.trim().split("\n")[0]; });
  return { text: lines.join("\n") };
}

// Translation is done one section at a time, only as the reader reaches it.
async function translate(env, h, lang, partQ) {
  if (!/^0x[0-9a-fA-F]{40,64}$/.test(h)) return J({ error: "bad hash" }, 400);
  lang = (lang || "").toLowerCase().split("-")[0];
  if (!LANGS[lang]) return J({ error: "unsupported language" }, 400);
  const rtl = RTL.has(lang);
  const full = await env.KV.get("tr3:" + h + ":" + lang, "json");
  if (full) return J({ part: 0, parts: 1, title: full.title, text: full.body, rtl, cached: true });
  const b = await getBody(env, h);
  const art = b.article;
  const cs = chunks(art.body || "");
  const parts = Math.max(1, cs.length);
  const p = parseInt(partQ || "0", 10);
  if (!(p >= 0 && p < parts)) return J({ error: "bad part" }, 400);
  const key = "tr5:" + h + ":" + lang + ":" + p;
  const hit = await env.KV.get(key, "json");
  if (hit && !hit.fx) { const f = await fixLines(env, cs[p] || "", hit.text, lang); if (f) { hit.text = f.text; hit.fx = 1; await env.KV.put(key, JSON.stringify(hit), { expirationTtl: 30 * 86400 }); } }
  if (hit) return J({ ...hit, part: p, parts, rtl, cached: true });
  const dk = "nr:" + new Date().toISOString().slice(0, 10);
  const used = parseInt((await env.KV.get(dk)) || "0", 10);
  if (used > BUDGET) return J({ error: "busy" }, 429);
  let rs;
  try {
    const jobs = [trU(env, cs[p] || "", lang)];
    if (p === 0) jobs.push(trU(env, art.title || "", lang));
    rs = await Promise.all(jobs);
  } catch (e) { return J({ error: "busy" }, 429); }
  const spent = rs.reduce((a, r) => a + r.n, 0);
  const res = { text: rs[0].text };
  if (lang !== "en") { const f = await fixLines(env, cs[p] || "", res.text, lang).catch(() => null); if (f) { res.text = f.text; } res.fx = 1; }
  if (p === 0) res.title = rs[1].text.trim();
  await env.KV.put(key, JSON.stringify(res), { expirationTtl: 30 * 86400 });
  await env.KV.put(dk, String(Math.ceil(used + spent)), { expirationTtl: 2 * 86400 });
  return J({ ...res, part: p, parts, rtl });
}

// ---------- TL;DR ----------
function aiOut(r) { let out = (r && (r.response || (r.result && r.result.response) || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || ""; return typeof out === "string" ? out : String(out); }
async function summary(env, h, langQ) {
  if (!/^0x[0-9a-fA-F]{40,64}$/.test(h)) return J({ error: "bad hash" }, 400);
  let lang = (langQ || "en").toLowerCase().split("-")[0]; if (!LANGS[lang]) lang = "en";
  const key = "sum:" + h + (lang === "en" ? "" : ":" + lang);
  const hit = await env.KV.get(key, "json");
  if (hit) return J({ ...hit, lang, cached: true }, 200, { "cache-control": "public, max-age=3600" });
  const dk = "nr:" + new Date().toISOString().slice(0, 10);
  const used = parseInt((await env.KV.get(dk)) || "0", 10);
  if (used > BUDGET) return J({ error: "busy" }, 429);
  const b = await getBody(env, h);
  const text = (b.article.title || "") + "\n\n" + (b.article.body || "").slice(0, 9000);
  const target = LANGS[lang];
  const sys = `Summarize the user's article in exactly 3 short lines in ${target}. Each line is one plain sentence under 22 words. No bullets, numbers, markdown, emojis or preamble. Keep proper nouns, product names, @mentions and $tickers as written. Write for a curious reader deciding whether to read it.`;
  const base = { messages: [{ role: "system", content: sys }, { role: "user", content: text }], max_tokens: 900, temperature: 0.2 };
  let r;
  try { r = await env.AI.run(MODEL, { ...base, reasoning: { effort: "low" } }); }
  catch (e) { try { r = await env.AI.run(MODEL, base); } catch (e2) { return J({ error: "busy" }, 429); } }
  const out = aiOut(r);
  const u = r && (r.usage || (r.result && r.result.usage));
  const n = u && u.prompt_tokens != null ? u.prompt_tokens * RATE.in + (u.completion_tokens || 0) * RATE.out : (text.length / 3) * RATE.in + (out.length / 1.5) * RATE.out;
  await env.KV.put(dk, String(Math.ceil(used + n)), { expirationTtl: 2 * 86400 });
  const lines = out.split("\n").map(l => l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, "").replace(/\*\*/g, "").trim()).filter(Boolean).slice(0, 3);
  if (!lines.length) return J({ error: "busy" }, 429);
  const res = { lines };
  await env.KV.put(key, JSON.stringify(res), { expirationTtl: 30 * 86400 });
  return J({ ...res, lang });
}


// Ask Folio: answers grounded only in Folio's own articles, 10 questions per Farcaster user per day.
const ASK_MAX = 10;
const ASK_DAY = 100; // questions per day across all users, raise as usage grows
const ASK_STOP = new Set("the a an and or but of to in on for with is are was were be been it its this that these those what which who whom how why when where do does did can could should would will about from into as at by my your our their i you we they me us them any some more most than then so if not no yes vs versus also just get got".split(" "));
function askWords(s) { return [...new Set((String(s || "").toLowerCase().match(/[\p{L}\p{N}$@][\p{L}\p{N}_-]{1,}/gu) || []).filter(w => w.length >= 3 && !ASK_STOP.has(w)))].slice(0, 12); }
function askStem(w) { return w.length >= 6 ? w.replace(/(ies|es|s|ing|ed)$/u, "") : w; }
function askRank(items, words) {
  if (!words.length) return [];
  const N = items.length || 1;
  const terms = [...new Set(words.map(askStem))].map(w => ({ w, re: new RegExp("(^|[^\\p{L}\\p{N}])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu") }));
  for (const t of terms) { let df = 0; for (const x of items) if (t.re.test(x.title || "") || t.re.test(x.prev || "")) df++; t.df = df; t.wt = df ? Math.log((N + 1) / (df + 1)) : 0; }
  const use = terms.filter(t => t.df && t.df <= N * 0.25);
  if (!use.length) return [];
  const out = [];
  for (const x of items) {
    const tt = x.title || "", p = x.prev || "";
    let s = 0, best = 0;
    for (const t of use) { let m = 0; if (t.re.test(tt)) m += 2; if (t.re.test(p)) m += 1; if (m) { s += m * t.wt; best = Math.max(best, t.wt); } }
    if (!s || best < 1.2) continue;
    out.push({ x, s: s + Math.min(1, (x.top || 0) / 100) });
  }
  return out.sort((a, b) => b.s - a.s).map(o => o.x);
}
async function askApi(env, req, url, tf) {
  if (req.method !== "POST") return J({ error: "bad" }, 405);
  const fid = tf || await qaFid(req, url);
  if (!fid) return J({ error: "auth" }, 401);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const q = String(b.q || "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (q.length < 4) return J({ error: "short" }, 400);
  const day = new Date().toISOString().slice(0, 10);
  const uk = "askn:" + day + ":" + fid;
  const usedU = parseInt((await env.KV.get(uk)) || "0", 10);
  if (usedU >= ASK_MAX) return J({ error: "limit", left: 0 }, 429);
  const gk = "askg:" + day;
  const usedG = parseInt((await env.KV.get(gk)) || "0", 10);
  if (usedG >= ASK_DAY) return J({ error: "full" }, 429);
  const gBump = () => env.KV.put(gk, String(usedG + 1), { expirationTtl: 2 * 86400 });
  const ck = "askc:" + q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 200);
  const items = publicItems(await loadIndex(env));
  const byH = new Map(items.map(x => [x.h, x]));
  const card = x => ({ h: x.h, title: x.title, cover: x.cover || null, min: x.min || 1, a: { u: x.a.u, n: x.a.n, p: x.a.p } });
  const hit = await env.KV.get(ck, "json");
  if (hit) {
    const arts = (hit.h || []).map(h => byH.get(h)).filter(Boolean).map(card);
    await env.KV.put(uk, String(usedU + 1), { expirationTtl: 2 * 86400 }); await gBump();
    return J({ answer: hit.a, arts, left: ASK_MAX - usedU - 1, cached: true });
  }
  const dk = "nr:" + day;
  let used = parseInt((await env.KV.get(dk)) || "0", 10);
  const bill = async (r, inLen, outLen) => { const u = r && (r.usage || (r.result && r.result.usage)); const n = u && u.prompt_tokens != null ? u.prompt_tokens * RATE.in + (u.completion_tokens || 0) * RATE.out : (inLen / 3) * RATE.in + (outLen / 1.5) * RATE.out; used += n; await env.KV.put(dk, String(Math.ceil(used)), { expirationTtl: 2 * 86400 }); };
  const run = async (sys, user, max) => { const base = { messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: max, temperature: 0.2 }; let r; try { r = await env.AI.run(MODEL, { ...base, reasoning: { effort: "low" } }); } catch (e) { r = await env.AI.run(MODEL, base); } await bill(r, sys.length + user.length, aiOut(r).length); return aiOut(r).trim(); };
  let words = askWords(q);
  let found = askRank(items, words);
  // questions in other languages: turn them into English search words first (small call)
  if (found.length < 2 && used < BUDGET) {
    try {
      const kw = await run("Turn the user's question into 3 to 6 short English search keywords for finding articles. Output only the keywords separated by commas, nothing else.", q, 300);
      const w2 = askWords(kw.replace(/,/g, " "));
      if (w2.length) { const f2 = askRank(items, w2); if (f2.length) { found = f2; words = w2; } }
    } catch (e) {}
  }
  const top = found.slice(0, 3);
  if (!top.length) return J({ answer: null, arts: [], none: true, left: ASK_MAX - usedU });
  const arts = top.map(card);
  if (used > BUDGET) return J({ answer: null, arts, busy: true, left: ASK_MAX - usedU });
  const ctxs = [];
  for (const x of top) {
    let body = "";
    try { const bd = await getBody(env, x.h); body = (bd.article && bd.article.body) || ""; } catch (e) { body = x.prev || ""; }
    body = body.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\s+/g, " ").slice(0, 2200);
    ctxs.push("Article: " + x.title + " (by @" + x.a.u + ")\n" + body);
  }
  let answer = "";
  try {
    answer = await run(
      "You are Ask Folio, the reading guide inside Folio, a Farcaster app for long-form articles. Answer the reader's question in 2 to 4 short plain sentences, in the same language as the question, using only the articles below. If the articles do not answer it, say so in one sentence and point to the closest article by its title. Never give financial advice, never promise prices, airdrops or returns, and never invent facts, links or numbers. No markdown, lists, emojis or preamble.\n\n" + ctxs.join("\n\n---\n\n"),
      q, 700);
    answer = answer.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").trim().slice(0, 900);
  } catch (e) { answer = ""; }
  if (!answer) return J({ answer: null, arts, busy: true, left: ASK_MAX - usedU });
  await env.KV.put(uk, String(usedU + 1), { expirationTtl: 2 * 86400 }); await gBump();
  await env.KV.put(ck, JSON.stringify({ a: answer, h: top.map(x => x.h) }), { expirationTtl: 3 * 86400 });
  return J({ answer, arts, left: ASK_MAX - usedU - 1 });
}

// public following list of a Farcaster user (for "From people you follow")
async function following(env, fid, ctx, origin) {
  if (!/^\d{1,9}$/.test(fid)) return J({ error: "bad fid" }, 400);
  const cache = caches.default; const ck = new Request(origin + "/api/following?fid=" + fid);
  const hit = await cache.match(ck); if (hit) return hit;
  const fids = []; let cursor = null;
  try {
    for (let i = 0; i < 4; i++) {
      const d = await fcGet("/v2/following?fid=" + fid + "&limit=50" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""));
      for (const u of (d.result && d.result.users) || []) fids.push(u.fid);
      cursor = d.next && d.next.cursor; if (!cursor) break;
    }
  } catch (e) { if (!fids.length) return J({ fids: [] }, 200); }
  const res = J({ fids }, 200, { "cache-control": "public, max-age=3600" });
  ctx.waitUntil(cache.put(ck, res.clone()));
  return res;
}


// ---------- image relay for covers hosted outside imagedelivery (e.g. Paragraph on Google Storage) ----------
async function imRelay(req, url, ctx) {
  const u = url.searchParams.get("u") || "";
  let t; try { t = new URL(u); } catch (e) { return new Response("bad", { status: 400 }); }
  if (t.protocol !== "https:" || t.port || /^(localhost|[\d.]+|\[.*\])$/i.test(t.hostname) || !t.hostname.includes(".") || /(^|\.)(local|internal|workers\.dev)$/i.test(t.hostname)) return new Response("host not allowed", { status: 403 });
  const cache = caches.default; const ck = new Request(url.origin + "/im?u=" + encodeURIComponent(u));
  const hit = await cache.match(ck); if (hit) return hit;
  const r = await fetch(u, { cf: { cacheTtl: 86400, cacheEverything: true } });
  const ct = r.headers.get("content-type") || "";
  if (!r.ok || !/^image\//.test(ct) || /svg/i.test(ct) || +(r.headers.get("content-length") || 0) > 12e6) return new Response("not found", { status: 404 });
  const res = new Response(r.body, { headers: { "content-type": ct, "cache-control": "public, max-age=604800", "x-content-type-options": "nosniff" } });
  ctx.waitUntil(cache.put(ck, res.clone()));
  return res;
}

// ---------- reader / writer suggestions ----------
// ---------- Requests (2026-11-16): readers ask for articles, writers pick them up ----------
const RQ_MAX_OPEN = 300, RQ_MAX_LEN = 140, RQ_CATS = ["crypto", "money", "builders", "farcaster", "culture", "life"];
async function rqLoad(env) { return (await env.KV.get("rq", "json")) || { seq: 0, items: [] }; }
async function rqSave(env, d) { if (!isPreview(env)) await env.KV.put("rq", JSON.stringify(d)); }
function rqPublic(d) {
  const open = d.items.filter(r => !r.ans).sort((a, b) => (b.b.length - a.b.length) || (b.ts - a.ts));
  const done = d.items.filter(r => r.ans).sort((a, b) => b.ans.ts - a.ans.ts).slice(0, 60);
  const pub = r => ({ id: r.id, t: r.t, c: r.c || "", ts: r.ts, f: r.f, u: r.u, n: r.b.length, b: r.b, cl: r.cl || null, ans: r.ans || null });
  return { open: open.map(pub), done: done.map(pub) };
}
async function rqUser(fid, b) {
  let u = String(b.u || "").slice(0, 40);
  try { const j = await fcGet("/v2/user?fid=" + fid); const us = j && j.result && j.result.user; if (us && us.fid === fid && us.username) u = us.username; } catch (e) {}
  return (u || "fid" + fid).replace(/[^\w.\-]/g, "").slice(0, 40);
}
async function rqResolve(env, s, fid) {
  // returns an index item for a Farcaster Article link, or an error string
  if (!/^(https?:\/\/)?(www\.)?(farcaster\.xyz|warpcast\.com)\//i.test(s)) return "Paste a farcaster.xyz link to the article.";
  let idx = await loadIndex(env);
  let h = (s.match(/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/) || [])[0];
  if (h) h = h.toLowerCase();
  else {
    const m = s.match(/(?:farcaster\.xyz|warpcast\.com)\/([^\/\s?#]+)\/(0x[0-9a-fA-F]{6,40})/i);
    if (!m) return "Paste a link to a Farcaster Article.";
    const pre = m[2].toLowerCase(), un = m[1].toLowerCase();
    for (const k in idx.items) { const x = idx.items[k]; if (k.startsWith(pre) && x.a && String(x.a.u || "").toLowerCase() === un) { h = k; break; } }
  }
  if (!h || !idx.items[h] || idx.items[h].meta !== 1) {
    try {
      const r = await suggestApi(env, new Request("https://folio/api/suggest", { method: "POST", headers: { "cf-connecting-ip": "rq" + fid, "content-type": "application/json" }, body: JSON.stringify({ u: s }) }));
      const j = await r.json(); if (j && j.h) h = j.h; else if (j && j.error) return j.error;
    } catch (e) {}
    idx = await loadIndex(env);
  }
  const x = h && idx.items[h];
  if (!x || x.meta !== 1 || (x.words || 0) < MIN_WORDS) return "Folio couldn't find that article yet. Check the link, or try again in a few minutes.";
  return { ...x, h };
}
async function rqNotify(env, r) {
  try {
    const subs = (await env.KV.get("subs", "json")) || {};
    const fids = [...new Set(r.b)].filter(f => f !== r.ans.f && subs[f]);
    const byUrl = {};
    for (const f of fids) { const d = subs[f]; (byUrl[d.url] = byUrl[d.url] || []).push(d.token); }
    const origin = env.ORIGIN || PROD;
    for (const [url, tokens] of Object.entries(byUrl)) {
      await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        notificationId: "folio-rq-" + r.id, title: "Your request has an article",
        body: ("@" + r.ans.au + " wrote it: " + r.ans.title).slice(0, 128), targetUrl: origin + "/?a=" + r.ans.h, tokens: tokens.slice(0, 100)
      }) }).catch(() => {});
    }
    return fids.length;
  } catch (e) { return 0; }
}
async function rqApi(env, req, url, ctx) {
  if (req.method === "GET") return J(rqPublic(await rqLoad(env)), 200, { "cache-control": "no-store" });
  if (req.method !== "POST") return J({ error: "bad" }, 405);
  const fid = await qaFid(req, url);
  if (!fid) return J({ error: "Open Folio in Farcaster to do this." }, 401);
  let b = {}; try { b = JSON.parse((await req.text()).slice(0, 2000)); } catch (e) {}
  const d = await rqLoad(env);
  const act = String(b.act || "");
  const r = b.id ? d.items.find(x => x.id === +b.id) : null;
  if (act === "new") {
    const t = String(b.t || "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim();
    if (t.length < 8) return J({ error: "Write a few more words about what you want to read." }, 400);
    if (t.length > RQ_MAX_LEN) return J({ error: "Keep it under " + RQ_MAX_LEN + " characters." }, 400);
    const day = new Date().toISOString().slice(0, 10), rk = "rqn:" + day + ":" + fid;
    const n = +((await env.KV.get(rk)) || 0);
    if (n >= 5) return J({ error: "You can post 5 requests a day. Try again tomorrow." }, 429);
    if (d.items.filter(x => !x.ans).length >= RQ_MAX_OPEN) return J({ error: "There are too many open requests right now. Back one with Me too instead." }, 429);
    const low = t.toLowerCase();
    const dup = d.items.find(x => !x.ans && x.t.toLowerCase() === low);
    if (dup) { if (!dup.b.includes(fid)) dup.b.push(fid); await rqSave(env, d); return J({ ok: 1, dup: 1, ...rqPublic(d) }); }
    const c = RQ_CATS.includes(String(b.c || "")) ? String(b.c) : "";
    d.seq = (d.seq || 0) + 1;
    d.items.push({ id: d.seq, t, c, ts: Date.now(), f: fid, u: await rqUser(fid, b), b: [fid] });
    await rqSave(env, d);
    if (!isPreview(env)) await env.KV.put(rk, String(n + 1), { expirationTtl: 2 * 86400 });
    return J({ ok: 1, id: d.seq, ...rqPublic(d) });
  }
  if (!r) return J({ error: "That request is gone." }, 404);
  if (act === "back") {
    if (r.ans) return J({ error: "This one is already answered." }, 400);
    if (r.f === fid) return J({ error: "This is your request." }, 400);
    const i = r.b.indexOf(fid); if (i >= 0) r.b.splice(i, 1); else r.b.push(fid);
    await rqSave(env, d); return J({ ok: 1, ...rqPublic(d) });
  }
  if (act === "claim") {
    if (r.ans) return J({ error: "This one is already answered." }, 400);
    if (r.cl && r.cl.f !== fid) return J({ error: "@" + r.cl.u + " is already writing this." }, 409);
    if (r.cl && r.cl.f === fid) r.cl = null; else r.cl = { f: fid, u: await rqUser(fid, b), ts: Date.now() };
    await rqSave(env, d); return J({ ok: 1, ...rqPublic(d) });
  }
  if (act === "answer") {
    if (r.ans) return J({ error: "This one is already answered." }, 400);
    const x = await rqResolve(env, String(b.url || "").trim().slice(0, 300), fid);
    if (typeof x === "string") return J({ error: x }, 400);
    const af = x.a ? x.a.fid : 0;
    if (fid !== af && !(r.cl && r.cl.f === fid)) return J({ error: r.cl ? "Only @" + r.cl.u + " or the article's writer can add the link." : "Only the article's writer can add it. Tap I'll write this first if you are writing it." }, 403);
    const d2 = await rqLoad(env); const r2 = d2.items.find(y => y.id === r.id);
    if (!r2 || r2.ans) return J({ error: "This one is already answered." }, 400);
    r2.ans = { h: x.h, title: String(x.title || "").slice(0, 160), au: x.a ? x.a.u : "", af, f: fid, ts: Date.now() };
    await rqSave(env, d2);
    const map = (await env.KV.get("rqa", "json")) || {}; map[x.h] = r2.id; if (!isPreview(env)) await env.KV.put("rqa", JSON.stringify(map));
    if (!isPreview(env)) { const p = rqNotify(env, r2); if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p; }
    return J({ ok: 1, ...rqPublic(d2) });
  }
  if (act === "del") {
    if (r.f !== fid) return J({ error: "Only the person who asked can remove it." }, 403);
    if (r.ans) return J({ error: "Answered requests stay up." }, 400);
    d.items = d.items.filter(y => y.id !== r.id); await rqSave(env, d); return J({ ok: 1, ...rqPublic(d) });
  }
  return J({ error: "bad" }, 400);
}

async function suggestApi(env, req) {
  if (req.method !== "POST") return J({ error: "bad" }, 405);
  const ip = req.headers.get("cf-connecting-ip") || "x";
  const day = new Date().toISOString().slice(0, 10);
  const rk = "sg:" + day + ":" + ip;
  const n = +((await env.KV.get(rk)) || 0);
  if (n >= 10) return J({ error: "That's the limit for today. Try again tomorrow." }, 429);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const s = String(b.u || "").trim().slice(0, 300);
  let h = (s.match(/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/) || [])[0];
  let c = null;
  if (h) {
    h = h.toLowerCase();
    try { const d = await fcGet("/v2/thread-casts?castHash=" + h + "&limit=1"); c = d.result.casts.find(k => k.hash === h) || null; } catch (e) {}
  } else {
    const m = s.match(/(?:farcaster\.xyz|warpcast\.com)\/([^\/\s?#]+)\/(0x[0-9a-fA-F]{6,40})/i);
    if (!m) return J({ error: "Paste a link to a Farcaster Article." }, 400);
    const pre = m[2].toLowerCase();
    try { const d = await fcGet("/v2/user-thread-casts?castHashPrefix=" + pre + "&username=" + encodeURIComponent(m[1]) + "&limit=1"); c = d.result.casts.find(k => k.hash.startsWith(pre)) || null; } catch (e) {}
  }
  if (!c) return J({ error: "Couldn't find that cast." }, 404);
  if (!c.chain) {
    if (c.parentHash || !(wc(c.text) >= LC_WORDS || pgUrlOf(c))) return J({ error: "That cast isn't a long read. Try an Article, a Paragraph post or a long cast." }, 400);
    await env.KV.put(rk, String(n + 1), { expirationTtl: 2 * 86400 });
    const h0 = c.hash.toLowerCase(); const o = (await loadIndex(env)).items[h0];
    if (o && o.meta === 1) return J({ ok: 1, known: 1, h: h0, listed: (o.words || 0) >= MIN_WORDS });
    await discover(env, false, { enrichOnly: true, casts: [c] });
    const y = (await loadIndex(env)).items[h0];
    return J({ ok: 1, h: h0, listed: !!(y && y.meta === 1 && (y.words || 0) >= MIN_WORDS) });
  }
  const root = (c.chain.index === 0 ? c.hash : (c.threadHash || c.hash)).toLowerCase();
  await env.KV.put(rk, String(n + 1), { expirationTtl: 2 * 86400 });
  const idx = await loadIndex(env);
  const old = idx.items[root];
  if (old && old.meta === 1) return J({ ok: 1, known: 1, h: root, listed: (old.words || 0) >= MIN_WORDS });
  await discover(env, false, { enrichOnly: true, hashes: [root], writers: [c.author.fid] });
  const x = (await loadIndex(env)).items[root];
  return J({ ok: 1, h: root, listed: !!(x && x.meta === 1 && (x.words || 0) >= MIN_WORDS) });
}

// private nudge to a writer who added Folio, the first time their article reaches the top 3 of Today
async function writerPing(env, origin) {
  const subs = (await env.KV.get("subs", "json")) || {};
  if (!Object.keys(subs).length) return;
  const idx = await loadIndex(env);
  const all = publicItems(idx), nowT = Date.now();
  for (const x of all.filter(x => x.a && subs[x.a.fid] && nowT - x.ts < 2 * DAY).slice(0, 10)) {
    const k = "wa:" + x.h; if (await env.KV.get(k)) continue; const d = subs[x.a.fid];
    await fetch(d.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      notificationId: "folio-a-" + x.h.slice(2, 18), title: "Your piece is on Folio", body: (x.title || "").slice(0, 128), targetUrl: origin + "/?a=" + x.h, tokens: [d.token]
    }) }).catch(() => {});
    await env.KV.put(k, "1", { expirationTtl: 30 * 86400 });
  }
  // New voices: tell a subscribed writer once when their first article is featured there
  try {
    const nvr = await (await fetch(origin + "/api/feed")).json();
    for (const x of (nvr.nv || [])) {
      const d = x.a && subs[x.a.fid]; if (!d) continue;
      const k = "wv:" + x.h; if (await env.KV.get(k)) continue;
      await fetch(d.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        notificationId: "folio-v-" + x.h.slice(2, 18), title: "You're in New voices on Folio", body: (x.title || "").slice(0, 128), targetUrl: origin + "/?a=" + x.h, tokens: [d.token]
      }) }).catch(() => {});
      await env.KV.put(k, "1", { expirationTtl: 60 * 86400 });
    }
  } catch (e) {}
  const top = todayList(all, nowT).slice(0, 3);
  for (let i = 0; i < top.length; i++) {
    const x = top[i], d = x.a && subs[x.a.fid];
    if (!d) continue;
    const k = "wn:" + x.h;
    if (await env.KV.get(k)) continue;
    await fetch(d.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      notificationId: "folio-w-" + x.h.slice(2, 18), title: ("You're #" + (i + 1) + " on Folio today").slice(0, 32),
      body: (x.title || "").slice(0, 128), targetUrl: origin + "/?a=" + x.h, tokens: [d.token]
    }) }).catch(() => {});
    await env.KV.put(k, "1", { expirationTtl: 30 * 86400 });
  }
}

// ---------- notifications ----------
function b64urlDecode(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return atob(s); }

async function webhook(env, req) {
  try {
    const body = await req.json();
    const header = JSON.parse(b64urlDecode(body.header));
    const payload = JSON.parse(b64urlDecode(body.payload));
    const fid = header.fid;
    const subs = (await env.KV.get("subs", "json")) || {};
    try { if (!isPreview(env)) await env.KV.put("whlast", JSON.stringify({ e: payload.event, fid, nd: !!payload.notificationDetails, at: Date.now() }), { expirationTtl: 30 * 86400 }); } catch (e) {}
    if (payload.event === "miniapp_added" || payload.event === "frame_added" || payload.event === "notifications_enabled") {
      if (payload.notificationDetails) subs[fid] = payload.notificationDetails;
    } else if (payload.event === "miniapp_removed" || payload.event === "frame_removed" || payload.event === "notifications_disabled") {
      delete subs[fid];
    }
    if (!isPreview(env)) await env.KV.put("subs", JSON.stringify(subs));
    return J({ ok: true });
  } catch (e) { return J({ ok: false }, 400); }
}

async function dailyDigest(env, origin) {
  if (isPreview(env)) return;
  const day = new Date().toISOString().slice(0, 10);
  if (await env.KV.get("sent:" + day)) return;
  const idx = await loadIndex(env);
  const now = Date.now();
  const top = publicItems(idx).filter(x => now - x.ts < 1.5 * DAY).sort((a, b) => b.hot - a.hot)[0];
  if (!top) return;
  const subs = (await env.KV.get("subs", "json")) || {};
  const byUrl = {};
  for (const d of Object.values(subs)) (byUrl[d.url] = byUrl[d.url] || []).push(d.token);
  for (const [url, tokens] of Object.entries(byUrl)) {
    for (let i = 0; i < tokens.length; i += 100) {
      await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        notificationId: "folio-" + day, title: "Today on Folio".slice(0, 32),
        body: (top.title + " by @" + top.a.u + ". Today's Who wrote it? is ready.").slice(0, 128), targetUrl: origin + "/?a=" + top.h, tokens: tokens.slice(i, i + 100)
      }) }).catch(() => {});
    }
  }
  await env.KV.put("sent:" + day, "1", { expirationTtl: 3 * 86400 });
}

// ---------- daily cast from the owner's account (needs FC_API_KEY) ----------
// text posted for the owner: no emoji, no underscores, no hashtags
function cleanText(t) {
  return String(t || "")
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\u{E0020}-\u{E007F}\u200D\uFE0E\uFE0F\u20E3]/gu, "")
    .replace(/#(\d)/g, "No. $1").replace(/[#_]+/g, " ")
    .replace(/\s+([,.!?:;])/g, "$1").replace(/\s+/g, " ").trim();
}
const PROD = "https://folio.pedieth.workers.dev";
async function dailyCast(env, origin) {
  if (!env.FC_API_KEY || isPreview(env)) return;
  const day = new Date().toISOString().slice(0, 10);
  const k = "cast:day:" + day;
  if (await env.KV.get(k)) return;
  const top = todayList(publicItems(await loadIndex(env)), Date.now()).slice(0, 3);
  if (top.length < 3) return;
  await env.KV.put(k, "pending", { expirationTtl: 3 * 86400 }); // claim the day first so it can never post twice
  const OPENERS = [
    "Three Farcaster articles worth your time today:",
    "Today's best reads on Farcaster:",
    "If you have a few minutes to read today, start here:",
    "Some great writing on Farcaster today:",
    "Three pieces people are reading on Farcaster today:",
    "Good reads from Farcaster writers today:",
    "Here is what Farcaster is reading today:",
    "A few Farcaster articles I'd read today:"
  ];
  const dn = Math.floor(Date.parse(day) / DAY);
  const intro = OPENERS[dn % OPENERS.length];
  const clean = cleanText;
  const enc = s => new TextEncoder().encode(s).length;
  let tl = 60, text = "";
  for (;;) {
    const cut = t => { t = clean(t); return t.length > tl ? t.slice(0, tl - 1).replace(/\s+\S*$/, "").replace(/[,;:.\s-]+$/, "") + "\u2026" : t; };
    text = intro + "\n\n" + top.map(x => `${cut(x.title)} by @${x.a.u}`).join("\n");
    if ((text.length <= 300 && enc(text) < 1000) || tl <= 30) break;
    tl -= 5;
  }
  try {
    const d = await fcGet("/v2/casts", null, env, { auth: 1, method: "POST", body: { text, embeds: [PROD + "/?a=" + top[0].h] } });
    const h = d && d.result && d.result.cast && d.result.cast.hash;
    await env.KV.put(k, JSON.stringify({ ok: 1, h: h || null, at: Date.now() }), { expirationTtl: 30 * 86400 });
  } catch (e) {
    await env.KV.put(k, JSON.stringify({ ok: 0, err: String(e && e.message || e).slice(0, 200), at: Date.now() }), { expirationTtl: 30 * 86400 });
  }
}


async function topReply(env) {
  if (!env.FC_API_KEY || isPreview(env)) return;
  const SKIP = new Set([1, 16447]);
  const top = todayList(publicItems(await loadIndex(env)), Date.now()).slice(0, 3);
  for (let i = 0; i < top.length; i++) {
    const x = top[i];
    if (!x || !x.a || SKIP.has(x.a.fid) || !/^0x[0-9a-f]{40}$/.test(x.h)) continue;
    const k = "trp:" + x.h; // own prefix: tr3:<hash>:<lang> is the translation cache
    if (await env.KV.get(k)) continue;
    await env.KV.put(k, "pending", { expirationTtl: 60 * 86400 }); // claim first so it can never reply twice
    const link = PROD + "/?a=" + x.h;
    const text = "This is #" + (i + 1) + " on Folio today. Congrats, people are reading it.\n" + link;
    try {
      const d = await fcGet("/v2/casts", null, env, { auth: 1, method: "POST", body: { text, parent: { hash: x.h }, embeds: [link] } });
      const h = d && d.result && d.result.cast && d.result.cast.hash;
      await env.KV.put(k, JSON.stringify({ ok: 1, h: h || null, r: i + 1, at: Date.now() }), { expirationTtl: 60 * 86400 });
    } catch (e) {
      const msg = String(e && e.message || e).slice(0, 200);
      // a failed post was never published, so allow a retry later (6h) instead of blocking it for 60 days
      await env.KV.put(k, JSON.stringify({ ok: 0, err: msg, at: Date.now() }), { expirationTtl: 6 * 3600 });
      if (/fc 40[13] /.test(msg)) { await env.KV.put("fcauth", JSON.stringify({ err: msg, at: Date.now() }), { expirationTtl: 7 * 86400 }); return; }
    }
  }
}

// ---------- manifest & html ----------
function manifest(env, origin) {
  const m = {
    miniapp: {
      version: "1", name: APP_NAME, iconUrl: origin + "/img/icon.png", homeUrl: origin + "/",
      imageUrl: origin + "/img/embed.png", buttonTitle: "Read today's best", splashImageUrl: origin + "/img/splash.png", splashBackgroundColor: "#F4EFE6",
      webhookUrl: origin + "/webhook",
      subtitle: "Long reads on Farcaster", description: "The best long reads on Farcaster each day. " + RANKED + " Read any article in your language with one tap.",
      primaryCategory: "news-media", tags: ["articles", "reading", "writers", "translate", "longform"],
      tagline: "Best long reads on Farcaster", heroImageUrl: origin + "/img/og.png",
      ogTitle: "Folio: best Farcaster reads", ogDescription: "Top long reads on Farcaster. " + RANKED, ogImageUrl: origin + "/img/og.png",
      screenshotUrls: [origin + "/img/shot1.png", origin + "/img/shot2.png", origin + "/img/shot3.png"], noindex: false
    }
  };
  if (env.ACC_HEADER) m.accountAssociation = { header: env.ACC_HEADER, payload: env.ACC_PAYLOAD, signature: env.ACC_SIG };
  return m;
}

function esc(s) { return String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

let FONTS = null;
async function ogData(u, w) {
  if (!u) return null;
  try {
    const src = /^https:\/\/imagedelivery\.net\/[^/]+\/[^/]+\/original$/.test(u) ? u.replace(/\/original$/, "/w=" + w) : u;
    const r = await fetch(src, { headers: { accept: "image/jpeg,image/png,image/*;q=0.5" }, cf: { cacheTtl: 86400 } });
    if (!r.ok) return null;
    const ct = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!/^image\/(png|jpeg|jpg|gif|webp)$/.test(ct)) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 4e6) return null;
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return "data:" + ct + ";base64," + btoa(bin);
  } catch (e) { return null; }
}
async function rankToday(env, h) {
  const idx = await loadIndex(env);
  const i = todayList(publicItems(idx), Date.now()).slice(0, 10).findIndex(x => x.h === h);
  return { rank: i < 0 ? 0 : i + 1, x: idx.items[h] };
}
const qnorm = s => String(s || "").replace(/\]\([^)]*\)/g, "").replace(/https?:\/\/\S+/g, "").replace(/[*_`#>\[\]()~\\|"\u201C\u201D\u2018\u2019']/g, "").replace(/\s+/g, " ").trim().toLowerCase();
async function quoteCard(env, h, t, ctx) {
  t = String(t).replace(/\s+/g, " ").trim().slice(0, 280);
  if (!/^0x[0-9a-fA-F]{40,64}$/.test(h) || t.length < 8) return new Response("bad", { status: 400 });
  const dg = [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  const key = "q:" + h + ":" + dg;
  const H = { "content-type": "image/png", "cache-control": "public, max-age=86400" };
  const hit = await env.KV.get(key, "arrayBuffer");
  if (hit) return new Response(hit, { headers: H });
  try {
    const b = await getBody(env, h);
    if (!qnorm(b.article.body).includes(qnorm(t))) return new Response("not in article", { status: 400 });
    if (!FONTS) FONTS = (await Promise.all(["NSerifB", "NSans", "NSansB"].map(f => env.KV.get("font:" + f, "arrayBuffer")))).map(x => new Uint8Array(x));
    const pf = await ogData(b.author.pfp && b.author.pfp.url, 128);
    const png = await renderCard(RESVG, FONTS, { quote: t, title: b.article.title, name: b.author.displayName, user: b.author.username, pfp: pf });
    ctx.waitUntil(env.KV.put(key, png, { expirationTtl: 30 * 86400 }));
    return new Response(png, { headers: H });
  } catch (e) {
    const v = await env.KV.get("img:embed.png", "arrayBuffer");
    return new Response(v, { headers: { "content-type": "image/png", "cache-control": "public, max-age=300" } });
  }
}

async function urAdd(env, fid, h, x) {
  if (isPreview(env)) return;
  const k = "ur:" + fid; const o = (await env.KV.get(k, "json")) || { r: [] };
  if (o.r.some(e => e[0] === h)) return;
  o.r.unshift([h, Date.now(), (x && x.a && x.a.u) || ""]); o.r = o.r.slice(0, 400);
  await env.KV.put(k, JSON.stringify(o));
}
async function urFill(env) {
  const idx = await loadIndex(env); const per = {}; let cur, n = 0;
  for (let i = 0; i < 40; i++) { const r = await env.KV.list({ prefix: "sn:", cursor: cur, limit: 1000 }); for (const k of r.keys) { const m = k.name.match(/^sn:(0x[0-9a-f]+):(\d+)$/); if (!m) continue; n++; const x = idx.items[m[1]]; (per[m[2]] = per[m[2]] || []).push([m[1], (k.metadata && k.metadata.ts) || 0, (x && x.a && x.a.u) || ""]); } if (r.list_complete || !r.cursor) break; cur = r.cursor; }
  let w = 0; for (const [f, l] of Object.entries(per)) { const k = "ur:" + f; const o = (await env.KV.get(k, "json")) || { r: [] }; const have = new Set(o.r.map(e => e[0])); for (const e of l) if (!have.has(e[0])) o.r.push(e); o.r.sort((a, b) => b[1] - a[1]); o.r = o.r.slice(0, 400); await env.KV.put(k, JSON.stringify(o)); w++; }
  return { keys: n, users: w };
}
const COVER_TIERS = [[0, "red", "Reader Edition"], [5, "silver", "Silver Edition"], [15, "gold", "Gold Edition"], [40, "black", "Collector\u2019s Edition"]];
async function coverData(env, fid) {
  const o = (await env.KV.get("ur:" + fid, "json")) || { r: [] };
  const now = Date.now(), r = o.r;
  const total = r.length, week = r.filter(e => now - e[1] < 7 * DAY).length;
  const wc = {}; for (const e of r) if (e[2]) wc[e[2]] = (wc[e[2]] || 0) + 1;
  const ws = Object.entries(wc).sort((a, b) => b[1] - a[1]);
  const idx = await loadIndex(env); const top = new Set(todayList(publicItems(idx), now).slice(0, 8).map(x => x.h));
  const inTop = r.filter(e => top.has(e[0])).length;
  const since = r.length ? Math.min(...r.map(e => e[1] || now)) : now;
  let ti = 0; for (let i = 0; i < COVER_TIERS.length; i++) if (total >= COVER_TIERS[i][0]) ti = i;
  const nx = COVER_TIERS[ti + 1];
  const persona = total + (total === 1 ? " article read" : " articles read");
  const lines = [];
  if (week) lines.push(week + (week === 1 ? " article" : " articles") + " this week");
  if (ws[0] && ws[0][1] >= 2) lines.push("Loyal reader of @" + ws[0][0]);
  if (inTop) lines.push("Read " + inTop + " of today\u2019s top 8");
  if (ws.length >= 2) lines.push(ws.length + " writers discovered");
  if (lines.length < 4 && total) lines.push(total + (total === 1 ? " read" : " reads") + " on Folio");
  if (lines.length < 4 && total) lines.push("Reading since " + new Date(since).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  if (!total) lines.push("First issue", "Open any article to fill this cover");
  let u = null; const ck = "cu:" + fid;
  u = await env.KV.get(ck, "json");
  if (!u) { try { const j = await fcGet("/v2/user?fid=" + fid); const us = j && j.result && j.result.user; if (us && us.fid === fid) { u = { u: us.username || "", n: us.displayName || "", p: (us.pfp && us.pfp.url) || "" }; await env.KV.put(ck, JSON.stringify(u), { expirationTtl: 86400 }); } } catch (e) {} }
  u = u || { u: "fid" + fid, n: "", p: "" };
  const day = new Date(now).toISOString().slice(0, 10);
  return { fid, user: u.u, name: u.n || u.u, pfpUrl: u.p, total, week, persona, lines: lines.slice(0, 4), tier: COVER_TIERS[ti][1], edition: COVER_TIERS[ti][2], next: nx ? { edition: nx[2], need: nx[0] - total } : null, date: new Date(now).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), v: day + "-" + total + "-" + week + "-" + inTop };
}
async function coverCard(env, fid, f, ctx) {
  if (!(fid > 0 && fid < 1e9)) return new Response("bad", { status: 400 });
  const d = await coverData(env, fid);
  const key = "cv2:" + fid + ":" + d.v + ":" + f + ":" + (d.pfpUrl || "").slice(-24);
  const H = { "content-type": "image/png", "cache-control": "public, max-age=3600" };
  const hit = await env.KV.get(key, "arrayBuffer");
  if (hit) return new Response(hit, { headers: H });
  try {
    if (!FONTS) FONTS = (await Promise.all(["NSerifB", "NSans", "NSansB"].map(x => env.KV.get("font:" + x, "arrayBuffer")))).map(b => new Uint8Array(b));
    const pf = await ogData(d.pfpUrl, f === "s" ? 600 : 900);
    const png = await renderCard(RESVG, FONTS, { cover: 1, portrait: f === "l" ? 0 : 1, ...(f === "s" ? { w: 600 } : {}), ...d, fid: String(fid), pfp: pf });
    ctx.waitUntil(env.KV.put(key, png, { expirationTtl: 7 * 86400 }));
    return new Response(png, { headers: H });
  } catch (e) {
    const v = await env.KV.get("img:embed.png", "arrayBuffer");
    return new Response(v, { headers: { "content-type": "image/png", "cache-control": "public, max-age=300" } });
  }
}
async function ogCard(env, h, ctx) {
  if (!/^0x[0-9a-fA-F]{40,64}$/.test(h)) return new Response("bad", { status: 400 });
  const { rank, x } = await rankToday(env, h);
  const key = "og:" + h + ":" + rank;
  const hit = await env.KV.get(key, "arrayBuffer");
  const H = { "content-type": "image/png", "cache-control": "public, max-age=3600" };
  if (hit) return new Response(hit, { headers: H });
  try {
    let a = x && x.a, title = x && x.title, cover = x && x.cover, mins = x && x.min;
    if (!x) { const b = await getBody(env, h); title = b.article.title; cover = b.article.cover && b.article.cover.url; a = { u: b.author.username, n: b.author.displayName, p: b.author.pfp && b.author.pfp.url }; }
    if (!FONTS) FONTS = (await Promise.all(["NSerifB", "NSans", "NSansB"].map(f => env.KV.get("font:" + f, "arrayBuffer")))).map(b => new Uint8Array(b));
    const [cv, pf] = await Promise.all([ogData(cover, 1200), ogData(a.p, 128)]);
    const png = await renderCard(RESVG, FONTS, { title, name: a.n, user: a.u, mins, rank, cover: cv, pfp: pf });
    ctx.waitUntil(env.KV.put(key, png, { expirationTtl: 3 * 86400 }));
    return new Response(png, { headers: H });
  } catch (e) {
    const v = await env.KV.get("img:embed.png", "arrayBuffer");
    return new Response(v, { headers: { "content-type": "image/png", "cache-control": "public, max-age=300" } });
  }
}
async function gameCard(env, fid, url, ctx) {
  if (!(fid > 0 && fid < 1e9)) return new Response("bad", { status: 400 });
  const no = Math.max(0, Math.min(99999, +(url.searchParams.get("no") || 0) | 0)), r = (url.searchParams.get("r") || "").replace(/[^01]/g, "").slice(0, 2), st = Math.max(0, Math.min(999, +(url.searchParams.get("s") || 0) | 0));
  const gq = (url.searchParams.get("g") || "").replace(/[^0-3]/g, "").slice(0, r.length || 2); // the player's picks (option indices, in order)
  const H = { "content-type": "image/png", "cache-control": "public, max-age=3600" }, HF = { "content-type": "image/png", "cache-control": "public, max-age=300" };
  try {
    const u = await fcUser(fid), ph = gcPh(u);
    let row = null; try { row = await gcGet(env, fid, 1); } catch (e) {}
    const ai = !!(row && row.ph === ph && row.st === "ok" && row.a && row.b);
    const key = "gc16:" + fid + ":" + no + ":" + r + ":" + st + ":" + (ai ? "a" + gq + ":" : "f") + ph;
    const hit = await env.KV.get(key, "arrayBuffer");
    if (hit) return new Response(hit, { headers: ai ? H : HF });
    await gcFonts(env);
    let png = null;
    if (ai) { // 2-scene character card; text drawn in code, no AI here
      try { const A = gcUri(row.a); let scr = row.info && row.info.scr; if (scr === undefined) { try { scr = await gcScreen(RESVG, A); } catch (e) { scr = null; } } if (!gcPaperOk(scr)) throw new Error("no paper"); const q = scr && scr.w > 0 ? await gcQuiz(env, no, r, gq) : {}; png = await renderGameCard(RESVG, FONTS, { a: A, b: gcUri(row.b), one: GC_ONE || !!(row.info && row.info.one), scr, no, r, s: st, date: gcGameDay(no), ...q }); } catch (e) { png = null; }
    }
    const isAi = !!png;
    if (!png) { const pf = await ogData(u.p, 200); png = await renderCard(RESVG, FONTS, { game: 1, no, r, s: st, name: u.n, user: u.u, pfp: pf }); } // classic card with the exact pfp (no restyle)
    if (isAi === ai) ctx.waitUntil(env.KV.put(key, png, { expirationTtl: 7 * 86400 }));
    return new Response(png, { headers: isAi ? H : HF });
  } catch (e) {
    const v = await env.KV.get("img:embed.png", "arrayBuffer");
    return new Response(v, { headers: { "content-type": "image/png", "cache-control": "public, max-age=300" } });
  }
}
async function page(env, origin, url) {
  const a = url.searchParams.get("a");
  let title = "Folio: the best long reads on Farcaster", desc = RANKED + " Read any article in your own language.", img = origin + "/img/embed.png", btn = "Read today's best", target = origin + "/";
  if (a && /^0x[0-9a-fA-F]{40,64}$/.test(a)) {
    try {
      const b = await getBody(env, a);
      title = b.article.title + " | Folio"; desc = (b.article.previewText || "").slice(0, 180); btn = "Read article"; target = origin + "/?a=" + a;
      const rk = (await rankToday(env, a)).rank; img = origin + "/og/" + a + ".png?r=" + rk;
      const qt = (url.searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 280); if (qt.length >= 8 && qnorm(b.article.body).includes(qnorm(qt))) { img = origin + "/q/" + a + ".png?t=" + encodeURIComponent(qt); btn = "Read article"; desc = "\u201C" + qt + "\u201D"; }
    } catch (e) {}
  }
  const cvf = url.searchParams.get("cover");
  if (!a && cvf && /^\d{1,9}$/.test(cvf)) { try { const d = await coverData(env, +cvf); title = d.name + "\u2019s Folio cover"; desc = d.persona + " \u00B7 " + d.edition + ". Get your own Folio cover, made from what you read."; img = origin + "/cover/" + cvf + ".png?v=" + encodeURIComponent(d.v); btn = "Get my cover"; target = origin + "/?mycover=1"; } catch (e) {} }
  const lrf = url.searchParams.get("learn");
  if (!a && !cvf && lrf && /^\d{1,9}$/.test(lrf)) { try { const o = (await env.KV.get("lr:" + lrf, "json")) || { l: [] }; const u = o.u || {}; const nm = u.n || u.u || "A reader"; const n = o.l.length; title = nm + "\u2019s Folio Learn transcript"; desc = n + (n === 1 ? " lesson" : " lessons") + " passed on Folio Learn, short courses made from Farcaster Articles."; btn = "Start learning"; target = origin + "/?learn=" + lrf; } catch (e) {} }
  const gpf = url.searchParams.get("gp");
  if (!a && !cvf && url.searchParams.has("game") && gpf && /^\d{1,9}$/.test(gpf)) { try { const u = await fcUser(+gpf); const no = +(url.searchParams.get("no") || 0) | 0, r = (url.searchParams.get("r") || "").replace(/[^01]/g, "").slice(0, 2), st = +(url.searchParams.get("s") || 0) | 0; title = (u.n || u.u || "A reader") + " played Who wrote it? #" + no + " on Folio"; desc = "One paragraph, four writers. Can you tell who wrote it?"; img = origin + "/gc/" + gpf + ".png?no=" + no + "&r=" + r + "&s=" + st + (/^[0-3]{1,2}$/.test(url.searchParams.get("g") || "") ? "&g=" + url.searchParams.get("g") : "") + (/^[0-9a-z]{1,12}$/.test(url.searchParams.get("v") || "") ? "&v=" + url.searchParams.get("v") : ""); btn = "Play Who wrote it?"; target = origin + "/?game=1"; } catch (e) {} }
  const slf = url.searchParams.get("seal"); // Zero Hour share page (title, writer, dates only; never the body)
  if (!a && slf && /^[0-9a-f]{6,24}$/.test(slf)) { try { const m = await slMeta(env, origin, slf); if (m) ({ title, desc, img, btn, target } = m); } catch (e) {} }
  const embed = { version: "1", imageUrl: img, button: { title: btn, action: { type: "launch_miniapp", name: APP_NAME, url: target, splashImageUrl: origin + "/img/splash.png", splashBackgroundColor: "#F4EFE6" } } };
  const embedFrame = { ...embed, button: { ...embed.button, action: { ...embed.button.action, type: "launch_frame" } } };
  return new Response(HTML.replace("<!--HEAD-->", () =>
    `<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${(a && (img.includes("/og/") || img.includes("/q/"))) || img.includes("/cover/") || img.includes("/gc/") || img.includes("/zh/") ? img : origin + "/img/og.png"}"><meta name="twitter:card" content="summary_large_image"><meta name="fc:miniapp" content='${esc(JSON.stringify(embed)).replace(/'/g, "&#39;")}'><meta name="fc:frame" content='${esc(JSON.stringify(embedFrame)).replace(/'/g, "&#39;")}'>`),
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=120" } });
}

async function qaFid(req, url) { const a = req.headers.get("authorization") || ""; if (!a.startsWith("Bearer ")) return 0; const v = new URL("https://auth.farcaster.xyz/verify-jwt"); v.searchParams.set("token", a.slice(7)); v.searchParams.set("domain", url.hostname); try { const r = await fetch(v); if (r.status !== 200) return 0; const j = await r.json(); return +j.sub || 0; } catch (e) { return 0; } } async function seenApi(env, req, url) { const h = (url.searchParams.get("h") || "").toLowerCase(); if (!/^0x[0-9a-f]{40,64}$/.test(h)) return J({ error: "bad" }, 400); const fid = await qaFid(req, url); if (!fid) return J({ error: "auth" }, 401); const idx = await loadIndex(env); const x = idx.items[h]; let af = x && x.a ? x.a.fid : 0; if (!af) { try { const b = await getBody(env, h); af = b.author.fid; } catch (e) {} } const pre = "sn:" + h + ":"; if (req.method === "POST") { if (!af || fid === af) return J({ ok: 1 }); try { await urAdd(env, fid, h, x); } catch (e) {} const k = pre + fid; const old = await env.KV.getWithMetadata(k); if (old && old.value !== null && old.metadata && Date.now() - (old.metadata.ts || 0) < 6 * 3600000) return J({ ok: 1 }); let b = {}; try { b = await req.json(); } catch (e) {} let u = String(b.u || ""), n = String(b.n || ""), pf = String(b.p || ""); try { const j = await fcGet("/v2/user?fid=" + fid); const us = j && j.result && j.result.user; if (us && us.fid === fid) { u = us.username || ""; n = us.displayName || ""; pf = (us.pfp && us.pfp.url) || ""; } } catch (e) {} const md = { u: u.slice(0, 40), n: n.slice(0, 60), p: pf.startsWith("https://") ? pf.slice(0, 400) : "", ts: Date.now() }; if (!isPreview(env)) await env.KV.put(k, "1", { metadata: md, expirationTtl: 90 * 86400 }); return J({ ok: 1 }); } if (fid !== af) return J({ error: "forbidden" }, 403); const m = new Map(); let cur; for (let i = 0; i < 5; i++) { const r = await env.KV.list({ prefix: pre, cursor: cur, limit: 1000 }); for (const k of r.keys) { const f = +k.name.slice(pre.length); const d = k.metadata || {}; if (f) m.set(f, { f, u: d.u || "", n: d.n || "", p: d.p || "", ts: d.ts || 0 }); } if (r.list_complete || !r.cursor) break; cur = r.cursor; } const legacy = (await env.KV.get("seen:" + h, "json")) || (h !== url.searchParams.get("h") ? (await env.KV.get("seen:" + url.searchParams.get("h"), "json")) : null) || []; for (const v of legacy) { const o = m.get(v.f); if (!o) m.set(v.f, v); else if (!o.ts || (v.ts || 0) > o.ts) m.set(v.f, { ...v, ...(o.n || o.u ? { u: o.u, n: o.n, p: o.p } : {}), ts: Math.max(v.ts || 0, o.ts || 0) }); } const rt = (await env.KV.get("rt:" + h, "json")) || { v: {}, m: {} }; for (const [fs, sv] of Object.entries(rt.v || {})) { const f = +fs; const mm = (rt.m && rt.m[fs]) || {}; const o = m.get(f); if (o) o.s = sv; else m.set(f, { f, u: mm.u || "", n: mm.n || "", p: mm.p || "", ts: mm.ts || 0, s: sv }); } const items = [...m.values()].sort((p, q) => (q.ts || 0) - (p.ts || 0)); return J({ items, n: items.length }, 200, { "cache-control": "private, no-store" }); } async function rdSet(env, h, f) { const k = "rd:" + h; const c = (await env.KV.get(k, "json")) || { o: 0, d: 0 }; f(c); if (!isPreview(env)) await env.KV.put(k, JSON.stringify(c), { expirationTtl: 40 * 86400 }); } async function rateApi(env, req, url) { const h = url.searchParams.get("h") || ""; if (!/^0x[0-9a-fA-F]{40,64}$/.test(h)) return J({ error: "bad" }, 400); const k = "rt:" + h; const o = (await env.KV.get(k, "json")) || { s: 0, n: 0, v: {} }; if (req.method === "POST") { const fid = await qaFid(req, url); if (!fid) return J({ error: "auth" }, 401); let b = {}; try { b = await req.json(); } catch (e) {} const s = Math.round(+b.s); if (!(s >= 1 && s <= 5)) return J({ error: "bad" }, 400); const idx = await loadIndex(env); const x = idx.items[h]; let af = x && x.a ? x.a.fid : 0; if (!af) { try { const bd = await getBody(env, h); af = bd.author.fid; } catch (e) {} } if (fid === af) return J({ error: "own" }, 403); const p = o.v[fid] || 0; if (p) { o.s -= p; o.n -= 1; } o.v[fid] = s; o.s += s; o.n += 1; o.m = o.m || {}; if (!o.m[fid]) { let md = { u: "", n: "", p: "" }; try { const j = await fcGet("/v2/user?fid=" + fid); const us = j && j.result && j.result.user; if (us && us.fid === fid) md = { u: (us.username || "").slice(0, 40), n: (us.displayName || "").slice(0, 60), p: ((us.pfp && us.pfp.url) || "").startsWith("https://") ? us.pfp.url.slice(0, 400) : "" }; } catch (e) {} o.m[fid] = md; } o.m[fid].ts = Date.now(); if (!isPreview(env)) { await env.KV.put(k, JSON.stringify(o)); await rdSet(env, h, c => { c.rs = o.s; c.rn = o.n; }); try { const ra = (await env.KV.get("rtall", "json")) || {}; ra[h] = [o.s, o.n]; await env.KV.put("rtall", JSON.stringify(ra)); await caches.default.delete(new Request(url.origin + "/api/feed?k=2")); } catch (e) {} if (af && p !== s) { try { const subs = (await env.KV.get("subs", "json")) || {}; const d = subs[af]; if (d) { const who = o.m[fid].u ? "@" + o.m[fid].u : "A reader"; const tt = (x && x.title) || "your piece"; await fetch(d.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notificationId: ("folio-r-" + h.slice(2, 14) + "-" + fid + "-" + s).slice(0, 128), title: ("\u2605".repeat(s) + " on your piece").slice(0, 32), body: (who + " rated \u201C" + tt + "\u201D " + s + "/5").slice(0, 128), targetUrl: url.origin + "/?a=" + h, tokens: [d.token] }) }); } } catch (e) {} } } return J({ a: o.n ? Math.round(o.s / o.n * 10) / 10 : 0, n: o.n ? 1 : 0, m: s }); } return J({ a: o.n ? Math.round(o.s / o.n * 10) / 10 : 0, n: o.n ? 1 : 0 }, 200, { "cache-control": "no-store" }); } async function hlIndex(env) { let ix = await env.KV.get("hlx", "json"); if (ix) return ix; ix = []; try { const ls = await env.KV.list({ prefix: "hl:", limit: 200 }); for (const k of ls.keys.slice(0, 40)) { const l = (await env.KV.get(k.name, "json")) || []; for (const x of l) if (x.f && x.f.length) ix.push({ h: k.name.slice(3), t: x.t, c: x.f.length }); } if (!isPreview(env)) await env.KV.put("hlx", JSON.stringify(ix)); } catch (e) {} return ix; }
async function hlSearch(env, url) { const q = String(url.searchParams.get("q") || "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 60); const ix = await hlIndex(env); let r = ix; if (q.length >= 2) { const re = new RegExp("(^|[^\\p{L}\\p{N}])" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu"); r = ix.filter(x => re.test(x.t)); } const hid = (await env.KV.get("hidden", "json")) || []; r = r.filter(x => !hid.includes(x.h)); r = r.slice().sort((a, b) => b.c - a.c).slice(0, 60); return J({ q, n: r.length, items: r }, 200, { "cache-control": "public, max-age=60" }); }
async function repApi(env, req, url) {
  const ak = url.searchParams.get("k"); const adm = ak && ak === env.ADMIN_KEY;
  let hid = (await env.KV.get("hidden", "json")) || [];
  if (req.method === "GET") { if (adm) return J({ hidden: hid, reports: (await env.KV.get("reports", "json")) || [] }); return J({ hidden: hid }, 200, { "cache-control": "public, max-age=60" }); }
  if (adm) { const h = url.searchParams.get("hide"), u = url.searchParams.get("unhide"); if (h && !hid.includes(h)) hid.push(h); if (u) hid = hid.filter(x => x !== u); await env.KV.put("hidden", JSON.stringify(hid)); return J({ ok: 1, hidden: hid }); }
  let b = {}; try { b = await req.json(); } catch (e) {}
  const h = String(b.h || ""); if (!/^0x[0-9a-fA-F]{40,64}$/.test(h)) return J({ error: "bad" }, 400);
  const why = String(b.why || "").slice(0, 40), t = String(b.t || "").replace(/\s+/g, " ").trim().slice(0, 300), note = String(b.note || "").slice(0, 500);
  const ip = req.headers.get("cf-connecting-ip") || "x"; const rk = "rl:rep:" + ip + ":" + new Date().toISOString().slice(0, 10); const rc = +(await env.KV.get(rk) || 0); if (rc >= 10) return J({ error: "limit" }, 429);
  if (isPreview(env)) return J({ ok: 1 });
  await env.KV.put(rk, String(rc + 1), { expirationTtl: 90000 });
  const fid = await qaFid(req, url).catch(() => null);
  const r = (await env.KV.get("reports", "json")) || []; r.push({ h, why, t, note, fid: fid || null, at: Date.now() }); await env.KV.put("reports", JSON.stringify(r.slice(-500)));
  try { const subs = (await env.KV.get("subs", "json")) || {}; const d = subs["16447"]; if (d) await fetch(d.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notificationId: ("folio-r-" + h.slice(2, 20) + r.length).slice(0, 64), title: "Folio: content reported", body: ("Reason: " + (why || "other") + (t ? " | " + t : "")).slice(0, 128), targetUrl: url.origin + "/?a=" + h, tokens: [d.token] }) }); } catch (e) {}
  return J({ ok: 1 });
}
async function hlApi(env, req, url) { const h = url.searchParams.get("h") || ""; if (!/^0x[0-9a-fA-F]{40,64}$/.test(h)) return J({ error: "bad" }, 400); const k = "hl:" + h; const l = (await env.KV.get(k, "json")) || []; if (req.method === "POST") { const fid = await qaFid(req, url); if (!fid) return J({ error: "auth" }, 401); let b = {}; try { b = await req.json(); } catch (e) {} const t = String(b.t || "").replace(/\s+/g, " ").trim(); if (t.length < 8 || t.length > 300) return J({ error: "bad" }, 400); let e = l.find(x => x.t === t); if (!e) { if (l.length >= 300) l.sort((a, b) => b.f.length - a.f.length).pop(); e = { t, f: [] }; l.push(e); } const i = e.f.indexOf(fid); let on = true; if (i >= 0) { e.f.splice(i, 1); on = false; } else e.f.push(fid); const out = l.filter(x => x.f.length); if (!isPreview(env)) { await env.KV.put(k, JSON.stringify(out)); await rdSet(env, h, c => { c.hc = out.reduce((s, x) => s + x.f.length, 0); }); try { const ix = await hlIndex(env); const rest = ix.filter(x => x.h !== h); for (const x of out) rest.push({ h, t: x.t, c: x.f.length }); await env.KV.put("hlx", JSON.stringify(rest.slice(-3000))); } catch (e) {} } return J({ on, c: e.f.length }); } const s = l.filter(x => x.f.length).sort((a, b) => b.f.length - a.f.length); return J({ top: s.slice(0, 3).map(x => ({ t: x.t, c: x.f.length })), n: s.reduce((a, x) => a + x.f.length, 0) }, 200, { "cache-control": "no-store" }); } async function ttsBytes(r){if(!r)return null;if(r instanceof ReadableStream)return new Uint8Array(await new Response(r).arrayBuffer());if(r instanceof ArrayBuffer)return new Uint8Array(r);if(r instanceof Uint8Array)return r;if(r.audio&&typeof r.audio==="string"){const b=atob(r.audio);const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}return null}

// ---------- monthly / yearly support (direct USDC on Base, verified onchain, no custody) ----------
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const TRANSFER_T = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const BASE_RPCS = ["https://mainnet.base.org", "https://base-rpc.publicnode.com", "https://base.llamarpc.com", "https://1rpc.io/base"];
async function baseRpc(method, params) { let last = null; for (const u of BASE_RPCS) { try { const r = await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); const j = await r.json(); if (j && !j.error && "result" in j) { if (j.result !== null) return j.result; last = null; continue; } } catch (e) {} } return last; }
async function ethAddrs(fid) {
  const out = new Set();
  try { const j = await (await fetch("https://api.farcaster.xyz/fc/primary-address?fid=" + fid + "&protocol=ethereum", { headers: { "user-agent": "Folio" } })).json(); const a = j && j.result && j.result.address && j.result.address.address; if (a) out.add(a.toLowerCase()); } catch (e) {}
  try { const j = await (await fetch("https://api.farcaster.xyz/v2/verifications?fid=" + fid, { headers: { "user-agent": "Folio" } })).json(); for (const v of (j && j.result && j.result.verifications) || []) if (v.protocol === "ethereum" && /^0x[0-9a-fA-F]{40}$/.test(v.address)) out.add(v.address.toLowerCase()); } catch (e) {}
  return out;
}
async function fcUser(fid) { try { const j = await fcGet("/v2/user?fid=" + fid); const us = j && j.result && j.result.user; if (us && us.fid === fid) return { u: (us.username || "").slice(0, 40), n: (us.displayName || "").slice(0, 60), p: ((us.pfp && us.pfp.url) || "").startsWith("https://") ? us.pfp.url.slice(0, 400) : "" }; } catch (e) {} return { u: "", n: "", p: "" }; }
const supActive = (m, now) => Object.entries(m || {}).filter(([f, s]) => s.until > now);
async function supApi(env, req, url) {
  const W = +(url.searchParams.get("fid") || 0); if (!(W > 0)) return J({ error: "bad" }, 400);
  const k = "sup:" + W; const m = (await env.KV.get(k, "json")) || {}; const now = Date.now();
  if (req.method === "POST") {
    const adm = env.ADMIN_KEY && url.searchParams.get("k") === env.ADMIN_KEY; const fid = adm ? +(url.searchParams.get("as") || 0) : await qaFid(req, url); if (!fid) return J({ error: "auth" }, 401);
    if (fid === W) return J({ error: "own" }, 403);
    let b = {}; try { b = await req.json(); } catch (e) {}
    const tx = String(b.tx || "").toLowerCase(); const plan = b.plan === "y" ? "y" : "m";
    if (!/^0x[0-9a-f]{64}$/.test(tx)) return J({ error: "bad tx" }, 400);
    const used = await env.KV.get("suptx:" + tx);
    if (used) { if (+used === fid && m[fid]) return J({ ok: 1, until: m[fid].until, usd: m[fid].usd, plan: m[fid].plan }); return J({ error: "used" }, 409); }
    let rc = null; for (let i = 0; i < 3 && !rc; i++) { rc = await baseRpc("eth_getTransactionReceipt", [tx]); if (!rc) await new Promise(r => setTimeout(r, 2500)); }
    if (!rc) return J({ error: "pending" }, 202);
    if (rc.status !== "0x1") return J({ error: "failed" }, 400);
    const blk = await baseRpc("eth_getBlockByNumber", [rc.blockNumber, false]); const bts = blk && blk.timestamp ? parseInt(blk.timestamp, 16) * 1000 : 0;
    if (!bts || now - bts > 3 * 86400000) return J({ error: "old" }, 400);
    const to = await ethAddrs(W); if (!to.size) return J({ error: "no wallet" }, 400);
    const from = await ethAddrs(fid); if (!from.size) return J({ error: "sender" }, 400);
    let amt = 0n;
    for (const l of rc.logs || []) { if ((l.address || "").toLowerCase() !== USDC_BASE || !l.topics || l.topics[0] !== TRANSFER_T || l.topics.length < 3) continue; const src = "0x" + l.topics[1].slice(26).toLowerCase(); const dst = "0x" + l.topics[2].slice(26).toLowerCase(); if (to.has(dst) && from.has(src)) amt += BigInt(l.data); }
    const usd = Number(amt) / 1e6; const min = plan === "y" ? 10 : 1;
    if (usd < min) return J({ error: "amount", usd }, 400);
    const days = plan === "y" ? 365 : 30;
    const o = m[fid] || {}; const md = o.u ? { u: o.u, n: o.n, p: o.p } : await fcUser(fid);
    const until = Math.max(now, o.until || 0) + days * 86400000;
    m[fid] = { ...md, until, plan, usd: Math.round(usd * 100) / 100, tot: Math.round(((o.tot || 0) + usd) * 100) / 100, ts: now, since: o.since || now };
    if (!isPreview(env)) {
      await env.KV.put("suptx:" + tx, String(fid), { expirationTtl: 400 * 86400 });
      await env.KV.put(k, JSON.stringify(m));
      const all = (await env.KV.get("supall", "json")) || []; if (!all.includes(W)) { all.push(W); await env.KV.put("supall", JSON.stringify(all)); }
      try { const subs = (await env.KV.get("subs", "json")) || {}; const d = subs[W]; if (d) { const who = md.u ? "@" + md.u : "A reader"; await fetch(d.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notificationId: ("folio-s-" + tx.slice(2, 40)).slice(0, 64), title: (o.until > now ? "A supporter renewed" : "You have a new supporter").slice(0, 32), body: (who + " supports you " + (plan === "y" ? "yearly" : "monthly") + " with $" + m[fid].usd + " USDC").slice(0, 128), targetUrl: url.origin + "/?stats=" + W, tokens: [d.token] }) }); } } catch (e) {}
    }
    return J({ ok: 1, until, usd: m[fid].usd, plan });
  }
  const act = supActive(m, now); const fid = await qaFid(req, url);
  const res = { n: act.length };
  if (fid && fid === W) res.items = act.map(([f, s]) => ({ f: +f, u: s.u, n: s.n, p: s.p, until: s.until, plan: s.plan, usd: s.usd, tot: s.tot, since: s.since })).sort((a, b) => b.since - a.since);
  else if (fid && m[fid]) res.mine = { until: m[fid].until, plan: m[fid].plan, usd: m[fid].usd };
  if (url.searchParams.has("a")) res.a = await fcUser(W);
  return J(res, 200, { "cache-control": "private, no-store" });
}
// remind a supporter (if they added Folio) 3 days before their support ends, once per period
async function supRemind(env, origin) {
  const all = (await env.KV.get("supall", "json")) || []; if (!all.length) return;
  const subs = (await env.KV.get("subs", "json")) || {}; const now = Date.now(); let sent = 0;
  for (const W of all.slice(0, 20)) {
    const m = (await env.KV.get("sup:" + W, "json")) || {}; let wu = null;
    for (const [f, s] of Object.entries(m)) {
      if (sent >= 10) return;
      const left = s.until - now; if (left > 3 * 86400000 || left < -86400000) continue;
      const d = subs[f]; if (!d) continue;
      const rk = "suprm:" + W + ":" + f + ":" + s.until; if (await env.KV.get(rk)) continue;
      if (!wu) wu = await fcUser(W);
      await fetch(d.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notificationId: ("folio-sr-" + W + "-" + f + "-" + Math.floor(s.until / 1e5)).slice(0, 64), title: (left > 0 ? "Your support ends soon" : "Your support has ended").slice(0, 32), body: ("Renew to keep supporting " + (wu.u ? "@" + wu.u : "this writer") + " on Folio.").slice(0, 128), targetUrl: origin + "/?support=" + W, tokens: [d.token] }) }).catch(() => {});
      await env.KV.put(rk, "1", { expirationTtl: 40 * 86400 }); sent++;
    }
  }
}

// ---- Folio Learn: short courses made from Articles, 3-question quizzes, public transcripts (added 2026-11-15) ----
const LEARN_COURSES = [
  { id: "build", n: "Build on Farcaster", d: "How Farcaster and Base work, and how people build on them.", re: /\b(farcaster|base|snapchain|daos?|protocols?|forks?|casts?|channels?|mini ?apps?|miniapps?|frames?|snapchain|developers?|devs?|coding|code|api|sdk|hackathon|open source|ship(ping)?|builders?)\b/i },
  { id: "ai", n: "AI tools", d: "Agents, models and how people really use them.", re: /\b(ai|agents?|agentic|llms?|gpt|claude|gemini|prompts?|prompting|machine learning|automation)\b/i },
  { id: "basics", n: "Crypto basics", d: "Wallets, tokens and how onchain money works.", re: /\b(crypto|bitcoin|btc|ethereum|eth|wallets?|stablecoins?|defi|tokens?|blockchain|onchain|on-chain|layer ?2|l2|rollups?|nfts?|usdc|self-custody|base chain)\b/i },
  { id: "money", n: "Money and markets", d: "Markets, investing and prediction markets.", re: /\b(markets?|trading|traders?|invest(ing|ment|or|ors)?|money|finance|financial|macro|polymarket|prediction|yield|portfolio|economy|economics)\b/i },
  { id: "writing", n: "Writing and creators", d: "Writing well and growing an audience.", re: /\b(writ(e|es|ing|er|ers)|creators?|audience|newsletters?|storytelling|publish(ing)?|essays?)\b/i }
];
const LEARN_EDU = /\b(how|guide|explained|explainer|what is|what are|why|intro|introduction|lessons?|learn(ed|ing)?|101|tutorial|beginners?|basics|steps?|tips|framework|playbook|deep dive|understanding|primer|mistakes)\b/i;
const LEARN_PER = 6, LEARN_BADGE = 3;
const LEARN_SKIP = /(^gm farcaster|\bday \d+\b|last week|weekly recap|moving to|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2},? \d{4}\b)/i;
function learnCourseOf(x) { if (LEARN_SKIP.test(x.title || "")) return ""; const ti = x.title || "", pv = x.prev || ""; for (const c of LEARN_COURSES) if (c.re.test(ti)) return c.id; for (const c of LEARN_COURSES) { const g = new RegExp(c.re.source, "gi"); const m = new Set((pv.match(g) || []).map(w => w.toLowerCase())); if (m.size >= 2) return c.id; } return ""; }
async function learnApi(env) {
  const idx = await loadIndex(env), now = Date.now();
  const items = publicItems(idx).filter(x => !x.lc && (x.min || 1) >= 2 && now - x.ts < 75 * DAY && x._g);
  const cnt = (await env.KV.get("lrn", "json")) || {};
  const by = {}; for (const x of items) { const c = learnCourseOf(x); if (!c) continue; (by[c] = by[c] || []).push(x); }
  const courses = [];
  for (const c of LEARN_COURSES) {
    const per = {}; const ls = (by[c.id] || []).map(x => ({ x, s: (x.top + 1) * (LEARN_EDU.test(x.title + " " + (x.prev || "")) ? 2.5 : 1) * (1 + (cnt[x.h] || 0) * 0.15) }))
      .sort((a, b) => b.s - a.s).map(o => o.x).filter(x => (per[x.a.fid] = (per[x.a.fid] || 0) + 1) <= 2).slice(0, LEARN_PER);
    if (ls.length < 3) continue;
    courses.push({ id: c.id, n: c.n, d: c.d, lessons: ls.map(x => ({ h: x.h, title: x.title, cover: x.cover, min: x.min || 1, a: { fid: x.a.fid, u: x.a.u, n: x.a.n, p: x.a.p }, n: cnt[x.h] || 0 })) });
  }
  try { const ids = courses.map(c => c.id).join(","); if ((await env.KV.get("lrc")) !== ids && !isPreview(env)) await env.KV.put("lrc", ids); } catch (e) {} // live course ids, for transcript badges
  return J({ courses, badge: LEARN_BADGE }, 200, { "cache-control": "public, max-age=300" });
}
function learnShuffle(q) { const o = q.o.map((t, i) => ({ t, ok: i === q.a })); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return { t: q.t, o: o.map(z => z.t), a: o.findIndex(z => z.ok), w: q.w || "" }; }
// Quiz cache: KV first; if KV writes are over the daily limit, fall back to the edge cache so a quiz stays stable between GET and POST.
const QZC = h => new Request("https://folio-cache.internal/qz/" + h);
async function qzCacheGet(h) { try { const r = await caches.default.match(QZC(h)); return r ? await r.json() : null; } catch (e) { return null; } }
async function qzCachePut(h, z) { try { await caches.default.put(QZC(h), new Response(JSON.stringify(z), { headers: { "content-type": "application/json", "cache-control": "max-age=172800" } })); } catch (e) {} }
async function quizGet(env, h) {
  const k = "qz:" + h; let z = null; try { z = await env.KV.get(k, "json"); } catch (e) {}
  if (z && z.q) return z;
  z = await qzCacheGet(h); if (z && z.q) return z;
  const dk = "nr:" + new Date().toISOString().slice(0, 10);
  const used = parseInt((await env.KV.get(dk)) || "0", 10);
  if (used > BUDGET) { const e = new Error("busy"); e.busy = 1; throw e; }
  const b = await getBody(env, h);
  const words = (b.article.body || "").split(/\s+/).length; if (words < 250) { const e = new Error("short"); e.short = 1; throw e; }
  const text = (b.article.title || "") + "\n\n" + (b.article.body || "").slice(0, 10000);
  const sys = `Write a 3-question multiple-choice quiz that checks whether someone really read and understood the user's article. Ask about the article's main ideas and arguments, never trivia like dates, percentages, prices or other numbers. Every question must be answerable from the article alone. Each question has 4 short options (under 14 words each) and exactly one correct option; wrong options must be plausible. Plain, simple English. For each question add "w": one short sentence saying why the answer is right, in plain words. Output only JSON, no markdown: {"q":[{"t":"question","o":["option","option","option","option"],"a":0,"w":"why"}]}`;
  const base = { messages: [{ role: "system", content: sys }, { role: "user", content: text }], max_tokens: 2500, temperature: 0.3 };
  let r;
  try { r = await env.AI.run(MODEL, { ...base, reasoning: { effort: "low" } }); }
  catch (e) { try { r = await env.AI.run(MODEL, base); } catch (e2) { const x = new Error("busy"); x.busy = 1; throw x; } }
  const out = aiOut(r);
  const u = r && (r.usage || (r.result && r.result.usage));
  const n = u && u.prompt_tokens != null ? u.prompt_tokens * RATE.in + (u.completion_tokens || 0) * RATE.out : (text.length / 3) * RATE.in + (out.length / 1.5) * RATE.out;
  try { await env.KV.put(dk, String(Math.ceil(used + n)), { expirationTtl: 2 * 86400 }); } catch (e) {}
  let q = null; try { const m = out.match(/\{[\s\S]*\}/); q = JSON.parse(m ? m[0] : out).q; } catch (e) {}
  q = (Array.isArray(q) ? q : []).filter(x => x && typeof x.t === "string" && Array.isArray(x.o) && x.o.length === 4 && x.o.every(o => typeof o === "string" && o.trim()) && Number.isInteger(x.a) && x.a >= 0 && x.a < 4).slice(0, 3)
    .map(x => learnShuffle({ t: x.t.trim(), o: x.o.map(o => o.trim()), a: x.a, w: String(x.w || "").trim() }));
  if (q.length < 3) { const e = new Error("busy"); e.busy = 1; throw e; }
  z = { q, at: Date.now() };
  try { await env.KV.put(k, JSON.stringify(z), { expirationTtl: 180 * 86400 }); } catch (e) { await qzCachePut(h, z); }
  return z;
}
async function quizApi(env, req, url) {
  const h = (url.searchParams.get("h") || "").toLowerCase();
  if (!/^0x[0-9a-f]{40,64}$/.test(h)) return J({ error: "bad" }, 400);
  if (req.method !== "POST" && url.searchParams.get("pre") === "1") { // background warm-up while the reader is still reading
    try { let c = null; try { c = await env.KV.get("qz:" + h, "json"); } catch (e) {} if (!c || !c.q) c = await qzCacheGet(h);
      if (c && c.q) return J({ ok: 1, c: 1 }, 200, { "cache-control": "no-store" });
      const used = parseInt((await env.KV.get("nr:" + new Date().toISOString().slice(0, 10))) || "0", 10);
      if (used > BUDGET * 0.6) return J({ ok: 0, skip: 1 }, 200, { "cache-control": "no-store" });
      await quizGet(env, h); return J({ ok: 1 }, 200, { "cache-control": "no-store" });
    } catch (e) { return J({ ok: 0 }, 200, { "cache-control": "no-store" }); }
  }
  let z; try { z = await quizGet(env, h); } catch (e) { return J({ error: e.short ? "short" : e.busy ? "busy" : "error" }, e.short ? 400 : 429); }
  const cnt = (await env.KV.get("lrn", "json")) || {};
  if (req.method !== "POST") return J({ q: z.q.map(x => ({ t: x.t, o: x.o })), n: cnt[h] || 0 }, 200, { "cache-control": "no-store" });
  let body = {}; try { body = await req.json(); } catch (e) {}
  const a = Array.isArray(body.a) ? body.a.map(Number) : [];
  const wrong = z.q.map((x, i) => (a[i] === x.a ? -1 : i)).filter(i => i >= 0);
  if (wrong.length) return J({ pass: false, wrong, n: cnt[h] || 0 });
  const res = { pass: true, w: z.q.map(x => x.w), n: cnt[h] || 0 };
  const fid = await qaFid(req, url);
  if (fid && !isPreview(env)) try {
    const k = "lr:" + fid; const o = (await env.KV.get(k, "json")) || { l: [] };
    if (!o.l.some(e => e.h === h)) {
      const idx = await loadIndex(env); const x = idx.items[h] || {};
      let au = x.a; if (!au) { try { const b = await getBody(env, h); au = { fid: b.author.fid, u: b.author.username }; } catch (e) { au = {}; } }
      o.l.unshift({ h, t: (x.title || "").slice(0, 140), w: au.u || "", wf: au.fid || 0, c: learnCourseOf(x), ts: Date.now() }); o.l = o.l.slice(0, 300);
      if (!o.u) { const cu = await env.KV.get("cu:" + fid, "json"); if (cu) o.u = cu; else { const fu = await fcUser(fid); if (fu && fu.u) o.u = fu; } }
      await env.KV.put(k, JSON.stringify(o));
      cnt[h] = (cnt[h] || 0) + 1; await env.KV.put("lrn", JSON.stringify(cnt));
      res.n = cnt[h];
    }
    res.saved = true;
  } catch (e) { res.saved = false; }
  return J(res);
}
async function learnerApi(env, fid) {
  if (!(fid > 0)) return J({ error: "bad" }, 400);
  const o = (await env.KV.get("lr:" + fid, "json")) || { l: [] };
  const by = {}; for (const e of o.l) if (e.c) by[e.c] = (by[e.c] || 0) + 1;
  const live = new Set(((await env.KV.get("lrc")) || "build,basics,money").split(","));
  const badges = LEARN_COURSES.filter(c => live.has(c.id) || by[c.id]).map(c => ({ id: c.id, n: c.n, k: by[c.id] || 0, got: (by[c.id] || 0) >= LEARN_BADGE }));
  const u = o.u || {};
  return J({ fid, u: u.u || u.username || "", n: u.n || u.displayName || "", p: u.p || (u.pfp && u.pfp.url) || "", l: o.l, badges, need: LEARN_BADGE }, 200, { "cache-control": "no-store" });
}

async function quizFlagApi(env, req, url) {
  if (req.method !== "POST") return J({ error: "bad" }, 405);
  const h = (url.searchParams.get("h") || "").toLowerCase();
  if (!/^0x[0-9a-f]{40,64}$/.test(h)) return J({ error: "bad" }, 400);
  const fk = "qf:" + h;
  if (await env.KV.get(fk)) return J({ ok: 0, again: 1 });
  await env.KV.put(fk, "1", { expirationTtl: 86400 });
  await env.KV.delete("qz:" + h);
  return J({ ok: 1 });
}



// ---------- Writer coin: a writer can show one of their own Clanker tokens (opt-in) ----------
async function ckList(fid) {
  const out = []; let cur = "";
  for (let i = 0; i < 6; i++) {
    let j; try { j = await (await fetch("https://www.clanker.world/api/tokens/fetch-deployed-by-fid?fid=" + fid + (cur ? "&cursor=" + encodeURIComponent(cur) : ""), { headers: { "user-agent": "Folio/1.0" } })).json(); } catch (e) { break; }
    for (const t of (j && j.data) || []) { if (!t.contract_address) continue; if (t.requestor_fid && +t.requestor_fid !== fid) continue; out.push({ a: String(t.contract_address).toLowerCase(), s: String(t.symbol || "").trim().slice(0, 24), n: String(t.name || "").trim().slice(0, 48), i: t.img_url || "", ts: Date.parse(t.deployed_at || t.created_at) || 0, v5: t.type === "clanker_tax" ? 1 : 0 }); }
    if (!j || !j.cursor || !(j.data || []).length) break; cur = j.cursor;
  }
  const seen = {}; return out.filter(t => !seen[t.a] && (seen[t.a] = 1)).sort((a, b) => (b.v5 - a.v5) || (b.ts - a.ts)).slice(0, 60);
}
async function coinApi(env, req, url) {
  if (req.method === "POST") {
    const fid = await qaFid(req, url); if (!fid) return J({ error: "auth" }, 401);
    let b = {}; try { b = await req.json(); } catch (e) {}
    const a = String(b.a || "").toLowerCase();
    if (!a) { if (!isPreview(env)) await env.KV.delete("ck:" + fid); return J({ c: null }); }
    if (!/^0x[0-9a-f]{40}$/.test(a)) return J({ error: "bad" }, 400);
    const t = (await ckList(fid)).find(x => x.a === a); if (!t) return J({ error: "notyours" }, 403);
    const c = { a: t.a, s: t.s, n: t.n, i: t.i, v5: t.v5 }; if (!isPreview(env)) await env.KV.put("ck:" + fid, JSON.stringify(c));
    return J({ c });
  }
  if (url.searchParams.has("mine")) {
    const fid = await qaFid(req, url); if (!fid) return J({ error: "auth" }, 401);
    const [list, c] = await Promise.all([ckList(fid), env.KV.get("ck:" + fid, "json")]);
    return J({ c: c || null, list }, 200, { "cache-control": "private, no-store" });
  }
  const af = +(url.searchParams.get("fid") || 0); if (!(af > 0)) return J({ error: "bad" }, 400);
  return J({ c: (await env.KV.get("ck:" + af, "json")) || null }, 200, { "cache-control": "public, max-age=300" });
}
async function ckHolds(env, coin, fid) {
  const ck = new Request("https://folio.cache/hold/" + coin + "/" + fid);
  try { const hit = await caches.default.match(ck); if (hit) return (await hit.text()) === "1"; } catch (e) {}
  let yes = false, ok = true;
  try {
    const v = await (await fetch("https://api.farcaster.xyz/v2/verifications?fid=" + fid, { headers: { "user-agent": "folio-reader/1.0" } })).json();
    const addrs = ((v.result && v.result.verifications) || []).filter(x => x.protocol === "ethereum" && /^0x[0-9a-fA-F]{40}$/.test(x.address)).map(x => x.address.toLowerCase()).slice(0, 5);
    const body = addrs.map((a, i) => ({ jsonrpc: "2.0", id: i, method: "eth_call", params: [{ to: coin, data: "0x70a08231" + a.slice(2).padStart(64, "0") }, "latest"] }));
    if (body.length) { const r = await (await fetch("https://mainnet.base.org", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json(); for (const x of [].concat(r)) { if (x.error) ok = false; else if (x.result && BigInt(x.result) > 0n) yes = true; } }
  } catch (e) { ok = false; }
  if (ok || yes) { try { await caches.default.put(ck, new Response(yes ? "1" : "0", { headers: { "cache-control": "max-age=" + (yes ? 21600 : 7200) } })); } catch (e) {} }
  return yes;
}
async function holdApi(env, req, url) {
  const af = +(url.searchParams.get("fid") || 0); if (!(af > 0)) return J({ error: "bad" }, 400);
  const c = await env.KV.get("ck:" + af, "json"); if (!c) return J({ h: [] }, 200, { "cache-control": "public, max-age=300" });
  const fs = [...new Set(String(url.searchParams.get("f") || "").split(",").map(Number).filter(x => x > 0 && x !== af))].slice(0, 30);
  const r = await Promise.all(fs.map(async f => (await ckHolds(env, c.a, f)) ? f : 0));
  return J({ s: c.s, n: c.n, h: r.filter(Boolean) }, 200, { "cache-control": "public, max-age=600" });
}

// ---------- Who wrote it? daily game ----------
const GM_START = Date.UTC(2026, 10, 17);
function gmDay(t) { return new Date(t || Date.now()).toISOString().slice(0, 10); }
function gmNo(day) { return Math.floor((Date.parse(day + "T00:00:00Z") - GM_START) / DAY) + 1; }
function gmRand(seed) { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e9) / 1e9; }; }
function gmPlain(p) { return p.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/https?:\S+/g, "").replace(/[*_`>#]+/g, "").replace(/\s+/g, " ").trim(); }
async function gmBuild(env, day) {
  const idx = await loadIndex(env); const now = Date.parse(day + "T12:00:00Z");
  const pool = todayList(publicItems(idx), now).filter(x => !isTeam(x)).slice(0, 10).filter(x => x.a && x.a.fid && x.a.u && x.a.p);
  const by = new Map(); for (const x of pool) if (!by.has(x.a.fid)) by.set(x.a.fid, x);
  const writers = [...by.values()]; if (writers.length < 4) return null;
  const used = (await env.KV.get("gmused", "json")) || [];
  const rnd = gmRand("folio-gm-" + day);
  const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const prevDay = gmDay(Date.parse(day + "T00:00:00Z") - DAY);
  const prev = new Set((((await env.KV.get("gm:" + prevDay, "json")) || {}).o || []).map(o => o.fid));
  const hi = writers.slice(0, 5), lo = writers.slice(5);
  const pick2 = (arr, avoid) => { const f = shuf(arr.filter(w => !prev.has(w.a.fid) && !avoid.has(w.a.fid))); const r = shuf(arr.filter(w => prev.has(w.a.fid) && !avoid.has(w.a.fid))); return f.concat(r); };
  const tried = new Set();
  for (let k = 0; k < 4; k++) {
    const avoid = new Set(k ? [...tried] : []);
    let A = pick2(hi, avoid).slice(0, 2), B = pick2(lo, avoid).slice(0, 2);
    if (A.length + B.length < 4) { const rest = pick2(writers, new Set([...A, ...B].map(w => w.a.fid))); while (A.length + B.length < 4 && rest.length) (A.length < 2 ? A : B).push(rest.shift()); }
    const quad = [...A, ...B]; if (quad.length < 4) break;
    const order = shuf(quad).sort((a, b) => (used.includes(a.h) ? 1 : 0) - (used.includes(b.h) ? 1 : 0));
    for (const x of order) {
      tried.add(x.a.fid);
      let b; try { b = await getBody(env, x.h); } catch (e) { continue; } if (/\b(fuck|cunt|nigg|retard|whore|porn)/i.test(String(b.article.body || ""))) continue;
      const names = [x.a.u, x.a.n, (x.a.n || "").split(" ")[0]].filter(s => s && s.length >= 3).map(s => s.toLowerCase());
      const paras = String(b.article.body || "").split(/\n\s*\n/).map(gmPlain).filter(p => p.length >= 140 && p.length <= 460 && !/@|\$[A-Za-z]|farcaster\.xyz|warpcast/i.test(p) && !/\b(fuck|shit|bitch|cunt|nigg|retard|whore)/i.test(p) && !names.some(n => p.toLowerCase().includes(n)));
      if (!paras.length) continue;
      const t = paras[Math.floor(rnd() * Math.min(paras.length, 6))];
      const opts = shuf(quad).map(w => ({ fid: w.a.fid, u: w.a.u, n: w.a.n || w.a.u, p: w.a.p }));
      const g = { d: day, no: gmNo(day), t, o: opts, a: opts.findIndex(o => o.fid === x.a.fid), h: x.h, title: x.title, au: { fid: x.a.fid, u: x.a.u, n: x.a.n, p: x.a.p } };
      if (!isPreview(env)) { await env.KV.put("gm:" + day, JSON.stringify(g), { expirationTtl: 40 * 86400 }); await env.KV.put("gmused", JSON.stringify([x.h, ...used].slice(0, 60))); }
      return g;
    }
  }
  return null;
}

async function gmGet(env, day) { return (await env.KV.get("gm:" + day, "json")) || await gmBuild(env, day); }
async function gameApi(env, req, url) {
  const day = (isPreview(env) && /^\d{4}-\d\d-\d\d$/.test(url.searchParams.get("gd") || "") && url.searchParams.get("gd")) || gmDay(); const g = await gmGet(env, day);
  if (!g) return J({ error: "none" }, 200, { "cache-control": "no-store" });
  if (req.method === "POST") {
    let b = {}; try { b = await req.json(); } catch (e) {}
    const gi = Math.round(+b.g), t = Math.round(+b.t) || 1; if (!(gi >= 0 && gi < g.o.length)) return J({ error: "bad" }, 400);
    const ok = gi === g.a, fin = ok || t >= 2;
    const sk = "gs:" + day; const st = (await env.KV.get(sk, "json")) || { n: 0, w: [0, 0, 0] };
    let stars = 0; if (fin && ok && !isPreview(env)) { try { const fid = await qaFid(req, url); if (fid) { const gk = "gst:" + day + ":" + fid; if (!(await env.KV.get(gk))) { stars = 3; await env.KV.put(gk, String(stars), { expirationTtl: 9 * 86400 }); const sw = (await env.KV.get("stw", "json")) || {}; const lim = Date.now() - 8 * 86400e3; for (const f in sw) { for (const d in sw[f]) if (Date.parse(d) < lim) delete sw[f][d]; if (!Object.keys(sw[f]).length) delete sw[f]; } (sw[fid] = sw[fid] || {})[day] = stars; await env.KV.put("stw", JSON.stringify(sw)); } } } catch (e) {} }
    if (fin && b.c !== 0 && !isPreview(env)) { st.n++; if (ok) st.w[Math.min(t, 2)]++; await env.KV.put(sk, JSON.stringify(st), { expirationTtl: 40 * 86400 }); }
    const pct = st.n ? Math.round((st.w[1] + st.w[2]) / st.n * 100) : 0;
    return J({ ok, fin, stars, ...(fin ? { a: g.a, h: g.h, title: g.title, au: g.au } : {}), n: st.n, pct }, 200, { "cache-control": "no-store" });
  }
  return J({ d: g.d, no: g.no, t: g.t, o: g.o.map(o => ({ u: o.u, n: o.n, p: o.p })) }, 200, { "cache-control": "public, max-age=300" });
}

// ---------- Want more: readers wait for a writer's next piece ----------
async function subsOf(env) { return (await env.KV.get("subs", "json")) || {}; }
async function wmApi(env, req, url) {
  const af = +(url.searchParams.get("fid") || 0); if (!(af > 0)) return J({ error: "bad" }, 400);
  const k = "wm:" + af; const o = (await env.KV.get(k, "json")) || { f: {} };
  const fid = await qaFid(req, url);
  if (req.method === "POST") {
    if (!fid) return J({ error: "auth" }, 401); if (fid === af) return J({ error: "own" }, 403);
    let on; if (o.f[fid]) { delete o.f[fid]; on = false; } else { o.f[fid] = Date.now(); on = true; }
    const n = Object.keys(o.f).length;
    if (!isPreview(env)) {
      await env.KV.put(k, JSON.stringify(o));
      if (on) { try { const d = (await subsOf(env))[af]; if (d) await fetch(d.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notificationId: ("folio-wm-" + af + "-" + gmDay()).slice(0, 128), title: "Readers want more", body: (n === 1 ? "A reader is" : n + " readers are") + " waiting for your next piece on Folio.", targetUrl: url.origin + "/", tokens: [d.token] }) }); } catch (e) {} }
    }
    return J({ on, n });
  }
  return J({ n: Object.keys(o.f).length, on: !!(fid && o.f[fid]) }, 200, { "cache-control": "private, no-store" });
}
async function wmPing(env, origin) {
  const subs = await subsOf(env); if (!Object.keys(subs).length) return;
  const idx = await loadIndex(env); const nowT = Date.now();
  const fresh = publicItems(idx).filter(x => x.a && x.a.fid && nowT - x.ts < 2 * DAY).sort((a, b) => b.ts - a.ts).slice(0, 40);
  for (const x of fresh) {
    const nk = "wmn:" + x.h; if (await env.KV.get(nk)) continue;
    const o = await env.KV.get("wm:" + x.a.fid, "json"); await env.KV.put(nk, "1", { expirationTtl: 30 * 86400 });
    if (!o || !o.f) continue;
    const byUrl = {}; for (const f of Object.keys(o.f)) { const d = subs[f]; if (d) (byUrl[d.url] = byUrl[d.url] || []).push(d.token); }
    for (const [u, toks] of Object.entries(byUrl)) for (let i = 0; i < toks.length; i += 100) await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notificationId: "folio-nw-" + x.h.slice(2, 18), title: ("New from @" + x.a.u).slice(0, 32), body: (x.title || "").slice(0, 128), targetUrl: origin + "/?a=" + x.h, tokens: toks.slice(i, i + 100) }) }).catch(() => {});
  }
}

// ---------- Loyal readers: who finishes a writer's pieces ----------
async function finApi(env, req, url) {
  const h = (url.searchParams.get("h") || "").toLowerCase(); if (!/^0x[0-9a-f]{40,64}$/.test(h)) return J({ error: "bad" }, 400);
  const fid = await qaFid(req, url); if (!fid) return J({ error: "auth" }, 401);
  const idx = await loadIndex(env); const x = idx.items[h]; let af = x && x.a ? x.a.fid : 0;
  if (!af) { try { af = (await getBody(env, h)).author.fid; } catch (e) {} }
  if (!af || af === fid) return J({ ok: 1, own: 1 });
  const k = "lr:" + af; const o = (await env.KV.get(k, "json")) || { r: {} };
  const e = o.r[fid] || { h: [], ts: 0 }; if (e.h.includes(h)) return J({ ok: 1, c: e.h.length });
  e.h = [h, ...e.h].slice(0, 60); e.ts = Date.now();
  if (!e.u) { const us = await fcUser(fid); e.u = us.u; e.n = us.n; e.p = us.p; }
  o.r[fid] = e;
  const ks = Object.keys(o.r); if (ks.length > 600) { ks.sort((a, b) => (o.r[a].h.length - o.r[b].h.length) || (o.r[a].ts - o.r[b].ts)); for (const q of ks.slice(0, ks.length - 600)) delete o.r[q]; }
  const anon = !!(await env.KV.get("anon:" + fid));
  if (!isPreview(env)) {
    await env.KV.put(k, JSON.stringify(o));
    if (e.h.length === 3 && !anon) { try { const d = (await subsOf(env))[af]; if (d) await fetch(d.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notificationId: ("folio-lr-" + af + "-" + fid).slice(0, 128), title: "A loyal reader", body: ("@" + (e.u || "someone") + " has now finished 3 of your pieces on Folio.").slice(0, 128), targetUrl: url.origin + "/?loyal=1", tokens: [d.token] }) }); } catch (er) {} }
  }
  return J({ ok: 1, c: e.h.length, anon });
}
async function loyalApi(env, req, url) {
  const fid = await qaFid(req, url); if (!fid) return J({ error: "auth" }, 401);
  const o = (await env.KV.get("lr:" + fid, "json")) || { r: {} };
  const idx = await loadIndex(env); const total = Object.values(idx.items).filter(x => x.a && x.a.fid === fid && x.meta === 1).length;
  const list = Object.entries(o.r).map(([f, e]) => ({ f: +f, c: e.h.length, ts: e.ts, u: e.u || "", n: e.n || "", p: e.p || "" })).sort((a, b) => (b.c - a.c) || (b.ts - a.ts)).slice(0, 30);
  const out = await Promise.all(list.map(async r => (await env.KV.get("anon:" + r.f)) ? { c: r.c, ts: r.ts, anon: 1 } : r));
  return J({ total, n: Object.keys(o.r).length, items: out }, 200, { "cache-control": "private, no-store" });
}
async function anonApi(env, req, url) {
  const fid = await qaFid(req, url); if (!fid) return J({ error: "auth" }, 401);
  if (req.method === "POST") { let b = {}; try { b = await req.json(); } catch (e) {} if (!isPreview(env)) { if (b.on) await env.KV.put("anon:" + fid, "1"); else await env.KV.delete("anon:" + fid); } return J({ on: !!b.on }); }
  return J({ on: !!(await env.KV.get("anon:" + fid)) }, 200, { "cache-control": "private, no-store" });
}


// ---------- Storage: D1 first, KV as read fallback (added 2026-11-17; KV free tier allows only 1k writes/day) ----------
// 2026-11-17 (indexd1): big string values (index etc.) now live in D1 too. Up to D1_ONE bytes -> one chunk row; bigger -> several chunk rows in table kvc.
// Header row in kv has st=3 and v = {"h":sha256,"n":chunks,"b":bytes,"at":ms}. Only binary (non-string) values still go to KV (st=2).
let D1_READY = null; const D1_BIG = new Map(); const D1_CACHE = new Map(); const D1_CACHE_MS = 45000;
function d1Init(db) { if (!D1_READY) D1_READY = db.batch([db.prepare("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT, m TEXT, exp INTEGER, st INTEGER NOT NULL DEFAULT 0)"), db.prepare("CREATE TABLE IF NOT EXISTS kvc (k TEXT NOT NULL, i INTEGER NOT NULL, v TEXT, PRIMARY KEY (k, i))")]).catch(e => { D1_READY = null; throw e; }); return D1_READY; }
const D1_MAX = 100000; // string values above this are stored as chunked big values (st=3)
const D1_ONE = 1900000, D1_CHUNK = 600000; // bytes that fit in one row; chars per chunk otherwise (<= 1.8MB even for 3-byte chars)
function d1Parse(v, type) { if (v == null) return null; if (type === "json") { try { return JSON.parse(v); } catch (e) { return null; } } return v; }
async function d1Hash(s) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join(""); }
function d1Split(s, bytes) { if (bytes <= D1_ONE) return [s]; const out = []; let i = 0; while (i < s.length) { let j = Math.min(s.length, i + D1_CHUNK); if (j < s.length) { const c = s.charCodeAt(j - 1); if (c >= 0xd800 && c <= 0xdbff) j--; } out.push(s.slice(i, j)); i = j; } return out; }
function hybridKV(kv, db) {
  const now = () => Math.floor(Date.now() / 1000);
  async function row(k) { const b = D1_BIG.get(k); if (b && b > Date.now()) return { st: 2 }; await d1Init(db); const r = await db.prepare("SELECT v, m, exp, st FROM kv WHERE k = ?").bind(k).first(); if (r && r.st === 2) D1_BIG.set(k, Date.now() + 60000); else D1_BIG.delete(k); return r; }
  // st: 0 = value in D1, 1 = deleted, 2 = value lives in KV (binary), 3 = big value in D1 chunk rows (kvc)
  // returns { v, m, exp } | null (deleted/expired) | undefined (no D1 row -> KV fallback) | "kv" (value lives in KV)
  async function load(k) {
    const c = D1_CACHE.get(k); if (c && c.t > Date.now()) { if (c.exp && c.exp < now()) return null; return c; }
    const bb = D1_BIG.get(k); if (bb && bb > Date.now()) return "kv";
    await d1Init(db);
    // one round trip: the kv row plus its chunk rows (none for normal values)
    const rs = (await db.prepare("SELECT kv.v, kv.m, kv.exp, kv.st, c.i ci, c.v cv FROM kv LEFT JOIN kvc c ON kv.st = 3 AND c.k = kv.k WHERE kv.k = ? ORDER BY c.i").bind(k).all()).results || [];
    const r = rs[0];
    if (!r) return undefined;
    if (r.st === 2) { D1_BIG.set(k, Date.now() + 60000); return "kv"; } else D1_BIG.delete(k);
    if (r.st === 1 || (r.exp && r.exp < now())) return null;
    if (r.st !== 3) return { v: r.v, m: r.m, exp: r.exp };
    const hd = JSON.parse(r.v || "{}"); const ch = rs.filter(x => x.ci != null && x.ci < hd.n);
    if (ch.length !== hd.n) throw new Error("d1 chunks missing for " + k);
    const v = ch.map(x => x.cv).join("");
    const o = { v, m: r.m, exp: r.exp, h: hd.h, t: Date.now() + D1_CACHE_MS }; D1_CACHE.set(k, o); return o;
  }
  async function get(k, opt) {
    const type = typeof opt === "string" ? opt : (opt && opt.type) || "text";
    if (type === "arrayBuffer" || type === "stream") return kv.get(k, opt);
    let r; try { r = await load(k); } catch (e) { return kv.get(k, opt); }
    if (r === undefined || r === "kv") return kv.get(k, opt);
    if (r === null) return null;
    return d1Parse(r.v, type);
  }
  async function getWithMetadata(k, opt) {
    const type = typeof opt === "string" ? opt : (opt && opt.type) || "text";
    if (type === "arrayBuffer" || type === "stream") return kv.getWithMetadata(k, opt);
    let r; try { r = await load(k); } catch (e) { return kv.getWithMetadata(k, opt); }
    if (r === undefined || r === "kv") return kv.getWithMetadata(k, opt);
    if (r === null) return { value: null, metadata: null };
    return { value: d1Parse(r.v, type), metadata: r.m ? JSON.parse(r.m) : null };
  }
  async function putBig(k, v, m, exp) {
    await d1Init(db);
    const h = await d1Hash(v); const b = new TextEncoder().encode(v).length;
    const cur = await db.prepare("SELECT v, m, exp, st FROM kv WHERE k = ?").bind(k).first();
    if (cur && cur.st === 3) { let hd = {}; try { hd = JSON.parse(cur.v || "{}"); } catch (e) {}
      if (hd.h === h) { // identical value: skip chunk writes
        if ((cur.m || null) !== m || (cur.exp || null) !== exp) await db.prepare("UPDATE kv SET m = ?, exp = ? WHERE k = ?").bind(m, exp, k).run();
        D1_CACHE.set(k, { v, m, exp, h, t: Date.now() + D1_CACHE_MS }); return "same";
      } }
    const parts = d1Split(v, b); const n = parts.length;
    const st = parts.map((p, i) => db.prepare("INSERT INTO kvc (k, i, v) VALUES (?, ?, ?) ON CONFLICT(k, i) DO UPDATE SET v = excluded.v").bind(k, i, p));
    st.push(db.prepare("DELETE FROM kvc WHERE k = ? AND i >= ?").bind(k, n));
    st.push(db.prepare("INSERT INTO kv (k, v, m, exp, st) VALUES (?, ?, ?, ?, 3) ON CONFLICT(k) DO UPDATE SET v = excluded.v, m = excluded.m, exp = excluded.exp, st = 3").bind(k, JSON.stringify({ h, n, b, at: Date.now() }), m, exp));
    await db.batch(st); // one transaction: readers never see half a value
    D1_BIG.delete(k); D1_CACHE.set(k, { v, m, exp, h, t: Date.now() + D1_CACHE_MS }); return "written";
  }
  async function put(k, v, o) {
    o = o || {};
    const exp = o.expiration ? +o.expiration : o.expirationTtl ? now() + +o.expirationTtl : null;
    const m = o.metadata ? JSON.stringify(o.metadata) : null;
    if (typeof v !== "string") {
      // binary values stay in KV
      await kv.put(k, v, o);
      try { await d1Init(db); await db.prepare("INSERT INTO kv (k, v, m, exp, st) VALUES (?, NULL, NULL, ?, 2) ON CONFLICT(k) DO UPDATE SET v = NULL, m = NULL, exp = excluded.exp, st = 2").bind(k, exp).run(); } catch (e) {}
      return;
    }
    if (v.length > D1_MAX) { await putBig(k, v, m, exp); return; }
    await d1Init(db);
    D1_CACHE.delete(k); D1_BIG.delete(k);
    await db.prepare("INSERT INTO kv (k, v, m, exp, st) VALUES (?, ?, ?, ?, 0) ON CONFLICT(k) DO UPDATE SET v = excluded.v, m = excluded.m, exp = excluded.exp, st = 0").bind(k, v, m, exp).run();
  }
  async function del(k) { await d1Init(db); D1_CACHE.delete(k); D1_BIG.delete(k); await db.prepare("INSERT INTO kv (k, v, m, exp, st) VALUES (?, NULL, NULL, NULL, 1) ON CONFLICT(k) DO UPDATE SET v = NULL, m = NULL, exp = NULL, st = 1").bind(k).run(); }
  async function list(o) {
    o = o || {}; const prefix = o.prefix || ""; const lim = o.limit || 1000;
    if (o.cursor) return { keys: [], list_complete: true };
    const out = new Map();
    let cur; for (let i = 0; i < 50; i++) { let r; try { r = await kv.list({ prefix, cursor: cur, limit: 1000 }); } catch (e) { break; } for (const x of r.keys) out.set(x.name, x); if (r.list_complete || !r.cursor) break; cur = r.cursor; }
    try {
      await d1Init(db);
      const rs = await db.prepare("SELECT k, m, exp, st FROM kv WHERE k >= ? AND k < ?").bind(prefix, prefix + "\uffff").all();
      const t = now();
      for (const r of rs.results || []) { if (r.st === 1 || (r.exp && r.exp < t)) { out.delete(r.k); continue; } if (r.st === 2) continue; out.set(r.k, { name: r.k, metadata: r.m ? JSON.parse(r.m) : undefined, expiration: r.exp || undefined }); }
    } catch (e) {}
    const keys = [...out.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    return { keys: lim >= keys.length || prefix === "sn:" || /^sn:/.test(prefix) ? keys : keys.slice(0, lim), list_complete: true };
  }
  return { get, getWithMetadata, put, delete: del, list, putBig };
}
function withStore(env) { if (!env || !env.DB || !env.KV || env.KV.__hybrid) return env; const KV = hybridKV(env.KV, env.DB); KV.__hybrid = 1; return { ...env, KV }; }
async function d1Sweep(env) { try { if (env.DB) { await d1Init(env.DB); await env.DB.prepare("DELETE FROM kv WHERE exp IS NOT NULL AND exp < ?").bind(Math.floor(Date.now() / 1000)).run(); await env.DB.prepare("DELETE FROM kvc WHERE k NOT IN (SELECT k FROM kv WHERE st = 3)").run(); } } catch (e) {} }
// read-only storage report (admin key, or preview): where a key lives and how big it is
async function d1StoreInfo(env, url) {
  const db = env.DB; await d1Init(db); const key = url.searchParams.get("key");
  if (key) { const r = await db.prepare("SELECT k, st, exp, length(v) lv, CASE WHEN st = 3 THEN v END hd FROM kv WHERE k = ?").bind(key).first(); const c = await db.prepare("SELECT count(*) n, sum(length(v)) chars FROM kvc WHERE k = ?").bind(key).first(); return J({ row: r, chunks: c }, 200, { "cache-control": "no-store" }); }
  const big = await db.prepare("SELECT k, st, exp, CASE WHEN st = 3 THEN v END hd FROM kv WHERE st IN (2, 3) ORDER BY k").all(); const s = await db.prepare("SELECT st, count(*) n FROM kv GROUP BY st").all(); const c = await db.prepare("SELECT count(*) n, sum(length(v)) chars FROM kvc").first();
  return J({ big: big.results, byStatus: s.results, chunks: c }, 200, { "cache-control": "no-store" });
}


// ---------- Farcaster Updates (added 2026-11-17): official top-level posts by @farcaster (fid 1), verbatim, no AI ----------
// Storage: one D1 row (table fcu) holding the processed list. 2026-11-18 fcufast: own cron (odd minutes, every 2 min) does a light check of the newest casts;
// the big JSON is rewritten only when a new kept cast appears, otherwise only the row's `at` column (last check time) is bumped. Lazy refresh on visit when the last check is >3 min old.
// No KV writes. New-prize notifications exist only behind FCU_NOTIFY (off) and never run on preview.
const FCU_NOTIFY = false;
const FCU_FID = 1, FCU_RC = new Set([37, 5283]), FCU_MIN_LEN = 120, FCU_TTL = 90 * 1000, FCU_LAZY = 180 * 1000, FCU_CRON = "1-59/2 * * * *", FCU_SINCE = Date.UTC(2026, 8, 1), FCU_KEEP = 120;
const FCU_VER = 3; // 2026-11-17 v3: markdown cleaned in title/excerpt. bump to force a fresh full backfill (2026-11-17: recasts of team prize posts added)
let FCU_INIT = null, FCU_BUSY = null;
function fcuInit(db) { if (!FCU_INIT) FCU_INIT = db.prepare("CREATE TABLE IF NOT EXISTS fcu (k TEXT PRIMARY KEY, v TEXT, at INTEGER)").run().catch(e => { FCU_INIT = null; throw e; }); return FCU_INIT; }
async function fcuLoad(env) { await fcuInit(env.DB); const r = await env.DB.prepare("SELECT v, at FROM fcu WHERE k = 'list'").first(); if (!r) return null; try { const d = JSON.parse(r.v); if (!(d && d.v === FCU_VER)) return null; d.chk = Math.max(+r.at || 0, d.at || 0); return d; } catch (e) { return null; } } // older cache versions are ignored -> full backfill from FCU_SINCE
async function fcuSave(env, d) { await fcuInit(env.DB); const { chk, ...o } = d; await env.DB.prepare("INSERT INTO fcu (k, v, at) VALUES ('list', ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, at = excluded.at").bind(JSON.stringify(o), Date.now()).run(); }
async function fcuTouch(env) { await env.DB.prepare("UPDATE fcu SET at = ? WHERE k = 'list'").bind(Date.now()).run(); } // 1 tiny row write, no JSON rewrite
// Recasts by @farcaster of prize/announcement posts from the Network School team (balajis.eth fid 37, dylanb.eth fid 5283) count as official updates.
function fcuNorm(x) { return String(x || "").trim().toUpperCase().replace(/[’']/g, "'").replace(/^VIDEOS ON\s+/, "").replace(/[!.:]+$/, "").trim(); }
function fcuSubject(s) { const t = String(s || ""); let m = t.match(/\$[\d,]+ (?:IN PRIZES )?FOR (.+?)(?:\s+prize\b|!|\n|$)/i) || t.match(/\bwith the (.+?) prize\b/i); return m ? fcuNorm(m[1]) : ""; }
const FCU_STOP = new Set(["PRIZE", "PRIZES", "VIDEOS", "VIDEO", "FARCASTER", "THE", "AND", "FOR", "WITH"]);
function fcuWords(s) { return [...new Set((String(s || "").toLowerCase().match(/[a-z]{4,}/g) || []))]; }
const FCU_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10, fourteen: 14 };
function fcuClassify(text, ts) {
  const t = String(text || ""), first = t.split("\n")[0];
  const o = { cat: "general" };
  if ((/^Thank you to everyone who/i.test(t) || /\bwinners?\b/i.test(first)) && /\b(1st|first) place\b/i.test(t)) { o.cat = "winners"; o.subj = fcuSubject(first); return o; }
  if (/\bIN PRIZES\b|\bPRIZES?\b/.test(t) || /^\$[\d,]+ (?:IN PRIZES )?FOR\b/.test(first)) {
    o.cat = "prize"; o.subj = fcuSubject(first);
    o.kw = fcuWords(t).slice(0, 1500).join(" ");
    const d = t.match(/(?:runs for|within) (\w+) days exactly from this post[’']?s timestamp/i); const n = d && (FCU_NUM[d[1].toLowerCase()] || +d[1]);
    if (n) o.end = ts + n * 24 * 3600 * 1000;
    return o;
  }
  if (/^Introducing\b/i.test(first) || /\bIntroducing\b/.test(first)) { o.cat = "feature"; return o; }
  if (/Network Code|farcaster\.xyz\/~\/code/i.test(t)) { o.cat = "rules"; return o; }
  return o;
}
function fcuMd(s) {
  let t = String(s || "").trim(), h = false;
  if (/^#{1,6}\s*/.test(t)) { h = true; t = t.replace(/^#{1,6}\s*/, "").replace(/\s+#+\s*$/, ""); }
  if (/^[-*_](\s*[-*_]){2,}$/.test(t)) return { t: "", h };
  t = t.replace(/^[-*+]\s+/, "• ");
  t = t.replace(/!?\[([^\]]*)\]\((?:[^()\s]|\([^()]*\))*\)/g, "$1");
  t = t.replace(/\*\*(\S(?:[^*]*?\S)?)\*\*/g, "$1").replace(/(^|[^\w])__(\S(?:[^_]*?\S)?)__(?=[^\w]|$)/g, "$1$2");
  t = t.replace(/(^|[^\w*])\*(\S(?:[^*]*?\S)?)\*(?=[^\w*]|$)/g, "$1$2").replace(/(^|[^\w_@])_(\S(?:[^_]*?\S)?)_(?=[^\w_]|$)/g, "$1$2");
  t = t.replace(/`+([^`]*)`+/g, "$1").replace(/\*\*/g, "").trim();
  if (t === "•" || /^[-*_]{3,}$/.test(t)) t = "";
  return { t, h };
}
function fcuMdLines(arr) {
  const L = arr.map(fcuMd).filter(x => x.t);
  const title = L.length ? L[0].t : "", rest = L.slice(1), ex = [];
  for (let i = 0; i < rest.length && ex.length < 2; i++) { if (rest[i].h && rest.slice(i + 1).some(y => !y.h)) continue; ex.push(rest[i].t); }
  return { title, ex };
}
function fcuItem(c) {
  const text = String(c.text || "");
  const m = fcuMdLines(text.split("\n").map(s => s.trim()).filter(Boolean));
  const it = { h: c.hash, ts: +c.timestamp, title: m.title, ex: m.ex, ...fcuClassify(text, +c.timestamp) };
  const un = c.author && c.author.username; if (un && un !== "farcaster") it.by = un;
  return it;
}
function fcuKeep(c) { return c && c.author && (+c.author.fid === FCU_FID || (c.recast && FCU_RC.has(+c.author.fid))) && !c.parentHash && !(c.parentAuthor && c.parentAuthor.fid) && String(c.text || "").trim().length >= FCU_MIN_LEN; }
async function fcuPage(cursor, lim) {
  const u = "https://api.farcaster.xyz/v2/casts?fid=" + FCU_FID + "&limit=" + (lim || 50) + (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
  const r = await fetch(u, { headers: { accept: "application/json", "user-agent": "Folio/1.0" } });
  if (!r.ok) throw new Error("fc " + r.status);
  const j = await r.json();
  return { casts: (j.result && j.result.casts) || [], next: j.next && j.next.cursor };
}
function fcuLink(items) {
  const prizes = items.filter(x => x.cat === "prize" && (x.subj || x.kw));
  for (const w of items) {
    if (w.cat !== "winners") continue; delete w.for; if (!w.subj) continue;
    let p = prizes.find(x => x.subj === w.subj && x.ts < w.ts);
    if (!p) { // title did not match: link only when every distinctive word of the winners' prize name appears in one earlier prize post
      const ws = fcuWords(w.subj).filter(x => !FCU_STOP.has(x.toUpperCase()));
      if (ws.length >= 2) { const c = prizes.filter(x => x.ts < w.ts && x.kw && ws.every(k => (" " + x.kw + " ").includes(" " + k + " "))); if (c.length === 1) p = c[0]; }
    }
    if (p) w.for = p.h;
  }
}
async function fcuRefresh(env, force) {
  if (!env.DB) return null;
  if (FCU_BUSY) return FCU_BUSY;
  FCU_BUSY = (async () => {
    const old = (await fcuLoad(env).catch(() => null)) || { items: [], at: 0, bf: 0 };
    if (!force && Date.now() - (old.chk || old.at || 0) < FCU_TTL) return old;
    const map = new Map(old.items.map(x => [x.h, x]));
    const known = new Set(map.keys());
    let cur = null, pages = 0;
    const backfill = !old.bf;
    const newest = old.items.reduce((m, x) => Math.max(m, x.ts), 0);
    for (;;) {
      const pg = await fcuPage(cur, !backfill && !cur ? 15 : 50); pages++; // light check: newest 15 first, page further only if no overlap
      let oldest = Infinity;
      for (const c of pg.casts) { if (!c.pinned) oldest = Math.min(oldest, +c.timestamp); if (fcuKeep(c) && +c.timestamp >= FCU_SINCE) map.set(c.hash, fcuItem(c)); }
      if (!pg.next || oldest < FCU_SINCE || pages >= 8 || (!backfill && (oldest <= newest || pages >= 3))) break; // hourly: page until we overlap what we have
      cur = pg.next; await new Promise(r => setTimeout(r, 1200)); // stay well under 10 req/10s
    }
    if (!backfill && old.items.length && [...map.keys()].every(h => known.has(h))) { await fcuTouch(env); old.chk = Date.now(); return old; } // nothing new: skip the JSON rewrite
    const items = [...map.values()].sort((a, b) => b.ts - a.ts).slice(0, FCU_KEEP);
    fcuLink(items);
    const fresh = items.filter(x => x.cat === "prize" && !known.has(x.h) && old.bf);
    const d = { v: FCU_VER, items, at: Date.now(), bf: 1 };
    await fcuSave(env, d); d.chk = d.at;
    if (FCU_NOTIFY && !isPreview(env) && fresh.length) { for (const x of fresh) await fcuNotify(env, x, env.ORIGIN || PROD).catch(() => {}); }
    return d;
  })().finally(() => { FCU_BUSY = null; });
  return FCU_BUSY;
}
// New-prize notification. OFF (FCU_NOTIFY=false) and never sends on preview; turning it on for live waits on the owner.
async function fcuNotify(env, x, origin) {
  if (!FCU_NOTIFY || isPreview(env)) return;
  const nid = "fcu-" + x.h.slice(2, 12);
  const subs = (await env.KV.get("subs", "json")) || {};
  const byUrl = {};
  for (const d of Object.values(subs)) (byUrl[d.url] = byUrl[d.url] || []).push(d.token);
  for (const [url, tokens] of Object.entries(byUrl)) for (let i = 0; i < tokens.length; i += 100) {
    await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notificationId: nid, title: "New Farcaster prize".slice(0, 32), body: x.title.slice(0, 128), targetUrl: origin + "/?tab=updates", tokens: tokens.slice(i, i + 100) }) }).catch(() => {});
  }
}
async function fcuApi(env, ctx) {
  if (!env.DB) return J({ error: "unavailable" }, 503);
  let d = await fcuLoad(env).catch(() => null);
  if (!d || !d.items || !d.items.length) { try { d = await fcuRefresh(env, true); } catch (e) { return J({ error: "unavailable", items: [] }, 503); } }
  else if (Date.now() - (d.chk || d.at || 0) > FCU_LAZY) { const p = fcuRefresh(env).catch(() => {}); if (ctx && ctx.waitUntil) ctx.waitUntil(p); }
  const now = Date.now();
  const items = d.items.filter(x => !x.by || x.cat === "prize" || x.cat === "winners").map(x => { /* 2026-11-19: own @farcaster posts, plus prize posts the team recast */ const o = { h: x.h, ts: x.ts, cat: x.cat, title: x.title, ex: x.ex, url: "https://farcaster.xyz/" + (x.by || "farcaster") + "/" + x.h.slice(0, 10) }; if (x.by) o.by = x.by; if (x.end) { o.end = x.end; o.open = now < x.end; } if (x.for) o.for = x.for; if (x.cat === "prize" && !x.end && d.items.some(w => w.for === x.h)) o.open = false; return o; });
  return J({ items, at: d.at, chk: d.chk || d.at }, 200, { "cache-control": "public, max-age=30" });
}


// ---------- Farcaster Updates: Participants (added 2026-11-19) ----------
// Video replies to each prize post, one block per prize. Only direct replies that carry a video; text, links and team accounts are left out.
// The client API hides some replies, so the full reply list comes from a public hub (haatz.quilibrium.com) and hidden ones are read one by one (budget per request).
// Ordered by reply time (oldest first), no one is pinned. Winners are read from the matching winners post (place + cast link).
// Storage: one D1 row in table fcu (k = 'parts'). Closed prizes are fetched once; open prizes (and 12 h after they close) are re-read at most every 10 min.
const FCP_VER = 3, FCP_TTL = 5 * 60 * 1000, FCP_TEAM = new Set([1, 37, 5283]);
let FCP_BUSY = null;
async function fcpLoad(env) { await fcuInit(env.DB); const r = await env.DB.prepare("SELECT v FROM fcu WHERE k = 'parts'").first(); try { const d = r && JSON.parse(r.v); if (d && d.v === FCP_VER) return d; } catch (e) {} return { v: FCP_VER, p: {} }; }
async function fcpSave(env, d) { await env.DB.prepare("INSERT INTO fcu (k, v, at) VALUES ('parts', ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, at = excluded.at").bind(JSON.stringify(d), Date.now()).run(); }
async function fcpThread(h, lim) {
  const r = await fetch("https://api.farcaster.xyz/v2/thread-casts?castHash=" + h + "&limit=" + (lim || 100), { headers: { accept: "application/json", "user-agent": "Folio/1.0" } });
  if (!r.ok) throw new Error("fc " + r.status);
  const j = await r.json(); return (j.result && j.result.casts) || [];
}
function fcpWinners(text) {
  const o = [], re = /^\s*([^\n,]{2,30}),\s*\$[\d,]+:\s*@([\w.-]+)[^\n]*\n\s*(?:https?:\/\/)?(?:farcaster\.xyz|warpcast\.com)\/[\w.-]+\/(0x[0-9a-fA-F]{6,})/gm; let m;
  while ((m = re.exec(String(text || "")))) { const l = m[1].trim(), n = l.match(/^(\d+)(?:st|nd|rd|th)\b/i); o.push({ r: n ? n[1] + ({ 1: "st", 2: "nd", 3: "rd" }[n[1]] || "th") : /runner/i.test(l) ? "Runner-up" : /hono/i.test(l) ? "Honorable" : l.slice(0, 14), u: m[2].toLowerCase(), x: m[3].toLowerCase() }); }
  return o;
}
const FCP_HUB = "https://haatz.quilibrium.com", FCP_BUDGET = 30;
async function fcpHub(h, af) { // full reply list from a public hub (the client API hides some replies)
  const r = await fetch(FCP_HUB + "/v1/castsByParent?fid=" + (af || 1) + "&hash=" + h + "&pageSize=1000&reverse=false", { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("hub " + r.status);
  const j = await r.json(); const out = [];
  for (const m of j.messages || []) { const d = m.data || {}, b = d.castAddBody || {}; if (FCP_TEAM.has(+d.fid)) continue; const v = (b.embeds || []).find(e => e && /^https:\/\/stream\.farcaster\.xyz\/.+\.m3u8/.test(e.url || "")); if (v) out.push({ h: m.hash, url: v.url }); }
  return out;
}
function fcpRich(c) { const v = (((c.embeds || {}).videos) || []).find(x => x && x.url); if (!v || !c.author) return null; return { h: c.hash, ts: +c.timestamp, f: +c.author.fid, u: c.author.username || "", n: c.author.displayName || "", p: (c.author.pfp && c.author.pfp.url) || "", th: v.thumbnailUrl || "", d: Math.round((+v.duration || 0) / 1000), vu: v.url }; }
async function fcpOne(h) { const c = (await fcpThread(h, 1)).find(k => k.hash === h); return c ? fcpRich(c) : null; }
async function fcpFetch(prize, win, old, bud) {
  let casts = await fcpThread(prize.h, 100); bud.n--;
  const top = casts.find(c => c && c.hash === prize.h), af = top && top.author ? +top.author.fid : 1; let ph = prize.h, pend0 = 0, end = 0;
  // 2026-11-19: some prize posts put the actual prize in the author's own reply ("details in the reply below"); entries reply to that one
  const kid = casts.find(c => c && c.parentHash === prize.h && c.author && +c.author.fid === af && /\bPRIZES?\b/.test(c.text || "") && /(?:will run|runs) for|exactly from this post/i.test(c.text || ""));
  if (kid) { ph = kid.hash; const dm = (kid.text || "").match(/(?:run|runs) for (\w+) days exactly from this post/i); const dn = dm && (FCU_NUM[dm[1].toLowerCase()] || +dm[1]); if (dn) end = +kid.timestamp + dn * 864e5; if (bud.n > 3) { casts = await fcpThread(ph, 100); bud.n--; } else pend0 = 1; }
  const byH = new Map(); for (const c of casts) { if (!c || c.parentHash !== ph || !c.author || FCP_TEAM.has(+c.author.fid)) continue; const e = fcpRich(c); if (e) byH.set(e.h, e); }
  for (const e of (old && old.e) || []) if (!byH.has(e.h)) byH.set(e.h, e); // keep what earlier runs already read
  let pend = pend0;
  try { const hub = await fcpHub(ph, af); bud.n--; const live = new Set(hub.map(x => x.h));
    for (const x of hub) { if (byH.has(x.h)) continue; if (bud.n < 2) { pend++; continue; } try { const e = await fcpOne(x.h); bud.n--; if (e) byH.set(e.h, e); } catch (er) { pend++; } }
    for (const h of [...byH.keys()]) if (!live.has(h) && !casts.some(c => c.hash === h)) byH.delete(h); // deleted replies drop out
  } catch (e) { bud.n--; }
  const seen = new Set(), e = [];
  for (const x of [...byH.values()].sort((a, b) => a.ts - b.ts)) { const k = x.vu || x.h; if (seen.has(k)) continue; seen.add(k); delete x.w; e.push(x); }
  const o = { at: Date.now(), e }; if (pend) o.pend = pend; if (end) o.end = end; if (ph !== prize.h) o.ph = ph;
  if (win && bud.n > 1) { try { const w = (await fcpThread(win.h, 3)).find(c => c.hash === win.h); bud.n--; if (w) { o.wd = 1; for (const x of fcpWinners(w.text)) { let t = e.find(k => k.h.toLowerCase().startsWith(x.x)) || e.find(k => k.u.toLowerCase() === x.u);
      if (!t && bud.n > 1) { try { const r = await fetch("https://api.farcaster.xyz/v2/user-thread-casts?castHashPrefix=" + x.x + "&username=" + encodeURIComponent(x.u) + "&limit=1", { headers: { accept: "application/json", "user-agent": "Folio/1.0" } }); bud.n--; const j = await r.json(); const c = ((j.result && j.result.casts) || []).find(k => k.hash.toLowerCase().startsWith(x.x)); const ne = c && fcpRich(c); if (ne && !seen.has(ne.vu)) { seen.add(ne.vu); e.push(ne); e.sort((a, b) => a.ts - b.ts); t = ne; } } catch (er) {} }
      if (t) t.w = x.r; } } } catch (er) {} }
  return o;
}
function fcpNeeds(x, c, win, now) { const end = (c && c.end) || x.end || x.ts + 3 * 864e5; if (!c || c.pend) return true; if (win && !c.wd) return true; return now < end + 12 * 3600e3 && now - (c.at || 0) > FCP_TTL; }
async function fcpRefresh(env, list, todo) {
  if (FCP_BUSY) return FCP_BUSY;
  FCP_BUSY = (async () => { const d = await fcpLoad(env); const bud = { n: FCP_BUDGET }; let n = 0;
    for (const x of todo) { if (bud.n < 4) break; const win = list.find(w => w.cat === "winners" && w.for === x.h); try { d.p[x.h] = await fcpFetch(x, win, d.p[x.h], bud); n++; } catch (e) {} }
    if (n) await fcpSave(env, d); return d; })().finally(() => { FCP_BUSY = null; });
  return FCP_BUSY;
}
function fcpName(x) { let s = x.subj || ""; if (!s) { s = String(x.title || "").replace(/\s*\(\$[\d,]+\s*PRIZE\)\s*$/i, "").trim(); if (s !== s.toUpperCase()) return s; } return s.toLowerCase().replace(/(^|[\s(\-"])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(Of|On|The|And|In|For|To|A|An)\b/g, (m, w, i) => i ? w.toLowerCase() : w); }
async function fcpApi(env, ctx) {
  if (!env.DB) return J({ error: "unavailable", prizes: [] }, 503);
  const fd = await fcuLoad(env).catch(() => null); const list = (fd && fd.items) || [];
  const prizes = list.filter(x => x.cat === "prize").sort((a, b) => b.ts - a.ts);
  let d = await fcpLoad(env).catch(() => ({ v: FCP_VER, p: {} })); const now = Date.now();
  const todo = prizes.filter(x => fcpNeeds(x, d.p[x.h], list.find(w => w.cat === "winners" && w.for === x.h), now));
  if (todo.length) { const missing = todo.filter(x => !d.p[x.h]); if (missing.length) { try { d = await fcpRefresh(env, list, missing.concat(todo.filter(x => d.p[x.h]))); } catch (e) {} } else { const p = fcpRefresh(env, list, todo).catch(() => {}); if (ctx && ctx.waitUntil) ctx.waitUntil(p); } }
  const out = [];
  for (const x of prizes) { const c = d.p[x.h]; if (!c) continue; const xe = c.end || x.end || 0; const open = xe ? now < xe : false; if (!c.e.length && !open) continue; out.push({ h: x.h, ts: x.ts, end: xe, open, name: fcpName(x), url: "https://farcaster.xyz/" + (x.by || "farcaster") + "/" + x.h.slice(0, 10), e: c.e.map(({ vu, ...k }) => k) }); }
  return J({ prizes: out, at: now }, 200, { "cache-control": "public, max-age=60" });
}


// ---------- "Who wrote it?" share card: 2-scene character card (2026-11-18) ----------
// Replaces the Top 7 rank cards (removed). The player's own pfp character in 2 scenes (laptop + phone), generated ONCE per
// player with flux-2-klein-4b (pfp as reference) and kept in D1 (table gcard) keyed by fid + pfp hash. The question on
// the paper and bottom strip are drawn in code on every share (no AI). Generation starts only from an authenticated
// share (POST /api/gcprep, Farcaster quick auth), runs in waitUntil, and is capped per UTC day (GC_CAP, shared site budget
// with the reader's BUDGET: 3,000 + 6,500 = 9,500 of the free 10,000). Any failure falls back to the classic share card.
const GC_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const GC_VIS = [["@cf/meta/llama-3.2-11b-vision-instruct", "img"], ["@cf/google/gemma-3-12b-it", "msg"]];
const GC_CAP = 3000;      // neurons per UTC day for game share cards (reader features: BUDGET 6,500; total 9,500 < 10,000 free)
const GC_GEN = 31.42;     // klein-4b: 512x512 output tile 26.05 + one <512px input tile 5.37 neurons
const GC_SCORE = 20;      // conservative neurons per identity-score call (llama-3.2-11b-vision ~10)
const GC_LOW = 6;         // a scene scoring <= this gets ONE more try
const GC_MIN = 5;         // final scene score below this -> classic card
const GC_KEEP = "Use the character from image 0 as the only character. Identity is the top priority: the character must be instantly recognisable as the one in image 0, a faithful copy of its head, face and look, not a reinterpretation. Draw it as a clean flat comic illustration with bold outlines, the Folio house style used for every player: thick dark ink outlines, simple cel shading with one darker tone on each colour and a soft highlight, a slightly three-quarter pose with the head and shoulders drawn in full, never a copy-paste of the original drawing. Even when image 0 is already a simple cartoon, redraw it fresh in this Folio style so it clearly looks re-illustrated, not pasted in, while keeping every identifying detail of image 0. Keep the character exactly the same as in image 0: same face shape, same eyes, same hair, same skin or fur colours, same clothes and the same accessories (glasses, hats, jewellery, masks), same colour palette. Only the pose and the scene change. The face is fully visible and unobstructed, facing the viewer. Square comic panel filling the whole frame edge to edge, no border. Folio house background, identical for every player: a flat warm off-white paper-cream background with a large flat terracotta coral circle behind the character's head and shoulders, dark ink outlines. No words, letters or logos anywhere";
// scenes v2 (2026-11-18): no hands holding the laptop/phone; one visible hand only (mug). FLUX klein has no negative prompt,
// so unwanted things are avoided by describing exactly what is visible instead of naming what to leave out.
// scenes v3 (2026-11-18): scene A is now writing on paper (no laptop); the day's question is handwritten in code on the blank
// paper (gcScreen finds the bright paper area). Scene B (one hand holds the mug, phone with hearts) unchanged.
const GC_SV = "s16";      // s6 (2026-11-18): Folio comic style + fixed red/cream background for all, identity first; s4/s5 per-pfp background rejected by user
const GC_SV_OLD = "s3";      // scene version: part of the cache key (gcPh); bump when the prompts change so cached scenes regenerate
// s8 (2026-11-18): ONE wide scene per player (user: "one card, not two"): the player sits behind the table with a coffee mug,
// the quiz host's arm reaches in from the right and slides the question paper across the table; pale blue background, cream circle.
const GC_ONE = true;
const GC_W1 = 896, GC_H1 = 512, GC_GEN1 = 51.0; // 896x512 output = 1.75 tiles * 26.05 + one input tile 5.37 neurons
const GC_KEEP1 = "Use the character from image 0 as the player, the only face in the picture. Identity is the top priority: the player must be instantly recognisable as the one in image 0, a faithful copy of its head, face and look, not a reinterpretation. Draw it as a clean flat comic illustration with bold outlines, the Folio house style used for every player: thick dark ink outlines, simple cel shading with one darker tone on each colour and a soft highlight, a slightly three-quarter pose with the head and shoulders drawn in full, never a copy-paste of the original drawing. Even when image 0 is already a simple cartoon, redraw it fresh in this Folio style so it clearly looks re-illustrated, not pasted in, while keeping every identifying detail of image 0: same face shape, same eyes, same hair, same skin or fur colours, same clothes and the same accessories (glasses, hats, jewellery, masks), same colour palette. Keep the player's own colours, mood and character exactly as in image 0: a colourful character stays colourful with the same hues, never recoloured to grey, black and white or a single tone. The face is fully visible and unobstructed, facing the viewer. Wide comic panel filling the whole frame edge to edge, no border. Folio house background, identical for every player: a flat pale light blue background with a large flat warm cream circle behind the player's head and shoulders, dark ink outlines. No words, letters or logos anywhere except the single word \"Coffee\" printed on the coffee mug. Scene, seen from the quiz host's side of a plain wooden table: the player sits across the table in the centre of the picture, shown from the chest up, facing the viewer, arms down out of sight below the table edge. A white coffee mug printed with the word \"Coffee\" stands on the table on the player's side, to the left of the paper, fully inside the picture and well away from the left edge. On the table in front of the player lies one large sheet of plain bright white paper, lying completely flat on the tabletop and seen in perspective as a trapezoid, in the lower centre of the picture, not a wide strip: in the picture the paper looks about as tall as it is wide, reaching from just below the table edge almost down to the bottom of the picture, entirely below the player's chest so it never covers the player's body: a clean rectangle, completely blank, plain white and evenly lit, nothing written or drawn on it and no lines around it. The quiz host's single hand rests on the tabletop, entering from the lower right edge of the picture, holding a simple dark pen whose tip touches the right edge of the paper as if writing on it, a simple, well-drawn hand with five fingers, smaller than the player's head, leaving the middle and left of the paper clear. Only the host's hand and wrist are visible, no host face. Nothing else on the table. Clean simple shapes, correct proportions.";
const GC_SCENES = [
  " except the single word \"Folio\" printed on the coffee mug. The character is shown from the chest up sitting behind a plain wooden desk, writing an article. A large sheet of plain bright white paper lies flat on the desk in the lower centre of the picture, filling most of the desk width and the lower part of the picture, tilted toward the viewer so its surface faces the viewer: a large clean rectangle, completely blank, plain white and evenly lit, with nothing written on it. One single hand is visible: it rests at the lower right corner of the paper holding a simple dark pen, a simple, well-drawn hand with five fingers, leaving the middle and left of the paper clear. The other arm rests down out of the picture below the desk edge. A white coffee mug printed with the word \"Folio\" stands on the desk to the left of the paper, fully inside the picture and well away from the left edge. Nothing else on the desk. Clean simple shapes, correct proportions.",
  ". The character is shown from the chest up sitting at a plain wooden table. One single hand is visible: it holds a white coffee mug by its handle at chest height below the chin, a simple, well-drawn hand with five fingers. The other arm rests down out of the picture below the table edge. A smartphone lies flat on the table in front of the character, its screen lit up and glowing, and small red hearts float up from the glowing phone screen into the air. Clean simple shapes, correct proportions."
];
// the question written on the paper: that day's 4 options (KV gm:<day>), the correct one (GC_MARK) and the player's picks.
// Picks come from the share link (g=); for older links they are inferred from r where possible (a correct try = the answer).
const GC_MARK = false;     // false = never mark the correct writer on the card (no spoiler for viewers who have not played)
let GC_HF = null;
async function gcQuiz(env, no, r, gq) {
  const o = {};
  try { if (!GC_HF) { const b = await env.KV.get("font:Caveat", "arrayBuffer"); if (b) GC_HF = new Uint8Array(b); } } catch (e) {}
  if (GC_HF) o.hf = GC_HF;
  let g = null; try { const d = gcGameDay(no); g = no > 0 ? (d === gmDay() ? await gmGet(env, d) : await env.KV.get("gm:" + d, "json")) : null; } catch (e) {} // today's: same source as /api/game
  const ans = g && Number.isInteger(g.a) ? g.a : -1;
  if (g && Array.isArray(g.o) && g.o.length === 4) o.opts = g.o.map(x => ({ u: String(x.u || "").slice(0, 40), n: String(x.n || "").slice(0, 40) }));
  const pk = []; for (let i = 0; i < r.length; i++) { const v = gq[i] !== undefined ? +gq[i] : r[i] === "1" ? ans : -1; pk.push(v); }
  // keep only picks consistent with r (a "1" must be the answer, a "0" must not be)
  if (ans >= 0 && pk.some((v, i) => v >= 0 && (r[i] === "1") !== (v === ans))) pk.length = 0;
  if (pk.length && pk[pk.length - 1] < 0) pk.length = 0; else for (let i = pk.length - 1; i >= 0; i--) if (pk[i] < 0) pk.splice(i, 1); // unknown pick -> not marked (never guessed)
  o.pk = GC_MARK ? pk : []; o.ans = GC_MARK ? ans : -1; // 2026-11-18: no marks on the paper, only the 4 options (no spoiler)
  return o;
}
const gcPh = u => gcHash(GC_SV + "|" + (u && u.p || ""));
let GC_DB = null;
async function gcInit(env) {
  if (!GC_DB) GC_DB = env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS gcard (fid INTEGER PRIMARY KEY, ph TEXT, st TEXT, at INTEGER, info TEXT, a BLOB, b BLOB)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS gcn (day TEXT PRIMARY KEY, n REAL)")
  ]).catch(e => { GC_DB = null; throw e; });
  return GC_DB;
}
const gcHash = s => { let h = 2166136261; for (const c of String(s || "")) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const gcErr = (m, q) => { const e = new Error(m); if (q) e.quota = 1; return e; };
const gcQuota = e => /4006|daily free allocation|neuron|quota|budget/i.test(String(e && e.message || e));
function gcB64(u8) { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function gcBytes(b64) { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
const gcMime = u8 => u8[0] === 0x89 && u8[1] === 0x50 ? "image/png" : u8[0] === 0x52 && u8[1] === 0x49 ? "image/webp" : "image/jpeg";
const gcUri = u8 => "data:" + gcMime(u8) + ";base64," + gcB64(u8);
async function gcFonts(env) { if (!FONTS) FONTS = (await Promise.all(["NSerifB", "NSans", "NSansB"].map(f => env.KV.get("font:" + f, "arrayBuffer")))).map(b => new Uint8Array(b)); return FONTS; }
function gcPfpUrl(p) { return /^https:\/\/imagedelivery\.net\/[^/]+\/[^/]+\/[^/]+$/.test(p) ? p.replace(/\/[^/]+$/, "/anim=false,fit=cover,w=500,h=500,format=jpeg") : "https://wsrv.nl/?url=" + encodeURIComponent(p) + "&w=500&h=500&fit=cover&output=jpg&n=1"; }
async function gcPfp(p) {
  if (!p) throw gcErr("no pfp");
  const r = await fetch(gcPfpUrl(p), { headers: { accept: "image/jpeg,image/png" }, cf: { cacheTtl: 3600 } });
  if (!r.ok) throw gcErr("pfp " + r.status);
  const u8 = new Uint8Array(await r.arrayBuffer()); if (u8.length < 500 || u8.length > 3e6) throw gcErr("pfp size");
  const m = gcMime(u8); if (m === "image/webp") throw gcErr("pfp webp");
  return { u8, m };
}
// atomic daily budget: adds n only if the day's total stays <= GC_CAP
async function gcSpend(env, n) {
  await gcInit(env); const day = gmDay();
  const r = await env.DB.prepare("INSERT INTO gcn (day, n) VALUES (?1, ?2) ON CONFLICT(day) DO UPDATE SET n = n + ?2 WHERE n + ?2 <= ?3 RETURNING n").bind(day, n, GC_CAP).first();
  return !!r && n <= GC_CAP;
}
async function gcUsed(env) { await gcInit(env); const r = await env.DB.prepare("SELECT n FROM gcn WHERE day = ?").bind(gmDay()).first(); return r ? +r.n : 0; }
async function gcGen(env, pfp, sc, lg) {
  const one = GC_ONE && sc === 0, cost = one ? GC_GEN1 : GC_GEN;
  if (!(await gcSpend(env, cost))) throw gcErr("budget", 1);
  lg.gens++; lg.neu += cost;
  const f = new FormData();
  f.append("prompt", one ? GC_KEEP1 : GC_KEEP + GC_SCENES[sc]); f.append("width", String(one ? GC_W1 : 512)); f.append("height", String(one ? GC_H1 : 512)); f.append("seed", String(1 + Math.floor(Math.random() * 2e9)));
  f.append("input_image_0", new Blob([pfp.u8], { type: pfp.m }), pfp.m === "image/png" ? "ref.png" : "ref.jpg");
  const fr = new Response(f);
  let out;
  try { out = await env.AI.run(GC_MODEL, { multipart: { body: fr.body, contentType: fr.headers.get("content-type") } }); }
  catch (e) { if (gcQuota(e)) throw gcErr(String(e.message || e), 1); lg.err.push(String(e.message || e).slice(0, 120)); return null; }
  const b = out && (out.image || (out.result && out.result.image)); if (!b) { lg.err.push("no image"); return null; }
  return gcBytes(b);
}
// one vision call scores up to 3 candidates against the pfp: returns [1..10] per candidate, or null
async function gcScore(env, ref, cands, lg) {
  const L = ["A", "B", "C"].slice(0, cands.length);
  if (!(await gcSpend(env, GC_SCORE))) return null;
  lg.neu += GC_SCORE;
  let png; try { png = await gcSheet(RESVG, await gcFonts(env), ref, cands); } catch (e) { return null; }
  const q = `This image is a grid. The panel labelled REF shows a reference character. Panels ${L.join(", ")} are new drawings. For each new drawing, rate from 1 to 10 how clearly it shows the SAME character as REF: same face, eyes, hair, colours, accessories such as glasses or hats, and the same art style. 10 means unmistakably the same character, 1 means a different character. Ignore pose, background and props. Reply with JSON only, like {${L.map(l => `"${l}":7`).join(",")}}`;
  for (const [m, kind] of GC_VIS) {
    for (let a = 0; a < 2; a++) {
      try {
        const out = kind === "img"
          ? await env.AI.run(m, { messages: [{ role: "user", content: q }], image: Array.from(png), max_tokens: 60, temperature: 0 })
          : await env.AI.run(m, { messages: [{ role: "user", content: [{ type: "text", text: q }, { type: "image_url", image_url: { url: "data:image/png;base64," + gcB64(png) } }] }], max_tokens: 60, temperature: 0 });
        const txt = typeof out === "string" ? out : (out && (out.response || (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content))) || "";
        const js = typeof txt === "object" ? txt : JSON.parse((String(txt).match(/\{[^{}]*\}/) || ["{}"])[0]);
        if (L.every(l => js[l] != null && +js[l] > 0)) { lg.scorer = m; return L.map(l => Math.max(1, Math.min(10, +js[l]))); }
        break;
      } catch (e) {
        if (gcQuota(e)) return null;
        if (a === 0 && /agree/i.test(String(e && e.message || e))) { try { await env.AI.run(m, { prompt: "agree" }); } catch (e2) {} continue; }
        break;
      }
    }
  }
  return null;
}
// no-AI identity hint: colour-histogram overlap of the centre of the image vs the pfp (0..1)
async function gcHistSim(ref, u8) { try { const a = await gcHist(RESVG, ref), b = await gcHist(RESVG, gcUri(u8)); return a.reduce((s, x, j) => s + Math.min(x, b[j]), 0); } catch (e) { return null; } }
async function gcSet(env, fid, o) {
  await gcInit(env);
  await env.DB.prepare("INSERT INTO gcard (fid, ph, st, at, info, a, b) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(fid) DO UPDATE SET ph = ?2, st = ?3, at = ?4, info = ?5, a = ?6, b = ?7")
    .bind(fid, o.ph, o.st, Date.now(), JSON.stringify(o.info || {}).slice(0, 2000), o.a || null, o.b || null).run();
}
async function gcGet(env, fid, tiles) {
  await gcInit(env);
  const r = await env.DB.prepare(tiles ? "SELECT ph, st, at, info, a, b FROM gcard WHERE fid = ?" : "SELECT ph, st, at, info FROM gcard WHERE fid = ?").bind(fid).first();
  if (!r) return null; let info = {}; try { info = JSON.parse(r.info || "{}"); } catch (e) {}
  return { ph: r.ph, st: r.st, at: r.at, info, a: r.a ? new Uint8Array(r.a) : null, b: r.b ? new Uint8Array(r.b) : null };
}
// state for this player's current pfp: ready | run | fail | cap | none
function gcState(row, ph) {
  if (!row || row.ph !== ph) return "none";
  if (row.st === "ok") return "ready";
  if (row.st === "run") return Date.now() - row.at < 120e3 ? "run" : "none";
  if (row.st === "fail") return Date.now() - row.at < 7 * 86400e3 ? "fail" : "none"; // low score / errors: classic card for a week
  if (row.st === "cap") return gmDay(row.at) === gmDay() ? "cap" : "none"; // budget/quota: retry next UTC day
  return "none";
}
// generate both scenes once (runs inside waitUntil). At most: 2 gens + 1 score + 2 retries + 1 score = 165.7 neurons
// the detected paper must be big enough for gcPaperUI to write on (card.mjs svgGameCard1: w>=150, h>=50 wide / 95 tall in card px; 512-units here, ~1.31 card px each)
function gcPaperOk(scr) { if (!scr || !(scr.w > 0)) return false; const w = scr.w * 1.31 * 0.92, h = scr.h * 1.31 * 0.96; return w >= 150 && h >= (w / h > 1.8 ? 50 : 95); }
async function gcGenerate(env, fid, u, ph, noRetry) {
  const lg = { gens: 0, neu: 0, err: [] };
  try {
    if (!env.AI) throw gcErr("no AI binding");
    if (isPreview(env)) throw gcErr("preview: no AI");
    const pfp = await gcPfp(u.p), ref = gcUri(pfp.u8);
    const SC = GC_ONE ? [0] : [0, 1];
    let t = await Promise.all(SC.map(sc => gcGen(env, pfp, sc, lg)));
    let s = t.every(Boolean) ? await gcScore(env, ref, t, lg) : null;
    if (!s) { const h = await Promise.all(t.map(x => x ? gcHistSim(ref, x) : 0)); lg.hist = h.map(v => v == null ? null : Math.round(v * 100) / 100); }
    const low = i => !t[i] || (s ? s[i] <= GC_LOW : lg.hist && lg.hist[i] != null && lg.hist[i] < 0.2);
    const redo = noRetry ? [] : SC.filter(low);
    if (redo.length) {
      const nt = await Promise.all(redo.map(sc => gcGen(env, pfp, sc, lg)));
      const ok = nt.map((x, k) => [redo[k], x]).filter(z => z[1]);
      if (ok.length) {
        const ns = s ? await gcScore(env, ref, ok.map(z => z[1]), lg) : null;
        ok.forEach(([sc, x], k) => {
          if (!t[sc]) { t[sc] = x; if (s) s[sc] = ns ? ns[k] : s[sc]; return; }
          if (s && ns && ns[k] > s[sc]) { t[sc] = x; s[sc] = ns[k]; }
          if (!s) t[sc] = x;
        });
      }
    }
    lg.scores = s;
    if (GC_ONE) t[1] = t[0]; // one wide scene: b mirrors a so stored rows stay valid
    if (!t[0] || !t[1]) throw gcErr("generation failed");
    if (s && s.some(v => v < GC_MIN)) { await gcSet(env, fid, { ph, st: "fail", info: { ...lg, why: "low score" } }); return "fail"; }
    try { lg.scr = await gcScreen(RESVG, gcUri(t[0])); } catch (e) { lg.scr = null; }
    if (!gcPaperOk(lg.scr) && !noRetry && (await gcUsed(env)) + GC_GEN <= GC_CAP) { // guard (2026-11-19): no usable paper -> one more try
      const x = await gcGen(env, pfp, 0, lg); let xs = null; if (x) { try { xs = await gcScreen(RESVG, gcUri(x)); } catch (e) {} }
      if (x && gcPaperOk(xs)) { t[0] = x; if (GC_ONE) t[1] = x; lg.scr = xs; lg.paperRetry = 1; }
    }
    if (!gcPaperOk(lg.scr)) { await gcSet(env, fid, { ph, st: "fail", info: { ...lg, why: "no paper" } }); return "fail"; } // never ship a blank-paper card
    await gcSet(env, fid, { ph, st: "ok", info: lg, a: t[0], b: t[1] });
    return "ok";
  } catch (e) {
    const q = e && e.quota;
    lg.why = String(e && e.message || e).slice(0, 160);
    try { await gcSet(env, fid, { ph, st: q ? "cap" : "fail", info: lg }); } catch (e2) {}
    return q ? "cap" : "fail";
  }
}
async function gcPrep(env, req, url, ctx) {
  if (req.method === "POST") {
    const fid = await qaFid(req, url); if (!fid) return J({ st: "auth" }, 401, { "cache-control": "no-store" });
    const u = await fcUser(fid); if (!u.p) return J({ st: "fail" }, 200, { "cache-control": "no-store" });
    const ph = gcPh(u); const row = await gcGet(env, fid); const s = gcState(row, ph);
    if (s !== "none") return J({ st: s, v: s === "ready" ? ph : undefined }, 200, { "cache-control": "no-store" });
    if (isPreview(env)) return J({ st: "fail" }, 200, { "cache-control": "no-store" });
    if ((await gcUsed(env)) + 2 * GC_GEN + GC_SCORE > GC_CAP) { await gcSet(env, fid, { ph, st: "cap", info: { why: "cap" } }); return J({ st: "cap" }, 200, { "cache-control": "no-store" }); }
    await gcSet(env, fid, { ph, st: "run", info: {} });
    ctx.waitUntil(gcGenerate(env, fid, u, ph));
    return J({ st: "run" }, 200, { "cache-control": "no-store" });
  }
  const fid = +(url.searchParams.get("fid") || 0); if (!(fid > 0 && fid < 1e9)) return J({ error: "bad" }, 400);
  const row = await gcGet(env, fid);
  const st = !row ? "none" : row.st === "ok" ? "ready" : row.st === "run" && Date.now() - row.at < 120e3 ? "run" : row.st;
  return J({ st, v: st === "ready" ? row.ph : undefined }, 200, { "cache-control": "no-store" });
}
function gcGameDay(no) { return gmDay(GM_START + (Math.max(1, no) - 1) * DAY); }
async function gcAdmin(env, ctx, url, req) {
  const fid = +(url.searchParams.get("fid") || 0), d = url.searchParams.get("do") || "status";
  if (d === "used") return J({ day: gmDay(), used: await gcUsed(env), cap: GC_CAP });
  if (!(fid > 0)) return J({ error: "fid" }, 400);
  const u = await fcUser(fid), ph = gcPh(u), row = await gcGet(env, fid);
  if (d === "status") return J({ fid, ph, state: gcState(row, ph), row: row && { ph: row.ph, st: row.st, at: row.at, info: row.info }, used: await gcUsed(env), cap: GC_CAP });
  if (d === "reset") { await gcInit(env); await env.DB.prepare("DELETE FROM gcard WHERE fid = ?").bind(fid).run(); return J({ ok: 1 }); }
  if (d === "gen") { await gcSet(env, fid, { ph, st: "run", info: {} }); const r = await gcGenerate(env, fid, u, ph, url.searchParams.get("noretry") === "1"); const n = await gcGet(env, fid); return J({ r, info: n && n.info, used: await gcUsed(env) }); }
  if (d === "tiles" && req && req.method === "POST") { // test only: install two posted images (multipart a, b) as this player's tiles, no AI
    const f = await req.formData(); const a = f.get("a"), b = f.get("b") || (GC_ONE ? a : null); if (!a || !b) return J({ error: "a,b" }, 400);
    const A = new Uint8Array(await a.arrayBuffer()), B = new Uint8Array(await b.arrayBuffer());
    let scr = null; try { scr = await gcScreen(RESVG, gcUri(A)); } catch (e) {}
    await gcSet(env, fid, { ph, st: "ok", info: { test: 1, scr }, a: A, b: B }); return J({ ok: 1, ph, scr });
  }
  return J({ error: "do=status|gen|reset|used|tiles" }, 400);
}

async function sdkJs(req, env, ctx) {
  const ck = new Request("https://folio.cache/js/sdk-040.mjs"), c = caches.default;
  let r = await c.match(ck); if (r) return r;
  const v = await env.KV.get("js:sdk-040", { type: "arrayBuffer", cacheTtl: 86400 });
  if (!v) return Response.redirect("https://esm.sh/@farcaster/miniapp-sdk@0.4.0/es2020/miniapp-sdk.bundle.mjs", 302);
  r = new Response(v, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=604800, immutable", "access-control-allow-origin": "*" } });
  ctx.waitUntil(c.put(ck, r.clone()));
  return r;
}
// ==== ZERO HOUR (sealed texts) START ====
// 2026-11-19. A writer seals a title + body until a date (1 day to 1 year). The body is stored only in its own key
// (<P>b:<id>) and is read ONLY by slBodyIfOpen(), which returns null unless now >= openAt and the seal was not withdrawn.
// Index <P>idx holds everything public (title, writer, dates, fingerprint, remind-me fids, votes). Withdraw only before
// the half-way point (sealedAt + (openAt - sealedAt) / 2), enforced here. Preview uses its own prefix so test seals never show on live.
const ZH_TMAX = 120, ZH_TMIN = 3, ZH_BMIN = 20, ZH_BMAX = 10000, ZH_DAYCAP = 3;
const slP = env => isPreview(env) ? "slp:" : "sl:";
const slHalf = x => x.sa + (x.oa - x.sa) / 2;
const slSt = (x, t) => x.wd ? "wd" : (t || Date.now()) >= x.oa ? "open" : "sealed";
async function slLoad(env) { const v = await env.KV.get(slP(env) + "idx", "json"); return Array.isArray(v) ? v : []; }
async function slSave(env, a) { await env.KV.put(slP(env) + "idx", JSON.stringify(a)); }
async function slBodyIfOpen(env, x) { if (slSt(x) !== "open") return null; const b = await env.KV.get(slP(env) + "b:" + x.id); return typeof b === "string" ? b : null; }
async function slSha(s) { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join(""); }
async function slUser(env, fid) {
  const ck = "cu:" + fid; let u = null; try { u = await env.KV.get(ck, "json"); } catch (e) {}
  if (!u || !u.u) { const f = await fcUser(fid); if (f.u) { u = f; try { if (!isPreview(env)) await env.KV.put(ck, JSON.stringify(u), { expirationTtl: 86400 }); } catch (e) {} } }
  return u || { u: "", n: "", p: "" };
}
// public shape: never contains the body
function slPub(x, fid) {
  const st = slSt(x), r = x.r || {}, wa = Object.values(r).filter(Boolean).slice(-3);
  const o = { id: x.id, t: x.t, w: { fid: x.fid, u: x.u, n: x.n, p: x.p }, sa: x.sa, oa: x.oa, half: slHalf(x), st, pred: !!x.pred, n: Object.keys(r).length, wa };
  if (st === "open") { o.fp = x.fp; if (x.pred) o.votes = { r: Object.keys((x.v && x.v.r) || {}).length, w: Object.keys((x.v && x.v.w) || {}).length }; }
  if (st === "wd") o.wdAt = x.wd;
  if (fid) { o.mine = fid === x.fid; o.rem = !!r[fid]; if (x.pred && x.v) o.my = x.v.r && x.v.r[fid] ? "r" : x.v.w && x.v.w[fid] ? "w" : ""; }
  return o;
}
async function slFidOf(env, req, url) {
  // preview-only test hook (admin key): lets the e2e test act as a fid without a Farcaster token. Never on live.
  if (isPreview(env) && env.ADMIN_KEY && url.searchParams.get("k") === env.ADMIN_KEY && +req.headers.get("x-zh-fid") > 0) return +req.headers.get("x-zh-fid");
  return await qaFid(req, url);
}
async function slApi(env, req, url) {
  const NC = { "cache-control": "private, no-store" };
  const fid = (req.headers.get("authorization") || req.headers.get("x-zh-fid")) ? await slFidOf(env, req, url) : 0;
  if (req.method === "GET") {
    const all = await slLoad(env); const id = url.searchParams.get("id");
    if (id) {
      const x = all.find(s => s.id === id); if (!x) return J({ error: "not found" }, 404, NC);
      const o = slPub(x, fid); const b = await slBodyIfOpen(env, x);
      if (b !== null) { o.b = b; o.fpOk = (await slSha(x.t + "\n" + b)) === x.fp; }
      return J(o, 200, NC);
    }
    const nowT = Date.now();
    const items = all.map(x => slPub(x, fid));
    const opened = all.filter(x => slSt(x, nowT) === "open").sort((a, b) => b.oa - a.oa).slice(0, 20);
    const bodies = {}; await Promise.all(opened.map(async x => { const b = await slBodyIfOpen(env, x); if (b !== null) bodies[x.id] = b; }));
    for (const o of items) if (o.st === "open" && bodies[o.id] != null) o.b = bodies[o.id];
    return J({ now: nowT, items }, 200, NC);
  }
  if (req.method !== "POST") return J({ error: "bad" }, 405);
  if (!fid) return J({ error: "auth" }, 401);
  let q = {}; try { q = await req.json(); } catch (e) {}
  const nowT = Date.now(); const P = slP(env);
  if (q.do === "seal") {
    const t = String(q.t || "").replace(/\s+/g, " ").trim(), b = String(q.b || "").replace(/\r\n?/g, "\n").trim(), oa = Math.round(+q.oa || 0);
    if (t.length < ZH_TMIN || t.length > ZH_TMAX) return J({ error: "title", msg: "Title must be 3 to 120 characters." }, 400);
    if (b.length < ZH_BMIN || b.length > ZH_BMAX) return J({ error: "body", msg: "Text must be 20 to 10,000 characters." }, 400);
    let test = 0; if (isPreview(env) && req.headers.get("x-zh-fid") && +q.testSec > 0) test = Math.min(+q.testSec, 86400) * 1000; // preview e2e only: short seals
    if (!test && (!(oa > 0) || oa < nowT + DAY - 6e5 || oa > nowT + 366 * DAY)) return J({ error: "date", msg: "Pick an open date between 1 day and 1 year from now." }, 400);
    const rk = P + "rl:" + fid + ":" + new Date(nowT).toISOString().slice(0, 10); const rc = +(await env.KV.get(rk) || 0);
    if (rc >= ZH_DAYCAP) return J({ error: "limit", msg: "You can seal up to 3 texts a day." }, 429);
    const u = await slUser(env, fid);
    const id = [...crypto.getRandomValues(new Uint8Array(6))].map(v => v.toString(16).padStart(2, "0")).join("");
    const fp = await slSha(t + "\n" + b);
    const x = { id, t, fid, u: u.u || "fid" + fid, n: u.n || "", p: u.p || "", sa: nowT, oa: test ? nowT + test : oa, fp, pred: !!q.pred, r: {}, v: { r: {}, w: {} } };
    await env.KV.put(P + "b:" + id, b);
    const all = await slLoad(env); all.push(x); await slSave(env, all);
    await env.KV.put(rk, String(rc + 1), { expirationTtl: 2 * 86400 });
    return J({ ok: 1, id, fp, oa: x.oa, sa: x.sa, half: slHalf(x) });
  }
  const all = await slLoad(env); const x = all.find(s => s.id === String(q.id || "")); if (!x) return J({ error: "not found" }, 404);
  const st = slSt(x, nowT);
  if (q.do === "rem") {
    if (st !== "sealed") return J({ error: "closed" }, 409); if (fid === x.fid) return J({ error: "own" }, 403);
    x.r = x.r || {}; let on;
    if (x.r[fid] !== undefined) { delete x.r[fid]; on = false; } else { const u = await slUser(env, fid); x.r[fid] = u.p || ""; on = true; }
    await slSave(env, all); return J({ ok: 1, on, ...slPub(x, fid) });
  }
  if (q.do === "wd") {
    if (fid !== x.fid) return J({ error: "own" }, 403); if (st !== "sealed") return J({ error: "closed" }, 409);
    if (Date.now() >= slHalf(x)) return J({ error: "locked", msg: "Past the half-way point. This one opens no matter what." }, 403);
    x.wd = nowT; delete x.fp; await env.KV.delete(P + "b:" + x.id); await slSave(env, all);
    return J({ ok: 1, ...slPub(x, fid) });
  }
  if (q.do === "vote") {
    if (!x.pred || st !== "open") return J({ error: "closed" }, 409); if (fid === x.fid) return J({ error: "own" }, 403);
    const v = q.v === "r" ? "r" : q.v === "w" ? "w" : ""; if (!v) return J({ error: "bad" }, 400);
    x.v = x.v || { r: {}, w: {} }; x.v.r = x.v.r || {}; x.v.w = x.v.w || {};
    if (x.v.r[fid] || x.v.w[fid]) return J({ error: "voted", ...slPub(x, fid) }, 409);
    x.v[v][fid] = 1; await slSave(env, all); return J({ ok: 1, ...slPub(x, fid) });
  }
  return J({ error: "bad" }, 400);
}
// cron: mark due seals opened and notify every Remind-me fid once (Folio's existing subs/notification tokens)
async function slTick(env, origin) {
  const all = await slLoad(env); const nowT = Date.now();
  const due = all.filter(x => !x.wd && !x.op && nowT >= x.oa).slice(0, 3); if (!due.length) return 0;
  for (const x of due) x.op = nowT; await slSave(env, all);
  if (isPreview(env)) return due.length;
  const subs = await subsOf(env);
  for (const x of due) {
    const byUrl = {}; for (const f of Object.keys(x.r || {})) { const d = subs[f]; if (d) (byUrl[d.url] = byUrl[d.url] || []).push(d.token); }
    for (const [u, toks] of Object.entries(byUrl)) for (let i = 0; i < toks.length; i += 100) await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notificationId: ("folio-zh-" + x.id).slice(0, 128), title: "Zero Hour just opened", body: ("Zero Hour: " + x.t + " by @" + x.u + " just opened").slice(0, 128), targetUrl: origin + "/?seal=" + x.id, tokens: toks.slice(i, i + 100) }) }).catch(() => {});
  }
  return due.length;
}
// share image /zh/<id>.png?h=<hour bucket>: 3:2 static PNG via card.mjs + resvg; cached per hour bucket
async function slCard(env, id, url, ctx) {
  const H = { "content-type": "image/png", "cache-control": "public, max-age=900" };
  try {
    const x = (await slLoad(env)).find(s => s.id === id); if (!x) return new Response("not found", { status: 404 });
    const ck = new Request(url.origin + "/zh/" + id + ".png?h=" + Math.floor(Date.now() / 36e5) + "&s=" + slSt(x) + "&n=" + Object.keys(x.r || {}).length);
    try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
    if (!FONTS) FONTS = (await Promise.all(["NSerifB", "NSans", "NSansB"].map(f => env.KV.get("font:" + f, "arrayBuffer")))).map(b => new Uint8Array(b));
    const pf = await ogData(x.p, 128).catch(() => null);
    const png = await renderSealCard(RESVG, FONTS, { st: slSt(x), title: x.t, user: x.u, name: x.n, pfp: pf, left: x.oa - Date.now(), oa: x.oa, n: Object.keys(x.r || {}).length });
    const res = new Response(png, { headers: H }); try { ctx.waitUntil(caches.default.put(ck, res.clone())); } catch (e) {}
    return res;
  } catch (e) {
    const v = await env.KV.get("img:embed.png", "arrayBuffer");
    return new Response(v, { headers: { "content-type": "image/png", "cache-control": "public, max-age=300" } });
  }
}
async function slMeta(env, origin, id) {
  const x = (await slLoad(env)).find(s => s.id === id); if (!x) return null; const st = slSt(x);
  const d = new Date(x.oa).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return { title: "Zero Hour: " + x.t + " by @" + x.u + " | Folio", desc: st === "open" ? "Opened on Folio. Read it now." : st === "wd" ? "Withdrawn by the writer." : "Sealed on Folio. Nobody can read it before " + d + ".", img: origin + "/zh/" + x.id + ".png?h=" + Math.floor(Date.now() / 36e5), btn: st === "open" ? "Read it now" : "See countdown", target: origin + "/?seal=" + x.id };
}
// ==== ZERO HOUR (sealed texts) END ====
export default {
  async fetch(req, env, ctx) {
    if (new URL(req.url).pathname === "/js/sdk-040.mjs") return sdkJs(req, env, ctx); // audit 2026-11-18: self-hosted miniapp-sdk 0.4.0 bundle (KV js:sdk-040)
    env = withStore(env);
    if (isPreview(env) && new URL(req.url).pathname === "/api/d1selftest") { const K = env.KV, r = {}, url0 = new URL(req.url); try { const k = "zz-d1t:" + Date.now(); await K.put(k, JSON.stringify({ a: 1 }), { expirationTtl: 600, metadata: { ts: 5 } }); r.json = await K.get(k, "json"); r.text = await K.get(k); r.meta = (await K.getWithMetadata(k)).metadata; r.list = (await K.list({ prefix: "zz-d1t:" })).keys.length; await K.delete(k); r.afterDel = await K.get(k); r.kvFallback = !!(await K.get("lrc")) || "nolrc"; r.hybrid = !!K.__hybrid; if (url0.searchParams.get("big") === "1") { const B = {}; const mk = (n) => { let s = ""; const u = "folio \u0641\u0627\u0631\u0633\u06cc \u4e2d\u6587 \ud83d\ude00 "; while (s.length < n) s += u + s.length + " "; return JSON.stringify({ s: s.slice(0, n) }); }; for (const [nm, n] of [["one", 1000000], ["multi", 2600000]]) { const k = "zz-d1big:" + nm + ":" + Date.now(); const v = mk(n); const t0 = Date.now(); const w1 = await K.putBig(k, v, null, Math.floor(Date.now() / 1000) + 600); const t1 = Date.now(); D1_CACHE.delete(k); const g = await K.get(k); const t2 = Date.now(); const g2 = await K.get(k); const t3 = Date.now(); const w2 = await K.putBig(k, v, null, Math.floor(Date.now() / 1000) + 600); const info = await env.DB.prepare("SELECT v FROM kv WHERE k = ?").bind(k).first(); B[nm] = { chars: v.length, w1, w2, equal: g === v, cachedEqual: g2 === v, putMs: t1 - t0, coldGetMs: t2 - t1, warmGetMs: t3 - t2, hd: info && info.v }; await K.delete(k); B[nm].afterDel = await K.get(k); } r.big = B; } if (url0.searchParams.get("idx") === "1") { const live = await env.KV.get("index"); const k = "zz-d1idx:" + Date.now(); const t0 = Date.now(); const w = await K.putBig(k, live, null, Math.floor(Date.now() / 1000) + 600); const t1 = Date.now(); D1_CACHE.delete(k); const g = await K.get(k, "json"); const t2 = Date.now(); const g2 = await K.get(k, "json"); const t3 = Date.now(); r.idx = { chars: live && live.length, items: g && Object.keys(g.items || {}).length, w, equal: JSON.stringify(g) === live, putMs: t1 - t0, coldGetParseMs: t2 - t1, warmGetParseMs: t3 - t2 }; await K.delete(k); } } catch (e) { r.err = String(e && e.stack || e); } return J(r, 200, { "cache-control": "no-store" }); }
    const url = new URL(req.url);
    const origin = url.origin;
    const p = url.pathname;
    try {
      if (p === "/.well-known/farcaster.json") return J(manifest(env, origin), 200, { "cache-control": "public, max-age=300" });
      if (p === "/api/feed") return await feed(env, url, ctx);
      if (p === "/api/replies") {
        const h = url.searchParams.get("h") || "";
        if (!/^0x[0-9a-fA-F]{40}$/.test(h)) return J({ error: "bad hash" }, 400);
        const ck = new Request(url.origin + "/api/replies?h=" + h.toLowerCase());
        try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
        let out = { n: 0, l: [] };
        try {
          const d = await fcGet("/v2/thread-casts?castHash=" + h + "&limit=15");
          const cs = (d.result && d.result.casts) || [];
          const root = cs.find(c => c.hash === h);
          const rs = cs.filter(c => c.parentHash === h && c.author && (c.text || "").trim());
          out = { n: Math.max(root && root.replies ? root.replies.count || 0 : 0, rs.length), l: rs.slice(0, 3).map(c => ({ h: c.hash, f: c.author.fid, u: c.author.username, n: c.author.displayName, p: c.author.pfp && c.author.pfp.url, t: String(c.text).replace(/\s+/g, " ").slice(0, 220) })) };
        } catch (e) {}
        const res = J(out, 200, { "cache-control": "public, max-age=300" });
        try { ctx.waitUntil(caches.default.put(ck, res.clone())); } catch (e) {}
        return res;
      }
      if (p === "/api/article") {
        const h = url.searchParams.get("h") || "";
        if (!/^0x[0-9a-fA-F]{40,64}$/.test(h)) return J({ error: "bad hash" }, 400);
        let b = null; try { b = await getBody(env, h); } catch (e) {}
        if (!b || !b.article || !b.author) return J({ error: "not found" }, 404, { "cache-control": "public, max-age=60" });
        const idx = await loadIndex(env); const x = idx.items[h];
        return J({ article: b.article, author: { fid: b.author.fid, u: b.author.username, n: b.author.displayName, p: b.author.pfp && b.author.pfp.url }, stats: x ? { l: x.l, r: x.r, rp: x.rp, min: x.min } : null, pg: x && x.k === "pg" && x.pg && PG_RE.test(x.pg) ? { url: x.pg, pub: "https://paragraph.com/@" + x.pg.match(PG_RE)[1].replace(/^@/, "") } : null }, 200, { "cache-control": "public, max-age=300" });
      }
      if (p === "/api/read") {
        const h = url.searchParams.get("h") || "", e = url.searchParams.get("e");
        const lg = (url.searchParams.get("l") || "").toLowerCase();
        if (!/^0x[0-9a-fA-F]{40,64}$/.test(h) || !/^(open|done|tr)$/.test(e) || (e === "tr" && !LANGS[lg])) return J({ error: "bad" }, 400);
        const k = "rd:" + h; const c = (await env.KV.get(k, "json")) || { o: 0, d: 0 };
        if (e === "open") { c.o++; const dy = new Date().toISOString().slice(0, 10); c.w = c.w || {}; c.w[dy] = (c.w[dy] || 0) + 1; const cut = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10); for (const q in c.w) if (q < cut) delete c.w[q]; } else if (e === "done") c.d++; else { c.t = c.t || {}; c.t[lg] = (c.t[lg] || 0) + 1; }
        if (!isPreview(env)) await env.KV.put(k, JSON.stringify(c), { expirationTtl: 40 * 86400 });
        return J({ ok: 1 });
      }
      if (p === "/api/game") return await gameApi(env, req, url); if (p === "/api/wm") return await wmApi(env, req, url); if (p === "/api/fin" && req.method === "POST") return await finApi(env, req, url); if (p === "/api/loyal") return await loyalApi(env, req, url); if (p === "/api/anon") return await anonApi(env, req, url); if (p === "/api/coin") return await coinApi(env, req, url); if (p === "/api/hold") return await holdApi(env, req, url);
      if (p === "/api/support") return await supApi(env, req, url); if (p === "/api/seen") return await seenApi(env, req, url); if (p === "/api/rate") return await rateApi(env, req, url); if (p === "/api/hl") return await hlApi(env, req, url); if (p === "/api/hlsearch") return await hlSearch(env, url); if (p === "/api/report") return await repApi(env, req, url); if (p === "/api/dbg") return new Response(null, { status: 204 }); /* debug beacons removed 2026-11-18; old cached pages may still send them */ if (p === "/terms") return new Response(TERMS_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } }); if (p === "/api/news") return J(((n) => n.some((x) => x && x.v >= 18) ? n : [{ v: 18, t: "New: Farcaster Updates", s: "Official Farcaster announcements, prizes and winners, all in one place. Find it in the second tab." }, ...n])((await env.KV.get("news", "json")) || []), 200, { "cache-control": "public, max-age=300" });
      if (p === "/api/stats") {
        const h = url.searchParams.get("h") || "", fid = +(url.searchParams.get("fid") || 0);
        const wsum = (c, a, b) => { let s = 0; if (c && c.w) for (const q in c.w) { const ag = Math.floor((Date.now() - Date.parse(q + "T00:00:00Z")) / 86400000); if (ag >= a && ag <= b) s += c.w[q]; } return s; }; const pack = (c) => ({ op: (c && c.o) || 0, rd: (c && c.d) || 0, t: (c && c.t) || {}, wk: wsum(c, 0, 6), pw: wsum(c, 7, 13) });
        if (/^0x[0-9a-fA-F]{40,64}$/.test(h)) return J(pack(await env.KV.get("rd:" + h, "json")), 200, { "cache-control": "public, max-age=60" });
        if (!fid) return J({ error: "bad" }, 400);
        const idx = await loadIndex(env);
        const mine = Object.values(idx.items).filter(x => x.a && x.a.fid === fid).sort((a, b) => b.ts - a.ts).slice(0, 25);
        const out = await Promise.all(mine.map(async x => ({ h: x.h, title: x.title, ts: x.ts, cover: x.cover, l: x.l || 0, r: x.r || 0, rp: x.rp || 0, q: x.q || 0, min: x.min || 1, ...pack(await env.KV.get("rd:" + x.h, "json")) })));
        return J({ a: mine[0] ? mine[0].a : null, items: out }, 200, { "cache-control": "public, max-age=60" });
      }
      if (p === "/api/cast") {
        const h = url.searchParams.get("h") || "";
        if (!/^0x[0-9a-fA-F]{40}$/.test(h)) return J({ error: "bad hash" }, 400);
        let c = await env.KV.get("cast:" + h, "json");
        if (!c) {
          const d = await fcGet("/v2/thread-casts?castHash=" + h + "&limit=1");
          const cs = (d && d.result && d.result.casts) || []; const x = cs.find(k => k.hash === h) || cs[0];
          if (!x || !x.author) return J({ error: "not found" }, 404, { "cache-control": "public, max-age=300" });
          const im = x.embeds && x.embeds.images && x.embeds.images[0];
          c = { u: x.author.username, n: x.author.displayName, p: x.author.pfp && x.author.pfp.url, t: x.text || "", i: im ? im.url : null };
          await env.KV.put("cast:" + h, JSON.stringify(c), { expirationTtl: 86400 });
        }
        return J(c, 200, { "cache-control": "public, max-age=3600" });
      }
      if (p === "/im") return await imRelay(req, url, ctx);
      if (p === "/api/learn") return await learnApi(env);
      if (p === "/api/quiz") return await quizApi(env, req, url);
      if (p === "/api/quizflag") return await quizFlagApi(env, req, url);
      if (p === "/api/learner") return await learnerApi(env, +(url.searchParams.get("fid") || 0));
      if (p === "/api/learnn") { const h = (url.searchParams.get("h") || "").toLowerCase(); const c = (await env.KV.get("lrn", "json")) || {}; return J({ n: c[h] || 0 }, 200, { "cache-control": "public, max-age=120" }); }
      if (p === "/api/updates") return await fcuApi(env, ctx);
      if (p === "/api/parts") return await fcpApi(env, ctx);
      if (p === "/api/suggest") return await suggestApi(env, req);
      if (p === "/api/requests") return await rqApi(env, req, url, ctx);
      if (p === "/api/ask") return await askApi(env, req, url);
      if (p === "/admin/ask" && url.searchParams.get("k") === env.ADMIN_KEY) return await askApi(env, req, url, +(url.searchParams.get("f") || 999999999));
      if (p === "/api/summary") return await summary(env, url.searchParams.get("h") || "", url.searchParams.get("lang") || "en");
      if (p === "/api/following") return await following(env, url.searchParams.get("fid") || "", ctx, origin);
      if (p === "/api/translate") return await translate(env, url.searchParams.get("h") || "", url.searchParams.get("lang") || "", url.searchParams.get("part"));
      if (p === "/webhook" && req.method === "POST") return webhook(env, req);
      if (p.startsWith("/cover/")) return await coverCard(env, +p.slice(7).replace(/\.png$/, ""), ({ p: "p", s: "s" })[url.searchParams.get("f")] || "l", ctx);
      if (p === "/api/cover") { const f = +(url.searchParams.get("fid") || 0); if (!(f > 0)) return J({ error: "bad" }, 400); const d = await coverData(env, f); delete d.pfpUrl; return J(d, 200, { "cache-control": "no-store" }); }
      if (p === "/admin/urfill" && url.searchParams.get("k") === env.ADMIN_KEY) return J(await urFill(env));
      if (p.startsWith("/q/")) return await quoteCard(env, p.slice(3).replace(/\.png$/, ""), url.searchParams.get("t") || "", ctx);
      if (p.startsWith("/gc/")) return await gameCard(env, +p.slice(4).replace(/\.png$/, ""), url, ctx);
      if (p.startsWith("/og/")) return await ogCard(env, p.slice(4).replace(/\.png$/, ""), ctx);
      if (p.startsWith("/music/")) {
        const k = p.slice(7).replace(/\.mp3$/, ""); if (!/^(lofi|piano|ambient)$/.test(k)) return new Response("not found", { status: 404 });
        const v = await env.KV.get("mus:" + k, "arrayBuffer", { cacheTtl: 86400 });
        if (!v) return new Response("not found", { status: 404 });
        const n = v.byteLength, h = { "content-type": "audio/mpeg", "accept-ranges": "bytes", "cache-control": "public, max-age=604800", "access-control-allow-origin": "*" };
        const rg = (req.headers.get("range") || "").match(/bytes=(\d*)-(\d*)/);
        if (rg && (rg[1] || rg[2])) { let a = rg[1] ? +rg[1] : n - +rg[2], b = rg[1] && rg[2] ? Math.min(+rg[2], n - 1) : n - 1; if (a >= n || a > b) return new Response(null, { status: 416, headers: { "content-range": "bytes */" + n } }); return new Response(v.slice(a, b + 1), { status: 206, headers: { ...h, "content-range": `bytes ${a}-${b}/${n}`, "content-length": String(b - a + 1) } }); }
        return new Response(v, { headers: { ...h, "content-length": String(n) } });
      }
      if (p.startsWith("/img/")) {
        const v = await env.KV.get("img:" + p.slice(5), "arrayBuffer");
        if (!v) return new Response("not found", { status: 404 });
        return new Response(v, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
      }
      if (p === "/admin/ai" && url.searchParams.get("k") === env.ADMIN_KEY) { try { const t0 = Date.now(); const out = await trU(env, url.searchParams.get("t"), url.searchParams.get("l") || "es", url.searchParams.get("m")); return J({ ...out, ms: Date.now() - t0 }); } catch (e) { return J({ err: String(e && e.message || e) }); } }
      if (p === "/admin/seed" && req.method === "POST" && url.searchParams.get("k") === env.ADMIN_KEY) { const b = await req.json(); return J(await discover(env, false, { enrichOnly: true, hashes: (b.hashes || []).slice(0, 200), writers: (b.writers || []).slice(0, 2000), fans: (b.fans || []).slice(0, 3000) })); }
      if (p === "/admin/store" && (isPreview(env) || url.searchParams.get("k") === env.ADMIN_KEY)) return await d1StoreInfo(env, url);
      if (p === "/admin/run" && url.searchParams.get("k") === env.ADMIN_KEY) return J(await discover(env, url.searchParams.get("dry") === "1"));
      if (p === "/api/gcprep") return await gcPrep(env, req, url, ctx);
      if (p === "/admin/gc" && env.ADMIN_KEY && url.searchParams.get("k") === env.ADMIN_KEY) return await gcAdmin(env, ctx, url, req);
      if (p === "/api/sealed") return await slApi(env, req, url); // Zero Hour
      if (p.startsWith("/zh/")) return await slCard(env, p.slice(4).replace(/\.png$/, ""), url, ctx); // Zero Hour share image
      if (p === "/" || p === "/index.html") return await page(env, origin, url);
      return new Response("not found", { status: 404 });
    } catch (e) {
      if (e && e.nf) return J({ error: "not found" }, 404);
      return J({ error: String(e.message || e) }, 500);
    }
  },
  async scheduled(ev, env, ctx) {
    env = withStore(env);
    if (ev && ev.cron === FCU_CRON) { await fcuRefresh(env).catch(() => {}); return; } // fast Updates check only, nothing else
    if (new Date().getUTCMinutes() < 10) ctx.waitUntil(d1Sweep(env));
    ctx.waitUntil(fcuRefresh(env).catch(() => {})); // fallback if the fast cron is missing; no-op (1 D1 read) when the last check is <90 s old
    await discover(env);
    const d = new Date();
    if (d.getUTCHours() === 14 && !isPreview(env)) {
      ctx.waitUntil(dailyDigest(env, env.ORIGIN || PROD));
    }
    if (!isPreview(env)) ctx.waitUntil(writerPing(env, env.ORIGIN || PROD));
    if (!isPreview(env)) ctx.waitUntil(wmPing(env, env.ORIGIN || PROD).catch(() => {}));
    if (!isPreview(env)) ctx.waitUntil(gmGet(env, gmDay()).catch(() => {}));
    if (!isPreview(env)) ctx.waitUntil(supRemind(env, env.ORIGIN || PROD));
    ctx.waitUntil(slTick(env, env.ORIGIN || PROD).catch(() => {})); // Zero Hour: open due seals, notify Remind-me fids (no sends on preview)
    // topReply disabled 2026-11-14 per user
  }
};

const TERMS_HTML = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Folio \u00b7 Terms and takedown</title><style>body{max-width:680px;margin:0 auto;padding:28px 20px 60px;font:16px/1.6 Georgia,serif;color:#1d1b16;background:#f3eee6}h1{font-size:30px;margin:0 0 4px}h2{font:700 15px system-ui,sans-serif;letter-spacing:.5px;text-transform:uppercase;margin:28px 0 6px}p,li{margin:6px 0}.m{color:#6b665c;font:14px system-ui,sans-serif}a{color:#a3361f}@media(prefers-color-scheme:dark){body{background:#15140f;color:#ece6da}.m{color:#a59f93}}</style></head><body><a class=\"m\" href=\"/\">\u2190 Back to Folio</a><h1>Terms and takedown</h1><p class=\"m\">Last updated November 14, 2026</p>\n<h2>What Folio is</h2><p>Folio is a reading layer for long-form writing that is already published publicly on Farcaster. Folio does not host, write, or edit articles. Every article and highlighted line is shown with its author and links back to the original source.</p>\n<h2>Who is responsible for content</h2><p>Each writer is responsible for what they publish. Folio shows content as the writer published it, without changes. Folio's own sections and rankings are chosen automatically and filter out spam and low-quality posts, but they are not an endorsement of any claim in an article.</p>\n<h2>What is not allowed</h2><ul><li>Defamation or knowingly false claims about real people</li><li>Harassment, threats, or hate</li><li>Sharing someone's private information</li><li>Copyright infringement</li><li>Spam, scams, or sexual content involving minors</li></ul>\n<h2>Reporting and takedown</h2><p>Every article on Folio has a Report button. Reports are reviewed by a person. Content that breaks these rules is removed from Folio's feeds, search, and article pages as soon as it is confirmed, usually within 24 hours. Removing content from Folio does not delete it from Farcaster; to remove the original, contact the writer or the Farcaster client where it was published.</p><p>If you are the subject of an article and believe it is false or defamatory, report it and include details. You can also ask for removal if you are the writer and no longer want your work shown on Folio.</p>\n<h2>Support payments</h2><p>Supporting a writer sends USDC on Base directly from your wallet to theirs. Folio does not hold funds, takes no fee, and cannot reverse on-chain payments. Support does not renew automatically.</p>\n<h2>Privacy</h2><p>Folio stores the minimum it needs to work: what you highlight, rate, follow, or save, linked to your Farcaster ID, and anonymous reading counts. Folio does not sell data.</p>\n<h2>Changes</h2><p>These terms may be updated as Folio grows. The date above shows the latest version.</p></body></html>";
const HTML = "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#F4EFE6\">\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link rel=\"modulepreload\" href=\"/js/sdk-040.mjs\">\n<script>window._feedP=fetch(\"/api/feed\").then(function(r){if(!r.ok)throw 0;return r.json()}).catch(function(){return null});</script>\n<link rel=\"stylesheet\" media=\"print\" data-m=\"all\" onload=\"this.media=this.dataset.m\" href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Spectral:ital,wght@0,400;0,600;0,700;1,400&display=swap\">\n<link rel=\"icon\" href=\"/img/icon.png\">\n<script>(function(){var t=null;try{t=localStorage.getItem(\"folio.theme\")}catch(e){}if(!t)t=window.matchMedia&&matchMedia(\"(prefers-color-scheme: dark)\").matches?\"dark\":\"light\";document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name=theme-color]');if(m)m.content=t===\"dark\"?\"#17150F\":\"#F4EFE6\"})()</script>\n<!--HEAD-->\n<style>\n:root{--grn:#2E8A5E;--gold:#8C6209;--silver:#4F6478;--bronze:#8B5A2B;--paper:#F4EFE6;--card:#FBF8F2;--ink:#1B1A17;--mute:#6E675C;--line:#E2D9C9;--acc:#A8341C;--title:\"Inter\",-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Arial,sans-serif;--serif:\"Spectral\",\"Iowan Old Style\",\"Palatino Linotype\",Palatino,Georgia,\"Times New Roman\",serif;--sans:\"Inter\",-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial,sans-serif}\n*{box-sizing:border-box}\nhtml,body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased}\na{color:inherit}\n.wrap{max-width:680px;margin:0 auto;padding:0 18px calc(40px + env(safe-area-inset-bottom))}\nheader.top{padding:22px 0 10px;border-bottom:2px solid var(--ink);display:flex;align-items:flex-end;justify-content:space-between;gap:12px}\n.mast{font-family:var(--serif);font-size:34px;font-weight:700;letter-spacing:-.5px;line-height:1}\n.mast small{display:block;font-family:var(--sans);font-size:11px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:var(--mute);margin-top:6px}\n.date{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--mute);text-align:right;line-height:1.5}\nnav.tabs{display:flex;gap:20px;border-bottom:1px solid var(--line);margin-top:2px;overflow-x:auto;scrollbar-width:none}\nnav.tabs button{background:none;border:0;padding:12px 0 10px;font:600 13px var(--sans);letter-spacing:.6px;text-transform:uppercase;color:var(--mute);border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap}\nnav.tabs button.on{color:var(--ink);border-color:var(--acc)}\n.chips{display:flex;gap:8px;padding:12px 0 4px;overflow-x:auto;scrollbar-width:none}\n.chips button{flex:none;border:1px solid var(--line);background:transparent;border-radius:999px;padding:6px 12px;font:500 13px var(--sans);color:var(--mute);cursor:pointer}\n.chips button.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}\n.lead{display:block;text-decoration:none;padding:18px 0 20px;border-bottom:1px solid var(--line);cursor:pointer}\n.lead img{width:100%;aspect-ratio:5/2;object-fit:cover;border-radius:4px;background:var(--line);display:block}\n.lead h2{font-family:var(--title);font-size:26px;line-height:1.2;margin:14px 0 8px;letter-spacing:-.5px}\n.lead p{margin:0 0 10px;color:#3F3B34;font-size:15px;line-height:1.5;font-family:var(--serif)}\n.row{display:grid;grid-template-columns:28px 1fr 84px;gap:12px;padding:16px 0;border-bottom:1px solid var(--line);cursor:pointer;align-items:start}\n.row .n{font-family:var(--serif);font-size:22px;color:var(--acc);line-height:1.1}\n.row h3{font-family:var(--title);font-size:17px;line-height:1.3;margin:0 0 6px;font-weight:600;letter-spacing:-.2px}\n.row img{width:84px;height:62px;object-fit:cover;border-radius:3px;background:var(--line)}\n.row.nocv{grid-template-columns:28px 1fr}\n.by{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--mute);flex-wrap:wrap}\n.by img.pf{width:18px;height:18px;border-radius:50%;object-fit:cover}\n.by b{color:var(--ink);font-weight:600}\n.dot:before{content:\"\\00B7\";margin:0 1px}\n.empty{padding:48px 0;text-align:center;color:var(--mute);font-family:var(--serif);font-size:17px}\n.w{display:grid;grid-template-columns:28px 40px 1fr;gap:12px;padding:14px 0;border-bottom:1px solid var(--line);align-items:center;cursor:pointer}\n.w img{width:40px;height:40px;border-radius:50%;object-fit:cover;background:var(--line)}\n.w .t{font-weight:600;font-size:15px}.w .s{font-size:13px;color:var(--mute);margin-top:2px;font-family:var(--serif)}\n.foot{margin-top:28px;font-size:12px;color:var(--mute);line-height:1.6;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}\n.foot button{background:none;border:1px solid var(--ink);color:var(--ink);border-radius:999px;padding:7px 14px;font:600 12px var(--sans);cursor:pointer}\n/* reader */\n#reader{position:fixed;inset:0;background:var(--paper);overflow-y:auto;display:none;z-index:5}\n#reader.open{display:block}\n.rbar{position:sticky;top:0;background:rgba(244,239,230,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);z-index:2}\n.rbar .in{max-width:680px;margin:0 auto;padding:10px 18px;display:flex;align-items:center;gap:10px}\n.rbar button{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:7px 12px;font:600 13px var(--sans);color:var(--ink);cursor:pointer;white-space:nowrap}\n.rbar .sp{flex:1}\n.rbar button.pri{background:var(--ink);color:var(--paper);border-color:var(--ink)}\n.rbar select{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:7px 8px;font:500 13px var(--sans);color:var(--ink);max-width:120px}\narticle.r{max-width:680px;margin:0 auto;padding:22px 18px 60px}\narticle.r .cov{width:100%;aspect-ratio:5/2;object-fit:cover;border-radius:4px;display:block;background:var(--line)}\narticle.r h1{font-family:var(--title);font-weight:600;font-size:24px;line-height:1.28;letter-spacing:-.4px;margin:20px 0 12px}\narticle.r .by{margin-bottom:22px}\n.md{font-family:var(--serif);font-size:19px;line-height:1.65;color:#25231F}\n.md h1,.md h2,.md h3{font-family:var(--title);letter-spacing:-.3px;line-height:1.25;margin:1.4em 0 .5em}\n.md h2{font-size:24px}.md h3{font-size:20px}.md h4{font-size:18px}.md h1,.md h2,.md h3,.md h4{font-family:var(--title);letter-spacing:-.3px;line-height:1.25;margin:1.4em 0 .5em}\n.castref{display:block}.cc{display:block;border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:1.2em 0;background:var(--card);text-decoration:none;color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.45;font-style:normal}.cc .h{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--mute);margin-bottom:6px}.cc .h img{width:22px;height:22px;border-radius:50%;object-fit:cover;margin:0}.cc .h b{color:var(--ink)}.cc .x{white-space:pre-wrap;overflow-wrap:anywhere}.cc .im{width:100%;max-height:320px;object-fit:cover;border-radius:6px;margin:8px 0 0}\n.md p{margin:0 0 1em}\n.md img{max-width:100%;height:auto;border-radius:4px;display:block;margin:1em auto}\n.md blockquote{margin:1.2em 0;padding:.2em 0 .2em 16px;border-left:3px solid var(--acc);color:#4A453C;font-style:italic}\n.md hr{border:0;border-top:1px solid var(--line);margin:2em auto;width:40%}\n.md code{font-family:ui-monospace,Menlo,monospace;font-size:.85em;background:#EAE3D6;padding:1px 5px;border-radius:3px}\n.md pre{background:#EAE3D6;padding:12px;border-radius:4px;overflow-x:auto;font-size:14px;direction:ltr;text-align:left}\n.md pre code{background:none;padding:0}\n.md table{border-collapse:collapse;width:100%;font-family:var(--sans);font-size:14px;margin:1em 0;display:block;overflow-x:auto}\n.md th,.md td{border-bottom:1px solid var(--line);padding:8px;text-align:start}\n.md a{color:var(--acc);text-decoration-thickness:1px;text-underline-offset:2px;word-break:break-word}\n.md ul,.md ol{padding-inline-start:1.3em;margin:0 0 1em}\n.md li{margin:.3em 0}\n.castref{display:block;border:1px solid var(--line);border-radius:6px;padding:10px 12px;font:500 14px var(--sans);text-decoration:none;color:var(--mute);margin:1em 0;background:var(--card)}\n.note{font:500 12.5px var(--sans);color:var(--mute);background:#EDE6D8;border-radius:6px;padding:9px 12px;margin:0 0 18px;display:flex;justify-content:space-between;gap:10px;align-items:center}\n.note button{background:none;border:0;color:var(--acc);font:600 12.5px var(--sans);cursor:pointer;padding:0}\n.rtl{direction:rtl;text-align:right}\n.rtl.md,.rtl .md,.rtl h1{font-family:\"Noto Sans Arabic\",\"Noto Sans Hebrew\",Tahoma,var(--sans)}\n.rtl.md{font-size:18px;line-height:1.95}\n.rtl .md blockquote,.md.rtl blockquote{border-left:0;border-right:3px solid var(--acc);padding:.2em 16px .2em 0}\n.endbar{max-width:680px;margin:0 auto;padding:0 18px 40px;display:flex;gap:10px;flex-wrap:wrap}\n.endbar button{flex:1;min-width:140px;border:1px solid var(--ink);background:transparent;border-radius:999px;padding:11px;font:600 14px var(--sans);cursor:pointer;color:var(--ink)}\n.endbar button.pri{background:var(--ink);color:var(--paper)}\n.sk{background:linear-gradient(90deg,#ECE5D8 0,#F5F0E7 50%,#ECE5D8 100%);background-size:200% 100%;animation:sk 1.2s infinite;border-radius:4px}\n@keyframes sk{to{background-position:-200% 0}}\n.loading{color:var(--mute);font:500 14px var(--sans);padding:12px 0}\n.badge{display:inline-block;font:600 11px var(--sans);letter-spacing:.4px;text-transform:uppercase;color:var(--acc);border:1px solid var(--acc);border-radius:999px;padding:3px 8px;margin:0 0 8px}\n.lead .badge{margin-top:12px;margin-bottom:0}\n.sv{background:none;border:0;padding:0 2px;margin-left:auto;cursor:pointer;color:var(--mute);font:600 15px var(--sans);line-height:1}\n.sv.on{color:var(--acc)}\n.sv svg{display:block}\n.fl{border:1px solid var(--ink);background:transparent;color:var(--ink);border-radius:999px;padding:4px 10px;font:600 12px var(--sans);cursor:pointer;white-space:nowrap}\n.fl.on{background:var(--ink);color:var(--paper)}\n.w{grid-template-columns:28px 40px 1fr auto}\n.tldr{border:1px solid var(--line);background:var(--card);border-radius:8px;margin:0 0 22px;font-family:var(--sans)}\n.tldr summary{list-style:none;cursor:pointer;padding:10px 14px;font:600 12.5px var(--sans);letter-spacing:.6px;text-transform:uppercase;color:var(--mute);display:flex;justify-content:space-between}\n.tldr summary::-webkit-details-marker{display:none}\n.tldr summary:after{content:\"+\";font-size:16px;line-height:1}\n.tldr[open] summary:after{content:\"\\2013\"}\n.tldr ul{margin:0;padding:0 14px 12px 30px;font-family:var(--serif);font-size:16px;line-height:1.5;color:#3F3B34}\n.tldr li{margin:.25em 0}\n.tldr .loading{padding:0 14px 12px}\n.addp{position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom));max-width:520px;margin:0 auto;background:var(--ink);color:var(--paper);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;z-index:4;box-shadow:0 6px 24px rgba(0,0,0,.18);font:500 14px var(--sans)}\n.addp span{flex:1;line-height:1.35}\n.addp button{border:0;border-radius:999px;padding:8px 12px;font:600 13px var(--sans);cursor:pointer}\n.addp .go{background:var(--paper);color:var(--ink)}\n.addp .x{background:transparent;color:var(--paper);padding:8px 6px;font-size:18px;line-height:1}\n.sub{display:flex;gap:8px;padding:12px 0 4px}\n.rank{font:500 12px var(--sans);color:var(--mute);margin:10px 0 0}\n\nhtml[data-theme=dark]{--grn:#4CBF86;--gold:#E2B54E;--silver:#D6E4F2;--bronze:#D9955A;--paper:#17150F;--card:#1F1C16;--ink:#ECE5D8;--mute:#B8AFA1;--line:#302B23;--acc:#E07A5F;color-scheme:dark}\nhtml[data-theme=dark] .lead p,html[data-theme=dark] .tldr ul{color:#CFC7B8}\nhtml[data-theme=dark] .md{color:#E2DBCD}\nhtml[data-theme=dark] .md blockquote{color:#C2B9A9}\nhtml[data-theme=dark] .md code,html[data-theme=dark] .md pre{background:#2A261F}\nhtml[data-theme=dark] .note{background:#26221B}\nhtml[data-theme=dark] .rbar{background:rgba(23,21,15,.94)}\nhtml[data-theme=dark] .sk{background:linear-gradient(90deg,#24201A 0,#2E2921 50%,#24201A 100%);background-size:200% 100%}\nhtml[data-theme=dark] .md img,html[data-theme=dark] .cov,html[data-theme=dark] .lead img,html[data-theme=dark] .row img{filter:brightness(.9)}\n.row .n{color:var(--mute);opacity:.5;font-weight:400;font-size:19px}.row .n2,.row .n3{opacity:1;font-weight:700;font-size:24px}.row .n2{color:var(--silver)}.row .n3{color:var(--bronze)}\n.top1{display:flex;align-items:center;gap:10px;margin:16px 0 -4px}.top1 .g{font-family:var(--serif);font-size:30px;font-weight:700;color:var(--gold);line-height:1}.top1 .k{font:700 11.5px var(--sans);letter-spacing:1.4px;text-transform:uppercase;color:var(--gold);flex:1;display:flex;align-items:center;gap:10px}.top1 .k:after{content:\"\";flex:1;height:1px;background:var(--gold);opacity:.55}\n.thm{background:var(--card);border:1.5px solid var(--mute);color:var(--ink);border-radius:999px;width:30px;height:30px;padding:0;font:600 15px var(--sans);cursor:pointer;line-height:1;flex:none}\n.hr{display:flex;align-items:flex-end;gap:10px}\n#stories{position:fixed;inset:0;z-index:10;background:#000;display:none;color:#fff;font-family:var(--sans);user-select:none}\n#stories.open{display:block}\n.sto{position:absolute;inset:0;max-width:520px;margin:0 auto;overflow:hidden;background:#111;display:flex;flex-direction:column;padding-top:calc(54px + env(safe-area-inset-top))}\n.sto .bg{position:absolute;inset:-40px;background-size:cover;background-position:center;filter:blur(26px) brightness(.6);transform:scale(1.1)}\n.sto .fg{position:relative;flex:1 1 0;min-height:110px;height:0;width:100%;object-fit:contain;object-position:center;z-index:1;opacity:0;transition:opacity .25s;-webkit-mask-image:linear-gradient(#000 86%,transparent);mask-image:linear-gradient(#000 86%,transparent)}.sto .fg.on{opacity:1}\n.sto .sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.55) 0,rgba(0,0,0,.05) 22%,rgba(0,0,0,.35) 45%,rgba(0,0,0,.92) 78%)}\n.sto .bars{position:absolute;top:calc(10px + env(safe-area-inset-top));left:10px;right:10px;display:flex;gap:4px;z-index:3}\n.sto .bars span{flex:1;height:3px;border-radius:3px;background:rgba(255,255,255,.3);overflow:hidden}\n.sto .bars span i{display:block;height:100%;width:0;background:#fff}\n.sto .hd{position:absolute;top:calc(22px + env(safe-area-inset-top));left:14px;right:14px;display:flex;align-items:center;gap:8px;z-index:3;font:600 13px var(--sans)}\n.sto .hd .lg{font-family:var(--serif);font-weight:700;font-size:18px}.sto .hd .sp{flex:1;opacity:.75;font-weight:500}\n.sto .hd button{background:none;border:0;color:#fff;font-size:26px;line-height:1;cursor:pointer;padding:0 4px}\n.sto.nt .bd h2,.sto.nt .bd .au{display:none}.sto .tcard b{flex:1 1 auto;min-height:0;overflow-wrap:break-word;word-break:normal;hyphens:none}\n.sto .bd{position:relative;flex:none;margin-top:auto;padding:10px 22px calc(20px + env(safe-area-inset-bottom));max-height:calc(100% - 100px);overflow:hidden;display:flex;flex-direction:column;z-index:3}.sto .bd>*{flex:none}.sto .bd ul{flex:0 1 auto;min-height:0;overflow:hidden;-webkit-mask-image:linear-gradient(#000 calc(100% - 18px),transparent);mask-image:linear-gradient(#000 calc(100% - 18px),transparent)}\n@media (max-height:620px){.sto h2{font-size:20px}.sto ul{font-size:13.5px;margin-bottom:10px}.sto li{margin:.25em 0}}\n@media (max-height:760px){.sto h2{font-size:22px;margin-bottom:8px}.sto ul{font-size:14px;line-height:1.4;margin-bottom:12px}.sto .rk{margin-bottom:8px}.sto .rk b{font-size:26px}.sto .au{margin-bottom:10px}.sto .rd{padding:12px}}\n.sto .rk{display:inline-flex;align-items:center;gap:8px;font:700 12px var(--sans);letter-spacing:1.6px;text-transform:uppercase;color:var(--sc);margin-bottom:12px}\n.sto .rk b{font-family:var(--serif);font-size:34px;letter-spacing:0;line-height:1}\n.sto h2{font-family:var(--title);letter-spacing:-.4px;font-size:28px;line-height:1.15;margin:0 0 10px;text-shadow:0 2px 12px rgba(0,0,0,.4)}\n.sto .au{display:flex;align-items:center;gap:8px;font-size:13.5px;opacity:.9;margin-bottom:16px}.sto .au img{width:24px;height:24px;border-radius:50%;object-fit:cover}\n.sto ul{margin:0 0 18px;padding:0 0 0 18px;font-family:var(--sans);font-size:15px;line-height:1.45}.sto li{margin:.35em 0}\n.sto .rd{width:100%;border:0;border-radius:999px;padding:14px;font:700 15px var(--sans);background:#fff;color:#111;cursor:pointer}\n.sto .tp{display:none}.sto .tp.l{left:0}.sto .tp.r{right:0;width:60%}\n.sto .ld{opacity:.7;font-size:14px}\n.sto h2{font-size:calc(28px*var(--fs,1))!important;line-height:1.15!important}.sto ul{font-size:calc(15px*var(--fs,1))!important;line-height:1.42!important}.sto .rk b{font-size:calc(34px*var(--fs,1))!important}.sto .bd ul{-webkit-mask-image:none;mask-image:none}.sto .bd ul.ov{-webkit-mask-image:linear-gradient(#000 calc(100% - 18px),transparent);mask-image:linear-gradient(#000 calc(100% - 18px),transparent)}.sto .fg{min-height:70px!important}.sto ul{list-style:none;padding:0!important;opacity:.9}.sto{background:#0E0E0E!important}.sto .bg,.sto .sh{display:none!important}.sto .fg{-webkit-mask-image:none!important;mask-image:none!important;margin-top:8px}\n.sto .tcard{position:relative;z-index:1;flex:1 1 0;min-height:0;margin:8px 20px 0;background:#F4EFE6;color:#1B1A17;border-radius:14px;padding:26px 22px 18px;display:flex;flex-direction:column;overflow:hidden}.sto .tcard i{display:block;width:34px;height:4px;background:#A8341C;margin-bottom:12px}.sto .tcard .tk{font:700 11.5px var(--sans);letter-spacing:1.3px;text-transform:uppercase;color:#A8341C}.sto .tcard b{display:block;font-family:var(--serif);font-weight:700;font-size:clamp(26px,9vw,44px);line-height:1.1;margin:14px 0 0;overflow:hidden;overflow-wrap:anywhere}.sto .tcard .ta{margin-top:auto;padding-top:14px;border-top:1px solid #D8CFBF;display:flex;align-items:center;gap:10px}.sto .tcard .ta img{width:38px;height:38px;border-radius:50%;object-fit:cover}.sto .tcard .ta strong{display:block;font:700 14px var(--sans)}.sto .tcard .ta em{font:400 12.5px var(--sans);color:#6E675C;font-style:normal}\n.stb .rg .rgt{display:flex;align-items:center;justify-content:center;background:#F4EFE6!important;color:#A8341C;font:700 22px var(--serif)}\n.stb{display:flex;align-items:center;gap:12px;margin:14px 0 2px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card);cursor:pointer}\n.stb{border:1.5px solid var(--grn)!important}.stb .rg{width:46px;height:46px;border-radius:50%;padding:2.5px;background:conic-gradient(from 200deg,#FEDA75,#FA7E1E,#D62976,#962FBF,#D62976,#FA7E1E,#FEDA75);flex:none}\n.stb .rg img,.stb .rg div{width:100%;height:100%;border-radius:50%;object-fit:cover;border:2.5px solid var(--card);background:var(--line)}\n.stb.seen .rg{background:var(--line)}\n.stb b{display:block;font-family:var(--serif);font-size:16px}.stb span{font-size:12.5px;color:var(--mute)}\n.bell{position:relative;background:var(--card);border:1.5px solid var(--mute);color:var(--ink);border-radius:999px;width:30px;height:30px;padding:0;cursor:pointer;flex:none;display:flex;align-items:center;justify-content:center}\n.bell svg{width:15px;height:15px}\n.bell i{position:absolute;top:-3px;right:-3px;min-width:15px;height:15px;border-radius:999px;background:var(--acc);color:#fff;font:700 9.5px/15px var(--sans);font-style:normal;padding:0 3px;border:2px solid var(--paper);display:none}\n.bell.new i{display:block}.bell.new svg{animation:ring 1.6s 1s ease-in-out 2;transform-origin:50% 10%}\n@keyframes ring{0%,100%{transform:rotate(0)}15%{transform:rotate(14deg)}30%{transform:rotate(-12deg)}45%{transform:rotate(8deg)}60%{transform:rotate(-5deg)}75%{transform:rotate(2deg)}}\n.nvh{margin:26px 0 4px;padding-top:16px;border-top:2px solid var(--ink,currentColor)}.nvh b{display:block;font:700 12px var(--sans);letter-spacing:1.4px;text-transform:uppercase;color:var(--acc)}.nvh span{font-size:13px;color:var(--mute)}.nvr .n{font-size:16px;color:var(--acc)}#news{position:fixed;inset:0;z-index:8;display:none;background:rgba(20,18,14,.35)}\n#news.open{display:block}\n.nw{position:absolute;top:96px;right:max(12px,calc(50% - 328px));width:min(340px,calc(100% - 24px));max-height:calc(100% - 120px);display:flex;flex-direction:column;background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.25);overflow:hidden;animation:moIn .3s ease both}.nw .bd{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;flex:1 1 auto;min-height:0}.nw .nx{flex:0 0 auto;margin:0;padding:13px;border:0;border-top:1px solid var(--line);background:none;color:var(--acc);font:600 14px var(--sans);cursor:pointer}@media(max-width:600px){.nw{top:auto;left:0;right:0;bottom:0;width:auto;max-height:78%;border-radius:18px 18px 0 0;border-bottom:0;padding-bottom:env(safe-area-inset-bottom);animation:nwUp .28s ease both}.nw h4{text-align:center}}@keyframes nwUp{from{transform:translateY(100%)}to{transform:none}}\n.nw h4{margin:0;padding:14px 16px 10px;font:700 12px var(--sans);letter-spacing:1.4px;text-transform:uppercase;color:var(--mute);border-bottom:1px solid var(--line)}\n.nw .it{padding:12px 16px;border-bottom:1px solid var(--line)}.nw .it:last-child{border-bottom:0}\n.nw .it b{display:block;font-family:var(--title);letter-spacing:-.2px;font-size:16px;margin-bottom:3px}.nw .it p{margin:0;font-size:13.5px;line-height:1.45;color:var(--mute)}\n.nw .it span{font:600 10.5px var(--sans);letter-spacing:.8px;text-transform:uppercase;color:var(--acc);margin-left:6px}\n#moment{position:fixed;inset:0;z-index:9;display:none;align-items:center;justify-content:center;background:rgba(20,18,14,.55);backdrop-filter:blur(6px);padding:20px}\n#moment.open{display:flex}\n.mo{position:relative;width:100%;max-width:420px;background:var(--paper);border-radius:18px;padding:34px 26px 22px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden;animation:moIn .55s cubic-bezier(.2,1.2,.4,1) both}\n@keyframes moIn{from{transform:translateY(24px) scale(.92);opacity:0}to{transform:none;opacity:1}}\n.mo .x{position:absolute;top:10px;right:12px;background:none;border:0;font-size:22px;color:var(--mute);cursor:pointer}\n.mo .medal{width:132px;height:132px;margin:0 auto 18px;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;border:3px solid var(--mc);background:radial-gradient(circle at 35% 30%,var(--card),var(--paper));animation:moPop .7s .2s cubic-bezier(.2,1.6,.4,1) both}\n.mo .medal:after{content:\"\";position:absolute;inset:-12px;border-radius:50%;border:1px solid var(--mc);opacity:.35;animation:moRing 2.4s .6s ease-out infinite}\n@keyframes moPop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}\n@keyframes moRing{0%{transform:scale(.9);opacity:.5}100%{transform:scale(1.25);opacity:0}}\n.mo .medal b{font-family:var(--serif);font-size:62px;color:var(--mc);line-height:1}\n.mo .medal b small{font-size:26px;vertical-align:top;margin-right:2px}\n.mo .shine{position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.35) 48%,transparent 60%);background-size:250% 100%;animation:moSh 2.8s .9s ease-in-out infinite;pointer-events:none}\n@keyframes moSh{from{background-position:150% 0}to{background-position:-100% 0}}\n.mo .k{font:700 12px var(--sans);letter-spacing:1.8px;text-transform:uppercase;color:var(--mc);margin-bottom:8px}\n.mo h2{font-family:var(--serif);font-size:25px;line-height:1.2;margin:0 0 10px}\n.mo .t{font-family:var(--serif);font-size:16px;color:var(--mute);font-style:italic;margin:0 0 16px;line-height:1.4}\n.mo .st{display:flex;justify-content:center;gap:18px;margin:0 0 20px;font:500 12px var(--sans);color:var(--mute)}\n.mo .st b{display:block;font-family:var(--serif);font-size:22px;color:var(--ink)}\n.mo .bt{display:flex;gap:8px}.mo .bt button{flex:1;border:1px solid var(--ink);background:transparent;color:var(--ink);border-radius:999px;padding:12px;font:600 14px var(--sans);cursor:pointer}\n.mo .bt .pri{background:var(--mc);border-color:var(--mc);color:#fff}\nhtml[data-theme=dark] .mo .bt .pri{color:#17150F}\n.mo i.cf{position:absolute;top:-10px;width:7px;height:12px;border-radius:2px;background:var(--mc);opacity:0;animation:cf 2.6s ease-in forwards}\n@keyframes cf{0%{opacity:0;transform:translateY(0) rotate(0)}10%{opacity:.9}100%{opacity:0;transform:translateY(520px) rotate(540deg)}}\n.fst{font:500 12.5px var(--sans);color:var(--mute);margin:-12px 0 20px;display:flex;gap:6px;flex-wrap:wrap}.fst b{color:var(--ink);font-weight:700}\n.stt{padding:18px 0 6px}.stt h2{font-family:var(--serif);font-size:26px;margin:0 0 4px}.stt p{margin:0;color:var(--mute);font-size:13px}\n.sg{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:14px 0 6px}.sg div{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px}.sg b{display:block;font-family:var(--serif);font-size:24px;color:var(--ink)}.sg span{font-size:11.5px;color:var(--mute);text-transform:uppercase;letter-spacing:.6px}\n.sr{padding:14px 0;border-bottom:1px solid var(--line);cursor:pointer}.sr h3{font-family:var(--title);letter-spacing:-.2px;font-size:17px;margin:0 0 6px;line-height:1.25}.sr .m{font-size:12.5px;color:var(--mute);display:flex;gap:10px;flex-wrap:wrap}.sr .m b{color:var(--ink)}\n.qbtn{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(18px + env(safe-area-inset-bottom));z-index:7;background:var(--ink);color:var(--paper);border:0;border-radius:999px;padding:12px 20px;font:700 14px var(--sans);box-shadow:0 6px 24px rgba(0,0,0,.25);cursor:pointer;display:none}\n#sug{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center;z-index:30}#sug.open{display:flex}#sug .bx{background:var(--paper);color:var(--ink);width:100%;max-width:560px;border-radius:18px 18px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom))}#sug h3{margin:0 0 6px;font:700 18px var(--serif)}#sug p{margin:0 0 12px;font:13px/1.5 var(--sans);color:var(--mute)}#sug input{width:100%;box-sizing:border-box;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font:14px var(--sans)}#sug .row{display:flex;gap:8px;margin-top:12px;justify-content:flex-end}#sug button{border-radius:999px;padding:9px 16px;font:600 13px var(--sans);cursor:pointer;border:1px solid var(--ink);background:none;color:var(--ink)}#sug button.go{background:var(--ink);color:var(--paper)}#sug .msg{min-height:18px;margin-top:10px;font:13px var(--sans)}\n.mi .rw{color:var(--gold);font-style:italic;font-weight:600;letter-spacing:.01em}\n.lead h2{font-size:18px!important;line-height:1.3!important;font-weight:600!important;letter-spacing:-.3px!important;margin:12px 0 8px!important}\n.lead p{font-size:14px!important;line-height:1.5!important;opacity:.85;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}\n.rqh h2{font:600 24px var(--serif);margin:6px 0 4px}.rqh p{margin:0 0 14px;color:var(--mute);font:500 14px/1.45 var(--sans)}\n.rqf{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px;margin:0 0 18px}\n.rqf textarea{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);font:500 15px/1.4 var(--sans);padding:10px;resize:none}\n.rqfr{display:flex;align-items:center;gap:10px;margin-top:8px}.rqfr select{border:1px solid var(--line);border-radius:999px;background:var(--paper);color:var(--ink);font:500 13px var(--sans);padding:7px 10px}\n.rqfr span{margin-left:auto;color:var(--mute);font:500 12px var(--sans)}.rqfr button{background:var(--acc);color:#fff;border:0;border-radius:999px;font:600 14px var(--sans);padding:8px 18px}\n.rqweb{color:var(--mute);font:500 14px/1.45 var(--sans)}\n.rqi{border-top:1px solid var(--line);padding:14px 0}.rqt{margin:0 0 6px;font:600 17px/1.35 var(--serif);color:var(--ink)}\n.rqm{display:flex;flex-wrap:wrap;gap:4px 10px;color:var(--mute);font:500 12.5px var(--sans)}\n.rqc{margin-top:6px;color:var(--grn);font:600 13px var(--sans)}.rqy{margin-top:6px;color:var(--acc);font:600 12.5px var(--sans)}\n.rqa{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px}\n.rqa button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;font:600 13px var(--sans);padding:6px 12px}\n.rqa .rqme.on{background:var(--acc);border-color:var(--acc);color:#fff}.rqa .rqme:disabled{opacity:.7}\n.rqa .rqn{color:var(--mute);font:500 12.5px var(--sans);margin-right:auto}\n.rqlf{gap:8px;margin-top:10px}.rqlf input{flex:1;min-width:0;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);font:500 14px var(--sans);padding:8px 10px}\n.rqlf button{background:var(--acc);color:#fff;border:0;border-radius:999px;font:600 13px var(--sans);padding:7px 14px}\n.rqmsg{color:var(--mute);font:500 12.5px var(--sans);margin-top:6px}.rqmsg:empty{display:none}\n.rqsec{font:600 13px var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--mute);margin:22px 0 4px}\n.rqans{display:block;width:100%;text-align:left;margin-top:10px;border:1px solid var(--line);background:var(--card);border-radius:12px;padding:10px 12px;color:var(--ink)}\n.rqans em{display:block;font:600 12px var(--sans);font-style:normal;color:var(--grn);margin-bottom:3px}.rqans b{font:600 15px/1.35 var(--serif)}\n.rqlb{color:var(--grn);font-weight:600}.rqlab{display:inline-block;margin:14px 0 0;color:var(--grn);font:600 12px var(--sans);letter-spacing:.04em;text-transform:uppercase}\n</style>\n<style>\n.askbar{display:flex;align-items:center;gap:10px;width:100%;margin:14px 0 4px;padding:13px 16px;border:1.5px solid var(--ink);border-radius:999px;background:var(--card);color:var(--mute);font:15px var(--sans);text-align:left;cursor:pointer}\n.askbar b{color:var(--ink);font:700 15px var(--serif);white-space:nowrap}.askbar span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.askbar svg{width:18px;height:18px;flex:none;color:var(--acc)}\n#ask{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center;z-index:31}#ask.open{display:flex}\n#ask .bx{background:var(--paper);color:var(--ink);width:100%;max-width:560px;max-height:88vh;overflow:auto;border-radius:18px 18px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom))}\n#ask h3{margin:0 0 4px;font:700 20px var(--serif)}#ask .sub{margin:0 0 12px;font:13px/1.5 var(--sans);color:var(--mute)}\n#ask .in{display:flex;gap:8px}#ask textarea{flex:1;min-height:46px;max-height:120px;resize:none;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);font:15px/1.4 var(--sans)}\n#ask button{border-radius:999px;padding:9px 16px;font:600 13px var(--sans);cursor:pointer;border:1px solid var(--ink);background:none;color:var(--ink)}#ask button.go{background:var(--ink);color:var(--paper);align-self:flex-end}#ask button:disabled{opacity:.5}\n#ask .ans{margin:16px 0 4px;font:16px/1.6 var(--serif);white-space:pre-wrap}#ask .msg{margin:12px 0 0;font:13px/1.5 var(--sans);color:var(--mute)}\n#ask .k{margin:16px 0 6px;font:700 11px var(--sans);letter-spacing:1.2px;text-transform:uppercase;color:var(--mute)}\n#ask .ar{display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--line);cursor:pointer}#ask .ar img{width:64px;height:44px;border-radius:6px;object-fit:cover;background:var(--line);flex:none}#ask .ar div{min-width:0}#ask .ar b{display:block;font:700 15px/1.3 var(--serif)}#ask .ar span{font:12px var(--sans);color:var(--mute)}\n#ask .ft{display:flex;justify-content:space-between;align-items:center;margin-top:14px;font:12px var(--sans);color:var(--mute)}\n#coverbar{display:none;align-items:center;gap:12px;width:100%;margin:10px 0 2px;padding:10px 14px;border:0;border-radius:14px;background:linear-gradient(100deg,#1B1A17,#3A3125);color:#F4EFE6;font:14px var(--sans);text-align:left;cursor:pointer}\n#coverbar i{flex:none;width:30px;height:40px;border-radius:3px;border:2px solid #D9A82B;background:#2A2722 center/cover no-repeat}\n#coverbar b{display:block;font:700 15px var(--serif)}#coverbar span{font-size:12.5px;color:#BDB5A6}\n.mo.cvm{padding:22px 18px 18px}.cvm .cvi{width:100%;max-width:300px;aspect-ratio:3/4;margin:0 auto 14px;border-radius:6px;background:#2A2722 center/cover no-repeat;box-shadow:0 12px 30px rgba(0,0,0,.35);animation:moPop .7s .1s cubic-bezier(.2,1.4,.4,1) both}\n.cvm .cvi.ld{position:relative;background:linear-gradient(110deg,#2A2722 30%,#3a352d 50%,#2A2722 70%) 0 0/250% 100%;animation:moPop .7s .1s cubic-bezier(.2,1.4,.4,1) both,cvsh 1.2s linear infinite}.cvm .cvi.ld::after{content:\"Printing\u2026\";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:italic 600 14px var(--serif);color:#D9A82B}@keyframes cvsh{to{background-position:-250% 0}}\n.cvm .nx{font:13px var(--sans);color:var(--mute);margin:0 0 14px}.cvm .nx b{color:var(--ink)}\n</style>\n<style>.sptip{display:block;width:100%;padding:13px;border:0;border-radius:12px;background:var(--grn);color:#fff;font:600 16px/1 inherit;font-family:inherit;margin:4px 0 8px;cursor:pointer}.sptip:disabled{opacity:.6}</style><style>#supe{margin:28px 0 8px;padding:22px 20px 20px;border:1px solid var(--line);border-radius:16px;background:var(--card);text-align:center}#supe .sek{font:600 11px/1 var(--sans);letter-spacing:.16em;text-transform:uppercase;color:var(--grn);margin-bottom:14px}#supe .sew{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:12px;text-align:left}#supe .sew img{width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--grn)}#supe .sew b{display:block;font:600 19px/1.2 var(--serif);color:var(--ink)}#supe .sew span{font:13px/1.3 var(--sans);color:var(--mute)}#supe .set{font:italic 15px/1.5 var(--serif);color:var(--mute);margin:0 auto 16px;max-width:30em}#supe .seb{display:block;width:100%;padding:14px;border:0;border-radius:12px;background:var(--grn);color:#fff;font:600 16px/1 var(--sans);cursor:pointer}#supe .seb.on{background:transparent;color:var(--grn);box-shadow:inset 0 0 0 1.5px var(--grn)}</style></head>\n<body>\n<div class=\"wrap\" id=\"home\">\n  <header class=\"top\">\n    <div class=\"mast\">Folio<small>The best long reads on Farcaster</small></div>\n    <div class=\"hr\"><button class=\"bell\" id=\"bell\" aria-label=\"What\\u2019s new\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\"/><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\"/></svg><i id=\"bellc\"></i></button><button class=\"thm\" id=\"thm\" aria-label=\"Switch theme\"></button><div class=\"date\" id=\"date\"></div></div>\n  </header>\n  <button id=\"coverbar\" aria-label=\"Your Folio cover\"><i id=\"coverthumb\"></i><div><b>Your Folio cover</b><span>A magazine cover made from what you read</span></div></button>\n  <nav class=\"tabs\" id=\"tabs\">\n    <button data-t=\"today\" class=\"on\">Today</button>\n    <button data-t=\"week\">This week</button>\n    <button data-t=\"latest\">Latest</button>\n    <button data-t=\"learn\">Learn</button>\n    <button data-t=\"requests\">Requests</button>\n    <button data-t=\"writers\">Writers</button>\n    <button data-t=\"following\">Following</button>\n    <button data-t=\"saved\">Saved</button>     <button data-t=\"hl\">Highlights</button>\n  </nav>\n  <div class=\"chips\" id=\"chips\">\n    <button data-c=\"\" class=\"on\">All</button>\n    <button data-c=\"crypto\">Crypto</button>\n    <button data-c=\"money\">Money</button>\n    <button data-c=\"builders\">Builders</button>\n    <button data-c=\"farcaster\">Farcaster</button>\n    <button data-c=\"culture\">Culture</button>\n    <button data-c=\"life\">Life</button>\n  </div>\n  <main id=\"list\"><div style=\"padding:18px 0\"><div class=\"sk\" style=\"aspect-ratio:5/2\"></div><div class=\"sk\" style=\"height:26px;margin:16px 0 8px;width:80%\"></div><div class=\"sk\" style=\"height:16px;width:60%\"></div></div></main>\n  <div class=\"foot\"><span id=\"meta\"></span><span style=\"display:flex;gap:8px\"><button id=\"sugbtn\">Suggest an article</button><button id=\"statsbtn\" style=\"display:none\">Your stats</button><button id=\"addbtn\" style=\"display:none\">Get the daily pick</button></span></div>\n</div>\n\n<div class=\"addp\" id=\"addp\" style=\"display:none\"><span>Get the daily pick: one great article a day, in your notifications.</span><button class=\"go\" id=\"addgo\">Get the daily pick</button><button class=\"x\" id=\"addx\" aria-label=\"Dismiss\">&times;</button></div>\n\n<div id=\"stories\"><div class=\"sto\" id=\"sto\"></div></div>\n<div id=\"news\"><div class=\"nw\" id=\"nw\"></div></div>\n<div id=\"moment\"><div class=\"mo\" id=\"mo\"></div></div>\n\n<button class=\"qbtn\" id=\"qbtn\">Share quote</button>\n<div id=\"reader\">\n  <div class=\"rbar\"><div class=\"in\">\n    <button id=\"back\" aria-label=\"Back\">&larr; Back</button>\n    <span class=\"sp\"></span>\n    <select id=\"lang\" aria-label=\"Language\"></select>\n    <button id=\"trbtn\" class=\"pri\">Translate</button><button id=\"listen\">Listen</button>\n  </div></div>\n  <article class=\"r\" id=\"art\"></article>\n  <div class=\"endbar\" id=\"endbar\">\n    <button id=\"opencast\" class=\"pri\">Reply on Farcaster</button>\n    <button id=\"share\">Share</button>\n  </div>\n</div>\n\n<script type=\"module\">\nlet sdk=null;\nconst _imp=(u,ms)=>Promise.race([import(u),new Promise((_,j)=>setTimeout(()=>j(new Error(\"slow\")),ms))]);\n/* audit 2026-11-18: SDK served from our own origin (one file, cached), esm.sh only as fallback */\ntry{ sdk=(await _imp(\"/js/sdk-040.mjs\",7000)).sdk; }catch(e){ try{ sdk=(await _imp(\"https://esm.sh/@farcaster/miniapp-sdk@0.4.0\",7000)).sdk; }catch(e2){} }\nconst $=s=>document.querySelector(s);\nconst LANGS={en:\"English\",es:\"Español\",pt:\"Português\",fr:\"Français\",de:\"Deutsch\",it:\"Italiano\",tr:\"Türkçe\",ru:\"Русский\",uk:\"Українська\",zh:\"中文\",ja:\"日本語\",ko:\"한국어\",hi:\"हिन्दी\",id:\"Bahasa Indonesia\",vi:\"Tiếng Việt\",th:\"ไทย\",pl:\"Polski\",nl:\"Nederlands\",he:\"עברית\",bn:\"বাংলা\",tl:\"Filipino\",sw:\"Kiswahili\",ms:\"Bahasa Melayu\",fa:\"فارسی\",ar:\"العربية\",ur:\"اردو\"};\nconst RTL=new Set([\"fa\",\"ar\",\"he\",\"ur\"]);\nlet data=null,tab=\"today\",topic=\"\",cur=null,curLang=null,showingTr=false,ctx=null,fsub=\"writers\",fcFids=null;\nconst store={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};\nconst jget=(k,d)=>{try{return JSON.parse(store.get(k))||d}catch(e){return d}};\nlet saved=jget(\"folio.saved\",{}),follows=jget(\"folio.follows\",{});\nconst isSaved=h=>!!saved[h],isFollow=f=>!!follows[f];\nconst rankOf=h=>{if(!data)return 0;const i=data.today.slice(0,10).findIndex(x=>x.h===h);return i<0?0:i+1};\nconst allItems=()=>{if(!data)return[];const m=new Map();for(const k of[\"today\",\"week\",\"latest\"])for(const x of data[k]||[])if(!m.has(x.h))m.set(x.h,x);return[...m.values()]};\nfunction toggleSave(x){if(saved[x.h])delete saved[x.h];else saved[x.h]={h:x.h,ts:x.ts,title:x.title,cover:x.cover,prev:x.prev,min:x.min,topic:x.topic,pg:x.pg,a:x.a,l:x.l||0,at:Date.now()};store.set(\"folio.saved\",JSON.stringify(saved))}\nfunction toggleFollow(a){if(follows[a.fid])delete follows[a.fid];else follows[a.fid]={fid:a.fid,u:a.u,n:a.n,p:a.p};store.set(\"folio.follows\",JSON.stringify(follows))}\nconst svBtn=x=>`<button class=\"sv${isSaved(x.h)?\" on\":\"\"}\" data-save=\"${esc(x.h)}\" aria-label=\"${isSaved(x.h)?\"Remove from saved\":\"Read later\"}\" title=\"Save for later\"><svg viewBox=\"0 0 24 24\" width=\"17\" height=\"17\" aria-hidden=\"true\"><path d=\"M6 3.5h12a.5.5 0 0 1 .5.5v16.6a.4.4 0 0 1-.65.3L12 16.6l-5.85 4.3a.4.4 0 0 1-.65-.3V4a.5.5 0 0 1 .5-.5z\" fill=\"${isSaved(x.h)?\"currentColor\":\"none\"}\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linejoin=\"round\"/></svg></button>`;\nconst flBtn=a=>`<button class=\"fl${isFollow(a.fid)?\" on\":\"\"}\" data-follow=\"${esc(a.fid)}\">${isFollow(a.fid)?\"Following\":\"Follow\"}</button>`;\nconst badge=h=>{const n=rankOf(h);return n?`<div class=\"badge\">Featured on Folio \\u00B7 #${n} today</div>`:\"\"};\n\n\nconst thm=$(\"#thm\");const drawThm=()=>{const dk=document.documentElement.dataset.theme===\"dark\";thm.textContent=dk?\"\\u2600\":\"\\u263E\";thm.title=dk?\"Light theme\":\"Dark theme\";const m=document.querySelector(\"meta[name=theme-color]\");if(m)m.content=dk?\"#17150F\":\"#F4EFE6\"};\nthm.onclick=()=>{const t=document.documentElement.dataset.theme===\"dark\"?\"light\":\"dark\";document.documentElement.dataset.theme=t;store.set(\"folio.theme\",t);drawThm()};drawThm();\ntry{matchMedia(\"(prefers-color-scheme: dark)\").addEventListener(\"change\",e=>{if(!store.get(\"folio.theme\")){document.documentElement.dataset.theme=e.matches?\"dark\":\"light\";drawThm()}})}catch(e){}\nconst d=new Date();$(\"#date\").innerHTML=d.toLocaleDateString(\"en-US\",{weekday:\"long\"})+\"<br>\"+d.toLocaleDateString(\"en-US\",{month:\"short\",day:\"numeric\",year:\"numeric\"});\nconst esc=s=>String(s??\"\").replace(/[&<>\"']/g,c=>({\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",'\"':\"&quot;\",\"'\":\"&#39;\"}[c]));\nconst ago=t=>{const m=Math.round((Date.now()-t)/60000);if(m<60)return m+\"m\";const h=Math.round(m/60);if(h<24)return h+\"h\";return Math.round(h/24)+\"d\"};\nconst nc=x=>{const m=(x.title||\"\").match(/[\\p{L}\\p{N}]/u);return`<i class=\"nc\" aria-hidden=\"true\">${esc(m?m[0].toUpperCase():\"F\")}</i>`};const img=(u,w)=>!u?\"\":/^https:\\/\\/imagedelivery\\.net\\/[^/]+\\/[^/]+\\/original$/.test(u)?u.replace(/\\/original$/,\"/w=\"+w):/^https:\\/\\/imagedelivery\\.net\\//.test(u)||u.startsWith(location.origin)||!/^https:/.test(u)?u:\"/im?u=\"+encodeURIComponent(u);\n\n// language\nconst sel=$(\"#lang\");\nconst navLang=(navigator.language||\"en\").toLowerCase().split(\"-\")[0];\nlet pref=store.get(\"folio.lang\")||(LANGS[navLang]&&navLang!==\"en\"?navLang:\"es\");\nfor(const [k,v] of Object.entries(LANGS)){const o=document.createElement(\"option\");o.value=k;o.textContent=v;if(k===pref)o.selected=true;sel.appendChild(o)}\nsel.onchange=()=>{pref=sel.value;store.set(\"folio.lang\",pref);if(showingTr)translate()};\n\nconst clip=t=>t.length<200||/[.!?”\"]$/.test(t)?t:t.replace(/\\s+\\S*$/,\"\").replace(/[,;:\\s]+$/,\"\")+\"\\u2026\";\nfunction by(a,extra){return `<div class=\"by\">${a.p?`<img class=\"pf\" src=\"${esc(img(a.p,48))}\" alt=\"\" loading=\"lazy\">`:\"\"}<b>${esc(a.n||a.u)}</b><span>@${esc(a.u)}</span>${extra||\"\"}</div>`}\n\nfunction render(){\n  const L=$(\"#list\");\n  if(!data||tab===\"stats\"){return}\n  $(\"#chips\").style.display=tab===\"writers\"?\"none\":\"flex\";\n  if(tab===\"writers\"){\n    const ws=data.writers;\n    if(!ws.length){L.innerHTML=`<div class=\"empty\">No writers yet.</div>`;return}\n    L.innerHTML=ws.map((w,i)=>`<div class=\"w\" data-h=\"${esc(w.best.h)}\"><div class=\"n\" style=\"font-family:var(--serif);font-size:20px;color:var(--acc)\">${i+1}</div><img src=\"${esc(img(w.a.p,96))}\" alt=\"\" loading=\"lazy\"><div><div class=\"t\">${esc(w.a.n||w.a.u)} <span style=\"color:var(--mute);font-weight:400\">@${esc(w.a.u)}</span></div><div class=\"s\">${w.n} article${w.n>1?\"s\":\"\"} · ${esc(w.best.title)}</div></div>${flBtn(w.a)}</div>`).join(\"\");\n    return;\n  }\n  let src=data[tab]||[],pre=\"\";\n  if(tab===\"saved\"){src=Object.values(saved).sort((a,b)=>(b.at||0)-(a.at||0))}\n  if(tab===\"following\"){\n    const canFc=!!(ctx&&ctx.user&&ctx.user.fid&&fcFids&&fcFids.length);\n    if(canFc)pre=`<div class=\"sub\" id=\"fsub\"><button class=\"fl${fsub===\"writers\"?\" on\":\"\"}\" data-fsub=\"writers\">Writers you follow</button><button class=\"fl${fsub===\"fc\"?\" on\":\"\"}\" data-fsub=\"fc\">From people you follow</button></div>`;\n    const set=fsub===\"fc\"&&canFc?new Set(fcFids.map(String)):new Set(Object.keys(follows));\n    src=allItems().filter(x=>!x.lc&&set.has(String(x.a.fid))).sort((a,b)=>b.ts-a.ts);\n    if(!src.length){L.innerHTML=pre+`<div class=\"empty\">${fsub===\"fc\"&&canFc?\"No articles from people you follow yet.\":\"Follow writers to see their articles here. Tap Follow on the Writers tab or on any article.\"}</div>`;return}\n  }\n  let items=src.filter(x=>!topic||(topic==='paragraph'?x.pg:x.topic===topic));\n  if(!items.length){L.innerHTML=pre+`<div class=\"empty\">${tab===\"saved\"?\"Nothing saved yet. Tap the bookmark on any article to read it later.\":\"Nothing here yet. Try another section.\"}</div>`;return}\n  const meta=x=>`${x.pg?'<span class=pgb>Paragraph</span>':''}${x.lc?'<span class=pgb>Long cast</span>':''}<span class=\"mi\"><span class=\"dot\"></span><span>${x.min||1} min read</span></span><span class=\"mi\"><span class=\"dot\"></span><span>${ago(x.ts)}</span></span>${x.l!=null?`<span class=\"mi\"><span class=\"dot\"></span><span>${x.l} likes</span></span>`:\"\"}${(!(x.a&&x.a.fid===1143161)&&(x.v||(x.v===0&&!(x.a&&x.a.fid===16447))))?`<span class=\"mi\"><span class=\"dot\"></span><span>${x.v===0?\"Under 100\":x.v>=1e4?Math.round(x.v/1e3)+\"K\":x.v>=1e3?(x.v/1e3).toFixed(1).replace(/\\.0$/,\"\")+\"K\":x.v} views</span></span>`:(x.a&&x.a.fid===1143161?`<span class=\"mi\"><span class=\"dot\"></span><span class=\"rw\">Rising writer</span></span>`:\"\")}${window.RQA&&RQA[x.h]?'<span class=\"mi\"><span class=\"dot\"></span><span class=\"rqlb\">Requested by readers</span></span>':''}${svBtn(x)}`;\n  const bg=x=>tab===\"today\"?\"\":badge(x.h);\n  const [first,...rest]=items;\n  if(tab===\"today\"&&!topic)pre+=storyBar();\n  L.innerHTML=pre+`<div class=\"lead\" data-h=\"${esc(first.h)}\">${first.cover?`<img src=\"${esc(img(first.cover,1200))}\" alt=\"\">`:\"\"}${bg(first)}${tab===\"today\"||tab===\"week\"?`<div class=\"top1\"><span class=\"g\">1</span><span class=\"k\">Top read ${tab===\"today\"?\"today\":\"this week\"}</span></div>`:\"\"}<h2>${esc(first.title)}</h2>${first.prev?`<p>${esc(clip(first.prev))}</p>`:\"\"}${by(first.a,meta(first))}</div>`+\n    rest.map((x,i)=>`<div class=\"row${x.cover?\"\":\" nocv\"}\" data-h=\"${esc(x.h)}\"><div class=\"n${tab===\"today\"||tab===\"week\"?(i===0?\" n2\":i===1?\" n3\":\"\"):\"\"}\">${i+2}</div><div>${bg(x)}<h3>${esc(x.title)}</h3>${by(x.a,meta(x))}</div>${x.cover?`<img src=\"${esc(img(x.cover,200))}\" alt=\"\" loading=\"lazy\">`:\"\"}</div>`).join(\"\")+(tab===\"today\"&&!topic&&data.nv&&data.nv.length?`<div class=\"nvh\"><b>New voices</b><span>First articles on Folio, rotating</span></div>`+data.nv.map(x=>`<div class=\"row nvr${x.cover?\"\":\" nocv\"}\" data-h=\"${esc(x.h)}\"><div class=\"n\">\\u2726</div><div><h3>${esc(x.title)}</h3>${by(x.a,meta(x))}</div>${x.cover?`<img src=\"${esc(img(x.cover,200))}\" alt=\"\" loading=\"lazy\">`:\"\"}</div>`).join(\"\"):\"\")+(tab==='today'&&!topic&&data.team&&data.team.length?`<div class='nvh tmh'><b>From Farcaster &amp; Folio</b><span>Not ranked</span></div>`+data.team.slice(0,2).map(x=>`<div class='row nvr tmr${x.cover?\"\":\" nocv\"}' data-h='${esc(x.h)}'><div class='n'>\\u25C6</div><div><h3>${esc(x.title)}</h3>${by(x.a,meta(x))}</div>${x.cover?`<img src='${esc(img(x.cover,200))}' alt='' loading='lazy'>`:''}</div>`).join(''):'');\n}\n\ndocument.addEventListener(\"click\",e=>{\n  const sv=e.target.closest(\"[data-save]\");\n  if(sv){e.stopPropagation();const h=sv.dataset.save;const x=allItems().find(k=>k.h===h)||saved[h]||(cur&&cur.h===h&&cur.article?{h,ts:Date.parse(cur.article.publishedAt)||Date.now(),title:cur.article.title,cover:cur.article.cover&&cur.article.cover.url,min:cur.min,a:cur.author}:null);if(!x)return;toggleSave(x);if(e.target.closest(\"#reader\"))drawSaveBtn();else render();return}\n  const fl=e.target.closest(\"[data-follow]\");\n  if(fl){e.stopPropagation();const f=fl.dataset.follow;const a=(data&&(data.writers.find(w=>String(w.a.fid)===f)||{}).a)||(allItems().find(x=>String(x.a.fid)===f)||{}).a||(cur&&cur.author&&String(cur.author.fid)===f?cur.author:null);if(!a)return;toggleFollow(a);document.querySelectorAll(`[data-follow=\"${f}\"]`).forEach(b=>{b.classList.toggle(\"on\",isFollow(a.fid));b.textContent=isFollow(a.fid)?\"Following\":\"Follow\"});if(tab===\"following\"&&!e.target.closest(\"#reader\"))render();return}\n  const fs=e.target.closest(\"[data-fsub]\");if(fs){fsub=fs.dataset.fsub;render();return}\n  const el=e.target.closest(\"[data-h]\");if(el&&!e.target.closest(\"#reader\"))openArticle(el.dataset.h,true)});\nfunction drawArticleTipFix(){if(cur&&cur.author)document.querySelectorAll(\".tip\").forEach(b=>b.style.display=sdk&&ctx&&cur.author.fid&&!(ctx.user&&ctx.user.fid===cur.author.fid)?\"\":\"none\")}\n(function(){\nconst art=hh=>{for(const k of ['today','week','latest'])for(const x of ((data&&data[k])||[]))if(x.h===hh)return x;return null};\nlet hq='';let hT=null;\nasync function hlRun(){const L=$('#list');const r=$('#hlr');if(!r)return;r.innerHTML='<div class=\"loading\">Searching\\u2026</div>';try{const j=await (await fetch('/api/hlsearch?q='+encodeURIComponent(hq))).json();if(tab!=='hl')return;\n if(!j.items.length){r.innerHTML=`<div class=\"empty\">${hq?'No highlighted lines mention \\u201c'+esc(hq)+'\\u201d yet.':'No highlights yet. Highlight lines you love in any article and they show up here.'}</div>`;return}\n r.innerHTML=`<p class=\"hlc\">${j.n} highlighted line${j.n===1?'':'s'}${hq?' mentioning \\u201c'+esc(hq)+'\\u201d':''}</p>`+j.items.map(x=>{const a=art(x.h);const t=esc(x.t).replace(hq?new RegExp('('+hq.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')+')','ig'):/$^/,'<mark>$1</mark>');return `<button class=\"hli\" data-h=\"${esc(x.h)}\"><span class=\"hlt\">\\u201c${t}\\u201d</span><span class=\"hlm\">${a?esc(a.title)+' \\u00b7 @'+esc(a.a.u||''):'Open article'}${x.c>1?' \\u00b7 highlighted by '+x.c:''}</span></button>`}).join('');\n r.querySelectorAll('.hli').forEach(b=>b.onclick=()=>openArticle(b.dataset.h,true))}catch(e){r.innerHTML='<div class=\"empty\">Search is unavailable right now.</div>'}}\nfunction hlRender(){$('#chips').style.display='none';const L=$('#list');L.innerHTML=`<div class=\"hls\"><input id=\"hlq\" type=\"search\" placeholder=\"Search highlighted lines, e.g. money, love, AI\" value=\"${esc(hq)}\" autocomplete=\"off\"><div id=\"hlr\"></div></div>`;const i=$('#hlq');i.oninput=()=>{hq=i.value.trim();clearTimeout(hT);hT=setTimeout(hlRun,300)};hlRun()}\nwindow.hlRender=hlRender;window.__fopen=h=>openArticle(h,true);window.__fimg=(u,w)=>img(u,w);window.__ftok=()=>qaTok();window.__fin=()=>!!(sdk&&ctx&&ctx.user&&ctx.user.fid);\n\ndocument.head.insertAdjacentHTML('beforeend','<style>.hls{padding:14px 0}.hls input{width:100%;box-sizing:border-box;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:12px 14px;font:16px var(--sans)}.hlc{color:var(--mute);font:600 12.5px var(--sans);margin:14px 0 6px}.hli{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:14px 0;cursor:pointer;color:var(--ink)}.hlt{display:block;font:italic 17px/1.45 var(--serif)}.hlm{display:block;margin-top:6px;color:var(--mute);font:600 12px var(--sans)}.hli mark{background:var(--acc);color:#17150F;border-radius:3px;padding:0 2px}</style>');\n})();;\n$(\"#tabs\").onclick=e=>{const b=e.target.closest(\"button\");if(!b)return;tab=b.dataset.t;[...$(\"#tabs\").children].forEach(x=>x.classList.toggle(\"on\",x===b));if(tab===\"hl\"){window.hlRender();}else{$(\"#chips\").style.display=\"\";render();}window.scrollTo(0,0)};\n$(\"#chips\").onclick=e=>{const b=e.target.closest(\"button\");if(!b)return;topic=b.dataset.c;[...$(\"#chips\").children].forEach(x=>x.classList.toggle(\"on\",x===b));render()};\n\n// markdown\nfunction inline(s){\n  const st=[];const put=h=>\"\\u0001\"+(st.push(h)-1)+\"\\u0002\";\n  s=s.replace(/\\\\([\\\\`*_{}\\[\\]()#+\\-.!|~>])/g,(m,c)=>put(esc(c)));\n  s=esc(s);\n  s=s.replace(/`([^`]+)`/g,(m,c)=>put(`<code>${c}</code>`));\n  s=s.replace(/!\\[([^\\]]*)\\]\\((https?:[^\\s)]+)(?:\\s+&quot;[^&]*&quot;)?\\)/g,(m,a,u)=>/^https:\\/\\/(?:farcaster\\.xyz|warpcast\\.com)\\//.test(u)&&!/\\.(png|jpe?g|gif|webp)(\\?|$)/i.test(u)?\"!\"+put(`<a href=\"${u}\" data-ext>`)+a+put(\"</a>\"):put(`<img src=\"${img(u.replace(/&amp;/g,\"&\"),1400).replace(/&/g,\"&amp;\")}\" alt=\"${a}\" loading=\"lazy\">`));\n  s=s.replace(/\\[([^\\]]+)\\]\\((https?:[^\\s)]+)\\)/g,(m,t,u)=>put(`<a href=\"${u}\" data-ext>`)+t+put(\"</a>\"));\n  s=s.replace(/(^|[\\s(])(https?:\\/\\/[^\\s<\\u0001]+)/g,(m,p,u)=>p+put(`<a href=\"${u}\" data-ext>${u.replace(/^https?:\\/\\//,\"\").slice(0,48)}${u.length>56?\"\\u2026\":\"\"}</a>`));\n  s=s.replace(/\\*\\*(?=\\S)([\\s\\S]+?)\\*\\*/g,\"<strong>$1</strong>\").replace(/__(?=\\S)([\\s\\S]+?)__/g,\"<strong>$1</strong>\").replace(/~~([^~]+)~~/g,\"<del>$1</del>\");\n  s=s.replace(/(^|[^\\w*])\\*(?=\\S)([^*]+?)\\*(?!\\w)/g,\"$1<em>$2</em>\").replace(/(^|[^\\w])_(?=\\S)([^_]+?)_(?![\\w])/g,\"$1<em>$2</em>\").replace(/(\\w)_(\\([^_]+?\\))_(?![\\w])/g,\"$1<em>$2</em>\");\n  s=s.replace(/\\s*\\\\$/,\"\").replace(/ {2,}$/,\"\");\n  for(let k=0;k<3;k++)s=s.replace(/\\u0001(\\d+)\\u0002/g,(m,n)=>st[+n]);\n  return s;\n}\nfunction md(src){\n  const lines=src.replace(/\\r/g,\"\").replace(/[\\u2060\\u200b\\ufeff]/g,\"\").replace(/%E2%81%A0/gi,\"\").split(\"\\n\");let out=\"\",i=0;\n  const castRe=/^https:\\/\\/(?:farcaster\\.xyz|warpcast\\.com)\\/[^\\s]+$/;\n  while(i<lines.length){\n    let l=lines[i];\n    if(/^```/.test(l)){let b=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))b.push(lines[i++]);i++;out+=`<pre><code>${esc(b.join(\"\\n\"))}</code></pre>`;continue}\n    if(/^\\s*$/.test(l)||l.trim()===\"\\\\\"){i++;continue}\n    if(/^(-{3,}|\\*{3,})\\s*$/.test(l)){out+=\"<hr>\";i++;continue}\n    const h=l.match(/^(#{1,4})\\s+(.*)$/);if(h){const n=Math.min(4,h[1].length+1);out+=`<h${n}>${inline(h[2].replace(/^\\*\\*(.*)\\*\\*$/,\"$1\"))}</h${n}>`;i++;continue}\n    if(castRe.test(l.trim())){const u=l.trim();const ch=(u.match(/(0x[0-9a-fA-F]{40})/)||[])[1];out+=`<a class=\"castref\" href=\"${esc(u)}\" data-ext${ch?` data-cast=\"${ch}\"`:\"\"}>View cast on Farcaster &rarr;</a>`;i++;continue}\n    if(/^>\\s?/.test(l)){let b=[];while(i<lines.length&&/^>\\s?/.test(lines[i]))b.push(lines[i++].replace(/^>\\s?/,\"\"));out+=`<blockquote>${b.map(inline).join(\"<br>\")}</blockquote>`;continue}\n    if(/^\\|/.test(l)){let rows=[];while(i<lines.length&&/^\\|/.test(lines[i]))rows.push(lines[i++]);const cells=r=>r.replace(/^\\||\\|$/g,\"\").split(\"|\");let t=\"<table>\";rows.forEach((r,k)=>{if(/^\\|?\\s*:?-+/.test(r)&&k===1)return;t+=\"<tr>\"+cells(r).map(c=>k===0?`<th>${inline(c.trim())}</th>`:`<td>${inline(c.trim())}</td>`).join(\"\")+\"</tr>\"});out+=t+\"</table>\";continue}\n    if(/^\\s*[-*]\\s+/.test(l)){let b=[];while(i<lines.length&&/^\\s*[-*]\\s+/.test(lines[i]))b.push(lines[i++].replace(/^\\s*[-*]\\s+/,\"\"));out+=\"<ul>\"+b.map(x=>`<li>${inline(x)}</li>`).join(\"\")+\"</ul>\";continue}\n    if(/^\\s*\\d+[.)]\\s+/.test(l)){let b=[];while(i<lines.length&&/^\\s*\\d+[.)]\\s+/.test(lines[i]))b.push(lines[i++].replace(/^\\s*\\d+[.)]\\s+/,\"\"));out+=\"<ol>\"+b.map(x=>`<li>${inline(x)}</li>`).join(\"\")+\"</ol>\";continue}\n    i++;const il=inline(l.trim());if(il)out+=`<p>${il}</p>`;\n  }\n  return out;\n}\n\nwindow._T0=window._T0||Date.now();function ntr(k,x){}function inMini(){try{return !!(sdk&&ctx)||!!window.ReactNativeWebView||window.parent!==window}catch(_){return true}}async function openArticle(h,push){ntr(\"open\",{p:push?1:0});\n  cur={h};showingTr=false;\n  $(\"#reader\").classList.add(\"open\");$(\"#reader\").scrollTop=0;document.body.style.overflow=\"hidden\";\n  $(\"#art\").innerHTML=`<div class=\"sk\" style=\"aspect-ratio:5/2\"></div><div class=\"sk\" style=\"height:34px;margin:20px 0 12px;width:85%\"></div><div class=\"sk\" style=\"height:16px;width:50%;margin-bottom:24px\"></div>${'<div class=\"sk\" style=\"height:16px;margin:10px 0\"></div>'.repeat(6)}`;\n  $(\"#trbtn\").textContent=\"Translate\";$(\"#share\").textContent=\"Share\";$(\"#endbar\").style.display=\"none\";try{rpBox.style.display=\"none\"}catch(e){}\n  window._oc=(window._oc||0)+1;window._lo2=Date.now();if(push){if(inMini()){try{if(window._bkok&&sdk&&sdk.back&&sdk.back.show){sdk.back.onback=()=>{if(cur)closeReader()};sdk.back.show()}}catch(_){}}else{window._lo=Date.now();history.pushState({a:h},\"\",location.pathname)}}\n  try{\n    let j=null;for(let t=0;t<3;t++){try{const r=await fetch(\"/api/article?h=\"+h);j=await r.json();if(!j.error||r.status===404)break}catch(e){j={error:\"net\"}}await new Promise(z=>setTimeout(z,800*(t+1)))}if(!j||j.error)throw new Error(j&&j.error);\n    cur={h,...j};drawArticle(j.article.title,j.article.body,null);track(h);artStats(h);\n  }catch(e){$(\"#art\").innerHTML=`<div class=\"empty\">This article could not be loaded.</div>`;$(\"#endbar\").style.display=\"none\";cur=null}\n}\nfunction drawArticle(title,body,lang){\n  const a=cur.article,au=cur.author;\n  const rtl=lang&&RTL.has(lang);\n  const words=(a.body||\"\").split(/\\s+/).length,min=Math.max(1,Math.round(words/230));\n  $(\"#art\").innerHTML=`${a.cover?`<img class=\"cov\" src=\"${esc(img(a.cover.url,1400))}\" alt=\"\">`:\"\"}\n   ${lang?`<div class=\"note\"><span>Translated to ${esc(LANGS[lang])}. Proper names kept as written.</span><button id=\"orig\">Original</button></div>`:\"\"}\n   <div class=\"${rtl?\"rtl\":\"\"}\"><h1>${esc(title)}</h1></div>\n   ${badge(cur.h)}\n   ${by(au,`${cur.pg?'<span class=pgb>Paragraph</span>':''}<span class=\"mi\"><span class=\"dot\"></span><span>${min} min read</span></span>${a.publishedAt?`<span class=\"mi\"><span class=\"dot\"></span><span>${new Date(a.publishedAt).toLocaleDateString(\"en-US\",{month:\"short\",day:\"numeric\"})}</span></span>`:\"\"}<span id=\"rsv\"></span>${au.fid?flBtn(au):\"\"}`)}\n   <div class=\"fst\" id=\"fst\"></div>\n   \n   <div class=\"md ${rtl?\"rtl\":\"\"}\">${md(body||\"\")}</div>`;\n  cur.min=min;\n  document.title=a.title+\" | Folio\";pgSub();$(\"#endbar\").style.display=\"\";hydrateCasts($(\"#art\"));try{rpLoad()}catch(e){}drawSaveBtn();setShare();\n  \n  document.querySelectorAll(\".tip\").forEach(b=>b.style.display=sdk&&ctx&&au.fid&&!(ctx.user&&ctx.user.fid===au.fid)?\"\":\"none\");\n  if(lang){$(\"#orig\").onclick=()=>{trTok++;showingTr=false;$(\"#trbtn\").textContent=\"Translate\";drawArticle(a.title,a.body,null)}}\n  if(rtl&&!document.getElementById(\"rtlf\")){const l=document.createElement(\"link\");l.id=\"rtlf\";l.rel=\"stylesheet\";l.href=\"https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&family=Noto+Sans+Hebrew:wght@400;700&display=swap\";document.head.appendChild(l)}\n}\nfunction drawSaveBtn(){const el=$(\"#rsv\");if(el&&cur)el.outerHTML=`<span id=\"rsv\">${svBtn({h:cur.h})}</span>`}\nfunction setShare(){if(!cur||!cur.author)return;const n=rankOf(cur.h);const mine=ctx&&ctx.user&&ctx.user.fid===cur.author.fid;$(\"#share\").textContent=mine&&n?`Share your #${n}`:\"Share\"}\nconst sumCache={};\nasync function loadSummary(td,lang){const box=td.querySelector(\".tb\");const key=cur.h+\":\"+lang;if(box.dataset.done===key)return;\n  box.innerHTML=`<div class=\"loading\">Summarizing\\u2026</div>`;\n  try{const j=sumCache[key]||(sumCache[key]=await (await fetch(`/api/summary?h=${cur.h}&lang=${lang}`)).json());if(j.error){delete sumCache[key];throw new Error(j.error)}\n    if(!td.isConnected)return;box.dataset.done=key;box.innerHTML=`<ul class=\"${RTL.has(lang)?\"rtl\":\"\"}\">${j.lines.map(l=>`<li>${esc(l)}</li>`).join(\"\")}</ul>`}\n  catch(e){box.innerHTML=`<div class=\"loading\">${e.message===\"busy\"?\"Summaries are resting for today. Check back tomorrow.\":\"Summary is not available right now.\"}</div>`}}\nconst castCache={};\nfunction hydrateCasts(root){root.querySelectorAll(\"a.castref[data-cast]\").forEach(async el=>{const h=el.dataset.cast;try{const c=castCache[h]||(castCache[h]=await (await fetch(\"/api/cast?h=\"+h)).json());if(!c||c.error||!el.isConnected)return;\n  el.className=\"cc\";el.innerHTML=`<div class=\"h\">${c.p?`<img src=\"${esc(img(c.p,48))}\" alt=\"\">`:\"\"}<b>${esc(c.n||c.u)}</b><span>@${esc(c.u)}</span></div><div class=\"x\">${esc(c.t.length>420?c.t.slice(0,400).replace(/\\s+\\S*$/,\"\")+\"\\u2026\":c.t)}</div>${c.i?`<img class=\"im\" src=\"${esc(img(c.i,800))}\" alt=\"\" loading=\"lazy\">`:\"\"}`;}catch(e){}})}\nfunction ping(h,e){const k=\"folio.rd.\"+e+\".\"+h;if(store.get(k))return;store.set(k,String(Date.now()));try{fetch(`/api/read?h=${h}&e=${e}`,{method:\"POST\",keepalive:true})}catch(x){}}\nlet trackIv=null;\nfunction track(h){ping(h,\"open\");clearInterval(trackIv);const t0=Date.now();let vis=0;const words=(cur.article.body||\"\").split(/\\s+/).length;const need=Math.min(90000,Math.max(15000,words/230*60000*0.35));\n  trackIv=setInterval(()=>{if(!cur||cur.h!==h){clearInterval(trackIv);return}if(!document.hidden)vis+=1000;const eb=$(\"#endbar\");if(eb.getBoundingClientRect().top<window.innerHeight&&vis>need){ping(h,\"done\");clearInterval(trackIv)}},1000)}\nlet trTok=0;\nconst STOK=new URLSearchParams(location.search).has(\"stories\")||store.get(\"folio.stpv\")===\"1\";\nconst SLANG=()=>{const l=store.get(\"folio.lang\")||navLang;return LANGS[l]?l:\"en\"};\nconst ST_MAX=6,ST_DUR=10000;let stI=0,stT=null,stList=[],stT0=0,stDur=ST_DUR,stPause=false;\nlet stSeen=jget(\"folio.stseen\",{});function markSeen(h){stSeen[h]=Date.now();const cut=Date.now()-4*864e5;for(const k in stSeen)if(stSeen[k]<cut)delete stSeen[k];store.set(\"folio.stseen\",JSON.stringify(stSeen))}\nconst stPick=()=>{if(!data)return[];const ok=x=>x&&x.a&&x.a.fid&&x.a.fid!==1;const top=(data.today||[]).filter(ok);const FEAT=[1143161];const ft=allItems().filter(x=>ok(x)&&FEAT.includes(x.a.fid)&&Date.now()-x.ts<3*864e5).sort((a,b)=>b.ts-a.ts).slice(0,1).map(x=>Object.assign({},x,{_ft:1}));const nv=(data.nv||[]).filter(ok).map(x=>Object.assign({},x,{_nv:1}));const out=[],fids=new Set(),hs=new Set();const add=x=>{if(!x||out.length>=ST_MAX||fids.has(x.a.fid)||hs.has(x.h))return;fids.add(x.a.fid);hs.add(x.h);out.push(x)};const PIN=[\"0xb8723ebf145b85e128165c0ca9f70a0f982f897b\"];const pn=allItems().filter(x=>ok(x)&&PIN.includes(x.h)&&Date.now()-x.ts<2*864e5).map(x=>Object.assign({},x,{_ft:1}));pn.forEach(add);top.slice(0,4).forEach(add);ft.forEach(add);nv.slice(0,1).forEach(add);nv.forEach(add);top.forEach(add);return out.slice(0,ST_MAX)};\nfunction storyBar(){if(tab!==\"today\"||!data||!data.today.length)return\"\";const L0=stPick();if(!L0.length)return\"\";const x=L0[0];const seen=L0.every(y=>stSeen[y.h]);\n  return `<div class=\"stb${seen?\" seen\":\"\"}\" id=\"stb\"><div class=\"rg\">${x.cover?`<img src=\"${esc(img(x.cover,120))}\" alt=\"\">`:`<div class=\"rgt\">${esc((cleanT(x.title)||\"F\").charAt(0).toUpperCase())}</div>`}</div><div><b>Today in 60 seconds</b><span>Top reads${L0.some(y=>y._nv||y._ft)?\" and featured writers\":\"\"} of the day</span></div></div>`}\nasync function openStories(){stList=stPick();stI=Math.max(0,stList.findIndex(y=>!stSeen[y.h]));$(\"#stories\").classList.add(\"open\");document.body.style.overflow=\"hidden\";drawStory()}\nfunction stTc(){const b=document.querySelector(\"#sto .tcard b\");if(!b)return;let f=44;b.style.fontSize=f+\"px\";const ov=()=>b.scrollHeight>b.clientHeight+1||b.scrollWidth>b.clientWidth+1;while(ov()&&f>14){f-=1;b.style.fontSize=f+\"px\"}}\nfunction stFit(){stTc();const S=$(\"#sto\"),u=$(\"#stsum\");if(!S||!u)return;let f=1;S.style.setProperty(\"--fs\",1);u.classList.remove(\"ov\");const over=()=>u.scrollHeight>u.clientHeight+2;while(over()&&f>0.66){f-=0.04;S.style.setProperty(\"--fs\",f.toFixed(2))}if(over())u.classList.add(\"ov\")}\naddEventListener(\"resize\",()=>{if($(\"#stories\").classList.contains(\"open\"))stFit()});\nfunction closeStories(){clearInterval(stT);$(\"#stories\").classList.remove(\"open\");document.body.style.overflow=\"\";render()}\nasync function drawStory(){\n  clearInterval(stT);const x=stList[stI];if(!x){closeStories();return}const rk=x._nv||x._ft?0:(data.today.findIndex(y=>y.h===x.h)+1||stI+1);\n  const sc=x._ft?\"#B9A3E3\":x._nv?\"#E8A598\":rk===1?\"#E2B54E\":rk===2?\"#A9B6C3\":rk===3?\"#D9955A\":\"#fff\";const lang=SLANG();\n  const S=$(\"#sto\");S.style.setProperty(\"--sc\",sc);markSeen(x.h);S.classList.toggle(\"nt\",!x.cover);\n  S.innerHTML=`<div class=\"bg\" style=\"background-image:url('${esc(img(x.cover,400))}')\"></div>${x.cover?`<img class=\"fg\" src=\"${esc(img(x.cover,1600))}\" alt=\"\" onload=\"this.classList.add('on')\">`:`<div class=\"tcard\"><i></i><span class=\"tk\">A long read on Folio</span><b>${esc(x.title)}</b><div class=\"ta\">${x.a.p?`<img src=\"${esc(img(x.a.p,96))}\" alt=\"\">`:\"\"}<div><strong>${esc(x.a.n||x.a.u)}</strong><em>@${esc(x.a.u)} \\u00B7 ${x.min||1} min read</em></div></div></div>`}<div class=\"sh\"></div>\n   <div class=\"bars\">${stList.map((_,i)=>`<span><i style=\"width:${i<stI?100:0}%\"></i></span>`).join(\"\")}</div>\n   <div class=\"hd\"><span class=\"lg\">Folio</span><span class=\"sp\">Today in 60 seconds</span><button id=\"stx\" aria-label=\"Close\">&times;</button></div>\n   <div class=\"tp l\" id=\"stl\"></div><div class=\"tp r\" id=\"str\"></div>\n   <div class=\"bd\"><div class=\"rk\">${x._ft?`<b>\\u2605</b>Featured writer`:x._nv?`<b>\\u2726</b>New voice`:`<b>${rk}</b>${rk===1?\"Top read today\":ord(rk)+\" today\"}`}</div><h2>${esc(x.title)}</h2>\n   <div class=\"au\">${x.a.p?`<img src=\"${esc(img(x.a.p,48))}\" alt=\"\">`:\"\"}<span>${esc(x.a.n||x.a.u)} \\u00B7 ${x.min||1} min read</span></div>\n   <button class=\"rd\" id=\"strd\">Read the full article</button></div>`;\n  $(\"#stx\").onclick=closeStories;\n  $(\"#strd\").onclick=()=>{closeStories();openArticle(x.h,true)};\n  const k=x.h+\":\"+lang;\n  false&&(async()=>{try{const j=sumCache[k]||(sumCache[k]=await (await fetch(`/api/summary?h=${x.h}&lang=${lang}`)).json());if(j.error)throw 0;if(stList[stI]!==x)return;const u=$(\"#stsum\");u.className=RTL.has(lang)?\"rtl\":\"\";u.innerHTML=j.lines.slice(0,1).map(l=>`<li>${esc(l)}</li>`).join(\"\");stFit()}catch(e){const u=$(\"#stsum\");if(u&&stList[stI]===x)u.innerHTML=x.prev?`<li>${esc(clip(x.prev))}</li>`:\"\";stFit()}})();\n  requestAnimationFrame(stFit);\n  if(stList[stI+1]&&stList[stI+1].cover){const im=new Image();im.src=img(stList[stI+1].cover,1600)}\n  stT0=Date.now();const bar=S.querySelectorAll(\".bars i\")[stI];\n  let stLast=Date.now();stT=setInterval(()=>{const nw=Date.now(),dt=nw-stLast;stLast=nw;if(stPause||document.hidden){stT0+=dt;return}const p=Math.min(1,(Date.now()-stT0)/stDur);bar.style.width=p*100+\"%\";if(p>=1){stI++;drawStory()}},100);\n}\nlet stDn=0;document.addEventListener(\"pointerdown\",e=>{if(e.target.closest(\"#sto\")){stPause=true;stDn=Date.now()}});document.addEventListener(\"pointerup\",()=>{stPause=false});document.addEventListener(\"pointercancel\",()=>{stPause=false});\ndocument.addEventListener(\"click\",e=>{const S=e.target.closest(\"#sto\");if(!S||e.target.closest(\"#stx,#strd\"))return;if(Date.now()-stDn>450)return;const r=S.getBoundingClientRect();if(e.clientX-r.left<r.width*0.33){if(stI>0){stI--;drawStory()}}else{stI++;drawStory()}});\ndocument.addEventListener(\"click\",e=>{if(e.target.closest(\"#stb\"))openStories()});\n(async()=>{let NEWS=[];try{NEWS=await (await fetch(\"/api/news\")).json()}catch(e){}if(!Array.isArray(NEWS)||!NEWS.length){$(\"#bell\").style.display=\"none\";return}\n  const b=$(\"#bell\"),c=$(\"#bellc\"),seen=+store.get(\"folio.news\")||0,n=NEWS.filter(x=>x.v>seen).length;\n  if(n){b.classList.add(\"new\");c.textContent=n>9?\"9+\":n}\n  b.onclick=()=>{const last=+store.get(\"folio.news\")||0;$(\"#nw\").innerHTML=`<h4>What\\u2019s new</h4><div class=\"bd\">`+NEWS.slice(0,8).map(x=>`<div class=\"it\"><b>${esc(x.t)}${x.v>last?`<span>New</span>`:\"\"}</b><p>${esc(x.s)}</p></div>`).join(\"\")+`</div><button class=\"nx\" onclick=\"document.getElementById('news').classList.remove('open')\">Got it</button>`;\n    $(\"#news\").classList.add(\"open\");store.set(\"folio.news\",String(Math.max(...NEWS.map(x=>x.v))));b.classList.remove(\"new\")};\n  $(\"#news\").onclick=e=>{if(e.target.id===\"news\")$(\"#news\").classList.remove(\"open\")};})();\nconst MS=[1000,500,250,100,50,25,10];\nasync function moment(fid,force){\n  try{const j=await (await fetch(\"/api/stats?fid=\"+fid)).json();if(!j.items||!j.items.length||!data)return;\n    let best=null;\n    for(const x of j.items){const rk=rankOf(x.h);const ms=MS.find(m=>x.op>=m)||0;\n      const sc=rk?100-rk:ms?ms/100:0;if(!sc)continue;if(!best||sc>best.sc)best={x,rk,ms,sc}}\n    if(!best)return;const {x,rk,ms}=best;\n    const key=\"folio.mo.\"+x.h+\":\"+(rk?\"r\"+rk:\"m\"+ms);\n    if(!force){if(store.get(key))return;const prev=+store.get(\"folio.mo.best.\"+x.h)||99;if(rk&&rk>=prev)return;}\n    store.set(key,\"1\");if(rk)store.set(\"folio.mo.best.\"+x.h,String(Math.min(rk,+store.get(\"folio.mo.best.\"+x.h)||99)));\n    const mc=rk===1?\"var(--gold)\":rk===2?\"var(--silver)\":rk===3?\"var(--bronze)\":rk?\"var(--acc)\":\"var(--gold)\";\n    const nl=Object.keys(x.t||{}).length;const t=cleanT(x.title);\n    const head=rk===1?\"Your article is the top read on Folio today\":rk?`Your article is ${ord(rk)} on Folio today`:`${nf(ms)} people read your article on Folio`;\n    const kick=rk===1?\"Top read today\":rk&&rk<=3?\"Top 3 today\":rk?\"Today\\u2019s top 8\":\"New milestone\";\n    const M=$(\"#mo\");M.style.setProperty(\"--mc\",mc);\n    M.innerHTML=`<button class=\"x\" aria-label=\"Close\">&times;</button><div class=\"medal\"><b>${rk?`<small>#</small>${rk}`:nf(ms)}</b><div class=\"shine\"></div></div>\n      <div class=\"k\">${kick}</div><h2>${head}</h2><p class=\"t\">\\u201C${esc(t)}\\u201D</p>\n      <div class=\"st\"><div><b>${nf(x.op)}</b>${x.op===1?\"read\":\"reads\"}</div><div><b>${nf(x.l)}</b>${x.l===1?\"like\":\"likes\"}</div>${nl?`<div><b>${nl}</b>language${nl>1?\"s\":\"\"}</div>`:\"\"}</div>\n      <div class=\"bt\"><button class=\"pri\" id=\"moshare\">Share it</button><button id=\"mostats\">Your stats</button></div>`+\n      Array.from({length:rk&&rk<=3?28:16},(_,i)=>`<i class=\"cf\" style=\"left:${Math.random()*100}%;animation-delay:${(Math.random()*1.2).toFixed(2)}s;opacity:0;${i%3?\"\":\"background:var(--ink);\"}\"></i>`).join(\"\");\n    const box=$(\"#moment\");box.classList.add(\"open\");\n    const close=()=>box.classList.remove(\"open\");M.querySelector(\".x\").onclick=close;box.onclick=e=>{if(e.target===box)close()};\n    $(\"#mostats\").onclick=()=>{close();showStats(fid)};\n    $(\"#moshare\").onclick=async()=>{const url=location.origin+\"/?a=\"+x.h;const text=rk?`My article \"${t}\" is ${ord(rk)} on Folio today. Thanks to everyone who read it.`:`${nf(ms)} people have read \"${t}\" on Folio. Thanks for reading it.`;\n      if(sdk&&ctx){try{await sdk.actions.composeCast({text,embeds:[url]});close();return}catch(e){}}\n      if(navigator.share){try{await navigator.share({text,url});close();return}catch(e){}}\n      try{await navigator.clipboard.writeText(text+\" \"+url);$(\"#moshare\").textContent=\"Copied\"}catch(e){}};\n  }catch(e){}\n}\nconst nf=n=>n>=1000?(n/1000).toFixed(n>=10000?0:1).replace(/\\.0$/,\"\")+\"k\":String(n);\nfunction trPing(h,l){const k=\"folio.rd.tr.\"+l+\".\"+h;if(store.get(k))return;store.set(k,\"1\");try{fetch(`/api/read?h=${h}&e=tr&l=${l}`,{method:\"POST\",keepalive:true})}catch(x){}}\nconst isMine=()=>!!(cur&&cur.author&&ctx&&ctx.user&&ctx.user.fid===cur.author.fid);\nfunction drawStats(){const el=$(\"#fst\");if(!el||!cur||!cur.st)return;const s=cur.st,nl=Object.keys(s.t||{}).length;\n  if(!isMine()&&s.op<10){el.innerHTML=\"\";return}\n  el.innerHTML=`<span>On Folio:</span><span><b>${nf(s.op)}</b> ${s.op===1?\"read\":\"reads\"}</span>${nl?`<span class=\"dot\"></span><span>translated into <b>${nl}</b> language${nl>1?\"s\":\"\"}</span>`:\"\"}`;el.querySelectorAll(\":scope > .dot\").forEach(d=>{const n=d.nextElementSibling;if(!n)return;const g=document.createElement(\"span\");g.className=\"mi\";d.before(g);g.append(d,n)})}\nasync function artStats(h){try{const s=await (await fetch(\"/api/stats?h=\"+h)).json();if(!cur||cur.h!==h||s.error)return;cur.st=s;drawStats()}catch(e){}}\nasync function showStats(fid){\n  const L=$(\"#list\");tab=\"stats\";[...$(\"#tabs\").children].forEach(x=>x.classList.remove(\"on\"));$(\"#chips\").style.display=\"none\";window.scrollTo(0,0);\n  L.innerHTML=`<div class=\"loading\">Loading your stats\\u2026</div>`;\n  try{const j=await (await fetch(\"/api/stats?fid=\"+fid)).json();\n    if(!j.items||!j.items.length){L.innerHTML=`<div class=\"empty\">No articles from this writer on Folio yet.</div>`;return}\n    const sum=k=>j.items.reduce((a,x)=>a+(x[k]||0),0);const langs=new Set();j.items.forEach(x=>Object.keys(x.t||{}).forEach(l=>langs.add(l)));\n    const op=sum(\"op\"),rd=sum(\"rd\");\n    L.innerHTML=`<div class=\"stt\"><h2>${isMineFid(fid)?\"Your stats\":esc(j.a.n||j.a.u)+\"\\u2019s stats\"}</h2><p>Reads and translations on Folio, last 40 days. Finished means read to the end, counting only time on screen.</p>\n      <div class=\"sg\"><div><b>${nf(op)}</b><span>Reads</span></div><div><b>${op?Math.round(Math.min(1,rd/op)*100)+'%':'0%'}</b><span>Finished</span></div><div><b>${nf(sum(\"l\"))}</b><span>Likes</span></div><div><b>${langs.size}</b><span>Languages</span></div></div></div>`+\n      j.items.map(x=>{const nl=Object.keys(x.t||{}).length;const rk=rankOf(x.h);return `<div class=\"sr\" data-h=\"${esc(x.h)}\"><h3>${rk?`<span style=\"color:var(--gold)\">#${rk} today \\u00B7 </span>`:\"\"}${esc(x.title)}</h3><div class=\"m\"><span><b>${nf(x.op)}</b> ${x.op===1?\"read\":\"reads\"}</span><span><b>${nl}</b> lang${nl===1?\"\":\"s\"}</span><span><b>${nf(x.rd||0)}</b> finished${x.op?' ('+Math.round(Math.min(1,(x.rd||0)/x.op)*100)+'%)':''}</span><span>${nf(x.l)} likes</span><span>${ago(x.ts)}</span></div></div>`}).join(\"\")}\n  catch(e){L.innerHTML=`<div class=\"empty\">Stats are not available right now.</div>`}}\nconst WK0=1795219200000;const wkLbl=n=>(Date.now()<WK0?(n===1?'read':'reads')+' since Nov 14':(n===1?'read':'reads')+' in the last 7 days');async function wkData(fid){const j=await (await fetch('/api/stats?fid='+fid)).json();if(!j.items||!j.items.length)return null;const wk=j.items.reduce((a,x)=>a+(x.wk||0),0),pw=j.items.reduce((a,x)=>a+(x.pw||0),0);const top=j.items.slice().sort((a,b)=>(b.wk||0)-(a.wk||0))[0];return {wk,pw,top}}async function weekly(fid,force){try{const d=await wkData(fid);if(!d)return;const {wk,pw,top}=d;const box=$('#moment');if(!force){if(wk<3||Date.now()<WK0||box.classList.contains('open'))return;const last=+store.get('folio.wk.last')||0;if(Date.now()-last<6.5*864e5)return}store.set('folio.wk.last',String(Date.now()));const ch=pw>0?Math.round((wk-pw)/pw*100):null;const tt=top&&top.wk?cleanT(top.title):'';const M=$('#mo');M.style.setProperty('--mc','var(--acc)');M.innerHTML=`<button class='x' aria-label='Close'>&times;</button><div class='medal'><b>${nf(wk)}</b><div class='shine'></div></div><div class='k'>Your week on Folio</div><h2>${wkLbl(wk)}</h2>${ch!==null?`<p class='t'>${ch>=0?'Up '+ch+'%':'Down '+(-ch)+'%'} from the week before</p>`:''}${tt?`<p class='t'>Most read: “${esc(tt)}”</p>`:''}<div class='bt'><button class='pri' id='wkshare'>Share it</button><button id='wkstats'>Your stats</button></div>`;box.classList.add('open');const close=()=>box.classList.remove('open');M.querySelector('.x').onclick=close;box.onclick=e=>{if(e.target===box)close()};$('#wkstats').onclick=()=>{close();showStats(fid)};$('#wkshare').onclick=async()=>{const url=location.origin+(top?'/?a='+top.h:'/');const text=`My writing got ${nf(wk)} ${wk===1?'read':'reads'} on Folio this week. Thanks to everyone who read it.`;if(sdk&&ctx){try{await sdk.actions.composeCast({text,embeds:[url]});close();return}catch(e){}}if(navigator.share){try{await navigator.share({text,url});close();return}catch(e){}}try{await navigator.clipboard.writeText(text+' '+url);$('#wkshare').textContent='Copied'}catch(e){}}}catch(e){}}const _showStats=showStats;showStats=async function(fid){await _showStats(fid);try{if(!isMineFid(fid))return;const d=await wkData(fid);const s=document.querySelector('#list .stt');if(!d||!s||s.querySelector('.wkl'))return;const w=document.createElement('div');w.className='wkl';w.innerHTML=`<span><b>${nf(d.wk)}</b> ${wkLbl(d.wk)}</span>${d.wk?`<button id='wkopen'>Weekly card</button>`:''}`;s.appendChild(w);const b=w.querySelector('button');if(b)b.onclick=()=>weekly(fid,true)}catch(e){}};document.head.insertAdjacentHTML('beforeend','<style>.wkl{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding:10px 14px;border:1px solid var(--line);border-radius:12px;font:500 13.5px var(--sans);color:var(--mute)}.wkl b{color:var(--ink)}.wkl button{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:6px 12px;font:600 12.5px var(--sans);color:var(--ink);cursor:pointer;white-space:nowrap}</style>');{const qw=new URLSearchParams(location.search).get('weekly');if(qw&&/^[0-9]+$/.test(qw))setTimeout(()=>weekly(+qw,true),2500)}const _ds=drawStats;drawStats=function(){_ds();try{const el=$('#fst'),s=cur&&cur.st;if(!el||!s||!s.rd||el.children.length<2)return;const f=document.createElement('span');f.innerHTML=`<b>${nf(s.rd)}</b> finished`;const d=document.createElement('span');d.className='dot';const g=document.createElement('span');g.className='mi';g.append(d,f);el.children[1].after(g)}catch(e){}};let seenC={};const seenNote=document.createElement('p');seenNote.id='seenote';seenNote.textContent='Writers can see who read and rated their articles on Folio.';seenNote.style.display='none';document.getElementById('endbar').after(seenNote);let qaHave=null;async function qaTok(bg){try{if(!sdk||!sdk.quickAuth)return null;if(bg){const mob=ctx&&ctx.client&&ctx.client.platformType===\"mobile\";if(!mob&&!qaHave)return null}try{ntr(\"qa\",{s:qaHave?\"have\":\"new\"})}catch(_){}const t=await Promise.race([sdk.quickAuth.getToken().then(r=>r&&r.token||null),new Promise(r=>setTimeout(()=>r(null),30000))]);if(t)qaHave=t;return t}catch(e){return null}}async function seenPost(h){try{const u=ctx&&ctx.user;const mine=!!(u&&cur&&cur.author&&u.fid===cur.author.fid);seenNote.style.display=u&&!mine?'':'none';if(!sdk||!u||!u.fid||mine)return;const k='folio.seen.'+h;if(store.get(k))return;const t=await qaTok(1);if(!t)return;const r=await fetch('/api/seen?h='+h,{method:'POST',headers:{Authorization:'Bearer '+t,'content-type':'application/json'},body:JSON.stringify({u:u.username||'',n:u.displayName||'',p:u.pfpUrl||''})});if(r.ok)store.set(k,'1')}catch(e){}}const _tr=track;track=function(h){_tr(h);seenPost(h)};async function seenGet(h){const c=seenC[h];if(c&&Date.now()-c.t<60000)return c.l;const t=await qaTok(1);if(!t)return null;const r=await fetch('/api/seen?h='+h,{headers:{Authorization:'Bearer '+t}});if(!r.ok)return null;const j=await r.json();if(j.items)seenC[h]={t:Date.now(),l:j.items};return j.items||null}function seenSheet(l){const M=$('#mo'),box=$('#moment');M.style.setProperty('--mc','var(--acc)');M.innerHTML=`<button class='x' aria-label='Close'>&times;</button><div class='k'>Seen by</div><h2>${nf(l.length)} ${l.length===1?'reader':'readers'}</h2>${(()=>{const r=l.filter(v=>v.s);return r.length?`<p class='t'>${(r.reduce((a,v)=>a+v.s,0)/r.length).toFixed(1)}\\u2605 from ${nf(r.length)} ${r.length===1?'rating':'ratings'}</p>`:''})()}<p class='sbn' style='margin:2px 0 0;font:500 12px var(--sans);color:var(--mute)'>Signed-in readers only. Reads also count rereads and signed-out visits.</p><div class='sbl'>${l.map(v=>`<button class='sbi' data-f='${v.f}'>${v.p?`<img src='${esc(img(v.p,96))}' alt=''>`:`<i></i>`}<span><b>${esc(v.n||v.u||'fid '+v.f)}</b><em>${v.s?`<span class='sbs'>${'\\u2605'.repeat(v.s)}${'\\u2606'.repeat(5-v.s)}</span> · `:''}${v.u?'@'+esc(v.u)+' · ':''}${Date.now()-v.ts<60000?'just now':ago(v.ts)+' ago'}</em></span></button>`).join('')||`<p class='t'>No signed-in readers yet.</p>`}</div>`;box.classList.add('open');const close=()=>box.classList.remove('open');M.querySelector('.x').onclick=close;box.onclick=e=>{if(e.target===box)close()};M.querySelectorAll('.sbi').forEach(b=>b.onclick=async()=>{const f=+b.getAttribute('data-f');try{if(sdk&&ctx)await sdk.actions.viewProfile({fid:f})}catch(e){}})}const _ds2=drawStats;drawStats=function(){_ds2();try{if(!isMine()||!cur)return;const h=cur.h,el=$('#fst');if(!el)return;seenGet(h).then(l=>{if(!l||!cur||cur.h!==h||el.querySelector('.sbb'))return;const b=document.createElement('button');b.className='sbb';b.innerHTML=`Seen by <b>${nf(l.length)}</b>${(()=>{const r=l.filter(v=>v.s);return r.length?` · <b>${(r.reduce((a,v)=>a+v.s,0)/r.length).toFixed(1)}\\u2605</b>`:''})()}`;b.onclick=()=>seenSheet(l);el.appendChild(b)}).catch(()=>{})}catch(e){}};document.head.insertAdjacentHTML('beforeend','<style>#seenote{max-width:680px;margin:-26px auto 34px;padding:0 18px;font:500 12px var(--sans);color:var(--mute);text-align:center}.sbb{margin-left:auto;border:1px solid var(--acc);color:var(--acc);background:transparent;border-radius:999px;padding:4px 11px;font:600 12px var(--sans);cursor:pointer}.sbb b{color:var(--acc)}.mi{display:inline-flex;align-items:center;gap:inherit;white-space:nowrap}.rtx{display:inline-flex;align-items:center;gap:inherit;white-space:nowrap}.rtm{margin-left:10px;color:var(--gold,#c9a227);white-space:nowrap}.rtm small{color:var(--mute);font-size:.9em}.sbs{color:var(--gold,#c9a227);letter-spacing:1px}.sbl{max-height:48vh;overflow:auto;margin:14px -8px 0;text-align:left}.sbi{display:flex;align-items:center;gap:12px;width:100%;padding:9px 8px;border:0;border-bottom:1px solid var(--line);background:none;color:var(--ink);cursor:pointer;text-align:left}.sbi img,.sbi i{width:38px;height:38px;border-radius:50%;object-fit:cover;flex:none;background:var(--line)}.sbi span{display:flex;flex-direction:column;min-width:0}.sbi b{font:600 14.5px var(--sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sbi em{font:400 12px var(--sans);color:var(--mute);font-style:normal}</style>');const rateBox=document.createElement('div');rateBox.id='rate';rateBox.style.display='none';document.getElementById('endbar').before(rateBox);let rtC={};const rpBox=document.createElement('div');rpBox.id='rpl';rpBox.style.display='none';document.getElementById('endbar').before(rpBox);document.head.insertAdjacentHTML('beforeend','<style>#rpl{max-width:680px;margin:-14px auto 18px;padding:0 18px}#rpl .rq{display:flex;gap:8px;align-items:flex-start;padding:7px 0;cursor:pointer}#rpl .rq img,#rpl .rq i{width:20px;height:20px;border-radius:50%;object-fit:cover;flex:none;background:var(--line);margin-top:1px}#rpl .rq p{margin:0;font:400 13px/1.4 var(--sans);color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}#rpl .rq b{font-weight:600;color:var(--mute);margin-right:5px}#rpl .ra{display:block;margin-top:2px;font:500 12.5px var(--sans);color:var(--mute);background:none;border:0;padding:4px 0;cursor:pointer}</style>');async function rpLoad(){const h=cur&&cur.h;rpBox.style.display='none';rpBox.innerHTML='';if(!h||h.length!==42)return;try{const j=await (await fetch('/api/replies?h='+h)).json();if(!cur||cur.h!==h||!j.l||!j.l.length)return;rpBox.innerHTML=j.l.map(r=>`<div class='rq' data-rh='${esc(r.h)}' data-f='${+r.f||\"\"}'>${r.p?`<img src='${esc(img(r.p,60))}' alt=''>`:'<i></i>'}<p><b>@${esc(r.u)}</b>${esc(r.t)}</p></div>`).join('')+(j.n>j.l.length?`<button class='ra'>See all ${j.n} replies on Farcaster</button>`:'');rpBox.style.display='';rpBox.querySelectorAll('.rq').forEach(e=>e.onclick=async()=>{const rh=e.dataset.rh;if(sdk&&ctx){try{await sdk.actions.viewCast({hash:rh});return}catch(x){}}window.open('https://farcaster.xyz/~/conversations/'+rh,'_blank')});const ra=rpBox.querySelector('.ra');if(ra)ra.onclick=()=>$('#opencast').click()}catch(e){}}\nfunction rtDraw(){const h=cur&&cur.h;if(!h){rateBox.style.display='none';return}const u=ctx&&ctx.user,mine=isMine(),my=+(store.get('folio.rt.'+h)||0),o=rtC[h];\n  if(mine||!u){rateBox.style.display=o&&o.n?'':'none';rateBox.innerHTML=o&&o.n?`<div class='rtl1'>Rated <b>${o.a.toFixed(1)}</b> \\u2605</div><div class='rts ro'>${[1,2,3,4,5].map(i=>`<span class='${i<=Math.round(o.a)?'on':''}'>\\u2605</span>`).join('')}</div>`:'';return}\n  rateBox.style.display='';rateBox.innerHTML=`<div class='rtl1'>${my?'You rated this':'Rate this article'}${o&&o.n?` \\u00B7 <b>${o.a.toFixed(1)}</b> \\u2605`:''}</div><div class='rts'>${[1,2,3,4,5].map(i=>`<button data-s='${i}' class='${i<=my?'on':''}' aria-label='${i} star${i>1?'s':''}'>\\u2605</button>`).join('')}</div>`;\n  rateBox.querySelectorAll('button').forEach(b=>b.onclick=async()=>{const s=+b.dataset.s;store.set('folio.rt.'+h,String(s));rateBox.querySelectorAll('button').forEach(x=>x.classList.toggle('on',+x.dataset.s<=s));try{const t=await qaTok();if(!t)return;const j=await (await fetch('/api/rate?h='+h,{method:'POST',headers:{Authorization:'Bearer '+t,'content-type':'application/json'},body:JSON.stringify({s})})).json();if(j.n){rtC[h]={a:j.a,n:j.n};if(data)for(const k of['today','week','latest'])for(const x of data[k]||[])if(x.h===h){x.rs=j.a;x.rn=1}if(cur&&cur.h===h)rtDraw()}}catch(e){}})}\nasync function rtGet(h){try{const j=await (await fetch('/api/rate?h='+h)).json();rtC[h]=j;if(cur&&cur.h===h){rtDraw();drawStats()}}catch(e){}}\nconst hlBar=document.createElement('div');hlBar.id='hlbar';hlBar.innerHTML=`<button id='hlb'>\\u2726 Highlight</button><button id='hls'>Share quote</button>`;document.body.appendChild(hlBar);hlBar.addEventListener('pointerdown',e=>e.preventDefault());let hlSel='',hlC={},hlMine=jget('folio.hl',{});\nfunction hlText(){const s=getSelection();if(!s||s.isCollapsed||!cur||showingTr)return '';const m=document.querySelector('#art .md');if(!m||!m.contains(s.anchorNode)||!m.contains(s.focusNode))return '';const t=String(s).replace(/\\s+/g,' ').trim();return t.length>=8&&t.length<=300?t:''}\nlet hlT=null;document.addEventListener('selectionchange',()=>{clearTimeout(hlT);hlT=setTimeout(()=>{hlSel=hlText();hlBar.classList.toggle('open',!!hlSel);if(hlSel){const k=cur.h+'|'+hlSel;$('#hlb').textContent=hlMine[k]?'\\u2726 Highlighted':'\\u2726 Highlight';$('#hlb').style.display=sdk&&ctx&&ctx.user&&!isMine()?'':'none'}},180)});\nfunction hlShare(t){if(!cur)return;qsel=t.slice(0,280);qb.onclick()}\n$('#hls').onclick=()=>{const t=hlSel;if(t)hlShare(t)};\n$('#hlb').onclick=async()=>{const t=hlSel,h=cur&&cur.h;if(!t||!h)return;const k=h+'|'+t,on=!hlMine[k];if(on)hlMine[k]=1;else delete hlMine[k];store.set('folio.hl',JSON.stringify(hlMine));$('#hlb').textContent=on?'\\u2726 Highlighted':'\\u2726 Highlight';try{getSelection().removeAllRanges()}catch(e){}hlBar.classList.remove('open');try{const tk=await qaTok();if(!tk)return;await fetch('/api/hl?h='+h,{method:'POST',headers:{Authorization:'Bearer '+tk,'content-type':'application/json'},body:JSON.stringify({t})});delete hlC[h];hlGet(h)}catch(e){}};\nfunction hlMark(t){const m=document.querySelector('#art .md');if(!m||m.querySelector('mark.hl'))return;const w=document.createTreeWalker(m,NodeFilter.SHOW_TEXT);let n;const key=t.slice(0,60);while(n=w.nextNode()){const i=n.data.replace(/\\s+/g,' ').indexOf(key);if(i<0||n.data.replace(/\\s+/g,' ')!==n.data)continue;const r=document.createRange();r.setStart(n,i);r.setEnd(n,Math.min(n.data.length,i+t.length));const mk=document.createElement('mark');mk.className='hl';try{r.surroundContents(mk)}catch(e){}return}}\nfunction hlDraw(){const h=cur&&cur.h,o=h&&hlC[h],old=document.getElementById('tophl');if(old)old.remove();if(!o||!o.top||!o.top.length||showingTr)return;const x=o.top[0],d=document.createElement('div');d.id='tophl';d.innerHTML=`<div class='k'>\\u2726 Top highlight \\u00B7 ${nf(x.c)} ${x.c===1?'reader':'readers'}</div><q>${esc(x.t)}</q><button class='hshare'>Share quote</button>`;d.querySelector('.hshare').onclick=()=>hlShare(x.t);const f=$('#fst');if(f)f.after(d);hlMark(x.t)}\nasync function hlGet(h){try{const j=hlC[h]||(hlC[h]=await (await fetch('/api/hl?h='+h)).json());if(cur&&cur.h===h)hlDraw()}catch(e){}}\nconst _tr3=track;track=function(h){_tr3(h);rtDraw();rtGet(h);hlGet(h)};\nconst _ds3=drawStats;drawStats=function(){_ds3();try{const o=cur&&rtC[cur.h],el=$('#fst');if(el&&o&&o.n&&el.innerHTML&&!el.querySelector('.rtx')){const s=document.createElement('span');s.className='rtx';s.innerHTML=`<span class=\"dot\"></span><span>\\u2605 <b>${o.a.toFixed(1)}</b></span>`;el.insertBefore(s,el.querySelector('.sbb'))}}catch(e){}};\ndocument.getElementById('back').addEventListener('click',()=>{hlBar.classList.remove('open')});\ndocument.head.insertAdjacentHTML('beforeend','<style>#qbtn{display:none!important}#rate{max-width:680px;margin:0 auto 26px;padding:16px 18px;text-align:center;border-top:1px solid var(--line)}#rate .rtl1{font:500 13px var(--sans);color:var(--mute);margin-bottom:8px}#rate .rtl1 b{color:var(--ink)}.rts{display:flex;justify-content:center;gap:6px}.rts button,.rts span{font-size:30px;line-height:1;background:none;border:0;color:var(--line);cursor:pointer;padding:2px 4px;transition:transform .15s,color .15s}.rts .on{color:#E8A317}.rts button:active{transform:scale(1.25)}.rts.ro span{font-size:20px;cursor:default}#hlbar{position:fixed;left:50%;bottom:calc(70px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9;display:none;gap:6px;padding:6px;background:var(--ink);border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.25)}#hlbar.open{display:flex}#hlbar button{border:0;background:transparent;color:var(--paper);font:600 13px var(--sans);padding:8px 12px;border-radius:999px;cursor:pointer;white-space:nowrap}#hlbar button+button{border-left:1px solid rgba(255,255,255,.25);border-radius:0 999px 999px 0}mark.hl{background:rgba(232,163,23,.28);color:inherit;border-radius:3px;padding:0 1px}#tophl{margin:0 0 22px;padding:14px 16px;border-left:3px solid #E8A317;background:var(--card);border-radius:0 10px 10px 0}#tophl .k{font:600 11.5px var(--sans);color:#B07A0C;letter-spacing:.3px;text-transform:uppercase;margin-bottom:6px}#tophl q{display:block;overflow-wrap:anywhere;font:italic 17px/1.5 var(--serif);color:var(--ink);quotes:\"\\\\201C\" \"\\\\201D\"}#tophl .hshare{margin-top:10px;border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:999px;padding:5px 12px;font:600 12px var(--sans);cursor:pointer}</style>');\n\nconst isMineFid=f=>!!(ctx&&ctx.user&&ctx.user.fid===+f);\nasync function getPart(p,lang){\n  for(let k=0;k<3;k++){\n    const ac=new AbortController();const t=setTimeout(()=>ac.abort(),75000);\n    try{const r=await fetch(`/api/translate?h=${cur.h}&lang=${lang}&part=${p}`,{signal:ac.signal});const j=await r.json();clearTimeout(t);if(j.error)throw new Error(j.error);return j}\n    catch(e){clearTimeout(t);if(e.message===\"busy\"||k===2)throw e;await new Promise(r=>setTimeout(r,1500*(k+1)))}\n  }\n}\nasync function translate(){\n  if(!cur||!cur.article)return;\n  const tok=++trTok,lang=pref,b=$(\"#trbtn\");b.disabled=true;b.textContent=\"Translating\\u2026\";\n  try{\n    const j=await getPart(0,lang);\n    if(tok!==trTok||!cur)return;\n    showingTr=true;drawArticle(j.title||cur.article.title,j.text,lang);trPing(cur.h,lang);if(cur.st)drawStats();b.textContent=\"Original\";\n    if(j.parts>1)more(document.querySelector(\"#art .md\"),1,j.parts,lang,tok);\n  }catch(e){if(tok!==trTok)return;b.textContent=e.message===\"busy\"?\"Try again later\":\"Translate\";if(e.message!==\"busy\")alert(\"Translation is not available right now.\")}\n  b.disabled=false;\n}\nfunction more(box,p,parts,lang,tok){\n  const s=document.createElement(\"div\");s.className=\"loading trmore\";\n  s.innerHTML='<div class=\"sk\" style=\"height:16px;margin:10px 0\"></div><div class=\"sk\" style=\"height:16px;margin:10px 0;width:92%\"></div><div class=\"sk\" style=\"height:16px;margin:10px 0;width:70%\"></div>';\n  box.after(s);\n  // fetch this part right away so it is ready by the time the reader gets here\n  const job=getPart(p,lang);job.catch(()=>{});\n  let done=false;\n  const R=$(\"#reader\");\n  const near=()=>s.isConnected&&s.getBoundingClientRect().top<window.innerHeight+1800;\n  const go=async()=>{\n    if(done||!near())return;done=true;R.removeEventListener(\"scroll\",go);clearInterval(iv);\n    try{const j=await job;if(tok!==trTok||!showingTr)return;\n      box.insertAdjacentHTML(\"beforeend\",md(j.text));hydrateCasts(box);s.remove();if(p+1<parts)more(box,p+1,parts,lang,tok);}\n    catch(e){if(tok!==trTok)return;\n      s.className=\"note\";s.innerHTML=e.message===\"busy\"?'<span>The rest of this piece is not translated yet. Check back later.</span><button>Original</button>':'<span>This part did not load.</span><button>Retry</button>';\n      s.querySelector(\"button\").onclick=()=>{if(e.message===\"busy\"){trTok++;showingTr=false;$(\"#trbtn\").textContent=\"Translate\";drawArticle(cur.article.title,cur.article.body,null)}else{s.remove();more(box,p,parts,lang,tok)}};}\n  };\n  R.addEventListener(\"scroll\",go,{passive:true});\n  const iv=setInterval(()=>{if(tok!==trTok||!s.isConnected){clearInterval(iv);R.removeEventListener(\"scroll\",go);return}go()},700);\n  go();\n}\ndocument.head.insertAdjacentHTML('beforeend','<style>@media (max-width:420px){.rbar .in{gap:6px;padding:10px 12px}.rbar select{max-width:96px}.rbar button{padding:7px 10px}}#spd{min-width:44px;padding-left:8px;padding-right:8px}@media (max-width:440px){.bk{display:none}}@media (max-width:360px){#spd{min-width:40px;padding-left:6px;padding-right:6px}.rbar select{max-width:78px}.rbar button{padding:7px 8px}.rbar .in{gap:5px}}</style>');(function(){var S=window.speechSynthesis,B=document.getElementById('listen');if(!S||!B){if(B)B.style.display='none';return}var q=[],on=false,ok=true,st=false,wd=0,RS=[1,1.25,0.8],rt=parseFloat(localStorage.getItem('folio.rate'))||1,D=document.createElement('button');if(RS.indexOf(rt)<0)rt=1;D.id='spd';D.setAttribute('aria-label','Reading speed');D.title='Reading speed';D.textContent=rt+'x';B.after(D);document.getElementById('back').innerHTML='&larr;<span class=bk> Back</span>';D.onclick=function(){rt=RS[(RS.indexOf(rt)+1)%RS.length];D.textContent=rt+'x';try{localStorage.setItem('folio.rate',rt)}catch(e){}};function L(){if(showingTr)return pref;var m=document.querySelector('#art .md'),t=m?m.innerText.slice(0,1500):'',f={};for(var i=0;i<t.length;i++){var c=t.charCodeAt(i),k=c>=12352&&c<=12543?'ja':c>=44032&&c<=55215?'ko':c>=19968&&c<=40959?'zh':c>=1024&&c<=1279?'ru':c>=2304&&c<=2431?'hi':'';if(k)f[k]=(f[k]||0)+1}return f.ja>9?'ja':f.ko>19?'ko':f.zh>19?'zh':f.ru>19?'ru':f.hi>19?'hi':'en'}function voice(l){var vs=S.getVoices().filter(function(v){return v.lang.toLowerCase().replace('_','-').indexOf(l)===0});return vs.find(function(v){return /natural|premium|enhanced|google/i.test(v.name)})||vs[0]||null}function nm(){return LANGS[L()]||L()}function upd(){if(on)return;var all=S.getVoices();ok=!all.length||!!voice(L());B.textContent=ok?'Listen':'No voice';B.style.opacity=ok?'':'.45';B.title=ok?'':'Read aloud is not available in '+nm()+' on this device'}window.__flon=function(){return on};function stop(){var w=on;on=false;if(w)document.dispatchEvent(new Event('flstop'));q=[];S.cancel();upd()}function next(){if(on&&!q.length){stop();if(window.__fend)window.__fend();return}if(!on||!q.length)return stop();var l=L(),u=new SpeechSynthesisUtterance(q.shift());u.lang=l;var v=voice(l);if(v)u.voice=v;u.rate=rt;u.onend=next;u.onerror=function(e){if(e&&(e.error==='interrupted'||e.error==='canceled'))return;stop()};u.onstart=function(){st=true};window.__fu=u;S.speak(u);if(!st&&!wd){wd=setTimeout(function(){wd=0;if(on&&!st){S.cancel();var r=new SpeechSynthesisUtterance(u.text);r.lang=u.lang;if(u.voice)r.voice=u.voice;r.rate=u.rate;r.onend=next;r.onerror=stop;r.onstart=function(){st=true};window.__fu=r;S.speak(r)}},2500)}}B.onclick=function(){if(on)return stop();upd();if(!ok){alert('Read aloud is not available in '+nm()+' on this device yet.');return}var h=document.querySelector('#art h1'),m=document.querySelector('#art .md');if(!m)return;var P=/[.!?:。！？]$/,t=h?h.innerText+(P.test(h.innerText)?' ':'. '):'';m.querySelectorAll('h2,h3,h4,h5,p,li,blockquote,th,td').forEach(function(e){if(e.closest('.cc')||(e.parentElement&&e.parentElement.closest('p,li,blockquote,th,td')))return;var x=e.innerText.split(String.fromCharCode(10)).join(' ').trim();if(x)t+=x+(P.test(x)?' ':'. ')});if(t.length<20)t=(h?h.innerText+'. ':'')+m.innerText;q=(t.match(/[^.!?。！？]+[.!?。！？]*/g)||[t]).reduce(function(a,s){if(a.length&&(a[a.length-1]+s).length<220)a[a.length-1]+=s;else a.push(s);return a},[]);q=[].concat.apply([],q.map(function(s){if(s.length<=220)return [s];var o=[],c='';s.split(' ').forEach(function(w){if(c&&(c+' '+w).length>220){o.push(c);c=w}else c=c?c+' '+w:w});if(c)o.push(c);return o}));on=true;st=false;try{S.cancel();if(S.paused)S.resume()}catch(e){}document.dispatchEvent(new Event('flstart'));B.textContent='Stop';B.style.opacity='';next();if(/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)){try{if(!localStorage.getItem('folio.ioshint')){localStorage.setItem('folio.ioshint','1');var n=document.createElement('div');n.id='lhint';n.textContent='No sound? Turn off Silent mode and turn up the volume. Keep the screen on while listening.';document.body.appendChild(n);setTimeout(function(){n.remove()},7000)}}catch(e){}}};S.addEventListener('voiceschanged',upd);new MutationObserver(function(){if(on)stop();else upd()}).observe(document.getElementById('art'),{childList:true});document.getElementById('back').addEventListener('click',stop);new MutationObserver(function(){if(on&&!document.getElementById('reader').classList.contains('open'))stop()}).observe(document.getElementById('reader'),{attributes:true,attributeFilter:['class']});document.getElementById('lang').addEventListener('change',function(){setTimeout(upd,0)});upd()})();(function(){var B=document.getElementById('listen');if(!B||!window.speechSynthesis)return;var wl=null,pend=false,an=localStorage.getItem('folio.anx')!=='0',bar=document.createElement('div');bar.id='lbar';bar.innerHTML='<button id=lanx></button><button id=lstop>Stop</button>';document.body.appendChild(bar);var A1=document.getElementById('lanx');function lbl(){A1.textContent='Auto-next: '+(an?'On':'Off');A1.classList.toggle('on',an)}function lock(){try{if(navigator.wakeLock&&!wl)navigator.wakeLock.request('screen').then(function(x){wl=x;x.addEventListener('release',function(){wl=null})}).catch(function(){})}catch(e){}}function unlock(){try{if(wl)wl.release()}catch(e){}wl=null}A1.onclick=function(){an=!an;try{localStorage.setItem('folio.anx',an?'1':'0')}catch(e){}lbl()};document.getElementById('lstop').onclick=function(){pend=false;if(window.__flon&&window.__flon())B.click();hide()};function show(){bar.classList.add('open');lbl()}function hide(){if(pend)return;bar.classList.remove('open');unlock()}document.addEventListener('flstart',function(){show();lock()});document.addEventListener('flstop',function(){setTimeout(hide,50)});document.addEventListener('visibilitychange',function(){if(!document.hidden&&bar.classList.contains('open'))lock()});function nxt(){var c=cur&&cur.h,els=[].slice.call(document.querySelectorAll('#list [data-h]')).map(function(e){return e.getAttribute('data-h')}),i=els.indexOf(c);for(var k=i+1;k<els.length;k++)if(els[k]!==c)return els[k];return null}window.__fend=function(){if(!an)return;var n=nxt();if(!n)return;pend=true;show();openArticle(n,true)};new MutationObserver(function(){if(!pend)return;if(document.querySelector('#art .md')&&document.querySelector('#art h1')){pend=false;setTimeout(function(){if(cur&&!(window.__flon&&window.__flon()))B.click()},700)}}).observe(document.getElementById('art'),{childList:true,subtree:true});document.getElementById('back').addEventListener('click',function(){pend=false;hide()});document.head.insertAdjacentHTML('beforeend','<style>#lbar{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:8;display:none;gap:6px;padding:6px;background:var(--paper);border:1px solid var(--line);border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.18);max-width:calc(100vw - 20px)}#lbar.open{display:flex}#lhint{position:fixed;left:50%;bottom:calc(66px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9;width:calc(100vw - 40px);max-width:360px;padding:10px 14px;background:var(--ink);color:var(--paper);border-radius:12px;font:500 13px/1.4 var(--sans);text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.2)}#lbar button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:7px 11px;font:600 12.5px var(--sans);white-space:nowrap;cursor:pointer}#lbar button.on{border-color:var(--acc);color:var(--acc)}@media (max-width:360px){#lbar button{padding:6px 8px;font-size:11.5px}}</style>')})();\n$(\"#trbtn\").onclick=()=>{if(showingTr){trTok++;showingTr=false;$(\"#trbtn\").textContent=\"Translate\";drawArticle(cur.article.title,cur.article.body,null)}else translate()};\n\nconst qb=$(\"#qbtn\");let qsel=\"\";\nconst qHide=()=>{qb.style.display=\"none\"};\ndocument.addEventListener(\"selectionchange\",()=>{const sl=window.getSelection&&getSelection();const t=sl?String(sl).replace(/\\s+/g,\" \").trim():\"\";const n=sl&&sl.rangeCount?sl.anchorNode:null;const el=n&&(n.nodeType===1?n:n.parentElement);\n  if(cur&&cur.article&&!showingTr&&el&&el.closest(\"#art .md\")&&t.length>=8&&$(\"#reader\").classList.contains(\"open\")){qsel=t.slice(0,280);qb.style.display=\"block\"}else qHide()});\nqb.addEventListener(\"pointerdown\",e=>e.preventDefault());\nqb.onclick=async()=>{if(!cur||!cur.article||!qsel)return;const url=location.origin+\"/?a=\"+cur.h+\"&q=\"+encodeURIComponent(qsel);\n  const short=qsel.length>200?qsel.slice(0,197).replace(/\\s+\\S*$/,\"\")+\"\\u2026\":qsel;\n  const text=\"\\u201C\"+short+\"\\u201D\\n\\nFrom \\u201C\"+cleanT(cur.article.title)+\"\\u201D by @\"+cur.author.u;\n  qHide();try{getSelection().removeAllRanges()}catch(e){}\n  if(sdk&&ctx){try{await sdk.actions.composeCast({text,embeds:[url]});return}catch(e){}}\n  if(navigator.share){try{await navigator.share({text,url});return}catch(e){}}\n  try{await navigator.clipboard.writeText(text+\"\\n\"+url);alert(\"Quote copied\")}catch(e){}};\nfunction closeReader(){try{if(inMini()&&sdk&&sdk.back&&sdk.back.hide&&(sdk.back.visible||window._bkok))sdk.back.hide()}catch(_){}try{ntr(\"close\",{st:(new Error).stack.split(\"\\n\").slice(1,4).join(\"|\").slice(0,200)})}catch(_){}trTok++;qHide();document.title=\"Folio: the best Farcaster Articles\";$(\"#reader\").classList.remove(\"open\");document.body.style.overflow=\"\";cur=null}\nlet skipPop=false;$(\"#back\").onclick=()=>{closeReader();if(history.state&&history.state.a){skipPop=true;try{history.back()}catch(e){}setTimeout(()=>{skipPop=false;if(history.state&&history.state.a)history.replaceState({},\"\",\"/\")},500)}else history.replaceState({},\"\",\"/\")};\nwindow.onpopstate=e=>{if(skipPop){skipPop=false;return}if(e.state&&e.state.a)openArticle(e.state.a,false);else if(cur&&cur.h&&Date.now()-(window._lo||0)<4000){const d=Date.now()-(window._lo||0);window._lo=0;history.pushState({a:cur.h},\"\",location.pathname);}else{closeReader()}};\ndocument.addEventListener(\"click\",async e=>{const a=e.target.closest(\"a[data-ext]\");if(!a)return;e.preventDefault();const u=a.href;\n  const m=u.match(/\\/(0x[0-9a-fA-F]{8,64})(?:$|[?#])/);\n  if(sdk&&ctx){try{ if(m&&m[1].length===42){await sdk.actions.viewCast({hash:m[1]});return} await sdk.actions.openUrl(u);return}catch(err){}}\n  window.open(u,\"_blank\",\"noopener\")});\n$(\"#opencast\").onclick=async()=>{if(!cur)return;if(sdk&&ctx){try{await sdk.actions.viewCast({hash:cur.h});return}catch(e){}}window.open(`https://farcaster.xyz/${cur.author.u}/${cur.h.slice(0,10)}`,\"_blank\")};\nconst ord=n=>n+(n%100>=11&&n%100<=13?\"th\":({1:\"st\",2:\"nd\",3:\"rd\"}[n%10]||\"th\"));\nconst cleanT=t=>String(t||\"\").replace(/[\\p{Extended_Pictographic}\\p{Emoji_Modifier}\\u{1F1E6}-\\u{1F1FF}\\u{E0020}-\\u{E007F}\\u200D\\uFE0E\\uFE0F\\u20E3]/gu,\"\").replace(/#(\\d)/g,\"No. $1\").replace(/[#_]+/g,\" \").replace(/\\s+([,.!?:;])/g,\"$1\").replace(/\\s+/g,\" \").trim();\n$(\"#share\").onclick=async()=>{if(!cur)return;const url=location.origin+\"/?a=\"+cur.h;const n=rankOf(cur.h);const mine=ctx&&ctx.user&&ctx.user.fid===cur.author.fid;\n  const t=cleanT(cur.article.title);\n  const text=mine&&n?`My article \"${t}\" is ${ord(n)} on Folio today. Thanks to everyone who read it.`:n?`${t} by @${cur.author.u}, ${ord(n)} on Folio today`:`${t} by @${cur.author.u}`;\n  if(sdk&&ctx){try{await sdk.actions.composeCast({text,embeds:[url]});return}catch(e){}}\n  if(navigator.share){try{await navigator.share({title:cur.article.title,url});return}catch(e){}}\n  try{await navigator.clipboard.writeText(url);$(\"#share\").textContent=\"Link copied\"}catch(e){}};\n\ndocument.querySelectorAll(\".tip\").forEach(b=>b.onclick=async()=>{if(!(sdk&&ctx&&cur&&cur.author&&cur.author.fid))return;const usd=+b.dataset.tip;const t=b.textContent;\n  try{const o={token:\"eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",recipientFid:cur.author.fid};if(usd>0)o.amount=String(usd*1000000);const r=await sdk.actions.sendToken(o);if(r&&r.success===false)throw new Error(\"x\");b.textContent=\"Thanks for tipping\";setTimeout(()=>b.textContent=t,3000)}catch(e){}});\n\nlet loadTry=0;async function load(){\n  try{const fp=window._feedP;window._feedP=null;let d0=fp?await fp:null;if(!d0||!Array.isArray(d0.today)){const r=await fetch(\"/api/feed\");d0=await r.json()}data=d0;\n    $(\"#meta\").textContent=`${data.count} articles tracked · updated ${ago(data.updated)} ago`;render();if(cur&&cur.article){setShare();const r=$(\"#art .badge\");if(!r){const n=rankOf(cur.h);if(n){const h1=$(\"#art h1\");if(h1)h1.parentElement.insertAdjacentHTML(\"afterend\",badge(cur.h))}}}\n  }catch(e){loadTry=(loadTry||0)+1;$(\"#list\").innerHTML=`<div class=\"empty\">Could not load articles. Retrying\\u2026</div>`;if(loadTry<6)setTimeout(load,2000*loadTry)}\n}\n\n\n\nload();\nconst q=new URLSearchParams(location.search).get(\"a\");\nconst qst=new URLSearchParams(location.search).get(\"stories\");if(qst===\"1\"){const w=()=>data?openStories():setTimeout(w,300);w()}\nconst qm=new URLSearchParams(location.search).get(\"moment\");if(qm&&/^\\d+$/.test(qm)){const w=()=>data?moment(+qm,true):setTimeout(w,400);w()}\nconst qs=new URLSearchParams(location.search).get(\"stats\");if(qs&&/^\\d+$/.test(qs))showStats(qs);\nif(q&&/^0x[0-9a-fA-F]{40,64}$/.test(q)){history.replaceState({},\"\",\"/\");openArticle(q,true)}\n\nconst _T=(p,ms)=>Promise.race([Promise.resolve(p),new Promise(z=>setTimeout(z,ms))]);\nif(sdk){\n  try{ctx=await _T(sdk.context,2500)}catch(e){}\n  try{if(ctx&&document.querySelector(\"#moment.open #gmshare, #moment.open .gm\"))gcWarm()}catch(e){}\n  try{if(ctx&&cur&&cur.h&&cur.article){seenPost(cur.h);drawStats();rtDraw()}}catch(e){}\n  try{if(sdk.back&&sdk.back.show&&ctx&&ctx.client&&ctx.client.platformType===\"mobile\"){sdk.back.onback=()=>{if(cur)closeReader()};const lt=+(localStorage.getItem(\"folio.bkw\")||0);if(Date.now()-lt>20000){localStorage.setItem(\"folio.bkw\",String(Date.now()));ntr(\"bkw\");await _T(sdk.back.show(),900);await new Promise(z=>setTimeout(z,250))}window._bkok=1;if(!cur&&sdk.back.hide)await _T(sdk.back.hide(),900)}else if(sdk.back){window._bkok=1;sdk.back.onback=()=>{if(cur)closeReader()}}}catch(e){}try{await _T(sdk.actions.ready(),900)}catch(e){}try{if(ctx&&ctx.user&&ctx.user.fid&&!sessionStorage.getItem(\"folio.qaw\")){sessionStorage.setItem(\"folio.qaw\",\"1\");ntr(\"qaw\");qaTok()}}catch(e){}\n  try{if(sdk.back&&sdk.back.enableWebNavigation){let cp=null;try{cp=await sdk.getCapabilities()}catch(e){}}}catch(e){}\n  try{coverInit()}catch(e){}\n  if(ctx&&!(ctx.client&&ctx.client.added)){\n    const b=$(\"#addbtn\"),p=$(\"#addp\");b.style.display=\"\";\n    let added=false,asking=false;const done=()=>{added=true;b.style.display=\"none\";p.style.display=\"none\";store.set(\"folio.addp\",\"added\")};\n    const add=async()=>{if(added||asking)return;asking=true;try{const r=await sdk.actions.addMiniApp();if(!r||r.added!==false)done()}catch(e){}asking=false};\n    b.onclick=add;$(\"#addgo\").onclick=add;\n    $(\"#addx\").onclick=()=>{p.style.display=\"none\"};\n    setTimeout(()=>{if(!added&&!cur)p.style.display=\"\"},1800);\n    try{ntr(\"addq\",{s:\"skip-auto\"})}catch(_){}\n    try{sdk.on&&sdk.on(\"miniAppAdded\",done)}catch(e){}\n  }\n  if(ctx&&ctx.user&&ctx.user.fid){try{const j=await (await fetch(\"/api/following?fid=\"+ctx.user.fid)).json();if(j.fids&&j.fids.length){fcFids=j.fids;if(tab===\"following\")render()}}catch(e){}}\n  if(cur&&cur.article){setShare();drawArticleTipFix();drawStats()}\n  if(ctx&&ctx.user&&ctx.user.fid){const me=ctx.user.fid;const sb=$(\"#statsbtn\");const chk=()=>{if(allItems().some(x=>x.a&&x.a.fid===me)){sb.style.display=\"\";sb.onclick=()=>showStats(me);setTimeout(()=>{if(!cur)moment(me)},900);setTimeout(()=>{if(!cur&&!$('#moment').classList.contains('open'))weekly(me)},2800)}};if(data)chk();else setTimeout(chk,2500)}\n}\n\n\nasync function openCover(){const u=ctx&&ctx.user;if(!u||!u.fid)return;const M=$(\"#mo\"),box=$(\"#moment\");M.className=\"mo cvm\";M.style.setProperty(\"--mc\",\"#A8341C\");\nM.innerHTML=`<button class=\"x\" aria-label=\"Close\">&times;</button><div class=\"cvi\" id=\"cvi\"></div><p class=\"nx\" id=\"cvnx\">Printing your issue\\u2026</p><div class=\"bt\"><button class=\"pri\" id=\"cvshare\">Share my cover</button><button id=\"cvsave\">Save</button></div>`;\nbox.classList.add(\"open\");const close=()=>{box.classList.remove(\"open\");M.className=\"mo\"};M.querySelector(\".x\").onclick=close;box.onclick=e=>{if(e.target===box)close()};\nlet d=null;try{d=await (await fetch(\"/api/cover?fid=\"+u.fid)).json()}catch(e){}\nif(!d||!d.v){$(\"#cvnx\").textContent=\"Could not print your cover. Try again in a moment.\";return}\nconst col={red:\"#A8341C\",silver:\"#7E8C99\",gold:\"#B8871A\",black:\"#1B1A17\"}[d.tier]||\"#A8341C\";M.style.setProperty(\"--mc\",col);\nconst img=location.origin+\"/cover/\"+u.fid+\".png?f=p&v=\"+encodeURIComponent(d.v);const sm=location.origin+\"/cover/\"+u.fid+\".png?f=s&v=\"+encodeURIComponent(d.v);const cv=$(\"#cvi\");cv.classList.add(\"ld\");let tr=0;const pre=new Image();pre.onload=()=>{cv.style.backgroundImage=`url(\"${pre.src}\")`;cv.classList.remove(\"ld\")};pre.onerror=()=>{if(tr++<1){setTimeout(()=>{pre.src=img},800)}else{cv.classList.remove(\"ld\");$(\"#cvnx\").textContent=\"Could not load your cover. Try again in a moment.\"}};pre.src=sm;\n$(\"#cvnx\").innerHTML=`<b>${esc(d.edition)}</b> \\u00B7 ${esc(d.persona)}`+(d.next?`<br>Read ${d.next.need} more ${d.next.need===1?\"article\":\"articles\"} to reach the ${esc(d.next.edition)}`:\"<br>You reached the top edition\");\n$(\"#cvshare\").onclick=async()=>{const url=location.origin+\"/?cover=\"+u.fid;const text=`My Folio cover this week, made from what I read.`;\nif(sdk&&ctx){try{await sdk.actions.composeCast({text,embeds:[url]});return}catch(e){}}\nif(navigator.share){try{await navigator.share({text,url});return}catch(e){}}\ntry{await navigator.clipboard.writeText(text+\" \"+url);$(\"#cvshare\").textContent=\"Copied\"}catch(e){}};\n$(\"#cvsave\").onclick=async()=>{if(sdk&&sdk.actions&&sdk.actions.openUrl){try{await sdk.actions.openUrl(img);return}catch(e){}}window.open(img,\"_blank\")};\n}\nfunction coverInit(){const u=ctx&&ctx.user;if(!u||!u.fid)return;const b=$(\"#coverbar\");b.style.display=\"flex\";if(u.pfpUrl)$(\"#coverthumb\").style.backgroundImage=`url(\"${u.pfpUrl}\")`;b.onclick=openCover;if(new URLSearchParams(location.search).get(\"mycover\")===\"1\"){history.replaceState({},\"\",\"/\");setTimeout(openCover,600)}}\nfunction fixDots(){document.querySelectorAll('.by').forEach(b=>{let prev=null;b.querySelectorAll(':scope>*').forEach(el=>{if(el.classList.contains('mi')){const d=el.querySelector('.dot');if(d){d.style.display='';if(prev&&el.offsetTop>prev.offsetTop+4)d.style.display='none'}}if(el.offsetParent)prev=el})})}\nconst _rnd=render;render=function(){const r=_rnd.apply(this,arguments);requestAnimationFrame(fixDots);return r};addEventListener('resize',()=>requestAnimationFrame(fixDots));\nfunction pgSub(){let b=document.getElementById('pgsub');if(!b){b=document.createElement('button');b.id='pgsub';document.getElementById('endbar').prepend(b)}if(!cur||!cur.pg||!cur.pg.pub){b.style.display='none';return}b.style.display='';b.textContent='Subscribe on Paragraph';b.onclick=async()=>{const u=cur.pg.pub;if(sdk&&ctx){try{await sdk.actions.openUrl(u);return}catch(e){}}window.open(u,'_blank','noopener')}}\ndocument.head.insertAdjacentHTML('beforeend','<style>.pgb{display:inline-block;font:600 10.5px var(--sans);letter-spacing:.3px;color:#3E5BD8;border:1px solid #3E5BD8;border-radius:999px;padding:1px 7px;margin-left:2px;white-space:nowrap}html[data-theme=dark] .pgb{color:#8EA2F5;border-color:#8EA2F5}#pgsub{flex-basis:100%;background:#3E5BD8!important;border-color:#3E5BD8!important;color:#fff!important}</style>');\nconst _rc=render;render=function(){_rc();try{const C=document.querySelectorAll('#chips [data-c]');const L=data&&Array.isArray(data[tab])?data[tab]:null;if(!L){C.forEach(c=>c.style.display='');return}let off=null;C.forEach(c=>{const k=c.dataset.c;const ok=!k||L.some(x=>k==='paragraph'?x.pg:x.topic===k);c.style.display='';c.style.opacity=ok?'':'.45'})}catch(e){}};\nconst SUPU=[3,5,10];const USDC_ID='eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';\nfunction supBtn(){try{const au=cur&&cur.author;const old=document.getElementById('supb');if(old)old.remove();const olde=document.getElementById('supe');if(olde)olde.remove();if(!au||!au.fid)return;const by=document.querySelector('#art .by');if(!by)return;if(isMine()){const c=document.createElement('button');c.id='supb';c.className='fl spb';c.textContent='Support \\uD83D\\uDCB0';c.onclick=()=>showStats(au.fid);by.appendChild(c);(async()=>{try{const t=await qaTok(1);const j=await (await fetch('/api/support?fid='+au.fid,{headers:t?{Authorization:'Bearer '+t}:{}})).json();if(document.getElementById('supb')===c)c.textContent='Support \\uD83D\\uDCB0 +'+(j.n||0)}catch(e){}})();return}const b=document.createElement('button');b.id='supb';b.className='fl spb';b.textContent='Tip or support '+(au.u?'@'+au.u:'this writer');b.onclick=()=>supSheet(au);const e=document.createElement('div');e.id='supe';const nm=esc(au.n||au.u||'this writer'),hn=au.u?'@'+esc(au.u):'';e.innerHTML=`<div class='sek'>Support the writer</div><div class='sew'>${au.p?`<img src='${esc(img(au.p,120))}' alt=''>`:''}<div><b>${nm}</b>${hn?`<span>${hn}</span>`:''}</div></div><p class='set'>Liked this piece? Send a one-time tip or support ${nm} monthly in USDC on Base. All of it goes to the writer.</p><button class='seb'>Tip or support</button>`;e.querySelector('.seb').onclick=()=>supSheet(au);const rb=document.getElementById('rate'),eb=document.getElementById('endbar');(rb||eb).before(e);supMine(au.fid)}catch(e){}}\nasync function supMine(f){try{const t=sdk&&ctx&&ctx.user?await qaTok(1):null;const j=await (await fetch('/api/support?fid='+f,{headers:t?{Authorization:'Bearer '+t}:{}})).json();const b=document.querySelector('#supe .seb');if(!b||!cur||!cur.author||cur.author.fid!==f)return;if(j.mine&&j.mine.until>Date.now()){b.classList.add('on');b.textContent='You support '+(cur.author.u?'@'+cur.author.u:'this writer')}}catch(e){}}\nfunction supSheet(au){const M=$('#mo'),box=$('#moment');M.style.setProperty('--mc','var(--grn)');let plan='m',amt=3;\n  const close=()=>box.classList.remove('open');\n  const msg=t=>{const e=$('#spm');if(e)e.textContent=t};\n  const lbl=()=>amt?`Support with $${amt*(plan==='y'?10:1)}`:'Support';\n  function draw(){const mult=plan==='y'?10:1;const other=!SUPU.includes(amt);\n    M.innerHTML=`<button class='x' aria-label='Close'>&times;</button>${au.p?`<img class='spav' src='${esc(img(au.p,120))}' alt=''>`:''}<div class='k'>Support a writer</div><h2>Support ${esc(au.n||au.u)}</h2><p class='t'>Your USDC goes straight to @${esc(au.u)}\\u2019s wallet on Base. Folio takes nothing.</p><button class='sptip' id='sptip'>Tip</button><p class='spn' style='margin:-2px 0 12px;text-align:center'>A one-time tip, any amount. Or support every month:</p><div class='spt'><button data-p='m' class='${plan==='m'?'on':''}'>Monthly</button><button data-p='y' class='${plan==='y'?'on':''}'>Yearly</button></div><div class='spa'>${SUPU.map(u=>`<button data-a='${u}' class='${amt===u?'on':''}'>$${u*mult}</button>`).join('')}<button data-a='0' class='${other?'on':''}'>Other</button></div>${other?`<input id='spin' type='number' min='1' max='500' step='1' inputmode='numeric' value='${amt||''}' placeholder='Dollars per month, 1 or more'><p class='spn' style='margin:-4px 0 8px'>Dollars per month${plan==='y'?', billed as 10 months':''}</p>`:''}<p class='spn'>${plan==='y'?'One payment covers 12 months, priced as 10.':'One payment covers 30 days.'} No automatic charges. If you added Folio, we\\u2019ll remind you before it ends.</p><div class='bt'><button class='pri' id='spgo'>${lbl()}</button></div><p class='spm' id='spm'></p>`;\n    M.querySelector('.x').onclick=close;\n    M.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{plan=b.dataset.p;draw()});\n    M.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{amt=+b.dataset.a;draw();const i=$('#spin');if(i)i.focus()});\n    const i=$('#spin');if(i)i.oninput=()=>{const v=Math.floor(+i.value);amt=v>0?Math.min(500,v):0;$('#spgo').textContent=lbl()};\n    $('#spgo').onclick=pay;$('#sptip').onclick=tip}\n  async function tip(){if(!(sdk&&ctx&&ctx.user)){msg('Open Folio inside Farcaster to tip writers.');return}const b=$('#sptip');b.disabled=true;msg('Waiting for your wallet\\u2026');try{const r=await sdk.actions.sendToken({token:USDC_ID,recipientFid:au.fid});if(r&&r.success&&r.send&&r.send.transaction){msg('Thanks for the tip. It went straight to @'+(au.u||'the writer')+'.');b.textContent='Tipped'}else msg(r&&r.reason==='rejected_by_user'?'Cancelled.':'Tip didn\\u2019t go through.')}catch(e){msg('Tip didn\\u2019t go through.')}b.disabled=false}\n  async function confirmTx(tx,p){msg('Confirming on Base\\u2026');for(let k=0;k<4;k++){try{const t=await qaTok();const r=await fetch('/api/support?fid='+au.fid,{method:'POST',headers:{Authorization:'Bearer '+t,'content-type':'application/json'},body:JSON.stringify({tx,plan:p})});const j=await r.json();if(j.ok){store.set('folio.suptx','');done(j);return}if(r.status!==202){store.set('folio.suptx','');msg(j.error==='amount'?'That payment was too small for this plan.':j.error==='used'?'This payment was already counted.':j.error==='sender'?'Please pay from the wallet linked to your Farcaster account.':j.error==='old'?'This payment is too old to count as support.':'We couldn\\u2019t confirm this payment.');return}}catch(e){}await new Promise(r=>setTimeout(r,4000))}msg('Payment sent. Confirmation is slow right now; Folio will finish it next time you open the app.')}\n  function done(j){const d=new Date(j.until).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});M.innerHTML=`<button class='x' aria-label='Close'>&times;</button><div class='medal'><b>\\u2665</b><div class='shine'></div></div><div class='k'>Thank you</div><h2>You\\u2019re supporting ${esc(au.n||au.u)}</h2><p class='t'>$${j.usd} sent. You\\u2019re a supporter until ${d}.</p><div class='bt'><button class='pri' id='spsh'>Share</button><button id='spok'>Done</button></div>`;M.querySelector('.x').onclick=close;$('#spok').onclick=close;$('#spsh').onclick=async()=>{try{await sdk.actions.composeCast({text:'Now supporting '+(au.u?'@'+au.u:(au.n||'this writer'))+' on Folio.',embeds:[location.origin+'/?support='+au.fid]})}catch(e){}};const b=document.querySelector('#supe .seb');if(b){b.classList.add('on');b.textContent='You support '+(cur.author.u?'@'+cur.author.u:'this writer')}}\n  async function pay(){if(!(sdk&&ctx&&ctx.user)){msg('Open Folio inside Farcaster to support writers.');return}if(!amt){msg('Enter an amount of 1 dollar or more.');return}const usd=amt*(plan==='y'?10:1);const g=$('#spgo');g.disabled=true;msg('Waiting for your wallet\\u2026');\n    try{const r=await sdk.actions.sendToken({token:USDC_ID,recipientFid:au.fid,amount:String(usd*1000000)});const tx=r&&r.success&&r.send&&r.send.transaction;\n      if(!tx){msg(r&&r.reason==='rejected_by_user'?'Cancelled.':'Payment didn\\u2019t go through.');g.disabled=false;return}\n      store.set('folio.suptx',JSON.stringify({tx,p:plan,f:au.fid}));await confirmTx(tx,plan)}catch(e){msg('Payment didn\\u2019t go through.')}\n    const g2=$('#spgo');if(g2)g2.disabled=false}\n  draw();box.classList.add('open');box.onclick=e=>{if(e.target===box)close()}}\nconst _daS=drawArticle;drawArticle=function(){_daS.apply(this,arguments);supBtn()};\nif(cur&&cur.article)supBtn();\nconst _ssS=showStats;showStats=async function(fid){await _ssS(fid);try{if(!isMineFid(fid))return;const t=await qaTok();if(!t)return;const j=await (await fetch('/api/support?fid='+fid,{headers:{Authorization:'Bearer '+t}})).json();const s=document.querySelector('#list .stt');if(!s||s.querySelector('.spl'))return;const w=document.createElement('div');w.className='spl';w.innerHTML=`<b>${nf(j.n||0)} ${j.n===1?'supporter':'supporters'}</b>`+(j.items&&j.items.length?j.items.map(v=>`<div class='spi'>${v.p?`<img src='${esc(img(v.p,64))}' alt=''>`:'<i></i>'}<span>${esc(v.n||v.u||'fid '+v.f)}<em>$${v.usd} ${v.plan==='y'?'yearly':'monthly'} \\u00b7 until ${new Date(v.until).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</em></span></div>`).join(''):`<p>Readers who support you monthly or yearly show up here.</p>`);s.appendChild(w)}catch(e){}};\ntry{const ps=JSON.parse(store.get('folio.suptx')||'null');if(ps&&ps.tx&&sdk&&ctx&&ctx.user)qaTok(1).then(t=>t&&fetch('/api/support?fid='+ps.f,{method:'POST',headers:{Authorization:'Bearer '+t,'content-type':'application/json'},body:JSON.stringify({tx:ps.tx,plan:ps.p})}).then(r=>{if(r.status!==202)store.set('folio.suptx','')})).catch(()=>{})}catch(e){}\n{const qsp=new URLSearchParams(location.search).get('support');if(qsp&&/^[0-9]+$/.test(qsp))fetch('/api/support?a=1&fid='+qsp).then(r=>r.json()).then(j=>{if(j.a&&j.a.u)supSheet({fid:+qsp,u:j.a.u,n:j.a.n,p:j.a.p})}).catch(()=>{})}\ndocument.head.insertAdjacentHTML('beforeend','<style>.spb{border-color:var(--grn)!important;color:var(--grn)!important;margin-left:6px}.spb.on{background:var(--grn)!important;color:#fff!important}.spav{width:64px;height:64px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 12px}.spt,.spa{display:flex;gap:6px;justify-content:center;margin:0 0 10px;flex-wrap:wrap}.spt button,.spa button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:8px 14px;font:600 13.5px var(--sans);cursor:pointer}.spt button.on,.spa button.on{border-color:var(--grn);background:var(--grn);color:#fff}#spin{width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font:15px var(--sans);margin:0 0 10px;text-align:center}.spn{font:500 12px/1.45 var(--sans);color:var(--mute);margin:4px 0 14px}.spm{min-height:16px;margin:10px 0 0;font:500 13px var(--sans);color:var(--mute)}.spl{margin-top:14px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;font:500 13.5px var(--sans)}.spl>b{display:block;margin-bottom:6px}.spl p{margin:0;color:var(--mute);font-size:12.5px}.spi{display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px solid var(--line)}.spi img,.spi i{width:30px;height:30px;border-radius:50%;object-fit:cover;background:var(--line);flex:none}.spi span{display:flex;flex-direction:column}.spi em{font-style:normal;color:var(--mute);font-size:12px}</style>');\n\n\n// ---- Folio Requests (2026-11-16) ----\n(function(){\nwindow.RQA=window.RQA||{};let RQ=null,rqOpenAns=0,rqBusy=false;\nconst rqFid=()=>ctx&&ctx.user&&ctx.user.fid||0;\nconst RQC=[[\"\",\"Any topic\"],[\"crypto\",\"Crypto\"],[\"money\",\"Money\"],[\"builders\",\"Builders\"],[\"farcaster\",\"Farcaster\"],[\"culture\",\"Culture\"],[\"life\",\"Life\"]];\nconst rqCat=c=>(RQC.find(x=>x[0]===c)||[\"\",\"\"])[1];\nfunction rqSet(j){if(!j||!j.open)return;RQ=j;const m={};for(const r of j.done)if(r.ans&&r.ans.h)m[r.ans.h]=r.id;window.RQA=m}\nasync function rqGet(){try{const r=await fetch(\"/api/requests\",{cache:\"no-store\"});rqSet(await r.json())}catch(e){}return RQ}\nasync function rqPost(body){const t=await qaTok();if(!t)return{error:\"Open Folio in Farcaster to do this.\"};const u=ctx&&ctx.user||{};\n  try{const r=await fetch(\"/api/requests\",{method:\"POST\",headers:{Authorization:\"Bearer \"+t,\"content-type\":\"application/json\"},body:JSON.stringify({...body,u:u.username||\"\"})});const j=await r.json();if(j&&j.open)rqSet(j);return j}catch(e){return{error:\"Something went wrong. Try again.\"}}}\nfunction rqCard(r){const me=rqFid(),mine=me&&r.f===me,backed=me&&r.b&&r.b.includes(me),n=r.n;\n  const who=`<span>@${esc(r.u)}</span><span>${Date.now()-r.ts<60000?\"just now\":ago(r.ts)}</span>${r.c?`<span>${esc(rqCat(r.c))}</span>`:\"\"}`;\n  if(r.ans){const asked=me&&r.b&&r.b.includes(me);\n    return `<div class=\"rqi done\" data-id=\"${r.id}\"><p class=\"rqt\">${esc(r.t)}</p><div class=\"rqm\">${who}<span>${n} ${n===1?\"reader\":\"readers\"} asked</span></div>${asked?`<div class=\"rqy\">You asked for this</div>`:\"\"}<button class=\"rqans\" data-h=\"${esc(r.ans.h)}\"><em>Answered by @${esc(r.ans.au)}</em><b>${esc(r.ans.title)}</b></button></div>`}\n  const clm=r.cl&&r.cl.f===me;\n  return `<div class=\"rqi\" data-id=\"${r.id}\"><p class=\"rqt\">${esc(r.t)}</p><div class=\"rqm\">${who}</div>${r.cl?`<div class=\"rqc\">Claimed by @${esc(r.cl.u)}</div>`:\"\"}\n  <div class=\"rqa\"><button class=\"rqme${backed?\" on\":\"\"}\"${mine?\" disabled\":\"\"}>${mine?\"Your request\":\"Me too\"}</button><span class=\"rqn\">${n} ${n===1?\"wants\":\"want\"} this</span>\n  ${r.cl?(clm?`<button class=\"rqlink\">Add the article</button><button class=\"rqcl\">Drop it</button>`:`<button class=\"rqlink\">I wrote it</button>`):`<button class=\"rqcl\">I'll write this</button>`}<button class=\"rqsh\">Share</button>${mine&&!r.cl?`<button class=\"rqdel\">Remove</button>`:\"\"}</div>\n  <div class=\"rqlf\" style=\"display:none\"><input type=\"url\" inputmode=\"url\" placeholder=\"Link to your Farcaster Article\" autocomplete=\"off\"><button class=\"rqsv\">Save</button></div><div class=\"rqmsg\"></div></div>`}\nasync function rqRender(){\n  $(\"#chips\").style.display=\"none\";const L=$(\"#list\"),me=rqFid();\n  const form=me?`<div class=\"rqf\"><textarea id=\"rqin\" maxlength=\"140\" rows=\"2\" placeholder=\"What do you want to read about?\"></textarea><div class=\"rqfr\"><select id=\"rqcat\" aria-label=\"Topic\">${RQC.map(c=>`<option value=\"${c[0]}\">${c[1]}</option>`).join(\"\")}</select><span id=\"rqcnt\">0/140</span><button id=\"rqgo\">Ask</button></div><div class=\"rqmsg\" id=\"rqfm\"></div></div>`\n    :`<div class=\"rqf rqweb\">Open Folio in Farcaster to post a request or back one with Me too.</div>`;\n  L.innerHTML=`<div class=\"rqh\"><h2>Requests</h2><p>Ask for the article you want to read. Back other requests with Me too. Writers can pick one up and publish it on Farcaster.</p></div>${form}<div id=\"rqls\"><div class=\"loading\">Loading requests\\u2026</div></div>`;\n  if(me){const I=$(\"#rqin\"),C=$(\"#rqcnt\");I.oninput=()=>{C.textContent=I.value.length+\"/140\"};\n    $(\"#rqgo\").onclick=async()=>{const t=I.value.trim(),M=$(\"#rqfm\");if(t.length<8){M.textContent=\"Write a few more words about what you want to read.\";return}if(rqBusy)return;rqBusy=true;M.textContent=\"Posting\\u2026\";\n      const j=await rqPost({act:\"new\",t,c:$(\"#rqcat\").value});rqBusy=false;if(j.error){M.textContent=j.error;return}I.value=\"\";C.textContent=\"0/140\";M.textContent=j.dup?\"Someone already asked for this. We added your Me too.\":\"Posted. Share it so writers see it.\";rqList()}}\n  if(!RQ)await rqGet();if(tab!==\"requests\")return;rqList()}\nfunction rqList(){const B=$(\"#rqls\");if(!B)return;if(!RQ){B.innerHTML=`<div class=\"empty\">Requests are not available right now.</div>`;return}\n  B.innerHTML=(RQ.open.length?RQ.open.map(rqCard).join(\"\"):`<div class=\"empty\">${RQ.done.length?\"No open requests right now. Ask for the article you want to read.\":\"No requests yet. Ask for the article you want to read.\"}</div>`)+(RQ.done.length?`<h3 class=\"rqsec\">Answered</h3>`+RQ.done.map(rqCard).join(\"\"):\"\");\n  B.querySelectorAll(\".rqi\").forEach(el=>{const id=+el.dataset.id,r=[...RQ.open,...RQ.done].find(x=>x.id===id);if(!r)return;const M=el.querySelector(\".rqmsg\");\n    const act=async(body)=>{if(!rqFid()){if(M)M.textContent=\"Open Folio in Farcaster to do this.\";return}if(rqBusy)return;rqBusy=true;if(M)M.textContent=\"\";const j=await rqPost({...body,id});rqBusy=false;if(j.error){if(M)M.textContent=j.error;return}rqList()};\n    const q=s=>el.querySelector(s);\n    if(q(\".rqme\"))q(\".rqme\").onclick=()=>act({act:\"back\"});\n    if(q(\".rqcl\"))q(\".rqcl\").onclick=()=>act({act:\"claim\"});\n    if(q(\".rqdel\"))q(\".rqdel\").onclick=()=>act({act:\"del\"});\n    if(q(\".rqlink\"))q(\".rqlink\").onclick=()=>{if(!rqFid()){M.textContent=\"Open Folio in Farcaster to do this.\";return}const f=q(\".rqlf\");f.style.display=f.style.display===\"none\"?\"flex\":\"none\";if(f.style.display!==\"none\")f.querySelector(\"input\").focus()};\n    if(q(\".rqsv\"))q(\".rqsv\").onclick=async()=>{const u=q(\".rqlf input\").value.trim();if(!u){M.textContent=\"Paste the link first.\";return}M.textContent=\"Checking the link\\u2026\";if(rqBusy)return;rqBusy=true;const j=await rqPost({act:\"answer\",id,url:u});rqBusy=false;if(j.error){M.textContent=j.error;return}rqList()};\n    if(q(\".rqans\"))q(\".rqans\").onclick=()=>openArticle(q(\".rqans\").dataset.h,true);\n    if(q(\".rqsh\"))q(\".rqsh\").onclick=async()=>{const text=`I want to read about: ${r.t.replace(/[.!?]+$/,\"\")}. Who's writing it?`,url=location.origin+\"/?tab=requests\";\n      if(sdk&&ctx){try{await sdk.actions.composeCast({text,embeds:[url]});return}catch(e){}}\n      if(navigator.share){try{await navigator.share({text,url});return}catch(e){}}\n      try{await navigator.clipboard.writeText(text+\" \"+url);M.textContent=\"Copied\"}catch(e){}};\n  })}\nconst _rR=render;render=function(){if(tab===\"requests\"){rqRender();return}return _rR.apply(this,arguments)};\nconst _daR=drawArticle;drawArticle=function(){_daR.apply(this,arguments);try{const o=document.getElementById(\"rqlab\");if(o)o.remove();if(cur&&cur.h&&window.RQA[cur.h]){const h1=document.querySelector(\"#art h1\");if(h1){const d=document.createElement(\"div\");d.id=\"rqlab\";d.className=\"rqlab\";d.textContent=\"Requested by readers\";h1.before(d)}}}catch(e){}};\nwindow.__freq=()=>{tab=\"requests\";[...$(\"#tabs\").children].forEach(x=>x.classList.toggle(\"on\",x.dataset.t===\"requests\"));rqRender()};\n{const qp=new URLSearchParams(location.search);if(qp.get(\"tab\")===\"requests\")setTimeout(()=>window.__freq(),300)}\nrqGet().then(()=>{try{if(Object.keys(window.RQA).length&&[\"today\",\"week\",\"latest\",\"following\",\"saved\"].includes(tab))render()}catch(e){}});\n})();\n\n\n// ---- Folio Learn (2026-11-15) ----\n(function(){\nconst LP=jget(\"folio.lp\",{});let LC=null,lrMe=null;\nconst lpSave=()=>store.set(\"folio.lp\",JSON.stringify(LP));\nconst passed=h=>!!LP[h]||!!(lrMe&&lrMe.l&&lrMe.l.some(e=>e.h===h));\nconst myFid=()=>ctx&&ctx.user&&ctx.user.fid||0;\nasync function lrLoad(fid){const j=await (await fetch(\"/api/learner?fid=\"+fid)).json();return j}\nasync function lcLoad(){if(LC)return LC;const j=await (await fetch(\"/api/learn\")).json();LC=j;return j}\nconst tabsEl=$(\"#tabs\");if(tabsEl&&!tabsEl.querySelector('[data-t=\"learn\"]')){const b=document.createElement(\"button\");b.dataset.t=\"learn\";b.textContent=\"Learn\";const t=tabsEl.querySelector('[data-t=\"latest\"]')||tabsEl.querySelector('[data-t=\"today\"]');t.after(b)}\nasync function learnRender(){\n  $(\"#chips\").style.display=\"none\";const L=$(\"#list\");\n  L.innerHTML=`<div class=\"lrh\"><h2>Learn</h2><p>Short courses made from the best articles on Farcaster. Read a lesson, answer 3 questions, and it goes on your transcript. Pass ${3} lessons in a course to earn its badge.</p><button id=\"lrme\" class=\"lrbt\">Your transcript</button></div><div id=\"lrc\"><div class=\"loading\">Loading courses\\u2026</div></div>`;\n  $(\"#lrme\").onclick=()=>showTranscript(myFid()||0);\n  try{const f=myFid();if(f&&!lrMe){try{lrMe=await lrLoad(f)}catch(e){}}\n    const j=await lcLoad();if(tab!==\"learn\")return;const C=$(\"#lrc\");\n    if(!j.courses||!j.courses.length){C.innerHTML=`<div class=\"empty\">Courses are being put together. Check back soon.</div>`;return}\n    C.innerHTML=j.courses.map(c=>{const done=c.lessons.filter(x=>passed(x.h)).length;const lr=c.lessons.reduce((s,x)=>s+(x.n||0),0);\n      return `<section class=\"lrs\"><div class=\"lrsh\"><div><h3>${esc(c.n)}</h3><p>${esc(c.d)}</p></div><span class=\"lrp${done>=j.badge?\" on\":\"\"}\">${done>=j.badge?\"Badge earned\":done+\" of \"+j.badge}</span></div>`+\n      c.lessons.map((x,i)=>`<button class=\"lrl\" data-lh=\"${esc(x.h)}\"><span class=\"lrn${passed(x.h)?\" ok\":\"\"}\">${passed(x.h)?\"\\u2713\":i+1}</span><span class=\"lrt\"><b>${esc(x.title)}</b><em>@${esc(x.a.u)} \\u00B7 ${x.min} min${x.n?` \\u00B7 ${x.n} learned`:\"\"}</em></span></button>`).join(\"\")+\n      (lr?`<p class=\"lrf\">${lr} ${lr===1?\"lesson passed\":\"lessons passed\"} by readers</p>`:\"\")+`</section>`}).join(\"\");\n    C.querySelectorAll(\".lrl\").forEach(b=>b.onclick=()=>openArticle(b.dataset.lh,true));\n  }catch(e){const C=$(\"#lrc\");if(C)C.innerHTML=`<div class=\"empty\">Courses are not available right now.</div>`}\n}\nconst _rL=render;render=function(){if(tab===\"transcript\")return;if(tab===\"learn\"){learnRender();return}return _rL.apply(this,arguments)};\n// test box under each article\n// warm up the quiz once the reader is ~60% through, so \"Test yourself\" opens instantly\nconst QPRE={};\nfunction qPre(h,el){if(QPRE[h])return;const R=document.getElementById(\"reader\");const iv=setInterval(()=>{if(QPRE[h]||!cur||cur.h!==h||!el.isConnected){clearInterval(iv);return}if(document.hidden)return;const H=(R&&R.scrollHeight>window.innerHeight*1.2)?R.scrollHeight:document.documentElement.scrollHeight;if(el.getBoundingClientRect().top<window.innerHeight+0.4*H){clearInterval(iv);QPRE[h]=fetch(\"/api/quiz?pre=1&h=\"+h).then(r=>r.json()).catch(()=>null)}},1500)}\nfunction quizBox(){const old=document.getElementById(\"lrq\");if(old)old.remove();if(!cur||!cur.article)return;\n  const words=(cur.article.body||\"\").split(/\\s+/).length;if(words<250)return;\n  const d=document.createElement(\"div\");d.id=\"lrq\";d.className=\"lrq\";const ok=passed(cur.h);\n  d.innerHTML=`<div><b>${ok?\"Lesson passed\":\"Test yourself\"}</b><span id=\"lrqn\">${ok?\"It\\u2019s on your transcript.\":\"3 quick questions about this article.\"}</span></div><button id=\"lrqgo\">${ok?\"Transcript\":\"Start\"}</button>`;\n  const eb=document.getElementById(\"endbar\");eb.after(d);\n  $(\"#lrqgo\").onclick=()=>ok?showTranscript(myFid()||0):openQuiz(cur.h);\n  if(!ok)qPre(cur.h,d);\n  fetch(\"/api/learnn?h=\"+cur.h).then(r=>r.json()).then(j=>{if(j&&j.n&&!ok){const s=$(\"#lrqn\");if(s)s.textContent=`3 quick questions. ${j.n} ${j.n===1?\"reader has\":\"readers have\"} passed this one.`}}).catch(()=>{})}\nconst _daL=drawArticle;drawArticle=function(){_daL.apply(this,arguments);try{quizBox()}catch(e){}};\nif(cur&&cur.article)quizBox();\nasync function openQuiz(h){\n  const box=$(\"#moment\"),M=$(\"#mo\");M.style.setProperty(\"--mc\",\"var(--grn)\");\n  const close=()=>{box.classList.remove(\"open\");if(tab===\"learn\")learnRender()};\n  M.innerHTML=`<button class='x' aria-label='Close'>&times;</button><div class='k'>Test yourself</div><div class=\"loading\" style=\"padding:24px 0\">Getting your questions ready\\u2026</div>`;\n  box.classList.add(\"open\");M.querySelector(\".x\").onclick=close;box.onclick=e=>{if(e.target===box)close()};\n  if(QPRE[h])try{await QPRE[h]}catch(e){}\n  let j;try{j=await (await fetch(\"/api/quiz?h=\"+h)).json()}catch(e){j={error:\"net\"}}\n  if(!j||j.error||!j.q){M.innerHTML=`<button class='x' aria-label='Close'>&times;</button><div class='k'>Test yourself</div><p class='t'>${j&&j.error===\"busy\"?\"Questions are resting for today. Try again tomorrow.\":\"Questions aren\\u2019t available for this article right now.\"}</p>`;M.querySelector(\".x\").onclick=close;return}\n  const ans=[null,null,null];const art=cur&&cur.h===h?cur:null;\n  const draw=(wrong)=>{if(wrong)wrong.forEach(i=>{ans[i]=null});M.innerHTML=`<button class='x' aria-label='Close'>&times;</button><div class='k'>Test yourself</div>`+j.q.map((q,i)=>`<div class=\"qq${wrong&&wrong.includes(i)?\" bad\":\"\"}\"><p>${i+1}. ${esc(q.t)}</p>${q.o.map((o,k)=>`<button data-q=\"${i}\" data-o=\"${k}\" class=\"${ans[i]===k?\"on\":\"\"}\">${esc(o)}</button>`).join(\"\")}</div>`).join(\"\")+`<p class=\"qm\" id=\"qm\">${wrong?`${wrong.length===1?\"One answer is\":wrong.length+\" answers are\"} not right yet. They\\u2019re marked in red, pick again.`:\"\"}</p><div class='bt'><button class='pri' id='qgo'>Check answers</button></div><p style=\"text-align:center;margin:12px 0 0\"><button id='qflag' style=\"background:none;border:0;padding:4px;font:13px var(--sans);color:var(--mut,#8A8478);text-decoration:underline;cursor:pointer\">A question looks wrong?</button></p>`;\n    M.querySelector(\".x\").onclick=close;\n    M.querySelectorAll(\"[data-q]\").forEach(b=>b.onclick=()=>{ans[+b.dataset.q]=+b.dataset.o;M.querySelectorAll(`[data-q=\"${b.dataset.q}\"]`).forEach(x=>x.classList.toggle(\"on\",x===b));const qq=b.closest(\".qq\");if(qq)qq.classList.remove(\"bad\")});\n    $(\"#qgo\").onclick=submit;$(\"#qflag\").onclick=flag};\n  async function flag(){const f=$(\"#qflag\");f.disabled=true;f.textContent=\"Getting new questions\\u2026\";let r=null;try{r=await (await fetch(\"/api/quizflag?h=\"+h,{method:\"POST\"})).json()}catch(e){}\n    if(r&&r.ok){openQuiz(h);return}f.textContent=r&&r.again?\"Thanks. These were already replaced today.\":\"Couldn\\u2019t replace them right now.\"}\n  async function submit(){if(ans.some(a=>a===null)){$(\"#qm\").textContent=\"Answer all 3 questions first.\";return}\n    const g=$(\"#qgo\");g.disabled=true;g.textContent=\"Checking\\u2026\";let t=null;try{if(sdk&&ctx&&ctx.user)t=await qaTok()}catch(e){}\n    let r;try{r=await (await fetch(\"/api/quiz?h=\"+h,{method:\"POST\",headers:{\"content-type\":\"application/json\",...(t?{Authorization:\"Bearer \"+t}:{})},body:JSON.stringify({a:ans})})).json()}catch(e){r=null}\n    if(!r){g.disabled=false;g.textContent=\"Check answers\";$(\"#qm\").textContent=\"Something went wrong. Try again.\";return}\n    if(!r.pass){draw(r.wrong);return}\n    LP[h]=Date.now();lpSave();if(lrMe&&r.saved){lrMe=null}\n    const au=art&&art.author;const ti=art&&art.article?art.article.title:\"\";\n    M.innerHTML=`<button class='x' aria-label='Close'>&times;</button><div class='medal'><b>\\u2713</b><div class='shine'></div></div><div class='k'>Lesson passed</div><h2>${esc(ti)}</h2><p class='t'>${r.saved?\"Added to your transcript.\":\"Saved on this device. Open Folio in Farcaster to keep a public transcript.\"}${r.n?` ${r.n} ${r.n===1?\"reader has\":\"readers have\"} passed this one.`:\"\"}</p>${r.w&&r.w.length?`<ul class=\"qw\">${r.w.filter(Boolean).map(w=>`<li>${esc(w)}</li>`).join(\"\")}</ul>`:\"\"}<div class='bt'>${sdk&&ctx?`<button class='pri' id='qsh'>Share</button>`:\"\"}<button id='qtr'>Transcript</button></div>`;\n    M.querySelector(\".x\").onclick=close;$(\"#qtr\").onclick=()=>{box.classList.remove(\"open\");showTranscript(myFid()||0)};\n    const s=$(\"#qsh\");if(s)s.onclick=async()=>{const text=`Just finished \"${ti}\"${au&&au.username?\" by @\"+au.username:au&&au.u?\" by @\"+au.u:\"\"} on Folio Learn.`;try{await sdk.actions.composeCast({text,embeds:[location.origin+\"/?a=\"+h]})}catch(e){}};\n    quizBox()}\n  draw(null)}\n// transcript\nasync function showTranscript(fid){\n  const L=$(\"#list\");tab=\"transcript\";[...$(\"#tabs\").children].forEach(x=>x.classList.toggle(\"on\",x.dataset.t===\"learn\"));$(\"#chips\").style.display=\"none\";window.scrollTo(0,0);\n  if(document.getElementById(\"reader\").classList.contains(\"open\")){try{$(\"#back\").click()}catch(e){}}\n  L.innerHTML=`<div class=\"loading\" style=\"padding:30px 0\">Loading transcript\\u2026</div>`;\n  let j=null;const mine=!fid||fid===myFid();\n  try{if(fid)j=await lrLoad(fid)}catch(e){}\n  let list=j&&j.l?j.l.slice():[];\n  if(mine){const have=new Set(list.map(e=>e.h));for(const h in LP)if(!have.has(h)){const x=allItems().find(z=>z.h===h);list.push({h,t:x?x.title:\"\",w:x&&x.a?x.a.u:\"\",ts:LP[h],c:\"\"})}list.sort((a,b)=>b.ts-a.ts)}\n  if(mine&&fid)lrMe=j;\n  const nm=j&&(j.n||j.u)?(j.n||j.u):\"\";\n  const badges=j&&j.badges?j.badges:[];\n  const writers=[...new Set(list.map(e=>e.w).filter(Boolean))];\n  L.innerHTML=`<div class=\"lrh\"><button class=\"lrbk\" id=\"lrbk\">\\u2190 Courses</button><h2>${mine?\"Your transcript\":esc(nm)+\"\\u2019s transcript\"}</h2><p>${list.length?`${list.length} ${list.length===1?\"lesson\":\"lessons\"} passed${writers.length?`, learned from ${writers.length} ${writers.length===1?\"writer\":\"writers\"}`:\"\"}.`:mine?\"Pass a lesson and it shows up here.\":\"No lessons passed yet.\"}</p>${mine&&fid&&list.length&&sdk&&ctx?`<button id=\"lrsh\" class=\"lrbt\">Share my transcript</button>`:\"\"}</div>`+\n   (badges.length?`<div class=\"lrb\">${badges.map(b=>`<div class=\"${b.got?\"on\":\"\"}\"><i>${b.got?\"\\u2605\":b.k+\"/\"+(j.need||3)}</i><span>${esc(b.n)}</span></div>`).join(\"\")}</div>`:\"\")+\n   list.map(e=>`<button class=\"lrl\" data-lh=\"${esc(e.h)}\"><span class=\"lrn ok\">\\u2713</span><span class=\"lrt\"><b>${esc(e.t||\"Article\")}</b><em>${e.w?\"@\"+esc(e.w)+\" \\u00B7 \":\"\"}${new Date(e.ts).toLocaleDateString(\"en-US\",{month:\"short\",day:\"numeric\"})}</em></span></button>`).join(\"\")+\n   (!mine?`<div style=\"padding:18px 0\"><button class=\"lrbt\" id=\"lrgo\">Start learning</button></div>`:\"\")+\n   (mine&&!fid&&list.length?`<p class=\"lrf\">Open Folio in Farcaster to keep a public transcript you can share.</p>`:\"\");\n  L.querySelectorAll(\".lrl\").forEach(b=>b.onclick=()=>openArticle(b.dataset.lh,true));\n  $(\"#lrbk\").onclick=()=>{tab=\"learn\";learnRender();window.scrollTo(0,0)};\n  const g=$(\"#lrgo\");if(g)g.onclick=()=>{tab=\"learn\";learnRender()};\n  const s=$(\"#lrsh\");if(s)s.onclick=async()=>{const ws=writers.slice(0,3).map(w=>\"@\"+w);const tail=ws.length?` Learned from ${ws.length>1?ws.slice(0,-1).join(\", \")+\" and \"+ws[ws.length-1]:ws[0]}.`:\"\";const text=`I've passed ${list.length} ${list.length===1?\"lesson\":\"lessons\"} on Folio Learn.${tail}`;try{await sdk.actions.composeCast({text,embeds:[location.origin+\"/?learn=\"+fid]})}catch(e){}}}\nwindow.__flearn=()=>{tab=\"learn\";[...$(\"#tabs\").children].forEach(x=>x.classList.toggle(\"on\",x.dataset.t===\"learn\"));learnRender()};\n{const qp=new URLSearchParams(location.search);const lf=qp.get(\"learn\");if(lf&&/^\\d{1,9}$/.test(lf))setTimeout(()=>showTranscript(+lf),300);else if(qp.get(\"tab\")===\"learn\")setTimeout(()=>window.__flearn(),300)}\ndocument.head.insertAdjacentHTML(\"beforeend\",`<style>.lrh{padding:16px 0 6px}.lrh h2{font:700 26px var(--serif);margin:0 0 6px}.lrh p{margin:0 0 12px;color:var(--mute);font:14.5px/1.5 var(--sans)}.lrbt{border:1px solid var(--ink);background:transparent;color:var(--ink);border-radius:999px;padding:9px 16px;font:600 13.5px var(--sans);cursor:pointer}.lrbk{border:0;background:none;color:var(--mute);font:600 13px var(--sans);padding:0 0 10px;cursor:pointer}.lrs{border:1px solid var(--line);background:var(--card);border-radius:16px;padding:14px 14px 6px;margin:14px 0}.lrsh{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:6px}.lrsh h3{font:700 19px var(--serif);margin:0 0 3px}.lrsh p{margin:0;color:var(--mute);font:13px/1.4 var(--sans)}.lrp{flex:none;font:600 12px var(--sans);color:var(--mute);border:1px solid var(--line);border-radius:999px;padding:4px 10px;white-space:nowrap}.lrp.on{color:#fff;background:var(--grn);border-color:var(--grn)}.lrl{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;background:none;border:0;border-top:1px solid var(--line);padding:12px 0;cursor:pointer;color:var(--ink)}.lrs .lrl:first-of-type{border-top:0}.lrn{flex:none;width:28px;height:28px;border-radius:50%;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font:600 13px var(--sans);color:var(--mute)}.lrn.ok{background:var(--grn);border-color:var(--grn);color:#fff}.lrt b{display:block;font:600 15.5px/1.35 var(--serif)}.lrt em{display:block;font:normal 12.5px var(--sans);color:var(--mute);margin-top:3px}.lrf{color:var(--mute);font:12.5px var(--sans);margin:4px 0 10px}.lrb{display:flex;gap:8px;overflow-x:auto;padding:6px 0 12px}.lrb div{flex:none;width:92px;text-align:center;border:1px solid var(--line);border-radius:14px;padding:10px 6px;background:var(--card)}.lrb i{display:flex;align-items:center;justify-content:center;width:40px;height:40px;margin:0 auto 6px;border-radius:50%;border:1px dashed var(--line);font:normal 600 12px var(--sans);color:var(--mute)}.lrb .on i{border:0;background:var(--gold);color:#fff;font-size:20px}.lrb span{font:600 11.5px/1.3 var(--sans)}.lrq{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:680px;margin:6px auto 30px;padding:14px 16px;border:1px solid var(--grn);border-radius:14px;background:var(--card)}.lrq b{display:block;font:700 16px var(--serif)}.lrq span{display:block;font:13px var(--sans);color:var(--mute);margin-top:2px}.lrq button{flex:none;border:0;background:var(--grn);color:#fff;border-radius:999px;padding:10px 16px;font:600 14px var(--sans);cursor:pointer}.mo .qq{text-align:left;margin:0 0 14px}.mo .qq p{font:600 15px/1.4 var(--sans);margin:0 0 8px}.mo .qq button{display:block;width:100%;text-align:left;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:10px;padding:10px 12px;margin:0 0 6px;font:14px/1.35 var(--sans);cursor:pointer}.mo .qq button.on{border-color:var(--grn);box-shadow:inset 0 0 0 1px var(--grn)}.mo .qq.bad p{color:var(--acc)}.mo .qm{min-height:18px;font:13px var(--sans);color:var(--acc);margin:0 0 10px}.mo .qw{text-align:left;margin:0 0 14px;padding-left:18px;font:13.5px/1.45 var(--sans);color:var(--mute)}#mo{max-height:88vh;overflow-y:auto}</style>`);\n})();\n\n// ===== Who wrote it? + Want more + Loyal readers (2026-11-17) =====\n(function(){\nconst GK=\"folio.gm\";const gS=()=>{try{return JSON.parse(store.get(GK)||\"{}\")}catch(e){return{}}};const gW=o=>store.set(GK,JSON.stringify(o));\nconst dayStr=t=>new Date(t).toISOString().slice(0,10);const today=()=>dayStr(Date.now());\nconst wkOf=d=>{const t=new Date(d+\"T00:00:00Z\");const w=(t.getUTCDay()+6)%7;return dayStr(t.getTime()-w*864e5)};\nconst dd=(a,b)=>Math.round((Date.parse(b+\"T00:00:00Z\")-Date.parse(a+\"T00:00:00Z\"))/864e5);\nfunction curStreak(s){if(!s.last)return 0;const g=dd(s.last,today());if(g<=1)return s.streak||0;if(g===2&&s.frz!==wkOf(today()))return s.streak||0;return 0}\nlet gm=null;async function gmLoad(){if(gm&&gm.d===today())return gm;try{const j=await (await fetch(\"/api/game\")).json();if(j&&!j.error)gm=j}catch(e){}return gm}\ndocument.head.insertAdjacentHTML(\"beforeend\",`<style>.mo .gmst{font:30px/1 var(--sans);letter-spacing:8px;color:#E2B54E;text-shadow:0 0 14px rgba(226,181,78,.45);margin:10px 0 4px}.mo .gmno{font:13px var(--sans);color:var(--mute);margin:4px 0 0}\n.gmc{display:flex;align-items:center;gap:10px;margin:10px 0 2px;padding:7px 10px;border:1px solid var(--line);border-radius:14px;background:var(--card);cursor:pointer}.gmc .gi{width:26px;height:26px;font-size:14px!important;border-radius:10px;background:linear-gradient(135deg,#F08C6C,#C9563A);color:#fff;display:flex;align-items:center;justify-content:center;font:700 19px var(--title);flex:none;margin:6px;box-shadow:0 0 0 2px #1F1D19,0 0 0 5px rgba(110,220,150,.6),0 0 16px rgba(110,220,150,.45)}.gmc div{flex:1;min-width:0}.gmc b{display:block;font:700 13.5px var(--title);color:var(--ink)}.gmc span{display:block;font:12px/1.3 var(--sans);color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gmc em{font:700 12px var(--sans);font-style:normal;color:#0F2A1A;flex:none;padding:5px 12px;border-radius:999px;background:linear-gradient(90deg,#3FB070,#6EDC96);box-shadow:0 0 12px rgba(110,220,150,.35)}\n.mo .gq{font:italic 16px/1.55 var(--serif);text-align:left;color:var(--ink);margin:6px 0 16px;padding:12px 14px;border-left:3px solid var(--acc);background:var(--card);border-radius:0 10px 10px 0;max-height:34vh;overflow-y:auto}\n.mo .go{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 12px}.mo .go button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);cursor:pointer;font:600 13px var(--sans)}.mo .go button img{width:46px;height:46px;border-radius:50%;object-fit:cover}.mo .go button small{font:400 11.5px var(--sans);color:var(--mute)}.mo .go button.ok{border-color:var(--grn);box-shadow:inset 0 0 0 2px var(--grn)}.mo .go button.no{opacity:.45;border-color:var(--acc)}.mo .go button:disabled{cursor:default}\n.mo .gr{font:22px/1 var(--sans);letter-spacing:4px;margin:4px 0 6px}.mo .gb{display:flex;flex-direction:column;gap:8px;margin-top:12px}.mo .gb button{padding:11px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:600 14px var(--sans);cursor:pointer}.mo .gb button.pri{background:var(--acc);border-color:var(--acc);color:#fff}\n#wmore{max-width:680px;margin:0 auto 14px;padding:0 18px;display:none}#wmore button{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:600 14px var(--sans);cursor:pointer}#wmore button.on{border-color:var(--acc);color:var(--acc)}#wmore p{margin:6px 0 0;text-align:center;font:12.5px var(--sans);color:var(--mute)}\n#finote{max-width:680px;margin:-6px auto 14px;padding:0 18px;font:12.5px/1.4 var(--sans);color:var(--mute);text-align:center;display:none}#finote button{background:none;border:0;color:var(--acc);font:600 12.5px var(--sans);cursor:pointer;padding:0 0 0 4px}\n.lyl{margin:22px 0 8px}.lyl h3{font:700 18px var(--title);margin:0 0 4px}.lyl p.s{margin:0 0 10px;font:13px/1.4 var(--sans);color:var(--mute)}.lyl .lr{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}.lyl .lr img,.lyl .lr i{width:34px;height:34px;border-radius:50%;object-fit:cover;background:var(--line);flex:none}.lyl .lr div{flex:1;min-width:0;font:14px var(--sans)}.lyl .lr div small{display:block;color:var(--mute);font-size:12px}.lyl .lr b.c{font:700 15px var(--sans);color:var(--acc)}.lyl .lr button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:5px 9px;font:600 12px var(--sans);cursor:pointer}/*csz1*/.stb,.gmc{margin:10px 0 2px!important;padding:7px 10px!important;gap:10px!important;border-radius:14px!important;border:1px solid rgba(76,191,134,.32)!important;box-shadow:none!important}.stb .rg{width:38px!important;height:38px!important;padding:2px!important}.stb .rg .rgt{font-size:16px!important}.stb>div:last-child{flex:1;min-width:0}.stb b{font:700 13.5px var(--title)!important;color:var(--ink)}.stb span{display:block;font:12px/1.3 var(--sans)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}/*gpf1*/.gmc .gi.gpf{display:grid;grid-template-columns:1fr 1fr;gap:1px;padding:0;overflow:hidden;background:#2A2722}.gmc .gi.gpf img{width:100%;height:100%;object-fit:cover;display:block;filter:grayscale(1) blur(.4px) brightness(.9)}.gmc .gi.gpw{display:block}.gmc .gi.gpw img{filter:none}.gmc .gi.gpx{background:linear-gradient(135deg,#F08C6C,#C9563A)}</style>`);\nfunction gmIco(s,done){try{const ok=done&&/\\uD83D\\uDFE9/.test(s.res||\"\");const au=s.ans&&s.ans.au;if(ok&&au&&au.p)return `<div class=\"gi gpf gpw\"><img src=\"${esc(img(au.p,120))}\" alt=\"\" onerror=\"this.parentNode.classList.add('gpx')\"></div>`;const o=gm&&Array.isArray(gm.o)?gm.o.filter(x=>x&&x.p):[];if(o.length===4)return `<div class=\"gi gpf\">${o.map(x=>`<img src=\"${esc(img(x.p,60))}\" alt=\"\" onerror=\"this.style.visibility='hidden'\">`).join(\"\")}</div>`}catch(e){}return `<div class=\"gi\">?</div>`}\nfunction gmCard(){const s=gS();const done=s.last===today()&&s.res;const st=curStreak(s);\n  return `<div class=\"gmc\" id=\"gmc\">${gmIco(s,done)}<div><b>Who wrote it?${gm?` #${gm.no}`:\"\"}</b><span>${done?`Played today ${esc(s.res)}${st>1?` \\u00b7 ${st} day streak`:\"\"}`:\"Guess the writer. Get it right: 3 \u2605\"}</span></div><em>${done?\"See result\":\"Play\"}</em></div>`}\nconst _rG=render;render=function(){_rG.apply(this,arguments);try{if(tab!==\"today\")return;const L=$(\"#list\");if(!L||document.getElementById(\"gmc\"))return;const put=()=>{if(tab!==\"today\"||document.getElementById(\"gmc\")||!gm)return;L.insertAdjacentHTML(\"afterbegin\",gmCard());document.getElementById(\"gmc\").onclick=gmOpen};if(gm)put();else gmLoad().then(r=>r?put():setTimeout(()=>gmLoad().then(put),2500))}catch(e){}};\nfunction gmShareText(s){const st=curStreak(s);return `Who wrote it? #${gm.no} on Folio\\n${s.res}${st>1?` \\uD83D\\uDD25${st}`:\"\"}\\n\\nOne paragraph, four writers. Can you tell who wrote it?`}\nasync function gcReady(me,ms){const t0=Date.now(),left=()=>ms-(Date.now()-t0),J2=async(u,o)=>{try{const r=await fetch(u,o);return await r.json()}catch(_){return null}},post=()=>qaTok().then(t=>t?J2(\"/api/gcprep\",{method:\"POST\",headers:{Authorization:\"Bearer \"+t}}):null).catch(()=>null);try{let j=await J2(\"/api/gcprep?fid=\"+me,{cache:\"no-store\"});if(j&&j.st===\"ready\"&&j.v){post();return j.v}if(!j||j.st!==\"run\"){j=await Promise.race([post(),new Promise(r=>setTimeout(()=>r(null),Math.max(0,Math.min(2500,left()))))]);if(j&&j.st===\"ready\"&&j.v)return j.v;if(!j)j=await J2(\"/api/gcprep?fid=\"+me,{cache:\"no-store\"})}while(j&&j.st===\"run\"&&left()>900){await new Promise(r=>setTimeout(r,900));j=await J2(\"/api/gcprep?fid=\"+me,{cache:\"no-store\"})}return j&&j.st===\"ready\"&&j.v?j.v:\"\"}catch(_){return\"\"}}\nasync function gmCast(text,embed){const url=embed||location.origin+\"/?game=1\";if(sdk&&ctx){try{await sdk.actions.composeCast({text,embeds:[url]});return true}catch(e){}}if(navigator.share){try{await navigator.share({text,url});return true}catch(e){}}try{await navigator.clipboard.writeText(text+\" \"+url);return true}catch(e){}return false}\nlet gcW=0;function gcWarm(){const me=ctx&&ctx.user&&ctx.user.fid;if(!me||gcW)return;gcW=1;try{fetch(\"/api/gcprep?fid=\"+me,{cache:\"no-store\"}).then(r=>r.json()).then(j=>{if(j&&(j.st===\"ready\"||j.st===\"run\"))return;return qaTok().then(t=>t?fetch(\"/api/gcprep\",{method:\"POST\",headers:{Authorization:\"Bearer \"+t}}):null)}).catch(()=>{gcW=0})}catch(_){gcW=0}}\nasync function gmOpen(){const M=$(\"#mo\"),box=$(\"#moment\");M.style.setProperty(\"--mc\",\"var(--acc)\");const close=()=>{box.classList.remove(\"open\");if(tab===\"today\"){const c=document.getElementById(\"gmc\");if(c){c.outerHTML=gmCard();document.getElementById(\"gmc\").onclick=gmOpen}}};\n  M.innerHTML=`<button class='x' aria-label='Close'>&times;</button><div class='k'>Who wrote it?</div><div class=\"loading\" style=\"padding:24px 0\">Getting today\\u2019s paragraph\\u2026</div>`;box.classList.add(\"open\");M.querySelector(\".x\").onclick=close;box.onclick=e=>{if(e.target===box)close()};\n  await gmLoad();if(!gm){M.innerHTML=`<button class='x' aria-label='Close'>&times;</button><div class='k'>Who wrote it?</div><p class='t'>Today\\u2019s puzzle isn\\u2019t ready yet. Come back in a little while.</p>`;M.querySelector(\".x\").onclick=close;return}\n  let s=gS();const played=s.last===today()&&s.res;let tries=played?2:0;const marks=[],picks=[];\n  const draw=()=>{M.innerHTML=`<button class='x' aria-label='Close'>&times;</button><div class='k'>Who wrote it? #${gm.no}</div><div class=\"gq\">\\u201C${esc(gm.t)}\\u201D</div><div class=\"go\">${gm.o.map((o,i)=>`<button data-i=\"${i}\"><img src=\"${esc(img(o.p,96))}\" alt=\"\"><span>${esc(o.n)}</span><small>@${esc(o.u)}</small></button>`).join(\"\")}</div><div class=\"qm\" id=\"gmm\">${played?\"\":\"Two guesses. Pick the writer.\"}</div><div id=\"gmx\"></div>`;M.querySelector(\".x\").onclick=close;M.querySelectorAll(\".go button\").forEach(b=>b.onclick=()=>guess(+b.dataset.i,b))};\n  const reveal=j=>{const bs=M.querySelectorAll(\".go button\");bs.forEach(b=>{b.disabled=true;if(+b.dataset.i===j.a)b.classList.add(\"ok\")});\n    const res=j.res||s.res;const st=curStreak(gS());\n    $(\"#gmm\").textContent=j.ok===false&&!j.pre?`It was @${j.au.u}.`:j.pre?\"\":`Yes, it was @${j.au.u}.`;\n    $(\"#gmx\").innerHTML=`<div class=\"gr\">${res}</div><p class='t' style=\"margin:0\">${st>1?`${st} day streak. `:\"\"}${j.n?`${j.pct}% of ${nf(j.n)} players got it.`:\"\"}</p>${j.ok===false&&!j.pre?`<p class=\"gmno\">No worries. Try again tomorrow.</p>`:`<div class=\"gmst\">\u2605\u2605\u2605</div><p class=\"gmno\">${j.stars?\"+3 stars for your articles this week\":ctx&&ctx.user&&ctx.user.fid?\"You got it right\":\"Open Folio in Farcaster to collect your stars\"}</p>`}<div class=\"gb\"><button class=\"pri\" id=\"gmread\">Read the full article</button><button id=\"gmtag\">Tell @${esc(j.au.u)} you found them</button></div>`;\n    $(\"#gmread\").onclick=()=>{box.classList.remove(\"open\");openArticle(j.h,true)};\n    \n    $(\"#gmtag\").onclick=async()=>{await gmCast(`Found @${j.au.u} through Who wrote it? on Folio today. Reading \\u201C${j.title}\\u201D now.`,location.origin+\"/?a=\"+j.h)}};\n  const guess=async(i,b)=>{if(tries>=2)return;tries++;M.querySelectorAll(\".go button\").forEach(x=>x.disabled=true);let j;try{const tk=ctx&&ctx.user&&ctx.user.fid?await qaTok().catch(()=>null):null;j=await (await fetch(\"/api/game\",{method:\"POST\",headers:Object.assign({\"content-type\":\"application/json\"},tk?{Authorization:\"Bearer \"+tk}:{}),body:JSON.stringify({g:i,t:tries})})).json()}catch(e){j=null}\n    if(!j||j.error){tries--;M.querySelectorAll(\".go button:not(.no)\").forEach(x=>x.disabled=false);$(\"#gmm\").textContent=\"Couldn\\u2019t check that. Try again.\";return}\n    picks.push(i);marks.push(j.ok?\"\\uD83D\\uDFE9\":\"\\uD83D\\uDFE5\");\n    if(!j.fin){b.classList.add(\"no\");$(\"#gmm\").textContent=\"Not quite. One more guess.\";M.querySelectorAll(\".go button:not(.no)\").forEach(x=>x.disabled=false);return}\n    if(!j.ok)b.classList.add(\"no\");\n    const res=marks.join(\"\");const o=gS();const t=today();\n    if(o.last!==t){const g=o.last?dd(o.last,t):99;let st=1;if(g===1)st=(o.streak||0)+1;else if(g===2&&o.frz!==wkOf(t)){st=(o.streak||0)+1;o.frz=wkOf(t)}\n      o.streak=st;o.best=Math.max(o.best||0,st);o.last=t;o.res=res;o.pk=picks.join(\"\");o.no=gm.no;o.ans={a:j.a,h:j.h,title:j.title,au:j.au,n:j.n,pct:j.pct};gW(o)}\n    s=gS();reveal({...j,res})};\n  draw();if(played&&s.ans){tries=2;reveal({...s.ans,ok:true,pre:true,res:s.res})}}\nwindow.__gmOpen=gmOpen;\ntry{if(data&&tab===\"today\")render()}catch(e){}\n{const qp=new URLSearchParams(location.search);if(qp.has(\"game\"))setTimeout(gmOpen,400)}\ngmLoad();\n\n// ---- Want more ----\nconst wmBox=document.createElement(\"div\");wmBox.id=\"wmore\";document.getElementById(\"endbar\").before(wmBox);\nconst finote=document.createElement(\"p\");finote.id=\"finote\";document.getElementById(\"endbar\").after(finote);\nasync function wmDraw(){wmBox.style.display=\"none\";const au=cur&&cur.author;if(!au||!au.fid)return;const me=ctx&&ctx.user&&ctx.user.fid;if(me&&me===au.fid)return;const h=cur.h;\n  let j={n:0,on:false};try{const t=me?await qaTok(1):null;j=await (await fetch(\"/api/wm?fid=\"+au.fid,{headers:t?{Authorization:\"Bearer \"+t}:{}})).json()}catch(e){}\n  if(!cur||cur.h!==h)return;const u=au.u||au.username||\"\";\n  const paint=()=>{wmBox.innerHTML=`<button class=\"${j.on?\"on\":\"\"}\">${j.on?\"\\uD83D\\uDD14 You\\u2019ll hear when @\"+esc(u)+\" posts next\":\"\\uD83D\\uDD14 I want more from @\"+esc(u)}</button><p>${j.n?`${nf(j.n)} ${j.n===1?\"reader is\":\"readers are\"} waiting for the next piece.`:\"Get a notification when the next piece is out.\"}</p>`;\n    wmBox.querySelector(\"button\").onclick=async()=>{if(!sdk||!ctx){wmBox.querySelector(\"p\").textContent=\"Open Folio in Farcaster to use this.\";return}const t=await qaTok();if(!t)return;try{const r=await (await fetch(\"/api/wm?fid=\"+au.fid,{method:\"POST\",headers:{Authorization:\"Bearer \"+t}})).json();if(r.error)return;j={n:r.n,on:r.on};paint();if(r.on){try{if(sdk.actions.addMiniApp&&!(ctx.client&&ctx.client.added))await sdk.actions.addMiniApp()}catch(e){}}}catch(e){}}};\n  paint();wmBox.style.display=\"block\"}\nconst _daW=drawArticle;drawArticle=function(){_daW.apply(this,arguments);try{wmDraw()}catch(e){};finote.style.display=\"none\"};\n\n// ---- Loyal readers: record finished reads ----\nasync function finPost(h){try{const me=ctx&&ctx.user&&ctx.user.fid;if(!sdk||!me||!cur||cur.h!==h||!cur.author||cur.author.fid===me)return;const t=await qaTok(1);if(!t)return;const j=await (await fetch(\"/api/fin?h=\"+h,{method:\"POST\",headers:{Authorization:\"Bearer \"+t}})).json();if(!j||j.own||!cur||cur.h!==h)return;\n  const u=cur.author.u||cur.author.username||\"the writer\";const paintF=a=>{finote.innerHTML=a?`Finished. You\\u2019re anonymous to writers.<button>Show my name</button>`:`Finished. @${esc(u)} can see you among their loyal readers.<button>Stay anonymous</button>`;finote.querySelector(\"button\").onclick=async()=>{const tk=await qaTok();if(!tk)return;try{const r=await (await fetch(\"/api/anon\",{method:\"POST\",headers:{Authorization:\"Bearer \"+tk,\"content-type\":\"application/json\"},body:JSON.stringify({on:!a})})).json();paintF(!!r.on)}catch(e){}}};\n  paintF(!!j.anon);finote.style.display=\"block\"}catch(e){}}\nconst _pgF=ping;ping=function(h,e){_pgF.apply(this,arguments);if(e===\"done\")finPost(h)};\n\n// ---- Loyal readers in Your stats ----\nasync function loyalBox(){const L=$(\"#list\");const host=L.querySelector(\".stt\")||L;const old=document.getElementById(\"lyl\");if(old)old.remove();const d=document.createElement(\"div\");d.className=\"lyl\";d.id=\"lyl\";d.innerHTML=`<h3>Loyal readers</h3><p class=\"s\">Loading\\u2026</p>`;host.appendChild(d);\n  let j=null;try{const t=await qaTok();if(t)j=await (await fetch(\"/api/loyal\",{headers:{Authorization:\"Bearer \"+t}})).json()}catch(e){}\n  if(!j||j.error){d.querySelector(\".s\").textContent=\"Sign in through Farcaster to see who finishes your pieces.\";return}\n  if(!j.items.length){d.querySelector(\".s\").textContent=\"When signed-in readers finish your pieces, they show up here.\";return}\n  d.innerHTML=`<h3>Loyal readers</h3><p class=\"s\">Readers who finished your pieces on Folio, most pieces first.</p>`+j.items.map(r=>r.anon?`<div class=\"lr\"><i></i><div>Anonymous reader<small>Finished ${r.c} of your ${j.total||r.c} pieces</small></div><b class=\"c\">${r.c}</b></div>`:`<div class=\"lr\" data-f=\"${+r.f}\">${r.p?`<img src=\"${esc(img(r.p,68))}\" alt=\"\">`:\"<i></i>\"}<div>${esc(r.n||r.u)}<small>@${esc(r.u)} \\u00b7 finished ${r.c} of your ${j.total||r.c} pieces</small></div><button data-u=\"${esc(r.u)}\" data-c=\"${r.c}\">Thank</button></div>`).join(\"\");\n  d.querySelectorAll(\"button[data-u]\").forEach(b=>b.onclick=async()=>{const u=b.dataset.u,c=+b.dataset.c;const text=c>1?`@${u} has finished ${c} of my pieces on Folio. Thank you for reading.`:`@${u} finished my piece on Folio. Thank you for reading.`;if(sdk&&ctx){try{await sdk.actions.composeCast({text});b.textContent=\"Thanked\";return}catch(e){}}try{await navigator.clipboard.writeText(text);b.textContent=\"Copied\"}catch(e){}})}\nconst _ssL=showStats;showStats=async function(fid){await _ssL.apply(this,arguments);try{if(isMineFid(fid)&&tab===\"stats\")loyalBox()}catch(e){}};\n{const qp=new URLSearchParams(location.search);if(qp.has(\"loyal\"))setTimeout(()=>{const me=ctx&&ctx.user&&ctx.user.fid;if(me)showStats(me)},1200)}\n})();\n\n// ===== Writer coin (Clanker, opt-in) 2026-11-17 =====\n(function(){\ndocument.head.insertAdjacentHTML(\"beforeend\",`<style>#wcoin{max-width:680px;margin:0 auto 14px;padding:0 18px;display:none}#wcoin a{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);text-decoration:none;font:14px var(--sans)}#wcoin a img{width:30px;height:30px;border-radius:50%;object-fit:cover;flex:none;background:var(--line)}#wcoin a span{flex:1;min-width:0}#wcoin a small{display:block;color:var(--mute);font-size:12px}\n#wcoin a .v5t{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:6px;border:1px solid rgba(110,220,150,.55);color:#7fdca0;font:700 10px var(--sans);letter-spacing:.04em;vertical-align:2px}#wcoin a em{font-style:normal;font-weight:600;color:var(--acc);flex:none;font-size:13px}\n.wck{margin:22px 0 8px}.wck h3{font:700 18px var(--title);margin:0 0 4px}.wck p.s{margin:0 0 10px;font:13px/1.4 var(--sans);color:var(--mute)}.wck .ck{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;margin:0 0 6px;background:var(--card);cursor:pointer;width:100%;text-align:left;color:var(--ink);font:14px var(--sans)}.wck .ck img,.wck .ck i{width:30px;height:30px;border-radius:50%;object-fit:cover;background:var(--line);flex:none}.wck .ck span{flex:1;min-width:0}.wck .ck small{display:block;color:var(--mute);font-size:12px}.wck .ck.on{border-color:var(--grn);box-shadow:inset 0 0 0 2px var(--grn)}.wck .ck b{font:600 12px var(--sans);color:var(--grn)}.wck .more{background:none;border:0;color:var(--acc);font:600 13px var(--sans);cursor:pointer;padding:4px 0}</style>`);\nconst cBox=document.createElement(\"div\");cBox.id=\"wcoin\";const wm=document.getElementById(\"wmore\")||document.getElementById(\"endbar\");wm.after(cBox);\nconst ckUrl=a=>\"https://www.clanker.world/clanker/\"+a;\nasync function coinDraw(){cBox.style.display=\"none\";const au=cur&&cur.author;if(!au||!au.fid)return;const h=cur.h;let j=null;try{j=await (await fetch(\"/api/coin?fid=\"+au.fid)).json()}catch(e){}\n  if(!j||!j.c||!cur||cur.h!==h)return;const c=j.c;const u=au.u||au.username||\"\";\n  cBox.innerHTML=`<a href=\"${esc(ckUrl(c.a))}\" target=\"_blank\" rel=\"noopener\">${c.i?`<img src=\"${esc(c.i)}\" alt=\"\">`:\"<img alt=\\\"\\\">\"}<span>Support @${esc(u)}${c.v5?`<b class=\"v5t\">v5</b>`:\"\"}<small>${esc(c.n||c.s)} \\u00b7 the writer\\u2019s coin on Clanker</small></span><em>View</em></a>`;\n  cBox.querySelector(\"a\").onclick=e=>{if(sdk&&ctx&&sdk.actions.openUrl){e.preventDefault();try{sdk.actions.openUrl(ckUrl(c.a))}catch(er){location.href=ckUrl(c.a)}}};cBox.style.display=\"block\"}\nconst _daC=drawArticle;drawArticle=function(){_daC.apply(this,arguments);try{coinDraw()}catch(e){}};\nasync function coinBox(){const L=$(\"#list\");const host=L.querySelector(\".stt\")||L;const old=document.getElementById(\"wck\");if(old)old.remove();const d=document.createElement(\"div\");d.className=\"wck\";d.id=\"wck\";d.innerHTML=`<h3>Your coin</h3><p class=\"s\">Loading\\u2026</p>`;const ly=document.getElementById(\"lyl\");if(ly&&ly.parentNode===host)ly.before(d);else host.appendChild(d);\n  let j=null;try{const t=await qaTok();if(t)j=await (await fetch(\"/api/coin?mine=1\",{headers:{Authorization:\"Bearer \"+t}})).json()}catch(e){}\n  if(!j||j.error){d.querySelector(\".s\").textContent=\"Sign in through Farcaster to choose a coin.\";return}\n  if(!j.list.length){d.querySelector(\".s\").textContent=\"You haven\\u2019t launched a coin on Clanker. If you do, you can show it under your articles here.\";return}\n  let sel=j.c&&j.c.a||\"\";let all=false;\n  const paint=()=>{const items=j.list.slice(0,all?60:6);d.innerHTML=`<h3>Your coin</h3><p class=\"s\">Pick one of your Clanker coins to show as a small link under your articles. No price is shown. Nothing shows unless you pick one.</p>`+items.map(t=>`<button class=\"ck${t.a===sel?\" on\":\"\"}\" data-a=\"${t.a}\">${t.i?`<img src=\"${esc(t.i)}\" alt=\"\">`:\"<i></i>\"}<span>${esc(t.n||t.s)}<small>${esc(t.s)}${t.v5?\" \\u00b7 v5\":\"\"}</small></span>${t.a===sel?\"<b>Showing</b>\":\"\"}</button>`).join(\"\")+(j.list.length>6&&!all?`<button class=\"more\" id=\"ckmore\">Show all ${j.list.length}</button>`:\"\")+(sel?`<button class=\"more\" id=\"ckoff\">Hide my coin</button>`:\"\");\n    d.querySelectorAll(\".ck\").forEach(b=>b.onclick=()=>save(b.dataset.a===sel?\"\":b.dataset.a));const m=d.querySelector(\"#ckmore\");if(m)m.onclick=()=>{all=true;paint()};const o=d.querySelector(\"#ckoff\");if(o)o.onclick=()=>save(\"\")};\n  const save=async a=>{const t=await qaTok();if(!t)return;try{const r=await (await fetch(\"/api/coin\",{method:\"POST\",headers:{Authorization:\"Bearer \"+t,\"content-type\":\"application/json\"},body:JSON.stringify({a})})).json();if(r.error)return;sel=r.c?r.c.a:\"\";paint()}catch(e){}};\n  paint()}\n\n// ---- Supporter mark: readers who hold the writer's chosen coin ----\ndocument.head.insertAdjacentHTML(\"beforeend\",`<style>.sup{display:inline-block;margin:0 5px 0 0;padding:1px 6px;border-radius:6px;background:var(--grn);color:#fff;font:600 10.5px/1.5 var(--sans);vertical-align:1px}</style>`);\nconst supMark=n=>`<span class=\"sup\" title=\"Holds ${esc(n||\"the writer\\u2019s\")} coin\">Supporter</span>`;\nasync function supFill(wf,els,get){const fs=[...new Set(els.map(get).filter(Boolean))];if(!fs.length)return;let j=null;try{j=await (await fetch(\"/api/hold?fid=\"+wf+\"&f=\"+fs.join(\",\"))).json()}catch(e){}if(!j||!j.h||!j.h.length)return;const hs=new Set(j.h.map(String));els.forEach(e=>{const f=get(e);if(f&&hs.has(String(f))&&!e.querySelector(\".sup\")){const b=e.querySelector(\"b,div\");if(b)b.insertAdjacentHTML(\"afterbegin\",supMark(j.n||j.s))}})}\nconst rpl=document.getElementById(\"rpl\");if(rpl){new MutationObserver(()=>{const els=[...rpl.querySelectorAll(\".rq[data-f]:not([data-sp])\")];if(!els.length||!cur||!cur.author||!cur.author.fid)return;els.forEach(e=>e.dataset.sp=1);supFill(cur.author.fid,els,e=>e.dataset.f)}).observe(rpl,{childList:true})}\n\nconst _ssC=showStats;showStats=async function(fid){await _ssC.apply(this,arguments);try{if(isMineFid(fid)&&tab===\"stats\"){coinBox();let n=0;const t=setInterval(()=>{n++;const els=[...document.querySelectorAll(\"#lyl .lr[data-f]:not([data-sp])\")];if(els.length||n>20){clearInterval(t);els.forEach(e=>e.dataset.sp=1);if(els.length)supFill(fid,els,e=>e.dataset.f)}},500)}}catch(e){}};\n})();\n\n\n// ---- Farcaster Updates tab (2026-11-17): official @farcaster posts, verbatim; UI English everywhere (2026-11-17 en-only) ----\n(function(){\nfunction fcuMd(s) {\n  let t = String(s || \"\").trim(), h = false;\n  if (/^#{1,6}\\s*/.test(t)) { h = true; t = t.replace(/^#{1,6}\\s*/, \"\").replace(/\\s+#+\\s*$/, \"\"); }\n  if (/^[-*_](\\s*[-*_]){2,}$/.test(t)) return { t: \"\", h };\n  t = t.replace(/^[-*+]\\s+/, \"• \");\n  t = t.replace(/!?\\[([^\\]]*)\\]\\((?:[^()\\s]|\\([^()]*\\))*\\)/g, \"$1\");\n  t = t.replace(/\\*\\*(\\S(?:[^*]*?\\S)?)\\*\\*/g, \"$1\").replace(/(^|[^\\w])__(\\S(?:[^_]*?\\S)?)__(?=[^\\w]|$)/g, \"$1$2\");\n  t = t.replace(/(^|[^\\w*])\\*(\\S(?:[^*]*?\\S)?)\\*(?=[^\\w*]|$)/g, \"$1$2\").replace(/(^|[^\\w_@])_(\\S(?:[^_]*?\\S)?)_(?=[^\\w_]|$)/g, \"$1$2\");\n  t = t.replace(/`+([^`]*)`+/g, \"$1\").replace(/\\*\\*/g, \"\").trim();\n  if (t === \"•\" || /^[-*_]{3,}$/.test(t)) t = \"\";\n  return { t, h };\n}\nfunction fcuMdLines(arr) {\n  const L = arr.map(fcuMd).filter(x => x.t);\n  const title = L.length ? L[0].t : \"\", rest = L.slice(1), ex = [];\n  for (let i = 0; i < rest.length && ex.length < 2; i++) { if (rest[i].h && rest.slice(i + 1).some(y => !y.h)) continue; ex.push(rest[i].t); }\n  return { title, ex };\n}\nconst FU={en:[\"Farcaster Updates\",\"All\",\"Prize\",\"Winners\",\"Feature\",\"Rules\",\"General\",\"Open post\",\"Open\",\"Closed\",\"Ends in {t}\",\"Official posts and prizes from the Farcaster team, shown exactly as posted.\",\"Loading updates\\u2026\",\"No updates right now.\",\"Prize post\",\"Announcements\",\"Prizes\",\"Participants\",\"No video entries yet.\",\"Show all {n} videos\",\"Show fewer\",\"{n} videos\",\"1 video\",\"Loading entries\\u2026\",\"Video entries to each prize, in the order they were posted. Tap one to watch it on Farcaster.\"]};\nconst FUL=\"en\";\nconst S=i=>FU[FUL][i]||FU.en[i];const RT=false;\nconst CI={prize:2,winners:3,feature:4,rules:5,general:6},NEWS=new Set([\"feature\",\"rules\",\"general\"]);\n// chips (2026-11-17 v3): Announcements (default: feature+rules+general) · Prizes · Winners · All\nconst CH=[[\"news\",15],[\"prize\",16],[\"winners\",3],[\"parts\",17]];\nlet FD=null,FDt=0,fcat=\"news\",ftick=null;\ndocument.head.insertAdjacentHTML(\"beforeend\",`<style>\n.fuh h2{margin:18px 0 4px;font:700 22px/1.2 var(--serif);color:var(--ink)}.fuh p{margin:0 0 12px;color:var(--mute);font:500 13.5px/1.45 var(--sans)}\n.fuc{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}.fuc::-webkit-scrollbar{display:none}\n.fuc button{flex:none;border:1px solid var(--line);background:var(--card);color:var(--mute);border-radius:999px;font:600 12.5px var(--sans);padding:6px 10px;cursor:pointer}.fuc button.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}\n.fui{border-top:1px solid var(--line);padding:14px 0}\n.fum{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;color:var(--mute);font:500 12.5px var(--sans);margin-bottom:6px}\n.fuk{border-radius:999px;padding:2px 9px;font:700 11px/1.6 var(--sans);letter-spacing:.4px;text-transform:uppercase;border:1px solid var(--line);color:var(--ink);background:var(--card)}\n.fuk.prize{color:var(--gold);border-color:var(--gold)}.fuk.winners{color:var(--grn);border-color:var(--grn)}.fuk.feature{color:var(--acc);border-color:var(--acc)}.fuk.rules{color:var(--silver);border-color:var(--silver)}\n.fus{font:600 12px var(--sans)}.fus.op{color:var(--grn)}.fus.cl{color:var(--mute)}\n.fut{margin:0 0 6px;font:600 17px/1.35 var(--serif);color:var(--ink);overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}\n.fux{margin:0 0 2px;color:var(--mute);font:400 14px/1.45 var(--sans);overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\n.fua{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.fua button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;font:600 13px var(--sans);padding:6px 12px;cursor:pointer}.fua button.pri{background:var(--acc);border-color:var(--acc);color:#fff}\n.fpnote{margin:0 0 10px;color:var(--mute);font:500 12.5px/1.4 var(--sans)}\n.fpz{border:1px solid var(--line);border-radius:12px;background:var(--card);margin:0 0 10px;overflow:hidden}\n.fph{position:relative;display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;border:0;background:none;color:var(--ink);text-align:left;cursor:pointer}\n.fpx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.fpx b{font:700 16px/1.3 var(--serif);overflow-wrap:anywhere}.fpx span{font:500 12.5px var(--sans);color:var(--mute)}.fpx .fus.op{color:var(--grn)}\n.fpdot{position:absolute;right:17px;bottom:15px;width:9px;height:9px;border-radius:50%;background:#2ecc71;box-shadow:0 0 0 0 rgba(46,204,113,.55);animation:fpdot 1.8s ease-in-out infinite}@keyframes fpdot{0%{opacity:.45;box-shadow:0 0 0 0 rgba(46,204,113,.5)}50%{opacity:1;box-shadow:0 0 0 5px rgba(46,204,113,0)}100%{opacity:.45;box-shadow:0 0 0 0 rgba(46,204,113,0)}}@media (prefers-reduced-motion:reduce){.fpdot{animation:none}}\n.fpc{font-style:normal;font-size:24px;line-height:1;color:var(--mute);transition:transform .2s;flex:none}.fpz.on .fpc{transform:rotate(90deg)}\n.fpg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 8px;padding:0 12px 4px}@media (min-width:560px){.fpg{grid-template-columns:repeat(4,minmax(0,1fr))}}\n.fpt{display:flex;flex-direction:column;gap:5px;border:0;background:none;padding:0;text-align:left;cursor:pointer;color:var(--ink);min-width:0}\n.fpi{position:relative;display:block;aspect-ratio:9/14;border-radius:10px;overflow:hidden;background:#24211B}.fpi img{width:100%;height:100%;object-fit:cover;display:block}\n.fpi i{position:absolute;font-style:normal}\n.fpp{left:50%;top:50%;transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;display:flex;align-items:center;justify-content:center}.fpp svg{width:16px;height:16px;margin-left:2px}\n.fpw{top:6px;left:6px;background:var(--gold);color:#fff;font:700 10px/1 var(--sans);padding:4px 6px;border-radius:999px;white-space:nowrap}\n.fpd{right:6px;bottom:6px;background:rgba(0,0,0,.6);color:#fff;font:600 10.5px/1 var(--sans);padding:3px 5px;border-radius:4px}\n.fpa{display:flex;align-items:center;gap:5px;min-width:0}.fpa img{width:16px;height:16px;border-radius:50%;object-fit:cover;flex:none}.fpa b{font:600 12px var(--sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}\n.fpm{font:500 11px var(--sans);color:var(--mute);margin-top:-3px}\n.fpmore{display:block;margin:10px 12px 0;width:calc(100% - 24px);border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:999px;padding:9px;font:600 13px var(--sans);cursor:pointer}\n.fppost{display:block;margin:4px auto 8px;border:0;background:none;color:var(--acc);padding:8px 12px;font:600 13px var(--sans);cursor:pointer}\n.fpe{padding:14px 0 18px;font-size:14px}\nhtml[data-theme=dark] .fpw{color:#17150F}\nnav.tabs button[data-t=updates]{display:inline-flex;align-items:center;gap:6px;color:var(--acc)}nav.tabs button[data-t=updates].on{color:var(--acc)}nav.tabs button[data-t=updates] svg{width:14px;height:14px;flex:none;transform:translateY(-.5px);pointer-events:none}nav.tabs button[data-t=today]{color:#2E7D4F}html[data-theme=dark] nav.tabs button[data-t=today]{color:#7FD1A3}\n</style>`);\nconst tabs=$(\"#tabs\");if(tabs&&!tabs.querySelector('[data-t=\"updates\"]')){const b=document.createElement(\"button\");b.dataset.t=\"updates\";b.innerHTML='<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z\"/><path d=\"M15.5 8.5a5 5 0 0 1 0 7\"/><path d=\"M18.5 5.5a9 9 0 0 1 0 13\"/></svg>';b.appendChild(document.createTextNode(S(0)));{const td=tabs.querySelector('[data-t=\"today\"]');td?td.after(b):tabs.insertBefore(b,tabs.firstChild)}}\nconst fdate=t=>{try{return new Date(t).toLocaleDateString(\"en-US\",{month:\"short\",day:\"numeric\",year:\"numeric\",calendar:\"gregory\"})}catch(e){return new Date(t).toDateString()}};\nconst left=ms=>{const m=Math.max(0,Math.floor(ms/60000)),d=Math.floor(m/1440),h=Math.floor(m%1440/60),mm=m%60;return d?`${d}d ${h}h`:h?`${h}h ${mm}m`:`${mm}m`};\nasync function openPost(x){const hash=x.h;if(sdk&&ctx){try{await sdk.actions.viewCast({hash});return}catch(e){}try{await sdk.actions.openUrl(x.url);return}catch(e){}}window.open(x.url,\"_blank\",\"noopener\")}\nfunction card(x){const now=Date.now();let st=\"\";if(x.end){st=now<x.end?`<span class=\"fus op\">${esc(S(8))} \\u00B7 ${esc(S(10).replace(\"{t}\",left(x.end-now)))}</span>`:`<span class=\"fus cl\">${esc(S(9))}</span>`}else if(x.open===false){st=`<span class=\"fus cl\">${esc(S(9))}</span>`}\n  const win=x.cat===\"prize\"&&FD?FD.items.find(w=>w.for===x.h):null;\n  return `<div class=\"fui\" data-fu=\"${esc(x.h)}\"><div class=\"fum\"><span>${esc(fdate(x.ts))}</span><span class=\"fuk ${esc(x.cat)}\">${esc(S(CI[x.cat]||6))}</span>${st}${x.by?`<span dir=\"ltr\">@${esc(x.by)}</span>`:\"\"}</div><h3 class=\"fut\" dir=\"auto\">${esc(fcuMd(x.title).t)}</h3>${fcuMdLines([\"t\",...(x.ex||[])]).ex.map(l=>`<p class=\"fux\" dir=\"auto\">${esc(l)}</p>`).join(\"\")}<div class=\"fua\"><button class=\"pri\" data-fo=\"${esc(x.h)}\">${esc(S(7))}</button>${x.for?`<button data-fo=\"${esc(x.for)}\">${esc(S(14))}</button>`:\"\"}${win?`<button data-fo=\"${esc(win.h)}\">${esc(S(3))}</button>`:\"\"}</div></div>`}\nlet PD=null,PDt=0;const fpOpen={},fpAll={};\nconst fpRange=x=>{const o={month:\"short\",day:\"numeric\"};try{const a=new Date(x.ts);if(!x.end)return a.toLocaleDateString(\"en-US\",{...o,year:\"numeric\"});const b=new Date(x.end),sm=a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth();return a.toLocaleDateString(\"en-US\",o)+\"\\u2013\"+(sm?b.getDate():b.toLocaleDateString(\"en-US\",o))+\", \"+b.getFullYear()}catch(e){return \"\"}};\nconst fpDur=s=>s?Math.floor(s/60)+\":\"+String(s%60).padStart(2,\"0\"):\"\";\nconst fpTime=t=>{try{return new Date(t).toLocaleString(\"en-US\",{month:\"short\",day:\"numeric\",hour:\"numeric\",minute:\"2-digit\"})}catch(e){return \"\"}};\nfunction fpTile(e){return `<button class=\"fpt\" data-fp=\"${esc(e.h)}\" data-u=\"${esc(e.u)}\"><span class=\"fpi\">${e.th?`<img src=\"${esc(img(e.th,360))}\" alt=\"\" loading=\"lazy\">`:\"\"}${e.w?`<i class=\"fpw\">\\u{1F3C6} ${esc(e.w)}</i>`:\"\"}<i class=\"fpp\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 5v14l11-7z\" fill=\"currentColor\"/></svg></i>${e.d?`<i class=\"fpd\">${fpDur(e.d)}</i>`:\"\"}</span><span class=\"fpa\">${e.p?`<img src=\"${esc(img(e.p,48))}\" alt=\"\" loading=\"lazy\">`:\"\"}<b dir=\"ltr\">@${esc(e.u||(\"fid \"+e.f))}</b></span><span class=\"fpm\">${esc(fpTime(e.ts))}</span></button>`}\nfunction fpBlock(x,k){const open=fpOpen[x.h]!==undefined?fpOpen[x.h]:k===0,all=!!fpAll[x.h],N=x.e.length,sh=all?x.e:x.e.slice(0,6);\n  const st=x.open?`<span class=\"fus op\">${esc(S(8))} \\u00B7 ${esc(S(10).replace(\"{t}\",left(x.end-Date.now())))}</span>`:`<span class=\"fus cl\">${esc(S(9))}</span>`;\n  const body=!open?\"\":N?`<div class=\"fpg\">${sh.map(fpTile).join(\"\")}</div>${N>6?`<button class=\"fpmore\" data-pm=\"${esc(x.h)}\">${esc(all?S(20):S(19).replace(\"{n}\",N))}</button>`:\"\"}<button class=\"fppost\" data-po=\"${esc(x.h)}\">${esc(S(14))}</button>`:`<div class=\"empty fpe\">${esc(S(18))}</div>`;\n  return `<section class=\"fpz${open?\" on\":\"\"}\"><button class=\"fph\" data-pt=\"${esc(x.h)}\"><span class=\"fpx\"><b dir=\"auto\">${esc(x.name)}</b><span>${esc(fpRange(x))} \\u00B7 ${esc(N===1?S(22):S(21).replace(\"{n}\",N))}</span>${st}</span><i class=\"fpc\">\\u203A</i>${x.open?`<i class=\"fpdot\" aria-hidden=\"true\"></i>`:\"\"}</button>${body}</section>`}\nasync function fpList(){const B0=$(\"#fuls\");if(!B0)return;B0.onclick=null;\n  if(!PD||Date.now()-PDt>60000){if(!PD)B0.innerHTML=`<div class=\"loading\">${esc(S(23))}</div>`;try{const j=await (await fetch(\"/api/parts\")).json();if(j&&j.prizes){PD=j;PDt=Date.now()}}catch(e){}}\n  const B=$(\"#fuls\");if(!B||fcat!==\"parts\"||tab!==\"updates\")return;\n  if(!PD||!PD.prizes||!PD.prizes.length){B.innerHTML=`<div class=\"empty\">${esc(S(18))}</div>`;return}\n  B.innerHTML=`<p class=\"fpnote\">${esc(S(24))}</p>`+PD.prizes.map(fpBlock).join(\"\");\n  B.onclick=ev=>{const t=ev.target.closest(\"[data-pt],[data-pm],[data-fp],[data-po]\");if(!t)return;\n    if(t.dataset.pt){const h=t.dataset.pt,k=PD.prizes.findIndex(x=>x.h===h);fpOpen[h]=!(fpOpen[h]!==undefined?fpOpen[h]:k===0);fpList();return}\n    if(t.dataset.pm){fpAll[t.dataset.pm]=!fpAll[t.dataset.pm];fpList();return}\n    if(t.dataset.po){const x=PD.prizes.find(p=>p.h===t.dataset.po);if(x)openPost({h:x.h,url:x.url});return}\n    const h=t.dataset.fp;openPost({h,url:\"https://farcaster.xyz/\"+(t.dataset.u||\"~\")+\"/\"+h.slice(0,10)})}}\n\nfunction fuList(){if(fcat===\"parts\"){fpList();return}const B=$(\"#fuls\");if(!B)return;B.onclick=null;if(!FD||!FD.items){B.innerHTML=`<div class=\"empty\">${esc(S(13))}</div>`;return}\n  const L=FD.items.filter(x=>!fcat||(fcat===\"news\"?NEWS.has(x.cat):x.cat===fcat));\n  B.innerHTML=L.length?L.map(card).join(\"\"):`<div class=\"empty\">${esc(S(13))}</div>`;\n  B.querySelectorAll(\"[data-fo]\").forEach(b=>b.onclick=()=>{const x=FD.items.find(i=>i.h===b.dataset.fo)||{h:b.dataset.fo,url:\"https://farcaster.xyz/~/conversations/\"+b.dataset.fo};openPost(x)})}\nasync function fuRender(){$(\"#chips\").style.display=\"none\";const L=$(\"#list\");\n  const chips=()=>`<div class=\"fuc\" id=\"fuc\"${RT?' dir=\"rtl\"':\"\"}>${CH.map(([c,i])=>`<button data-fc=\"${c}\" class=\"${fcat===c?\"on\":\"\"}\">${esc(S(i))}</button>`).join(\"\")}</div>`;\n  L.innerHTML=`<div class=\"fuh\"${RT?' dir=\"rtl\"':\"\"}><h2>${esc(S(0))}</h2><p>${esc(S(11))}</p></div><div id=\"fucw\">${chips()}</div><div id=\"fuls\"><div class=\"loading\">${esc(S(12))}</div></div>`;\n  const bind=()=>{const C=$(\"#fuc\");if(C)C.onclick=e=>{const b=e.target.closest(\"button\");if(!b)return;fcat=b.dataset.fc;$(\"#fucw\").innerHTML=chips();bind();fuList()}};bind();\n  if(!FD||Date.now()-FDt>120000){try{const j=await (await fetch(\"/api/updates\")).json();if(j&&j.items){FD=j;FDt=Date.now()}}catch(e){}}\n  if(tab!==\"updates\")return;$(\"#fucw\").innerHTML=chips();bind();fuList();\n  clearInterval(ftick);ftick=setInterval(()=>{if(tab!==\"updates\"||!document.getElementById(\"fuls\")){clearInterval(ftick);return}if(FD&&FD.items.some(x=>x.end&&x.end>Date.now()-60000))fuList();if(document.visibilityState===\"visible\"&&Date.now()-FDt>110000){FDt=Date.now();fetch(\"/api/updates\").then(r=>r.json()).then(j=>{if(!j||!j.items)return;const k=a=>a.items.map(x=>x.h).join();const ch=!FD||k(j)!==k(FD);FD=j;if(ch&&tab===\"updates\")fuList()}).catch(()=>{})}},60000)}\nconst _rU=render;render=function(){if(tab===\"updates\"){fuRender();return}return _rU.apply(this,arguments)};\nwindow.__fupd=()=>{tab=\"updates\";[...$(\"#tabs\").children].forEach(x=>x.classList.toggle(\"on\",x.dataset.t===\"updates\"));fuRender()};\n{const qp=new URLSearchParams(location.search);if(qp.get(\"tab\")===\"updates\")setTimeout(()=>window.__fupd(),300)}\n})();\n\n\n\n// ---- Folio nav 2026-11-19: Library (Saved+Highlights), Requests under Writers, cover icon in header ----\n(function(){try{\nconst T=$(\"#tabs\");if(!T||T.querySelector('[data-t=\"library\"]'))return;\nconst G={writers:{subs:[[\"writers\",\"Top writers\"],[\"requests\",\"Requests\"]],cur:\"writers\"},library:{subs:[[\"saved\",\"Saved\"],[\"hl\",\"Highlights\"]],cur:\"saved\"}};\nconst grpOf=t=>t===\"writers\"||t===\"requests\"?\"writers\":t===\"saved\"||t===\"hl\"?\"library\":null;\nconst rq=T.querySelector('[data-t=\"requests\"]'),sv=T.querySelector('[data-t=\"saved\"]'),hl=T.querySelector('[data-t=\"hl\"]');\nconst lib=document.createElement(\"button\");lib.dataset.t=\"library\";lib.textContent=\"Library\";\nif(sv)sv.before(lib);else T.appendChild(lib);\n[rq,sv,hl].forEach(b=>{if(b)b.remove()});\nconst subHtml=g=>`<div class=\"sub gsub\" id=\"gsub\">${G[g].subs.map(([t,l])=>`<button class=\"fl${tab===t?\" on\":\"\"}\" data-gsub=\"${t}\">${l}</button>`).join(\"\")}</div>`;\nconst addSub=()=>{const g=grpOf(tab);if(!g)return;G[g].cur=tab;const L=$(\"#list\");if(!L)return;const o=document.getElementById(\"gsub\");if(o)o.remove();L.insertAdjacentHTML(\"afterbegin\",subHtml(g))};\nconst markOn=g=>[...T.children].forEach(x=>x.classList.toggle(\"on\",x.dataset.t===g));\nconst show=t=>{tab=t;markOn(grpOf(t));if(t===\"hl\"){window.hlRender()}else{$(\"#chips\").style.display=\"\";render()}};\nconst _rN=render;render=function(){const r=_rN.apply(this,arguments);try{addSub()}catch(e){}return r};\nconst _hN=window.hlRender;window.hlRender=function(){const r=_hN.apply(this,arguments);try{addSub()}catch(e){}return r};\nT.addEventListener(\"click\",e=>{const b=e.target.closest(\"button\");if(!b||!G[b.dataset.t])return;e.stopPropagation();show(G[b.dataset.t].cur);window.scrollTo(0,0)},true);\n$(\"#list\").addEventListener(\"click\",e=>{const b=e.target.closest(\"[data-gsub]\");if(!b)return;e.stopPropagation();show(b.dataset.gsub)});\nwindow.__freq=()=>show(\"requests\");\n// cover: small icon in header instead of the full-width bar\nconst cb=$(\"#coverbar\"),hr=document.querySelector(\"header.top .hr\");\nif(cb&&hr){const ib=document.createElement(\"button\");ib.id=\"covbtn\";ib.setAttribute(\"aria-label\",\"Your Folio cover\");ib.title=\"Your Folio cover\";ib.innerHTML=\"<i></i>\";ib.style.display=\"none\";hr.insertBefore(ib,hr.firstChild);ib.onclick=()=>cb.click();\n const sync=()=>{const on=cb.style.display===\"flex\";ib.style.display=on?\"\":\"none\";const th=$(\"#coverthumb\");const bg=th&&th.style.backgroundImage;if(bg)ib.querySelector(\"i\").style.backgroundImage=bg};\n sync();new MutationObserver(sync).observe(cb,{attributes:true,subtree:true,attributeFilter:[\"style\"]})}\ndocument.head.insertAdjacentHTML(\"beforeend\",\"<style>#coverbar{display:none!important}#covbtn{position:relative;flex:none;width:30px;height:30px;border-radius:999px;border:1.5px solid #D9A82B;background:#1B1A17;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center}#covbtn[style*='none']{display:none!important}#covbtn i{width:14px;height:19px;border-radius:2px;border:1.5px solid #D9A82B;background:#3A3125 center/cover no-repeat}.gsub{padding:12px 0 4px}#covbtn{margin-left:54px}#covbtn::after{content:'Cover';position:absolute;right:100%;top:50%;transform:translateY(-50%);margin-right:8px;padding:2px 8px 3px;border-radius:999px;border:1px solid rgba(217,168,43,.45);background:rgba(217,168,43,.08);font:italic 600 11.5px var(--serif);letter-spacing:.3px;color:#A8801F;white-space:nowrap;cursor:pointer}</style>\");\n}catch(e){}})();\n\n// ---- Zero Hour (sealed texts) 2026-11-19: Today top card, list page, compose, detail. Body comes from the server only after open. ----\n(function(){try{\nif(window.__zh)return;window.__zh=1;\nconst D=864e5,H=36e5;let SL=null,zv=null,zfilt=\"soon\",zcur=null;\nconst zfmt=t=>new Date(t).toLocaleDateString(\"en-US\",{month:\"short\",day:\"numeric\",year:\"numeric\"});\nconst zp=n=>String(n).padStart(2,\"0\");\nconst zfull=ms=>{ms=Math.max(0,ms);return `${Math.floor(ms/D)}d ${zp(Math.floor(ms%D/H))}h ${zp(Math.floor(ms%H/6e4))}m ${zp(Math.floor(ms%6e4/1e3))}s`};\nconst zcd=ms=>{ms=Math.max(0,ms);return `<div><b>${Math.floor(ms/D)}</b><span>days</span></div><div><b>${zp(Math.floor(ms%D/H))}</b><span>hours</span></div><div><b>${zp(Math.floor(ms%H/6e4))}</b><span>min</span></div><div><b>${zp(Math.floor(ms%6e4/1e3))}</b><span>sec</span></div>`};\nconst LK='<svg viewBox=\"0 0 24 24\" width=\"11\" height=\"11\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\"><rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 11V7a4 4 0 0 1 8 0v4\"/></svg>';\nconst BL='<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\"/><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\"/></svg>';\nconst zav=(p,u,c)=>p?`<img class=\"${c}\" src=\"${esc(img(p,96))}\" alt=\"\" loading=\"lazy\" onerror=\"this.style.visibility='hidden'\">`:`<span class=\"${c} zpl\">${esc((u||\"?\")[0].toUpperCase())}</span>`;\nconst zhead=(x,sub,extra)=>`<div class=\"zsh\"><div class=\"zpw\">${zav(x.w.p,x.w.u,\"zpa\")}<i class=\"zlk\">${LK}</i></div><div class=\"zst\"><h3>${esc(x.t)}</h3><div class=\"zby\">@${esc(x.w.u)}${sub?\" \\u00b7 \"+sub:\"\"}</div>${extra||\"\"}</div></div>`;\nconst zwrow=x=>`<div class=\"zwt\">${(x.wa||[]).map(p=>zav(p,\"\",\"zwa\")).join(\"\")}<em>${x.n} waiting</em></div>`;\nconst zrb=x=>x.mine?\"\":`<button class=\"zrb${x.rem?\" on\":\"\"}\" data-zrem=\"${esc(x.id)}\">${BL}${x.rem?\"Reminder set\":\"Remind me\"}</button>`;\nconst zpending=()=>(SL||[]).filter(x=>x.st===\"sealed\"&&x.oa>Date.now());\nconst zsignedIn=()=>{try{return !!(window.__fin&&window.__fin())}catch(e){return false}};\nlet ztoastT=0;const ztoast=t=>{let e=document.getElementById(\"ztoast\");if(!e){e=document.createElement(\"div\");e.id=\"ztoast\";document.body.appendChild(e)}e.textContent=t;e.classList.add(\"on\");clearTimeout(ztoastT);ztoastT=setTimeout(()=>e.classList.remove(\"on\"),2200)};\nasync function zfetch(bg){try{const t=zsignedIn()?await qaTok(bg?1:0):null;const r=await fetch(\"/api/sealed\",{headers:t?{Authorization:\"Bearer \"+t}:{}});if(!r.ok)return;const j=await r.json();SL=j.items||[];zdrawTop();if(zv===\"list\")zdrawList()}catch(e){}}\nasync function zpost(o){const t=await qaTok();if(!t){ztoast(\"Open Folio in Farcaster and sign in first\");return null}const r=await fetch(\"/api/sealed\",{method:\"POST\",headers:{Authorization:\"Bearer \"+t,\"content-type\":\"application/json\"},body:JSON.stringify(o)});let j={};try{j=await r.json()}catch(e){}if(!r.ok){ztoast(j.msg||(r.status===401?\"Sign in to Farcaster first\":\"Something went wrong\"));return null}return j}\nconst zmerge=j=>{if(!j||!j.id||!SL)return;const i=SL.findIndex(x=>x.id===j.id);const {ok,on,...o}=j;if(i>=0)SL[i]={...SL[i],...o}};\nfunction ztopHtml(){const live=zpending().sort((a,b)=>(b.n-a.n)||(a.oa-b.oa));if(!live.length)return `<div id=\"zhtop\"><div class=\"zintro\"><div class=\"zk\">${LK} Zero Hour</div><div class=\"zit\">Write something now. It stays locked until the date you pick, then opens for everyone at once.</div><div class=\"zib\"><button class=\"zwl2\" data-zgo=\"write\">+ Seal yours</button><button class=\"zal2\" data-zgo=\"list\">See all \\u203a</button></div></div></div>`;const x=live[0];\n return `<div id=\"zhtop\"><div class=\"zseal\" data-zid=\"${esc(x.id)}\"><div class=\"zk\">${LK} Zero Hour \\u00b7 opens ${zfmt(x.oa)}</div>${zhead(x,\"sealed \"+zfmt(x.sa))}<div class=\"zcd\" data-o=\"${x.oa}\">${zcd(x.oa-Date.now())}</div><div class=\"zrow\">${zwrow(x)}${zrb(x)}</div><button class=\"zallb\" data-zgo=\"list\">See all Zero Hour texts (${live.length}) <span>\\u203a</span></button><button class=\"zwl\" data-zgo=\"write\">+ Seal yours</button></div></div>`}\nfunction zdrawTop(){try{const o=document.getElementById(\"zhtop\");if(tab!==\"today\"){if(o)o.remove();return}const L=$(\"#list\");if(!L||!L.querySelector(\".lead,.row,.gmc\"))return;const h=ztopHtml();if(o){if(!h)o.remove();else o.outerHTML=h}else if(h)L.insertAdjacentHTML(\"afterbegin\",h)}catch(e){}}\nconst _rZ=render;render=function(){const r=_rZ.apply(this,arguments);try{zdrawTop()}catch(e){}return r};\nfunction zcard(x){\n if(x.st===\"wd\")return `<div class=\"zsc wd\">${zhead(x,\"withdrawn by the writer\")}</div>`;\n if(x.st===\"open\"||x.oa<=Date.now())return `<div class=\"zsc op\" data-zopen=\"${esc(x.id)}\">${zhead(x,\"opened \"+zfmt(x.oa))}${x.b!=null?`<div class=\"ztxt zclamp\">${esc(x.b)}</div>`:\"\"}<div class=\"zft\"><span>${x.n} ${x.n===1?\"was\":\"were\"} waiting</span><span class=\"zok2\">Read \\u203a</span></div></div>`;\n const wdl=x.mine?(Date.now()<x.half?`<button class=\"zwdb\" data-zwd=\"${esc(x.id)}\">Withdraw \\u00b7 until ${zfmt(x.half)}</button>`:`<span class=\"zwdn\">Locked for good \\u00b7 can't withdraw</span>`):\"\";\n return `<div class=\"zsc\" data-zdet=\"${esc(x.id)}\">${zhead(x,\"opens \"+zfmt(x.oa),`<div class=\"zcl\"><span class=\"zchip\" data-s=\"${x.oa}\">${LK} ${zfull(x.oa-Date.now())}</span></div>${wdl}`)}<div class=\"zft\">${zwrow(x)}${zrb(x)}</div></div>`}\nfunction zdrawList(){const L=document.getElementById(\"zlist\");if(!L)return;if(!SL){L.innerHTML='<p class=\"zsub\">Loading\\u2026</p>';return}let a=SL.slice();const n=Date.now();\n if(zfilt===\"soon\")a=a.filter(x=>x.st===\"wd\"||(x.st===\"sealed\"&&x.oa>n)).sort((p,q)=>((p.st===\"wd\")-(q.st===\"wd\"))||p.oa-q.oa);else a=a.filter(x=>x.st===\"open\"||(x.st===\"sealed\"&&x.oa<=n)).sort((p,q)=>q.oa-p.oa);\n L.innerHTML=a.map(zcard).join(\"\")||`<p class=\"zsub\">${zfilt===\"soon\"?\"Nothing sealed right now. Be the first.\":\"Nothing has opened yet.\"}</p>`}\n// ---- overlay ----\nconst ZV=document.createElement(\"div\");ZV.id=\"zhv\";document.body.appendChild(ZV);\nlet zbk=null;\nfunction zopen(v,arg){zv=v;ZV.classList.add(\"open\");document.documentElement.classList.add(\"zlock\");\n try{if(!zbk&&window._bkok&&sdk&&sdk.back){zbk=sdk.back.onback;sdk.back.onback=()=>{if(zv===\"detail\"||zv===\"write\")zopen(\"list\");else zclose()};if(inMini()&&sdk.back.show)sdk.back.show()}}catch(e){}\n if(v===\"list\")zlistView();else if(v===\"write\")zwriteView();else if(v===\"detail\")zdetailView(arg);ZV.scrollTop=0}\nfunction zclose(){zv=null;ZV.classList.remove(\"open\");document.documentElement.classList.remove(\"zlock\");ZV.innerHTML=\"\";try{if(zbk&&sdk&&sdk.back){sdk.back.onback=zbk;zbk=null;if(!cur&&sdk.back.hide)sdk.back.hide()}}catch(e){}zdrawTop()}\nwindow.__zhOpen=zopen;\nfunction zlistView(){ZV.innerHTML=`<div class=\"zw\"><button class=\"zbk\" data-zclose>\\u2039 Back</button><div class=\"zph\"><b>Zero Hour</b><button class=\"zwbtn\" data-zgo=\"write\">+ Seal yours</button></div><div class=\"zsub\">Texts locked until a date. Nobody can read them before then, not even the writer.</div><div class=\"ztg\"><button class=\"${zfilt===\"soon\"?\"on\":\"\"}\" data-zf=\"soon\">Sealed</button><button class=\"${zfilt===\"open\"?\"on\":\"\"}\" data-zf=\"open\">Opened</button></div><div id=\"zlist\"></div></div>`;zdrawList();zfetch(1)}\nlet zpick=\"30\",zoa=0;\nfunction zcalc(){const t=new Date(),i=$(\"#zcdate\");if(!i)return;if(zpick===\"ny\"){zoa=new Date(t.getFullYear(),11,31,23,59).getTime();if(zoa<Date.now()+D)zoa=new Date(t.getFullYear()+1,11,31,23,59).getTime();if(zoa>Date.now()+365*D)zoa=0}else if(zpick===\"c\"){const v=i.value;if(v){const d=new Date(v+\"T00:00\");d.setHours(t.getHours(),t.getMinutes()+5,0,0);zoa=d.getTime()}else zoa=0}else zoa=Date.now()+(+zpick)*D;\n i.style.display=zpick===\"c\"?\"block\":\"none\";$(\"#zodate\").textContent=zoa?new Date(zoa).toLocaleString(\"en-US\",{month:\"short\",day:\"numeric\",year:\"numeric\",hour:\"2-digit\",minute:\"2-digit\"}):\"pick a date\";\n const half=zoa?Date.now()+(zoa-Date.now())/2:0;$(\"#zrules\").textContent=zoa?`After sealing, nobody can read or edit it, not even you. You can withdraw it until ${zfmt(half)}; after that it opens no matter what. A withdrawn seal stays on Folio marked \"Withdrawn\".`:\"Pick a date between tomorrow and one year from now.\"}\nfunction zwriteView(){ZV.innerHTML=`<div class=\"zw\"><button class=\"zbk\" data-zgo=\"list\">\\u2039 Cancel</button><div class=\"zph\"><b>Seal a text</b></div><div class=\"zpap\" id=\"zpap\"><input id=\"zt\" maxlength=\"120\" placeholder=\"Title\"><textarea id=\"zb\" maxlength=\"10000\" placeholder=\"Write something to open later: a prediction, a letter, a promise...\"></textarea><div class=\"zwax\" id=\"zwax\">${LK.replace(/width=\"11\" height=\"11\"/,'width=\"30\" height=\"30\"')}</div></div><label class=\"zpred\"><input type=\"checkbox\" id=\"zpr\"> This is a prediction <span>(readers can vote Right or Wrong after it opens)</span></label><div class=\"zlb\">Opens on</div><div class=\"zop\" id=\"zpre\"><button data-d=\"7\">1 week</button><button data-d=\"30\" class=\"on\">1 month</button><button data-d=\"ny\">New Year's Eve</button><button data-d=\"365\">1 year</button><button data-d=\"c\">Pick a date</button></div><input type=\"date\" id=\"zcdate\"><div class=\"zdt\">Opens for everyone on <b id=\"zodate\"></b></div><div class=\"zrules\" id=\"zrules\"></div><div class=\"zmsg\" id=\"zmsg\"></div><button class=\"zbtn\" id=\"zsealbtn\">Seal it</button></div>`;\n zpick=\"30\";const f=d=>{const z=new Date(d);return z.getFullYear()+\"-\"+zp(z.getMonth()+1)+\"-\"+zp(z.getDate())};$(\"#zcdate\").min=f(Date.now()+D);$(\"#zcdate\").max=f(Date.now()+364*D);\n $(\"#zpre\").onclick=e=>{const b=e.target.closest(\"button\");if(!b)return;zpick=b.dataset.d;ZV.querySelectorAll(\"#zpre button\").forEach(x=>x.classList.toggle(\"on\",x===b));zcalc()};$(\"#zcdate\").oninput=zcalc;zcalc();\n if(!zsignedIn())$(\"#zmsg\").textContent=\"Open Folio inside Farcaster to seal a text.\";\n $(\"#zsealbtn\").onclick=zseal}\nasync function zseal(){const t=$(\"#zt\").value.replace(/\\s+/g,\" \").trim(),b=$(\"#zb\").value.trim(),M=$(\"#zmsg\"),B=$(\"#zsealbtn\");\n if(t.length<3){M.textContent=\"Add a title (3 to 120 characters).\";return}if(b.length<20){M.textContent=\"Write at least 20 characters.\";return}\n if(!zoa||zoa<Date.now()+D-6e4||zoa>Date.now()+366*D){M.textContent=\"Pick a date between tomorrow and one year from now.\";return}\n M.textContent=\"\";B.disabled=true;B.textContent=\"Sealing\\u2026\";const j=await zpost({do:\"seal\",t,b,oa:zoa,pred:$(\"#zpr\").checked});\n if(!j){B.disabled=false;B.textContent=\"Seal it\";return}\n const P=$(\"#zpap\");P.classList.add(\"stamp\");await new Promise(r=>setTimeout(r,matchMedia(\"(prefers-reduced-motion: reduce)\").matches?200:1300));\n ZV.innerHTML=`<div class=\"zw\"><div class=\"zdone\"><div class=\"zwax big\">${LK.replace(/width=\"11\" height=\"11\"/,'width=\"34\" height=\"34\"')}</div><h3>Sealed</h3><p>Opens for everyone on ${esc(zfmt(j.oa))}</p><p class=\"zfpl\">Fingerprint (SHA-256)</p><p><code>${esc(j.fp)}</code></p><p class=\"zsm\">Anyone can check later that the opened text matches this fingerprint.</p></div><button class=\"zbtn\" id=\"zcast\">Cast it</button><button class=\"zbtn2\" data-zgo=\"list\">See all in Zero Hour</button></div>`;zv=\"done\";\n $(\"#zcast\").onclick=()=>zshare({id:j.id,t,oa:j.oa},true);zfetch(1)}\nasync function zshare(x,own){const url=location.origin+\"/?seal=\"+x.id;const text=own?`I sealed a text on Folio: \"${x.t}\". Nobody can read it until ${zfmt(x.oa)}, not even me.`:`\"${x.t}\" opens on Folio on ${zfmt(x.oa)}. Waiting with me?`;\n if(sdk&&ctx){try{await sdk.actions.composeCast({text,embeds:[url]});return}catch(e){}}if(navigator.share){try{await navigator.share({text,url});return}catch(e){}}try{await navigator.clipboard.writeText(text+\" \"+url);ztoast(\"Link copied\")}catch(e){}}\nasync function zsha(s){const h=await crypto.subtle.digest(\"SHA-256\",new TextEncoder().encode(s));return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,\"0\")).join(\"\")}\nasync function zdetailView(id){ZV.innerHTML=`<div class=\"zw\"><button class=\"zbk\" data-zgo=\"list\">\\u2039 Zero Hour</button><div id=\"zdet\"><p class=\"zsub\">Loading\\u2026</p></div></div>`;\n let x=null;try{const t=zsignedIn()?await qaTok(1):null;const r=await fetch(\"/api/sealed?id=\"+encodeURIComponent(id),{headers:t?{Authorization:\"Bearer \"+t}:{}});if(r.ok)x=await r.json()}catch(e){}\n const E=document.getElementById(\"zdet\");if(!E||zv!==\"detail\")return;if(!x){E.innerHTML='<p class=\"zsub\">This one could not be found.</p>';return}zcur=x;zdrawDetail(true)}\nasync function zdrawDetail(first){const x=zcur,E=document.getElementById(\"zdet\");if(!E||!x)return;\n if(x.st===\"wd\"){E.innerHTML=`<div class=\"zsc wd\">${zhead(x,\"withdrawn by the writer\")}</div>`;return}\n if(x.st===\"sealed\"&&x.oa>Date.now()){const wdl=x.mine?(Date.now()<x.half?`<button class=\"zwdb\" data-zwd=\"${esc(x.id)}\">Withdraw \\u00b7 until ${zfmt(x.half)}</button>`:`<span class=\"zwdn\">Locked for good \\u00b7 can't withdraw</span>`):\"\";\n  E.innerHTML=`<div class=\"zseal\"><div class=\"zk\">${LK} Zero Hour \\u00b7 opens ${zfmt(x.oa)}</div>${zhead(x,\"sealed \"+zfmt(x.sa))}<div class=\"zcd\" data-o=\"${x.oa}\" data-zre=\"${esc(x.id)}\">${zcd(x.oa-Date.now())}</div><div class=\"zrow\">${zwrow(x)}${zrb(x)}</div>${wdl?`<div class=\"zwdw\">${wdl}</div>`:\"\"}<button class=\"zallb\" id=\"zsh\">Share the countdown <span>\\u203a</span></button></div>`;\n  $(\"#zsh\").onclick=()=>zshare(x,x.mine);return}\n if(x.b==null){E.innerHTML=`<div class=\"zsc op\">${zhead(x,\"opening\\u2026\")}</div>`;return}\n const ok=x.fp&&(await zsha(x.t+\"\\n\"+x.b))===x.fp;const k=\"folio.zh.seen.\"+x.id;let anim=false;try{anim=first&&!localStorage.getItem(k)&&!matchMedia(\"(prefers-reduced-motion: reduce)\").matches;localStorage.setItem(k,\"1\")}catch(e){}\n const votes=x.pred?`<div class=\"zvote\"><div class=\"zvq\">Was this prediction right?</div><div class=\"zvb\"><button data-zv=\"r\" class=\"${x.my===\"r\"?\"on\":\"\"}\" ${x.my||x.mine?\"disabled\":\"\"}>Right \\u00b7 ${x.votes?x.votes.r:0}</button><button data-zv=\"w\" class=\"${x.my===\"w\"?\"on\":\"\"}\" ${x.my||x.mine?\"disabled\":\"\"}>Wrong \\u00b7 ${x.votes?x.votes.w:0}</button></div></div>`:\"\";\n const pub=x.mine?`<button class=\"zbtn\" id=\"zpub\">Post it on Farcaster</button>`:`<button class=\"zbtn2\" id=\"zsh2\">Share</button>`;\n E.innerHTML=`<div class=\"zban\">Opened \\u00b7 ${x.n} ${x.n===1?\"was\":\"were\"} waiting</div><div class=\"zsc op zbig${anim?\" zbrk\":\"\"}\">${anim?`<div class=\"zbreak\"><i class=\"l\"></i><i class=\"r\"></i></div>`:\"\"}${zhead(x,\"opened \"+zfmt(x.oa))}<div class=\"ztxt\">${esc(x.b)}</div><div class=\"zft\"><span>Sealed ${zfmt(x.sa)}</span><span class=\"zok2\">${ok?\"Fingerprint matches \\u2713\":\"Fingerprint does not match\"}</span></div></div>${votes}${pub}`;\n const pb=$(\"#zpub\");if(pb)pb.onclick=async()=>{const url=location.origin+\"/?seal=\"+x.id;let body=x.b.replace(/\\s+/g,\" \").trim();const head=x.t+\"\\n\\n\",room=300-head.length;if(body.length>room)body=body.slice(0,Math.max(0,room-1)).replace(/\\s+\\S*$/,\"\")+\"\\u2026\";const text=head+body;if(sdk&&ctx){try{await sdk.actions.composeCast({text,embeds:[url]});return}catch(e){}}try{await navigator.clipboard.writeText(text+\"\\n\"+url);ztoast(\"Copied\")}catch(e){}};\n const s2=$(\"#zsh2\");if(s2)s2.onclick=()=>{const url=location.origin+\"/?seal=\"+x.id;const text=`\"${x.t}\" by @${x.w.u} just opened on Folio.`;if(sdk&&ctx){sdk.actions.composeCast({text,embeds:[url]}).catch(()=>{});return}try{navigator.clipboard.writeText(text+\" \"+url);ztoast(\"Link copied\")}catch(e){}}}\nZV.addEventListener(\"click\",zclick);document.addEventListener(\"click\",e=>{if(e.target.closest(\"#zhtop\"))zclick(e)});\nasync function zclick(e){const g=e.target.closest(\"[data-zgo]\");if(g){e.preventDefault();e.stopPropagation();zopen(g.dataset.zgo);return}\n if(e.target.closest(\"[data-zclose]\")){zclose();return}\n const f=e.target.closest(\"[data-zf]\");if(f){zfilt=f.dataset.zf;ZV.querySelectorAll(\".ztg button\").forEach(b=>b.classList.toggle(\"on\",b===f));zdrawList();return}\n const r=e.target.closest(\"[data-zrem]\");if(r){e.stopPropagation();if(r.disabled)return;r.disabled=true;const j=await zpost({do:\"rem\",id:r.dataset.zrem});r.disabled=false;if(j){zmerge(j);if(zcur&&zcur.id===j.id){Object.assign(zcur,j)}ztoast(j.on?\"We\\u2019ll notify you when it opens\":\"Reminder removed\");if(j.on){try{if(sdk&&ctx&&!(ctx.client&&ctx.client.added)&&sdk.actions.addMiniApp)await sdk.actions.addMiniApp()}catch(_){}}zdrawTop();if(zv===\"list\")zdrawList();if(zv===\"detail\")zdrawDetail()}return}\n const w=e.target.closest(\"[data-zwd]\");if(w){e.stopPropagation();if(!confirm('Withdraw this sealed text? It stays on Folio marked \"Withdrawn\" and the text is deleted for good.'))return;const j=await zpost({do:\"wd\",id:w.dataset.zwd});if(j){zmerge(j);if(zcur&&zcur.id===j.id)zcur={...zcur,...j};ztoast(\"Withdrawn\");zdrawTop();if(zv===\"list\")zdrawList();if(zv===\"detail\")zdrawDetail()}return}\n const v=e.target.closest(\"[data-zv]\");if(v&&zcur){const j=await zpost({do:\"vote\",id:zcur.id,v:v.dataset.zv});if(j){zcur={...zcur,...j};zdrawDetail()}return}\n const o=e.target.closest(\"[data-zopen],[data-zdet],#zhtop .zseal\");if(o){const id=o.dataset.zopen||o.dataset.zdet||o.dataset.zid;if(id)zopen(\"detail\",id)}}\nsetInterval(()=>{try{const n=Date.now();document.querySelectorAll(\".zcd[data-o]\").forEach(e=>{const ms=+e.dataset.o-n;e.innerHTML=zcd(ms);if(ms<=0&&e.dataset.zre&&zv===\"detail\"&&!e.dataset.done){e.dataset.done=1;setTimeout(()=>zdetailView(e.dataset.zre),1500)}});document.querySelectorAll(\".zchip[data-s]\").forEach(e=>{e.innerHTML=LK+\" \"+zfull(+e.dataset.s-n)});if(SL&&document.getElementById(\"zhtop\")&&!zpending().length)zdrawTop()}catch(e){}},1000);\ndocument.head.insertAdjacentHTML(\"beforeend\",`<style>\n#zhtop{margin:14px 0 6px}\n#zhtop .zintro{background:#211c16;color:#f3ead7;border:1.5px solid #c9a24a;border-radius:16px;padding:14px 16px}#zhtop .zintro .zit{font:500 14px/1.45 var(--sans);color:#d9cfb8;margin:6px 0 12px}#zhtop .zib{display:flex;gap:10px}#zhtop .zwl2{flex:1;background:#D9A82B;color:#1B1A17;border:0;border-radius:999px;padding:9px 12px;font:700 14px var(--sans);cursor:pointer}#zhtop .zal2{background:none;border:1px solid rgba(217,168,43,.6);color:#E2BE62;border-radius:999px;padding:9px 14px;font:600 14px var(--sans);cursor:pointer}\n.zseal{border-radius:16px;background:linear-gradient(115deg,#1B1A17,#3A3125);color:#F4EFE6;padding:14px;position:relative;overflow:hidden;cursor:pointer}\n#zhtop .zseal{border:1.5px solid #c9a24a;animation:zglow 3.2s ease-in-out infinite}\n@keyframes zglow{0%,100%{box-shadow:0 0 0 0 rgba(201,162,74,.15),0 0 6px rgba(201,162,74,.18)}50%{box-shadow:0 0 0 3px rgba(201,162,74,.22),0 0 18px rgba(201,162,74,.45)}}\n@media (prefers-reduced-motion:reduce){#zhtop .zseal{animation:none;box-shadow:0 0 10px rgba(201,162,74,.3)}}\n.zk{display:flex;align-items:center;gap:6px;font:700 10.5px var(--sans);letter-spacing:1.4px;color:#D9A82B;text-transform:uppercase}\n.zsh{display:flex;gap:12px;align-items:center;margin:8px 0 12px}.zpw{position:relative;flex:none}\n.zpa{width:44px;height:44px;border-radius:50%;object-fit:cover;display:block;background:#8d7b62}.zpl{display:flex;align-items:center;justify-content:center;color:#fff;font:700 18px var(--serif)}\n.zlk{position:absolute;right:-3px;bottom:-3px;width:20px;height:20px;border-radius:50%;background:#A8341C;color:#fff;display:flex;align-items:center;justify-content:center;border:2px solid #2a251e}\n.zst{min-width:0}.zst h3{margin:0 0 2px;font:700 17px/1.25 var(--serif);overflow-wrap:anywhere}.zseal .zst h3{font-size:19px;color:#F4EFE6}.zby{font:500 12.5px var(--sans);color:#BDB5A6;line-height:1.5}\n.zcd{display:flex;gap:8px}.zcd div{flex:1;text-align:center;background:rgba(255,255,255,.08);border-radius:10px;padding:6px 0}.zcd b{display:block;font:700 18px var(--serif);color:#F4EFE6}.zcd span{font:500 10px var(--sans);color:#BDB5A6;text-transform:uppercase;letter-spacing:.8px}\n.zrow{display:flex;align-items:center;justify-content:space-between;margin-top:11px;gap:8px}\n.zwt{display:flex;align-items:center;min-width:0}.zwa{width:22px;height:22px;border-radius:50%;object-fit:cover;margin-left:-7px;border:2px solid #2a251e;background:#8d7b62}.zwa:first-child{margin-left:0}.zwt em{font:500 12.5px var(--sans);font-style:normal;margin-left:7px;color:#E8E0D2;white-space:nowrap}\n.zrb{display:inline-flex;align-items:center;gap:5px;border:0;border-radius:999px;background:#D9A82B;color:#1B1A17;font:700 12.5px var(--sans);padding:8px 13px;cursor:pointer;flex:none}.zrb.on{background:transparent;color:#D9A82B;box-shadow:inset 0 0 0 1.5px #D9A82B}\n.zallb{display:flex;justify-content:center;align-items:center;gap:6px;width:100%;margin-top:12px;padding:11px;border:1.5px solid rgba(217,168,43,.55);border-radius:12px;background:rgba(217,168,43,.1);color:#F4D78A;font:700 14px var(--sans);cursor:pointer}.zallb span{font-size:18px;line-height:1}\n.zwl{display:block;margin:8px auto 0;border:0;background:none;color:#D9A82B;font:700 12.5px var(--sans);cursor:pointer;padding:4px 8px}\n#zhv{position:fixed;inset:0;z-index:60;background:var(--paper);color:var(--ink);overflow-y:auto;display:none;-webkit-overflow-scrolling:touch}#zhv.open{display:block}html.zlock body{overflow:hidden}\n.zw{max-width:640px;margin:0 auto;padding:calc(14px + env(safe-area-inset-top)) 18px 50px}\n.zbk{border:0;background:none;font:600 14px var(--sans);color:var(--mute);padding:6px 0;cursor:pointer}\n.zph{display:flex;justify-content:space-between;align-items:center;margin:6px 0 4px}.zph b{font:700 24px var(--serif)}\n.zsub{color:var(--mute);font:13.5px/1.5 var(--sans);margin:4px 0 8px}\n.zwbtn{border:0;border-radius:999px;background:var(--acc);color:#fff;font:700 13px var(--sans);padding:9px 14px;cursor:pointer}\n.ztg{display:flex;gap:8px;margin:10px 0 2px}.ztg button{border:1px solid var(--ink);background:transparent;color:var(--ink);border-radius:999px;padding:5px 12px;font:600 12.5px var(--sans);cursor:pointer}.ztg button.on{background:var(--ink);color:var(--paper)}\n.zsc{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:10px 0;cursor:pointer;position:relative;overflow:hidden}.zsc .zsh{margin:0}.zsc .zby{color:var(--mute)}.zsc .zst h3{color:var(--ink)}\n#zlist .zsc,#zdet .zsc:not(.op){border:1.5px solid #E3CC92;box-shadow:0 1px 0 rgba(201,162,74,.12),0 4px 14px -8px rgba(201,162,74,.35)}#zlist .zsc.wd{border-color:var(--line);box-shadow:none}\n.zsc .zlk{border-color:var(--card)}.zsc .zwa{border-color:var(--card)}.zsc .zwt em{color:var(--mute)}\n.zft{display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #EFE2C2;font:500 12.5px var(--sans);color:var(--mute)}.zft .zwt{flex:1}\n.zcl{display:flex;align-items:center;gap:8px;margin-top:6px;white-space:nowrap}.zchip{display:inline-flex;align-items:center;gap:4px;border-radius:999px;font:700 12px var(--sans);font-variant-numeric:tabular-nums;background:#FBECE8;color:#A33A22;border:1.5px solid #C2462B;padding:3px 9px}\n.zsc .zrb{background:var(--ink);color:var(--paper);padding:6px 10px;font-size:12px}.zsc .zrb.on{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--ink)}\n.zwdb{margin-top:8px;background:none;border:1px solid #D8C9A8;color:#7a6a4a;border-radius:999px;padding:4px 10px;font:600 12px var(--sans);cursor:pointer}.zwdn{display:inline-block;margin-top:8px;color:var(--mute);font:500 12px var(--sans)}.zseal .zwdn{color:#BDB5A6}.zseal .zwdb{color:#E8D7AE;border-color:rgba(217,168,43,.5)}\n.zsc.wd{opacity:.55;cursor:default}.zsc.wd .zlk{background:var(--mute)}\n.zsc.op .zlk{background:#2E7D4F}.ztxt{font:15px/1.6 var(--serif);margin:10px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}.zclamp{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}.zok2{margin-left:auto;color:#2E7D4F;font-weight:700}\n.zbig{cursor:default;border-color:#2E7D4F}.zbig .ztxt{font-size:16.5px;line-height:1.7}\n.zban{margin:10px 0 0;padding:9px 12px;border-radius:12px;background:#E5F2EA;color:#2E7D4F;font:700 13px var(--sans);text-align:center}\n.zbrk .zsh,.zbrk .ztxt,.zbrk .zft{animation:zin .7s ease-out 1.1s both}@keyframes zin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}\n.zbreak{position:absolute;inset:0;z-index:2;pointer-events:none;animation:zgone .4s ease-in 1.2s forwards}.zbreak i{position:absolute;top:50%;width:46px;height:92px;margin-top:-46px;background:radial-gradient(circle at 100% 50%,#d2583c,#A8341C 55%,#7a2412)}.zbreak .l{left:50%;margin-left:-46px;border-radius:46px 0 0 46px;animation:zl 1.1s cubic-bezier(.5,0,.6,1) .3s forwards}.zbreak .r{left:50%;border-radius:0 46px 46px 0;background:radial-gradient(circle at 0 50%,#d2583c,#A8341C 55%,#7a2412);animation:zr 1.1s cubic-bezier(.5,0,.6,1) .3s forwards}\n@keyframes zl{40%{transform:rotate(-8deg)}100%{transform:translate(-160px,40px) rotate(-40deg);opacity:0}}@keyframes zr{40%{transform:rotate(8deg)}100%{transform:translate(160px,40px) rotate(40deg);opacity:0}}@keyframes zgone{to{opacity:0}}\n.zvote{margin:14px 0 4px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--card)}.zvq{font:700 13.5px var(--sans);margin-bottom:8px}.zvb{display:flex;gap:8px}.zvb button{flex:1;border:1.5px solid var(--ink);background:transparent;color:var(--ink);border-radius:999px;padding:8px;font:700 13px var(--sans);cursor:pointer}.zvb button.on{background:var(--ink);color:var(--paper)}.zvb button:disabled{cursor:default}\n.zpap{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;position:relative;margin-top:12px;overflow:hidden}\n.zpap input,.zpap textarea{width:100%;box-sizing:border-box;border:0;background:none;color:var(--ink);outline:none;resize:none}.zpap input{font:700 19px var(--serif);padding:0 0 8px;border-bottom:1px solid var(--line)}.zpap textarea{font:15px/1.6 var(--serif);margin-top:10px;min-height:170px}\n.zwax{display:none;position:absolute;left:50%;top:50%;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#d2583c,#A8341C 55%,#7a2412);box-shadow:0 3px 8px rgba(0,0,0,.45),inset 0 0 0 5px rgba(0,0,0,.12);color:#F4D9C9;align-items:center;justify-content:center}\n.zpap.stamp textarea,.zpap.stamp input{transition:filter .5s,opacity .5s;filter:blur(4px);opacity:.5}.zpap.stamp .zwax{display:flex;animation:zst .55s cubic-bezier(.3,1.6,.5,1) .15s both}\n@keyframes zst{from{transform:scale(2.4) rotate(-25deg);opacity:0}to{transform:none;opacity:1}}\n.zpred{display:block;margin-top:12px;font:600 13.5px/1.45 var(--sans);cursor:pointer}.zpred span{font-weight:400;color:var(--mute)}.zpred input{margin:0 8px 0 0;vertical-align:-2px}\n.zlb{font:700 11.5px var(--sans);color:var(--mute);letter-spacing:1px;text-transform:uppercase;margin:20px 0 8px}\n.zop{display:flex;flex-wrap:wrap;gap:8px}.zop button{border:1px solid var(--line);border-radius:999px;padding:7px 13px;font:500 13px var(--sans);background:var(--card);color:var(--ink);cursor:pointer}.zop button.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}\n#zcdate{display:none;margin-top:8px;font:15px var(--sans);padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink)}\n.zdt{margin-top:10px;font:500 13.5px var(--sans)}.zdt b{color:var(--acc)}\n.zrules{margin-top:14px;padding:12px;border-radius:12px;background:var(--line);font:12.5px/1.5 var(--sans);color:var(--ink)}\n.zmsg{font:13px var(--sans);color:var(--acc);margin-top:8px;min-height:18px}\n.zbtn{margin-top:16px;width:100%;border:0;border-radius:14px;background:var(--acc);color:#fff;font:700 16px var(--sans);padding:14px;cursor:pointer}.zbtn:disabled{opacity:.45}\n.zbtn2{margin-top:10px;width:100%;border:1.5px solid var(--ink);border-radius:14px;background:transparent;color:var(--ink);font:700 15px var(--sans);padding:12px;cursor:pointer}\n.zdone{text-align:center;padding:30px 6px}.zwax.big{display:flex;position:static;margin:0 auto 14px;animation:zst .5s cubic-bezier(.3,1.6,.5,1)}\n.zdone h3{font:700 22px var(--serif);margin:0 0 6px}.zdone p{color:var(--mute);font:14px/1.5 var(--sans);margin:4px 0}.zdone code{font:600 12px monospace;color:var(--ink);word-break:break-all}.zfpl{margin-top:14px!important;font-weight:700!important}.zsm{font-size:12.5px!important}\n.zwdw{margin-top:4px}\n#ztoast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:80;background:#1B1A17;color:#F4EFE6;padding:10px 16px;border-radius:999px;font:600 13px var(--sans);opacity:0;transition:.25s;pointer-events:none}#ztoast.on{opacity:1}\n[data-theme=dark] .zban{background:#173326;color:#7FD3A1}[data-theme=dark] .zft{border-top-color:var(--line)}[data-theme=dark] #zlist .zsc{border-color:#6B5A2E}[data-theme=dark] .zchip{background:#3A1E17;color:#F2A08A}\n</style>`);\n{const qp=new URLSearchParams(location.search);const sid=qp.get(\"seal\");if(sid&&/^[0-9a-f]{6,24}$/.test(sid))setTimeout(()=>zopen(\"detail\",sid),200);else if(qp.has(\"zerohour\"))setTimeout(()=>zopen(\"list\"),200)}\nzfetch(1);setInterval(()=>{if(!document.hidden)zfetch(1)},120000);\n}catch(e){}})();\n</script>\n<div id=\"ask\"><div class=\"bx\"><h3>Ask Folio</h3><p class=\"sub\">Ask a question. Folio answers from the articles it tracks and shows you the ones to read. 10 free questions a day.</p><div class=\"in\"><textarea id=\"askin\" maxlength=\"300\" placeholder=\"e.g. What are Farcaster Articles?\"></textarea><button class=\"go\" id=\"askgo\">Ask</button></div><div id=\"askout\"></div><div class=\"ft\"><span id=\"askleft\"></span><button id=\"askx\">Close</button></div></div></div>\n<script>(function(){const S=document.getElementById('ask'),I=document.getElementById('askin'),O=document.getElementById('askout'),G=document.getElementById('askgo'),LF=document.getElementById('askleft');const e=t=>String(t||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));const open=()=>{S.classList.add('open');setTimeout(()=>I.focus(),60)};const close=()=>S.classList.remove('open');document.getElementById('askx').onclick=close;S.onclick=v=>{if(v.target===S)close()};I.onkeydown=v=>{if(v.key==='Enter'&&!v.shiftKey){v.preventDefault();G.click()}};\nconst arts=l=>l&&l.length?`<div class=\"k\">Read more</div>`+l.map(x=>`<div class=\"ar\" data-h=\"${e(x.h)}\">${x.cover?`<img src=\"${e(window.__fimg?window.__fimg(x.cover,200):x.cover)}\" alt=\"\" loading=\"lazy\">`:''}<div><b>${e(x.title)}</b><span>${e(x.a.n||x.a.u)} \\u00b7 ${x.min||1} min read</span></div></div>`).join(''):'';\nO.onclick=v=>{const r=v.target.closest('.ar');if(r&&window.__fopen){close();window.__fopen(r.dataset.h)}};\nG.onclick=async()=>{const q=I.value.trim();if(q.length<4){O.innerHTML='<p class=\"msg\">Type a full question first.</p>';return}\nif(!(window.__fin&&window.__fin())){O.innerHTML='<p class=\"msg\">Open Folio inside Farcaster to ask. Questions are tied to your Farcaster account.</p>';return}\nG.disabled=true;O.innerHTML='<p class=\"msg\">Reading the articles\\u2026</p>';\ntry{O.innerHTML='<p class=\"msg\">Confirming it\\u2019s you on Farcaster\\u2026</p>';const t=await window.__ftok();if(!t){O.innerHTML='<p class=\"msg\">Farcaster didn\\u2019t confirm your sign-in. If it asked you to approve on your phone, approve it, then tap Ask again.</p>';G.disabled=false;return}O.innerHTML='<p class=\"msg\">Reading the articles\\u2026</p>';const ac=new AbortController();const to=setTimeout(()=>ac.abort(),60000);const r=await fetch('/api/ask',{method:'POST',signal:ac.signal,headers:{Authorization:'Bearer '+t,'content-type':'application/json'},body:JSON.stringify({q})});clearTimeout(to);const j=await r.json();\nif(j.error==='full'){O.innerHTML='<p class=\"msg\">Today\\u2019s 100 free questions are taken. New ones open tomorrow.</p>'}else if(j.error==='limit'){O.innerHTML='<p class=\"msg\">You have used your 10 questions for today. Come back tomorrow.</p>';LF.textContent='0 left today'}\nelse if(j.error){O.innerHTML='<p class=\"msg\">Something went wrong. Try again in a moment.</p>'}\nelse{let h='';if(j.answer)h+=`<div class=\"ans\">${e(j.answer)}</div>`;else if(j.none)h+='<p class=\"msg\">Folio has no articles on this yet. Try other words.</p>';else if(j.busy)h+='<p class=\"msg\">Answers are paused for today, but these articles cover it.</p>';O.innerHTML=h+arts(j.arts);if(j.left!=null)LF.textContent=j.left+' question'+(j.left===1?'':'s')+' left today'}}\ncatch(x){O.innerHTML='<p class=\"msg\">Something went wrong. Try again in a moment.</p>'}G.disabled=false}})();</script>\n<div id=\"sug\"><div class=\"bx\"><h3>Suggest an article</h3><p>Found a great long read we missed? Paste a link to a Farcaster Article, a cast sharing a Paragraph post, or a long cast. Writers can suggest their own too.</p><input id=\"sugin\" type=\"url\" inputmode=\"url\" placeholder=\"https://farcaster.xyz/username/0x...\" autocomplete=\"off\"><div class=\"msg\" id=\"sugmsg\"></div><div class=\"row\"><button id=\"sugx\">Close</button><button class=\"go\" id=\"sugok\">Suggest</button></div></div></div>\n<script>(function(){const S=document.getElementById('sug'),I=document.getElementById('sugin'),M=document.getElementById('sugmsg'),B=document.getElementById('sugok');document.getElementById('sugbtn').onclick=()=>{M.textContent='';I.value='';S.classList.add('open');setTimeout(()=>I.focus(),50)};document.getElementById('sugx').onclick=()=>S.classList.remove('open');S.onclick=e=>{if(e.target===S)S.classList.remove('open')};B.onclick=async()=>{const u=I.value.trim();if(!u){M.textContent='Paste a link first.';return}B.disabled=true;M.textContent='Checking\\u2026';try{const r=await fetch('/api/suggest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({u})});const j=await r.json();if(!r.ok||!j.ok){M.textContent=j.error||'Something went wrong.';}else if(!j.listed){M.textContent='Thanks. It\\u2019s too short to list, so we skipped it.';}else{M.textContent=j.known?'Already on Folio. Opening it.':'Added. Opening it.';setTimeout(()=>{S.classList.remove('open');try{openArticle(j.h,true)}catch(e){location.href='/?a='+j.h}},700)}}catch(e){M.textContent='Something went wrong.'}B.disabled=false}})();</script>\n<script>\n(function(){\nlet HID=[];fetch('/api/report').then(r=>r.json()).then(j=>{HID=j.hidden||[];if(HID.length)hideNow()}).catch(()=>{});\nfunction hideNow(){document.querySelectorAll('#list [data-h]').forEach(e=>{if(HID.includes(e.dataset.h))e.style.display='none'});const q=new URLSearchParams(location.search).get('a');if(q&&HID.includes(q)){const m=document.querySelector('main')||document.body;const d=document.createElement('div');d.className='rpgone';d.textContent='This article was removed from Folio.';document.querySelectorAll('article,#art,.art').forEach(x=>x.style.display='none');m.prepend(d)}}\nnew MutationObserver(()=>{if(HID.length)hideNow()}).observe(document.body,{childList:true,subtree:true});\nfunction curH(){const q=new URLSearchParams(location.search).get('a');return q||(window.cur&&cur.h)||null}\nwindow.repSheet=function(h,t){h=h||curH();if(!h)return;const o=document.createElement('div');o.className='rpo';o.innerHTML=`<div class=\"rps\"><b>Report ${t?'this highlight':'this article'}</b><p>Why are you reporting it?</p>${['Defamation or false claims','Harassment or hate','Private information','Copyright','Spam','Other'].map(x=>`<button class=\"rpb\" data-w=\"${x}\">${x}</button>`).join('')}<textarea id=\"rpn\" maxlength=\"500\" placeholder=\"Details (optional)\"></textarea><div class=\"rpa\"><a href=\"/terms\" target=\"_blank\" style=\"float:left;color:var(--mute);font:600 13px var(--sans);margin-top:4px\">Terms and takedown</a><button id=\"rpx\">Cancel</button></div></div>`;document.body.appendChild(o);o.onclick=e=>{if(e.target===o||e.target.id==='rpx')o.remove()};o.querySelectorAll('.rpb').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const tk=window.__ftok&&window.__fin&&window.__fin()?await window.__ftok().catch(()=>null):null;const r=await fetch('/api/report',{method:'POST',headers:Object.assign({'content-type':'application/json'},tk?{Authorization:'Bearer '+tk}:{}),body:JSON.stringify({h,t:t||'',why:b.dataset.w,note:o.querySelector('#rpn').value})});o.querySelector('.rps').innerHTML=r.ok?'<b>Thanks, we got it.</b><p>We review every report and remove content that breaks the rules.</p><div class=\"rpa\"><button id=\"rpx\">Close</button></div>':'<b>Could not send.</b><p>Please try again later.</p><div class=\"rpa\"><button id=\"rpx\">Close</button></div>'}catch(e){}})};\nfunction addBtn(){const q=new URLSearchParams(location.search).get('a');const by=document.querySelector('#supb')&&document.querySelector('#supb').parentElement;if(!by||document.getElementById('rpbtn'))return;const b=document.createElement('button');b.id='rpbtn';b.className='rpl';b.textContent='Report';b.onclick=()=>repSheet(curH());const end=document.querySelector('.endbar')||by;end.appendChild(b)}\nsetInterval(addBtn,1500);\ndocument.addEventListener('contextmenu',()=>{});\ndocument.head.insertAdjacentHTML('beforeend','<style>.rpo{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:flex-end;justify-content:center}.rps{background:var(--bg,#fff);color:var(--ink);width:100%;max-width:520px;border-radius:18px 18px 0 0;padding:20px;font:15px var(--sans);box-sizing:border-box}.rps p{color:var(--mute);margin:6px 0 12px}.rpb{display:block;width:100%;text-align:left;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:11px 12px;margin:6px 0;font:600 14px var(--sans);cursor:pointer}.rps textarea{width:100%;box-sizing:border-box;margin-top:8px;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--card);color:var(--ink);font:14px var(--sans);min-height:60px}.rpa{text-align:right;margin-top:10px}.rpa button{background:none;border:0;color:var(--mute);font:600 14px var(--sans);cursor:pointer}.rpl{background:none;border:0;color:var(--mute);font:600 12px var(--sans);text-decoration:underline;cursor:pointer;margin-left:10px}.rpgone{padding:40px 0;text-align:center;color:var(--mute);font:16px var(--sans)}</style>');\n})();\n</script><script>\n(function(){\nvar T=[{k:'lofi',n:'Lofi',s:'Soft keys, slow beat'},{k:'piano',n:'Piano',s:'Calm piano and pads'},{k:'ambient',n:'Ambient',s:'Warm pads, no beat'}];\nvar LS={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};\nvar pick=LS.get('folio.music')||'',on=false,a=null,ac=null,g=null,BASE=0.35,DUCK=0.08,duck=false,R=document.getElementById('reader');\nvar L=document.getElementById('listen');if(!L||!R)return;\nvar B=document.createElement('button');B.id='musb';B.setAttribute('aria-label','Background music');B.title='Background music';\nB.innerHTML='<svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 18V5l11-2v13\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"17\" cy=\"16\" r=\"3\"/></svg>';\n(document.getElementById('spd')||L).after(B);\nfunction lvl(){return duck?DUCK:BASE}\nfunction setVol(v,ms){if(g&&ac){var t=ac.currentTime;g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(v,t+(ms||600)/1000)}else if(a){a.volume=v}}\nfunction ensure(){if(a)return;a=new Audio();a.preload='auto';a.crossOrigin='anonymous';a.loop=false;\n try{var C=window.AudioContext||window.webkitAudioContext;if(C){ac=new C();var s=ac.createMediaElementSource(a);g=ac.createGain();g.gain.value=0;s.connect(g);g.connect(ac.destination)}}catch(e){ac=null;g=null}\n a.addEventListener('timeupdate',function(){if(on&&a.duration&&a.duration-a.currentTime<1.8&&!a._f){a._f=1;setVol(0,1500)}});\n a.addEventListener('ended',function(){a._f=0;if(on){a.currentTime=0;a.play().catch(function(){});setVol(lvl(),1500)}})}\nfunction start(){if(!pick)return;ensure();var src='/music/'+pick+'.mp3';if(a.getAttribute('src')!==src){a.src=src;a._f=0}\n try{if(ac&&ac.state==='suspended')ac.resume()}catch(e){}\n if(!g)a.volume=0;var p=a.play();on=true;B.classList.add('on');if(p&&p.catch)p.catch(function(){on=false;B.classList.remove('on')});setVol(lvl(),900)}\nfunction stop(fast){if(!a)return;on=false;B.classList.remove('on');setVol(0,fast?150:500);setTimeout(function(){if(!on&&a)a.pause()},fast?200:550)}\nwindow.__fmus={start:start,stop:stop,state:function(){return{pick:pick,on:on}}};\nfunction sheet(){var o=document.getElementById('musp');if(o){o.remove();return}o=document.createElement('div');o.id='musp';\n o.innerHTML='<b>Music while you read</b>'+T.map(function(t){return '<button data-m=\"'+t.k+'\" class=\"'+(pick===t.k?'on':'')+'\"><span>'+t.n+'</span><em>'+t.s+'</em></button>'}).join('')+'<button data-m=\"\" class=\"'+(!pick?'on':'')+'\"><span>Off</span><em>Read in silence</em></button>';\n document.body.appendChild(o);\n o.onclick=function(e){var b=e.target.closest('[data-m]');if(!b)return;pick=b.getAttribute('data-m');LS.set('folio.music',pick);o.querySelectorAll('[data-m]').forEach(function(x){x.classList.toggle('on',x===b)});if(pick)start();else stop();setTimeout(function(){o.remove()},350)}}\nB.onclick=function(e){e.stopPropagation();sheet()};\ndocument.addEventListener('click',function(e){var o=document.getElementById('musp');if(o&&!e.target.closest('#musp,#musb'))o.remove();\n if(pick&&!on&&!e.target.closest('#musb,#musp,#back')&&(e.target.closest('[data-h]')||e.target.closest('#reader')||e.target.closest('#strd')))start()},true);\nnew MutationObserver(function(){if(!R.classList.contains('open')){stop(true);var o=document.getElementById('musp');if(o)o.remove()}}).observe(R,{attributes:true,attributeFilter:['class']});\ndocument.addEventListener('flstart',function(){duck=true;if(on)setVol(DUCK,400)});\ndocument.addEventListener('flstop',function(){duck=false;if(on)setVol(BASE,900)});\ndocument.addEventListener('visibilitychange',function(){if(document.hidden&&on)stop(true)});\nif(pick)B.classList.add('set');\ndocument.head.insertAdjacentHTML('beforeend','<style>@media (max-width:440px){.rbar .in{gap:5px!important;padding:10px 10px!important}.rbar select{max-width:80px!important}.rbar button{padding:7px 9px!important}#musb{padding:7px 8px!important}}@media (max-width:370px){.rbar select{max-width:68px!important}.rbar .in{gap:4px!important;padding:10px 8px!important}}#musb{display:flex;align-items:center;justify-content:center;padding:7px 10px}#musb.set{color:var(--acc);border-color:var(--acc)}#musb.on{background:var(--acc);border-color:var(--acc);color:#fff}#musb.on svg{animation:musp 1.6s ease-in-out infinite}@keyframes musp{50%{transform:translateY(-1.5px)}}#musp{position:fixed;top:58px;right:max(12px,calc(50% - 328px));z-index:12;width:min(260px,calc(100vw - 24px));background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.22);padding:10px;animation:moIn .25s ease both}#musp b{display:block;font:700 11.5px var(--sans);letter-spacing:1.2px;text-transform:uppercase;color:var(--mute);padding:4px 6px 8px}#musp button{display:flex;flex-direction:column;align-items:flex-start;width:100%;border:1px solid transparent;background:none;border-radius:10px;padding:9px 10px;cursor:pointer;color:var(--ink);text-align:left}#musp button span{font:600 14.5px var(--sans)}#musp button em{font:400 12px var(--sans);color:var(--mute);font-style:normal}#musp button.on{border-color:var(--acc);background:var(--card)}#musp button.on span{color:var(--acc)}</style>');\n})();\n</script>\n</body>\n</html>\n";