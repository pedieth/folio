// Zero Hour server unit test: runs the real block from src/build.js against an in-memory KV.
// Asserts: body never returned before open (list, detail, meta), withdraw blocked after half, open-date validation, auth, limits.
import fs from "fs";
import { makeD1 } from "./d1shim.mjs";
const s = fs.readFileSync("/workspace/work/folio/src/build.js", "utf8");
const a = s.indexOf("// ==== ZERO HOUR (sealed texts) START ===="), b = s.indexOf("// ==== ZERO HOUR (sealed texts) END ====");
if (a < 0 || b < 0) { console.log("FAIL block markers"); process.exit(1); }
const block = s.slice(a, b);
const pre = `const DAY=86400000;let FONTS=1;const RESVG=null;
const J=(o,st=200,h={})=>new Response(JSON.stringify(o),{status:st,headers:{"content-type":"application/json",...h}});
const isPreview=env=>!!env.PREVIEW;const fcUser=async fid=>({u:"user"+fid,n:"User "+fid,p:"https://imagedelivery.net/x/"+fid+"/original"});
const qaFid=async(req)=>{const a=req.headers.get("authorization")||"";return a.startsWith("Bearer fid")?+a.slice(10):0};
const subsOf=async env=>env.__subs||{};const ogData=async()=>null;const renderSealCard=async()=>new Uint8Array([1]);`;
const mod = await import("data:text/javascript;base64," + Buffer.from(pre + block + "\nexport { slApi, slTick, slMeta, slPub, slHalf };").toString("base64"));
const mem = new Map();
const KV = { get: async (k, t) => { const v = mem.get(k); if (v == null) return null; return t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { mem.set(k, String(v)); }, delete: async k => { mem.delete(k); } };
const sent = []; globalThis.fetch = async (u, o) => { sent.push(JSON.parse(o.body)); return new Response("{}"); };
const env = { KV, ...(process.env.NOD1 ? {} : { DB: makeD1() }), __subs: { 7: { url: "https://n.example/x", token: "t7" } } };
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) bad++; console.log((c ? "PASS " : "FAIL ") + m); };
const call = async (method, q, fid, body) => { const url = new URL("https://folio.test/api/sealed" + (q || "")); const h = {}; if (fid) h.authorization = "Bearer fid" + fid; if (body) h["content-type"] = "application/json"; const req = new Request(url, { method, headers: h, body: body ? JSON.stringify(body) : undefined }); const r = await mod.slApi(env, req, url); const t = await r.text(); return { s: r.status, j: JSON.parse(t), t }; };

