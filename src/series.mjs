// Folio series (2026-11-25): a writer groups their own articles into a named series.
// D1 table series_parts, created at runtime (idempotent). Only the article's own author (verified FID) can set/clear.
// Routes: GET /api/series?h=  | GET /api/series?fid=&list=1 | GET /api/series?fid=&slug= | POST /api/series?h= {name, part}
//         GET /s/<fid or username>/<slug>  (series page)
const MAX_PARTS = 50, MAX_SERIES = 30, NAME_MAX = 60;
const HRE = /^0x[0-9a-fA-F]{40,64}$/;
const json = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", ...h } });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function cleanName(s) { return String(s || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX); }
export function slugify(name) { return cleanName(name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/, ""); }
// new order after moving `h` to position `part` (1-based; 0/omitted/too big = end). `list` = hashes in current order.
export function placeAt(list, h, part) {
  const l = list.filter(x => x !== h); const p = Math.floor(+part || 0);
  const i = p >= 1 && p <= l.length ? p - 1 : l.length; l.splice(i, 0, h); return l;
}

let INIT = null;
function init(db) {
  if (!INIT) INIT = db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS series_parts (h TEXT PRIMARY KEY, fid INTEGER NOT NULL, u TEXT, slug TEXT NOT NULL, name TEXT NOT NULL, part INTEGER NOT NULL, title TEXT, at INTEGER)"),
    db.prepare("CREATE INDEX IF NOT EXISTS series_parts_fs ON series_parts (fid, slug, part)")
  ]).catch(e => { INIT = null; throw e; });
  return INIT;
}
export function _resetInit() { INIT = null; }

async function partsOf(db, fid, slug) { return ((await db.prepare("SELECT h, u, slug, name, part, title FROM series_parts WHERE fid = ? AND slug = ? ORDER BY part, at").bind(fid, slug).all()).results) || []; }
async function info(db, h) {
  const r = await db.prepare("SELECT h, fid, u, slug, name, part FROM series_parts WHERE h = ?").bind(h).first(); if (!r) return null;
  const ps = await partsOf(db, r.fid, r.slug); const i = ps.findIndex(x => x.h === r.h); if (i < 0) return null;
  const pk = x => x ? { h: x.h, t: x.title || "" } : null;
  return { fid: r.fid, u: r.u || "", slug: r.slug, name: (ps[0] && ps[0].name) || r.name, part: i + 1, n: ps.length, prev: pk(ps[i - 1]), next: pk(ps[i + 1]), url: "/s/" + r.fid + "/" + encodeURIComponent(r.slug) };
}
async function renumber(db, fid, slug, order, name) {
  const st = order.map((h, i) => db.prepare("UPDATE series_parts SET part = ?, name = ? WHERE h = ? AND fid = ?").bind(i + 1, name, h, fid));
  if (st.length) await db.batch(st);
}

// deps: { verifyFid(req) -> fid|0, authorOf(h) -> { fid, u, title } | null }
export async function handleSeries(req, env, url, deps) {
  const p = url.pathname;
  if (p !== "/api/series" && !p.startsWith("/s/")) return null;
  const db = env.DB;
  if (p.startsWith("/s/")) return seriesPage(db, url, p);
  if (!db) return json({ s: null }, 200, { "cache-control": "no-store" });
  await init(db);
  const h = (url.searchParams.get("h") || "").toLowerCase();
  if (req.method === "GET") {
    if (h) { if (!HRE.test(h)) return json({ error: "bad" }, 400); return json({ s: await info(db, h) }, 200, { "cache-control": "public, max-age=30" }); }
    const fid = +(url.searchParams.get("fid") || 0); if (!(fid > 0)) return json({ error: "bad" }, 400);
    if (url.searchParams.get("list")) { const r = ((await db.prepare("SELECT slug, MIN(name) AS name, COUNT(*) AS n FROM series_parts WHERE fid = ? GROUP BY slug ORDER BY MAX(at) DESC").bind(fid).all()).results) || []; return json({ series: r }, 200, { "cache-control": "no-store" }); }
    const slug = slugify(url.searchParams.get("slug") || ""); if (!slug) return json({ error: "bad" }, 400);
    const ps = await partsOf(db, fid, slug); if (!ps.length) return json({ error: "not found" }, 404);
    return json({ fid, slug, name: ps[0].name, parts: ps.map((x, i) => ({ h: x.h, t: x.title || "", part: i + 1 })) }, 200, { "cache-control": "public, max-age=30" });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!HRE.test(h)) return json({ error: "bad" }, 400);
  const fid = await deps.verifyFid(req); if (!fid) return json({ error: "auth" }, 401);
  let a = null; try { a = await deps.authorOf(h); } catch (e) { a = null; }
  if (!a || !a.fid) return json({ error: "not found" }, 404);
  if (+a.fid !== +fid) return json({ error: "not yours" }, 403);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const name = cleanName(b.name), slug = slugify(name);
  const old = await db.prepare("SELECT fid, slug, name FROM series_parts WHERE h = ?").bind(h).first();
  if (!name) { // clear
    if (old) { await db.prepare("DELETE FROM series_parts WHERE h = ? AND fid = ?").bind(h, fid).run(); const rest = await partsOf(db, fid, old.slug); await renumber(db, fid, old.slug, rest.map(x => x.h), rest[0] ? rest[0].name : old.name); }
    return json({ ok: 1, s: null });
  }
  if (name.length < 2 || !slug) return json({ error: "name" }, 400);
  const cur = await partsOf(db, fid, slug);
  if (!cur.length) { const k = await db.prepare("SELECT COUNT(DISTINCT slug) AS c FROM series_parts WHERE fid = ?").bind(fid).first(); if (k && k.c >= MAX_SERIES) return json({ error: "too many series" }, 400); }
  if (cur.length >= MAX_PARTS && !cur.some(x => x.h === h)) return json({ error: "series full" }, 400);
  const now = Date.now();
  await db.prepare("INSERT INTO series_parts (h, fid, u, slug, name, part, title, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(h) DO UPDATE SET fid = excluded.fid, u = excluded.u, slug = excluded.slug, name = excluded.name, part = excluded.part, title = excluded.title, at = excluded.at")
    .bind(h, fid, String(a.u || "").slice(0, 40), slug, name, 9999, String(a.title || "").slice(0, 200), now).run();
  if (old && old.slug !== slug) { const rest = await partsOf(db, fid, old.slug); await renumber(db, fid, old.slug, rest.map(x => x.h), rest[0] ? rest[0].name : old.name); }
  await renumber(db, fid, slug, placeAt(cur.map(x => x.h), h, b.part), name);
  return json({ ok: 1, s: await info(db, h) });
}

