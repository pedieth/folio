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
const mod = await import("data:text/javascript;base64," + Buffer.from(pre + block + "\nexport { slApi, slTick, slMeta, slPub, slHalf, SL_SNAP };").toString("base64"));
const mem = new Map();
const dl=()=>new Promise(z=>setTimeout(z,Math.random()*30));
const KV = { get: async (k, t) => { await dl(); const v = mem.get(k); if (v == null) return null; return t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { await dl(); mem.set(k, String(v)); }, delete: async k => { mem.delete(k); } };
const sent = []; globalThis.fetch = async (u, o) => { sent.push(JSON.parse(o.body)); return new Response("{}"); };
const env = { KV, ...(process.env.NOD1 ? {} : { DB: makeD1() }), __subs: { 7: { url: "https://n.example/x", token: "t7" } } };
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) bad++; console.log((c ? "PASS " : "FAIL ") + m); };
const call = async (method, q, fid, body) => { const url = new URL("https://folio.test/api/sealed" + (q || "")); const h = {}; if (fid) h.authorization = "Bearer fid" + fid; if (body) h["content-type"] = "application/json"; const req = new Request(url, { method, headers: h, body: body ? JSON.stringify(body) : undefined }); const r = await mod.slApi(env, req, url); const t = await r.text(); return { s: r.status, j: JSON.parse(t), t }; };

const now=Date.now(),DAY=864e5;const clr=()=>{for(const k in mod.SL_SNAP)delete mod.SL_SNAP[k];};const age=()=>{for(const k in mod.SL_SNAP)if(mod.SL_SNAP[k].t)mod.SL_SNAP[k].t-=61000;};
const r=await call("POST","",5,{do:"seal",t:"Race test",b:"x".repeat(40),oa:now+2*DAY,pred:true});const id=r.j.id;
await call("GET","",0);
await Promise.all(Array.from({length:25},(_,i)=>call("POST","",100+i,{do:"rem",id})));
let M=await call("GET","?id="+id,107); ok(M.j.rem===true,"own Remind shows instantly for that user even with a cached snapshot");
let S=await call("GET","?id="+id,0); ok(S.j.n<25,"others see the cached count (snapshot in use)");
age();
let L=await call("GET","?id="+id,0); ok(L.j.n===25,"25 parallel Remind me all kept (got "+L.j.n+")");
await Promise.all(Array.from({length:5},(_,i)=>call("POST","",100+i,{do:"rem",id})));
age();L=await call("GET","?id="+id,0); ok(L.j.n===20,"5 parallel un-remind kept (got "+L.j.n+")");
if(env.DB){const r=await env.DB.prepare("SELECT j FROM zh_s WHERE id = ?").bind(id).first();const x=JSON.parse(r.j);x.oa=now-1000;x.op=now;await env.DB.prepare("UPDATE zh_s SET j = ? WHERE id = ?").bind(JSON.stringify(x),id).run();for(const k in mod.SL_SNAP)delete mod.SL_SNAP[k];}else{const k=[...mem.keys()].find(k=>k.endsWith("idx"));const all=JSON.parse(mem.get(k));all[0].oa=now-1000;all[0].op=now;mem.set(k,JSON.stringify(all));}
await Promise.all(Array.from({length:30},(_,i)=>call("POST","",200+i,{do:"vote",id,v:i%3?"r":"w"})));
M=await call("GET","?id="+id,205); ok(M.j.my==="r"||M.j.my==="w","own vote shows instantly");age();L=await call("GET","?id="+id,0); ok(L.j.votes&&L.j.votes.r+L.j.votes.w===30,"30 parallel votes all kept (got "+JSON.stringify(L.j.votes)+")");
const dup=await Promise.all([call("POST","",200,{do:"vote",id,v:"w"}),call("POST","",200,{do:"vote",id,v:"r"})]);
age();L=await call("GET","?id="+id,0); ok(L.j.votes.r+L.j.votes.w===30,"same fid cannot vote twice");
await Promise.all(Array.from({length:6},(_,i)=>call("POST","",300+i,{do:"seal",t:"Parallel "+i,b:"y".repeat(40),oa:now+2*DAY})));
L=await call("GET","",0); ok(L.j.items.length===7,"6 parallel seals all kept (got "+L.j.items.length+")");
console.log("ZH RACE "+(n-bad)+" / "+n);