const idxStr = async () => env.DB ? JSON.stringify((await env.DB.prepare("SELECT j FROM zh_s").all()).results) : mem.get("sl:idx");
const editSeal = async (id, fn) => { if (env.DB) { const r = await env.DB.prepare("SELECT j FROM zh_s WHERE id = ?").bind(id).first(); const x = JSON.parse(r.j); fn(x); await env.DB.prepare("UPDATE zh_s SET j = ? WHERE id = ?").bind(JSON.stringify(x), id).run(); } else { const a = JSON.parse(mem.get("sl:idx")); fn(a.find(q => q.id === id)); mem.set("sl:idx", JSON.stringify(a)); } };
const SECRET = "SECRET-BODY-zx81 this must never leak before open";
const now = Date.now(), DAY = 864e5;
// auth
ok((await call("POST", "", 0, { do: "seal", t: "Hello", b: SECRET, oa: now + 2 * DAY })).s === 401, "unauthenticated seal rejected (401)");
// validation
ok((await call("POST", "", 5, { do: "seal", t: "Hi", b: SECRET, oa: now + 2 * DAY })).s === 400, "title < 3 chars rejected");
ok((await call("POST", "", 5, { do: "seal", t: "x".repeat(121), b: SECRET, oa: now + 2 * DAY })).s === 400, "title > 120 chars rejected");
ok((await call("POST", "", 5, { do: "seal", t: "Hello", b: "too short", oa: now + 2 * DAY })).s === 400, "body < 20 chars rejected");
ok((await call("POST", "", 5, { do: "seal", t: "Hello", b: "y".repeat(10001), oa: now + 2 * DAY })).s === 400, "body > 10000 chars rejected");
ok((await call("POST", "", 5, { do: "seal", t: "Hello", b: SECRET, oa: now + 3600e3 })).j.error === "date", "open date < 1 day rejected");
ok((await call("POST", "", 5, { do: "seal", t: "Hello", b: SECRET, oa: now + 367 * DAY })).j.error === "date", "open date > 1 year rejected");
ok((await call("POST", "", 5, { do: "seal", t: "Hello", b: SECRET, oa: now - DAY })).j.error === "date", "open date in the past rejected");
ok((await call("POST", "", 5, { do: "seal", t: "Hello", b: SECRET, oa: now + 3600e3, testSec: 5 })).j.error === "date", "short test seals impossible on live");
// seal
const r1 = await call("POST", "", 5, { do: "seal", t: "My <b>prediction</b>", b: SECRET, oa: now + 10 * DAY, pred: true });
ok(r1.s === 200 && /^[0-9a-f]{64}$/.test(r1.j.fp) && !r1.t.includes("SECRET-BODY"), "seal ok, returns SHA-256 fingerprint, no body echoed");
const id = r1.j.id;
// no leak
const L = await call("GET", "", 0); ok(L.s === 200 && L.j.items.length === 1 && !L.t.includes("SECRET-BODY"), "list (anon) has no body before open");
const L2 = await call("GET", "", 9); ok(!L2.t.includes("SECRET-BODY"), "list (signed in) has no body before open");
const D1 = await call("GET", "?id=" + id, 5); ok(D1.s === 200 && D1.j.b === undefined && !D1.t.includes("SECRET-BODY") && D1.j.mine === true, "detail (writer) has no body before open");
const M = await mod.slMeta(env, "https://folio.test", id); ok(M && !JSON.stringify(M).includes("SECRET-BODY"), "share meta has no body");
ok(!(await idxStr()).includes("SECRET-BODY"), "index record never holds the body");
// remind
ok((await call("POST", "", 5, { do: "rem", id })).s === 403, "writer cannot Remind-me own seal");
const R = await call("POST", "", 7, { do: "rem", id }); ok(R.j.on === true && R.j.n === 1 && !R.t.includes("SECRET-BODY"), "Remind me on, waiting count 1");
// withdraw rules
ok((await call("POST", "", 9, { do: "wd", id })).s === 403, "only writer can withdraw");
const r2 = await call("POST", "", 5, { do: "seal", t: "Second one", b: SECRET + " 2", oa: now + 4 * DAY });
await editSeal(r2.j.id, x2 => { x2.sa = now - 5 * DAY; }); // half-way already passed
const W = await call("POST", "", 5, { do: "wd", id: r2.j.id }); ok(W.s === 403 && W.j.error === "locked" && mem.has("sl:b:" + r2.j.id), "withdraw blocked after half-way (body kept)");
const W2 = await call("POST", "", 5, { do: "wd", id }); ok(W2.s === 200 && W2.j.st === "wd" && !mem.has("sl:b:" + id), "withdraw allowed in first half; body deleted");
ok((await call("GET", "?id=" + id, 0)).j.st === "wd", "withdrawn card stays public");
// daily cap
const r3 = await call("POST", "", 5, { do: "seal", t: "Third one", b: SECRET + " 3", oa: now + 4 * DAY });
const r4 = await call("POST", "", 5, { do: "seal", t: "Fourth one", b: SECRET + " 4", oa: now + 4 * DAY });
ok(r3.s === 200 && r4.s === 429, "max 3 seals per fid per day");
// open on read + fingerprint + votes + cron notify
await call("POST", "", 7, { do: "rem", id: r3.j.id });
await editSeal(r3.j.id, x3 => { x3.oa = Date.now() - 1000; x3.pred = true; });
const O = await call("GET", "?id=" + r3.j.id, 0); ok(O.j.st === "open" && O.j.b === SECRET + " 3" && O.j.fpOk === true, "open on read (before cron): body + fingerprint matches");
const OL = await call("GET", "", 0); ok(OL.j.items.find(q => q.id === r3.j.id).b === SECRET + " 3" && !OL.t.includes(SECRET + " 2\"") && !OL.t.includes(SECRET + "\""), "list shows body only for opened seal");
ok((await call("POST", "", 7, { do: "vote", id: r3.j.id, v: "r" })).j.votes.r === 1 && (await call("POST", "", 7, { do: "vote", id: r3.j.id, v: "w" })).s === 409, "prediction vote once per fid");
ok((await call("POST", "", 7, { do: "vote", id: r2.j.id, v: "r" })).s === 409, "no votes before open");
const T = await mod.slTick(env, "https://folio.test"); const T2 = await mod.slTick(env, "https://folio.test");
ok(T === 1 && T2 === 0 && sent.length === 1 && sent[0].tokens[0] === "t7" && /^Zero Hour: Third one by @user5 just opened/.test(sent[0].body), "cron opens due seal and notifies Remind-me fids once");
console.log("ZH UNIT", n - bad, "/", n); process.exit(bad ? 1 : 0);