async function seriesPage(db, url, p) {
  const m = p.match(/^\/s\/([^/]{1,40})\/([^/]{1,200})\/?$/); const nf = () => new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
  if (!m || !db) return nf();
  let who = "", slug = ""; try { who = decodeURIComponent(m[1]).replace(/^@/, ""); slug = slugify(decodeURIComponent(m[2])); } catch (e) { return nf(); }
  if (!slug) return nf();
  await init(db);
  let fid = /^\d{1,9}$/.test(who) ? +who : 0;
  if (!fid) { const r = await db.prepare("SELECT fid FROM series_parts WHERE u = ? COLLATE NOCASE AND slug = ? LIMIT 1").bind(who, slug).first(); fid = r ? r.fid : 0; }
  const ps = fid ? await partsOf(db, fid, slug) : []; if (!ps.length) return nf();
  const o = url.origin, name = ps[0].name, u = ps.find(x => x.u) ? ps.find(x => x.u).u : "";
  const embed = { version: "1", imageUrl: o + "/img/embed.png", button: { title: "Read the series", action: { type: "launch_miniapp", name: "Folio", url: o + "/?a=" + ps[0].h, splashImageUrl: o + "/img/splash.png", splashBackgroundColor: "#F4EFE6" } } };
  const li = ps.map((x, i) => `<li><a href="/?a=${esc(x.h)}"><span class="n">${i + 1}</span><span class="t" dir="auto">${esc(x.title || "Part " + (i + 1))}</span></a></li>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)} | Folio</title><meta property="og:title" content="${esc(name)} | Folio"><meta property="og:description" content="A series in ${ps.length} parts${u ? " by @" + esc(u) : ""} on Folio"><meta name="fc:miniapp" content="${esc(JSON.stringify(embed))}"><style>*{box-sizing:border-box}html,body{margin:0;overflow-x:clip;background:#F4EFE6;color:#1B1A17;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}main{max-width:640px;margin:0 auto;padding:22px 16px 48px}.k{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6E675C;margin:0 0 6px}h1{font:700 26px/1.2 Georgia,serif;margin:0 0 4px;overflow-wrap:anywhere}.by{color:#6E675C;font-size:14px;margin:0 0 18px;overflow-wrap:anywhere}ol{list-style:none;margin:0;padding:0}li a{display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px;padding:14px 0;border-top:1px solid #E2D9C9;text-decoration:none;color:inherit}li:last-child a{border-bottom:1px solid #E2D9C9}.n{color:#A8341C;font-weight:700}.t{font-weight:600;overflow-wrap:anywhere;min-width:0}.home{display:inline-block;margin-top:22px;color:#A8341C;font-size:14px}</style></head><body><main><p class="k">Series \u00b7 ${ps.length} ${ps.length === 1 ? "part" : "parts"}</p><h1 dir="auto">${esc(name)}</h1>${u ? `<p class="by">by @${esc(u)}</p>` : ""}<ol>${li}</ol><a class="home" href="/">Folio \u2192</a></main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } });
}
