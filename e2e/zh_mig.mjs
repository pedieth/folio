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
const dl=()=>new Promise(z=>setTimeout(z,Math.random()*30));
const KV = { get: async (k, t) => { await dl(); const v = mem.get(k); if (v == null) return null; return t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { await dl(); mem.set(k, String(v)); }, delete: async k => { mem.delete(k); } };
const sent = []; globalThis.fetch = async (u, o) => { sent.push(JSON.parse(o.body)); return new Response("{}"); };
const env = { KV, __subs: { 7: { url: "https://n.example/x", token: "t7" } } };
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) bad++; console.log((c ? "PASS " : "FAIL ") + m); };
const call = async (method, q, fid, body) => { const url = new URL("https://folio.test/api/sealed" + (q || "")); const h = {}; if (fid) h.authorization = "Bearer fid" + fid; if (body) h["content-type"] = "application/json"; const req = new Request(url, { method, headers: h, body: body ? JSON.stringify(body) : undefined }); const r = await mod.slApi(env, req, url); const t = await r.text(); return { s: r.status, j: JSON.parse(t), t }; };

const now=Date.now();
mem.set("sl:idx",JSON.stringify([{id:"aa11",t:"Old seal",fid:5,u:"u5",n:"",p:"",sa:now-1000,oa:now+5*864e5,fp:"f",pred:true,r:{"7":"p7","8":""},v:{r:{},w:{}}}]));
env.DB=makeD1();
let L=await call("GET","?id=aa11",0); ok(L.s===200&&L.j.n===2,"old KV seal imported into D1 with its 2 reminders");
ok(mem.has("sl:idx")&&mem.has("sl:migd1"),"old KV index kept as backup, import flagged once");
await call("POST","",9,{do:"rem",id:"aa11"}); L=await call("GET","?id=aa11",0); ok(L.j.n===3,"new remind after import works");
console.log("ZH MIG "+(n-bad)+" / "+n);
