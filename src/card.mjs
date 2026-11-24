import { initWasm, Resvg } from "./resvg.mjs";
let ready = null;
export function init(wasm) { if (!ready) ready = initWasm(wasm); return ready; }
const X = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clean = s => String(s || "").replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\u200D\uFE0F\u20E3]/gu, "").replace(/[^\u0000-\u052F\u1E00-\u1FFF\u2000-\u206F\u20AC]/g, "").replace(/\s+/g, " ").trim();
function wrap(t, max, lines) {
  const w = t.split(" "), out = []; let cur = "";
  for (const x of w) { if ((cur + " " + x).trim().length > max && cur) { out.push(cur); cur = x; } else cur = (cur + " " + x).trim(); }
  if (cur) out.push(cur);
  if (out.length > lines) { const k = out.slice(0, lines); k[lines - 1] = k[lines - 1].replace(/[,;:.\s]*$/, "") + "\u2026"; return k; }
  return out;
}
const ORD = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"));
export function svg({ title, name, user, mins, rank, cover, pfp }) {
  const t = clean(title) || "Untitled";
  const big = t.length <= 60;
  const fs = big ? 64 : 54, ml = big ? 30 : 36;
  const L = wrap(t, ml, 3);
  const top = cover ? 360 : 230;
  const col = rank === 1 ? "#8C6209" : rank === 2 ? "#4F6478" : rank === 3 ? "#8B5A2B" : "#A8341C";
  const bt = rank === 1 ? "#1 TOP READ ON FOLIO TODAY" : ORD(rank).toUpperCase() + " ON FOLIO TODAY";
  const bw = Math.round(bt.length * 15.2 + 56);
  const badge = rank ? `<rect x="60" y="${top - 6}" width="${bw}" height="46" rx="23" fill="none" stroke="${col}" stroke-width="2.5"/><text x="${60 + bw / 2}" y="${top + 25}" text-anchor="middle" font-family="Noto Sans" font-weight="700" font-size="22" letter-spacing="2" fill="${col}">${bt}</text>` : "";
  const ty = top + (rank ? 118 : 60);
  const tl = L.map((l, i) => `<text x="60" y="${ty + i * (fs * 1.18)}" font-family="Noto Serif" font-weight="700" font-size="${fs}" fill="#1B1A17">${X(l)}</text>`).join("");
  const nm = clean(name).replace(/[\s\-\u2013\u2014|·.,:;]+$/, "") || user;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="800" viewBox="0 0 1200 800">
<defs><clipPath id="c"><rect x="0" y="0" width="1200" height="300"/></clipPath><clipPath id="p"><circle cx="92" cy="722" r="32"/></clipPath></defs>
<rect width="1200" height="800" fill="#F4EFE6"/>
${cover ? `<image href="${cover}" x="0" y="0" width="1200" height="300" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/><rect x="0" y="300" width="1200" height="3" fill="#1B1A17"/>` : `<text x="60" y="120" font-family="Noto Serif" font-weight="700" font-size="58" fill="#1B1A17">Folio</text><text x="60" y="160" font-family="Noto Sans" font-size="20" letter-spacing="3" fill="#6E675C">THE BEST OF FARCASTER ARTICLES</text><rect x="60" y="182" width="1080" height="3" fill="#1B1A17"/>`}
${badge}${tl}
<rect x="60" y="672" width="1080" height="1.5" fill="#E2D9C9"/>
${pfp ? `<image href="${pfp}" x="60" y="690" width="64" height="64" preserveAspectRatio="xMidYMid slice" clip-path="url(#p)"/>` : `<circle cx="92" cy="722" r="32" fill="#E2D9C9"/>`}
<text x="140" y="716" font-family="Noto Sans" font-weight="700" font-size="26" fill="#1B1A17">${X(nm.slice(0, 40))}</text>
<text x="140" y="748" font-family="Noto Sans" font-size="21" fill="#6E675C">@${X(user)}${mins ? " \u00B7 " + mins + " min read" : ""}</text>
${cover ? `<text x="1140" y="736" text-anchor="end" font-family="Noto Serif" font-weight="700" font-size="40" fill="#1B1A17">Folio</text>` : ""}
</svg>`;
}
export function svgQuote({ quote, title, name, user, pfp }) {
  const t = clean(quote).replace(/^["\u201C\u201D']+|["\u201C\u201D']+$/g, "");
  const n = t.length;
  const fs = n <= 70 ? 58 : n <= 130 ? 48 : n <= 200 ? 40 : 34;
  const ml = Math.floor(980 / (fs * 0.56));
  const L = wrap(t, ml, n <= 130 ? 5 : 7);
  const lh = fs * 1.3, blockH = L.length * lh;
  const y0 = Math.round(340 - blockH / 2 + fs * 0.95);
  const tl = L.map((l, i) => `<text x="100" y="${y0 + i * lh}" font-family="Noto Serif" font-weight="700" font-size="${fs}" fill="#1B1A17">${X(i === 0 ? "\u201C" + l : l)}${i === L.length - 1 ? "\u201D" : ""}</text>`).join("");
  const nm = clean(name).replace(/[\s\-\u2013\u2014|·.,:;]+$/, "") || user;
  const tt = wrap(clean(title) || "", 58, 1)[0] || "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="800" viewBox="0 0 1200 800">
<defs><clipPath id="p"><circle cx="132" cy="702" r="32"/></clipPath></defs>
<rect width="1200" height="800" fill="#F4EFE6"/>
<rect x="60" y="${y0 - fs * 0.95}" width="6" height="${blockH}" fill="#A8341C"/>
${tl}
<rect x="100" y="640" width="1000" height="1.5" fill="#E2D9C9"/>
${pfp ? `<image href="${pfp}" x="100" y="670" width="64" height="64" preserveAspectRatio="xMidYMid slice" clip-path="url(#p)"/>` : `<circle cx="132" cy="702" r="32" fill="#E2D9C9"/>`}
<text x="180" y="696" font-family="Noto Sans" font-weight="700" font-size="26" fill="#1B1A17">${X(nm.slice(0, 40))}</text>
<text x="180" y="728" font-family="Noto Sans" font-size="21" fill="#6E675C">${X(tt)}</text>
<text x="1100" y="716" text-anchor="end" font-family="Noto Serif" font-weight="700" font-size="40" fill="#1B1A17">Folio</text>
</svg>`;
}

const TIERS = { red: ["#A8341C", "#F4EFE6"], silver: ["#C9D3DD", "#1B1A17"], gold: ["#D9A82B", "#1B1A17"], black: ["#F4EFE6", "#0E0D0B"] };
function coverInner(o) {
  const [c0, ink] = TIERS[o.tier] || TIERS.red; const c = o.tier==="black" ? "url(#mg)" : c0; const W = o.tier==="black" ? "#F6EFE1" : "#FFFFFF";
  const nm = clean(o.name).replace(/[\s\-\u2013\u2014|·.,:;]+$/, "") || o.user;
  const per = clean(o.persona) || "The Reader";
  const pL = wrap(per.toUpperCase(), 14, 2);
  const lines = (o.lines || []).map(clean).filter(Boolean).slice(0, 4);
  let yy = 380; const cl = lines.map(l => { const w = wrap(l, 24, 2); const y0 = yy; yy += w.length * 44 + 40; return `<rect x="56" y="${y0 - 32}" width="8" height="${w.length * 44 - 4}" fill="${c}"/>` + w.map((t, j) => `<text x="80" y="${y0 + j * 44}" font-family="Noto Sans" font-weight="700" font-size="36" fill="${W}" filter="url(#sh)">${X(t)}</text>`).join(""); }).join("");
  const py = 1010 - (pL.length - 1) * 92;
  return `<defs><clipPath id="cv"><rect x="0" y="0" width="900" height="1200"/></clipPath>
<linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".28" stop-color="#000" stop-opacity=".05"/><stop offset=".55" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".88"/></linearGradient>
${o.tier==="black"?'<linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBF1D0"/><stop offset=".45" stop-color="#E2BE6A"/><stop offset=".75" stop-color="#B8893A"/><stop offset="1" stop-color="#E9CF8A"/></linearGradient>':''}<filter id="sh" x="-5%" y="-20%" width="110%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity=".6"/></filter></defs>
<g clip-path="url(#cv)">
<rect width="900" height="1200" fill="#2A2722"/>
${o.pfp ? `<image href="${o.pfp}" x="0" y="0" width="900" height="1200" preserveAspectRatio="xMidYMid slice"/>` : `<text x="450" y="700" text-anchor="middle" font-family="Noto Serif" font-weight="700" font-size="300" fill="#4A453D">${X((nm[0] || "F").toUpperCase())}</text>`}
<rect width="900" height="1200" fill="url(#g1)"/>
<text x="450" y="268" text-anchor="middle" font-family="Noto Serif" font-weight="700" font-size="200" letter-spacing="6" fill="${o.tier==="black"?"#F6EFE1":c}" filter="url(#sh)">FOLIO</text>
<text x="56" y="58" font-family="Noto Sans" font-weight="700" font-size="22" letter-spacing="3" fill="${o.tier==="black"?c:"#FFFFFF"}" filter="url(#sh)">${X(o.edition.toUpperCase())}</text>
<text x="844" y="60" text-anchor="end" font-family="Noto Sans" font-weight="700" font-size="22" letter-spacing="3" fill="#FFFFFF" filter="url(#sh)">FID ${X(o.fid)}</text>
<text x="450" y="312" text-anchor="middle" font-family="Noto Sans" font-weight="700" font-size="22" letter-spacing="5" fill="#FFFFFF" filter="url(#sh)">THE READER ISSUE \u00B7 ${X(o.date.toUpperCase())}</text>
${cl}
${pL.map((t, i) => `<text x="56" y="${py + i * 92}" font-family="Noto Serif" font-weight="700" font-size="96" fill="${c}" filter="url(#sh)">${X(t)}</text>`).join("")}
<text x="56" y="1090" font-family="Noto Sans" font-weight="700" font-size="34" fill="#FFFFFF" filter="url(#sh)">${X(nm.slice(0, 34))}</text>
<text x="56" y="1132" font-family="Noto Sans" font-size="26" fill="#E8E2D6" filter="url(#sh)">@${X(o.user)}</text>
<text x="844" y="1132" text-anchor="end" font-family="Noto Sans" font-weight="700" font-size="22" letter-spacing="2" fill="#E8E2D6" filter="url(#sh)">FOLIO ON FARCASTER</text>
</g>
<rect x="10" y="10" width="880" height="1180" fill="none" stroke="${c}" stroke-width="${o.tier === "red" ? 0 : 10}"/>`;
}
export function svgCover(o) {
  if (o.portrait) return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="900" height="1200" viewBox="0 0 900 1200">${coverInner(o)}</svg>`;
  const [c] = TIERS[o.tier] || TIERS.red;
  const nm = clean(o.name).replace(/[\s\-\u2013\u2014|·.,:;]+$/, "") || o.user;
  const t = wrap(nm.slice(0, 40) + "\u2019s cover", 15, 3);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="800" viewBox="0 0 1200 800">
<rect width="1200" height="800" fill="#16140F"/>
<g transform="translate(90 32) scale(0.62)">${coverInner(o)}</g>
${t.map((l, i) => `<text x="720" y="${220 + i * 60}" font-family="Noto Serif" font-weight="700" font-size="46" fill="#F4EFE6">${X(l)}</text>`).join("")}
<text x="720" y="${220 + t.length * 60 + 10}" font-family="Noto Sans" font-weight="700" font-size="22" letter-spacing="3" fill="${c}">${X(o.edition.toUpperCase())}</text>
<rect x="720" y="${220 + t.length * 60 + 50}" width="400" height="2" fill="#3A362E"/>
<text x="720" y="${220 + t.length * 60 + 100}" font-family="Noto Sans" font-size="26" fill="#BDB5A6">This week\u2019s Folio cover,</text>
<text x="720" y="${220 + t.length * 60 + 136}" font-family="Noto Sans" font-size="26" fill="#BDB5A6">made from what they read.</text>
<text x="720" y="${220 + t.length * 60 + 210}" font-family="Noto Sans" font-weight="700" font-size="28" fill="${c}">Get yours on Folio</text>
</svg>`;
}
const PAL = ["#1B1A17", "#4A2A22", "#A8341C", "#E0A07C", "#F4EFE6"];
export async function pixGrid(wasm, uri, N) {
  await init(wasm);
  const r = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${N}" height="${N}" viewBox="0 0 ${N} ${N}"><rect width="${N}" height="${N}" fill="#F4EFE6"/><image href="${uri}" x="0" y="0" width="${N}" height="${N}" preserveAspectRatio="xMidYMid slice"/></svg>`, { fitTo: { mode: "width", value: N } });
  const im = r.render(); const px = im.pixels, W = im.width || N, Hh = im.height || N; const L = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = Math.min(Hh - 1, Math.floor(y * Hh / N)) * W + Math.min(W - 1, Math.floor(x * W / N)); L.push(0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]); }
  const sorted = [...L].sort((a, b) => a - b), lo = sorted[Math.floor(N * N * 0.03)], hi = sorted[Math.floor(N * N * 0.97)] || 255, sp = Math.max(1, hi - lo);
  return L.map(v => Math.max(0, Math.min(1, (v - lo) / sp)));
}
function pixArt(g, N, x0, y0, S) {
  const c = S / N; let o = `<clipPath id="hc"><rect x="${x0}" y="${y0}" width="${S}" height="${S}"/></clipPath><g clip-path="url(#hc)">`;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = 1 - g[y * N + x]; const r = c * 0.62 * Math.sqrt(v); if (r < 0.5) continue; const ox = (y % 2) * c / 2; o += `<circle cx="${(x0 + x * c + c / 2 + ox).toFixed(1)}" cy="${(y0 + y * c + c / 2).toFixed(1)}" r="${r.toFixed(2)}" fill="${v > 0.72 ? "#1B1A17" : "#A8341C"}"/>`; }
  return o + "</g>";
}
export function svgGame({ no, r, s, name, user, pfp, grid, N }) {
  const res = String(r || "").slice(0, 2).split("").map(c => c === "1");
  const won = res.includes(true), tries = res.length;
  const head = won ? (tries === 1 ? "Got it first try" : "Got it in two") : "Missed it today";
  const sq = res.map((ok, i) => { const x = 620 + i * 140; return `<rect x="${x}" y="250" width="116" height="116" rx="14" fill="${ok ? "#2E7D4F" : "#A8341C"}"/>` + (ok ? `<path d="M${x + 32} ${310} L${x + 51} ${329} L${x + 86} ${290}" fill="none" stroke="#F4EFE6" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="M${x + 38} 288 L${x + 78} 328 M${x + 78} 288 L${x + 38} 328" fill="none" stroke="#F4EFE6" stroke-width="11" stroke-linecap="round"/>`); }).join("");
  const clean = String(name || "").replace(/[^\u0020-\u024F\u2018\u2019]/g, "").replace(/[-\s]+$/,"").replace(/\s+/g, " ").trim(); const nm = wrap(clean.length >= 2 ? clean : (user || "A reader"), 18, 2);
  const ny = 560;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="800" viewBox="0 0 1200 800">
<defs><clipPath id="gp"><circle cx="290" cy="330" r="150"/></clipPath></defs>
<rect width="1200" height="800" fill="#F4EFE6"/>
${grid ? "" : `<circle cx="290" cy="330" r="162" fill="#A8341C"/>`}
${grid ? `<rect x="122" y="162" width="336" height="336" rx="8" fill="#1B1A17"/><rect x="130" y="170" width="320" height="320" fill="#F4EFE6"/>${pixArt(grid, N, 130, 170, 320)}` : pfp ? `<image href="${pfp}" x="140" y="180" width="300" height="300" preserveAspectRatio="xMidYMid slice" clip-path="url(#gp)"/>` : `<circle cx="290" cy="330" r="150" fill="#E2D9C9"/><text x="290" y="372" text-anchor="middle" font-family="Noto Serif" font-weight="700" font-size="120" fill="#8A8170">${X((nm[0] || "F")[0].toUpperCase())}</text>`}
${nm.map((t, i) => `<text x="290" y="${ny + i * 52}" text-anchor="middle" font-family="Noto Serif" font-weight="700" font-size="44" fill="#1B1A17">${X(t)}</text>`).join("")}
${user ? `<text x="290" y="${ny + nm.length * 52 + 4}" text-anchor="middle" font-family="Noto Sans" font-size="28" fill="#7A7264">@${X(user)}</text>` : ""}
<text x="620" y="200" font-family="Noto Sans" font-weight="700" font-size="28" letter-spacing="5" fill="#A8341C">WHO WROTE IT? #${X(String(no || ""))}</text>
${sq}
<text x="620" y="470" font-family="Noto Serif" font-weight="700" font-size="56" fill="#1B1A17">${head}</text>
${s > 1 ? `<text x="620" y="520" font-family="Noto Sans" font-weight="700" font-size="28" fill="#A8341C">${X(String(s))} day streak</text>` : ""}
<text x="620" y="${s > 1 ? 580 : 540}" font-family="Noto Sans" font-size="30" fill="#4A453D">One paragraph, four writers.</text>
<text x="620" y="${s > 1 ? 624 : 584}" font-family="Noto Sans" font-size="30" fill="#4A453D">Can you tell who wrote it?</text>
<rect x="60" y="690" width="1080" height="1.5" fill="#E2D9C9"/>
<text x="60" y="752" font-family="Noto Serif" font-weight="700" font-size="38" fill="#1B1A17">Folio</text>
<text x="1140" y="750" text-anchor="end" font-family="Noto Sans" font-weight="700" font-size="28" fill="#A8341C">Play today\u2019s game</text>
</svg>`;
}
export async function render(wasm, fonts, opts) {
  await init(wasm);
  const r = new Resvg(opts.game ? svgGame(opts) : opts.cover ? svgCover(opts) : opts.quote ? svgQuote(opts) : svg(opts), { fitTo: { mode: "width", value: opts.w || (opts.game ? 2400 : opts.cover && opts.portrait ? 900 : 1200) }, font: { fontBuffers: fonts, loadSystemFonts: false, defaultFontFamily: "Noto Sans", serifFamily: "Noto Serif" } });
  return r.render().asPng();
}
// ---------- "Who wrote it?" 2-scene share card (2026-11-18) ----------
// One static 1200x800 (3:2, the Farcaster mini app embed ratio) image: 2 AI scene tiles side by side, the day's question
// handwritten in code on the blank paper of tile A (scenes v3: heading, the 4 options, the player's pick circled, the
// correct one checked), and a bottom strip FOLIO · Who wrote it? #N · result · streak · date.
const GW = 1200, GH = 800, GT = { y: 14, w: 580, h: 662 }, GX = [14, 606];
const GOK = "#2E7D4F", GNO = "#A8341C";
function gcRes(r) { const res = String(r || "").slice(0, 2).split("").map(c => c === "1"); const won = res.includes(true); return { res, head: won ? (res.length === 1 ? "Got it first try" : "Got it in two") : res.length ? "Missed it" : "Played" }; }
function gcSquares(res, x, y, S, gap) {
  return res.map((ok, i) => { const X0 = x + i * (S + gap), k = S / 116; return `<rect x="${X0.toFixed(1)}" y="${y.toFixed(1)}" width="${S.toFixed(1)}" height="${S.toFixed(1)}" rx="${(S * 0.14).toFixed(1)}" fill="${ok ? GOK : GNO}"/>` +
    (ok ? `<path d="M${(X0 + 32 * k).toFixed(1)} ${(y + 60 * k).toFixed(1)} L${(X0 + 51 * k).toFixed(1)} ${(y + 79 * k).toFixed(1)} L${(X0 + 86 * k).toFixed(1)} ${(y + 40 * k).toFixed(1)}" fill="none" stroke="#FFFFFF" stroke-width="${(11 * k).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<path d="M${(X0 + 38 * k).toFixed(1)} ${(y + 38 * k).toFixed(1)} L${(X0 + 78 * k).toFixed(1)} ${(y + 78 * k).toFixed(1)} M${(X0 + 78 * k).toFixed(1)} ${(y + 38 * k).toFixed(1)} L${(X0 + 38 * k).toFixed(1)} ${(y + 78 * k).toFixed(1)}" fill="none" stroke="#FFFFFF" stroke-width="${(11 * k).toFixed(1)}" stroke-linecap="round"/>`); }).join("");
}
// handwritten question on the paper box (x,y,w,h in card px). o.opts: [{u,n}] of that day's game (or none -> A-D lines),
// o.ans: correct index (-1 = unknown / hidden), o.pk: the player's picks in order (indices, may be partly unknown)
const INK = "#22345C", HF = "Caveat, Noto Sans";
function gcPaperUI(x, y, w, h, o, R) {
  if (o.one && w / h > 1.8) return gcPaperWide(x, y, w, h, o); // s15: short wide paper -> heading + 2x2 options
  const opts = Array.isArray(o.opts) && o.opts.length === 4 ? o.opts : null, ans = Number.isInteger(o.ans) && o.ans >= 0 && o.ans < 4 ? o.ans : -1;
  const pk = (Array.isArray(o.pk) ? o.pk : []).slice(0, 2), fin = pk.length ? pk[pk.length - 1] : -1;
  const big = !!o.one, hs = Math.min(h * (big ? 0.2 : 0.24), w * 0.135), lh = (h - hs * (big ? 1.15 : 1.25)) / 4, fs0 = Math.min(lh * (big ? 0.95 : 0.9), w * 0.125), LN = Array.isArray(o.opts) ? Math.max(8, ...o.opts.map(q => String(q && (q.u ? '@' + q.u : q.n) || '').length)) : 8, fs = big ? Math.min(fs0, (w * 0.86) / (1.0 + LN * (o.hf ? 0.43 : 0.5))) : fs0; // s14: always fits inside the paper
  const SW = big ? ` stroke="${INK}" stroke-width="${Math.max(0.7, fs * 0.05).toFixed(2)}"` : ""; // s11: bigger, slightly bolder handwriting on the single scene
  const cx = x + w / 2, lx = x + w * 0.06, nx = lx + fs * 0.95, cw = fs * (o.hf ? 0.43 : 0.56), maxc = Math.max(4, Math.floor((x + w - nx - fs * 1.1) / cw));
  const L = ["A", "B", "C", "D"], f2 = v => v.toFixed(1);
  let out = `<text x="${f2(cx)}" y="${f2(y + hs * 0.95)}" text-anchor="middle" font-family="${HF}" font-size="${f2(hs)}" fill="${INK}"${SW}>Who wrote it? #${X(String(o.no))}</text>`;
  out += `<path d="M${f2(cx - w * 0.3)} ${f2(y + hs * 1.12)} Q${f2(cx)} ${f2(y + hs * 1.2)} ${f2(cx + w * 0.3)} ${f2(y + hs * 1.08)}" fill="none" stroke="${INK}" stroke-width="${f2(Math.max(1.2, fs * 0.06))}" stroke-linecap="round" opacity="0.8"/>`;
  for (let i = 0; i < 4; i++) {
    const by = y + hs * (big ? 1.15 : 1.25) + lh * i, ty = by + lh * 0.5 + fs * 0.32;
    let nm = opts ? String(opts[i].u ? "@" + opts[i].u : opts[i].n || "") : "";
    if (nm.length > maxc) nm = nm.slice(0, maxc - 1) + "\u2026";
    const tw = opts ? nm.length * cw : w * 0.5;
    out += `<text x="${f2(lx)}" y="${f2(ty)}" font-family="${HF}" font-size="${f2(fs)}" fill="${INK}"${SW}>${L[i]}</text>`;
    out += opts ? `<text x="${f2(nx)}" y="${f2(ty)}" font-family="${HF}" font-size="${f2(fs)}" fill="${INK}"${SW}>${X(nm)}</text>`
                : `<path d="M${f2(nx)} ${f2(ty)} L${f2(nx + tw)} ${f2(ty - fs * 0.04)}" stroke="${INK}" stroke-width="${f2(Math.max(1, fs * 0.05))}" stroke-linecap="round" opacity="0.55"/>`;
    const ex = nx + tw; // end of the name
    // a wrong guess: red strike-through
    if (pk.includes(i) && i !== ans && ans >= 0) out += `<path d="M${f2(lx - fs * 0.15)} ${f2(ty - fs * 0.28)} L${f2(ex + fs * 0.15)} ${f2(ty - fs * 0.34)}" stroke="${GNO}" stroke-width="${f2(Math.max(1.4, fs * 0.08))}" stroke-linecap="round"/>`;
    // the player's final answer: a loose hand-drawn ring around letter + name
    if (i === fin) { const rx = (ex - lx) / 2 + fs * 0.62, ry = lh * 0.52, ecx = (lx + ex) / 2 - fs * 0.06, ecy = ty - fs * 0.3;
      out += `<path d="M${f2(ecx + rx * 0.9)} ${f2(ecy - ry * 0.55)} C${f2(ecx + rx * 1.1)} ${f2(ecy + ry * 0.9)} ${f2(ecx - rx * 1.05)} ${f2(ecy + ry * 1.05)} ${f2(ecx - rx)} ${f2(ecy)} C${f2(ecx - rx * 0.95)} ${f2(ecy - ry * 1.15)} ${f2(ecx + rx * 0.8)} ${f2(ecy - ry * 1.2)} ${f2(ecx + rx * 1.02)} ${f2(ecy - ry * 0.15)}" fill="none" stroke="${INK}" stroke-width="${f2(Math.max(1.4, fs * 0.075))}" stroke-linecap="round"/>`; }
    // the correct writer: green tick after the name
    if (i === ans) { const kx = ex + fs * (i === fin ? 0.8 : 0.3), k = fs / 30;
      out += `<path d="M${f2(kx)} ${f2(ty - 10 * k)} L${f2(kx + 7 * k)} ${f2(ty - 2 * k)} L${f2(kx + 22 * k)} ${f2(ty - 24 * k)}" fill="none" stroke="${GOK}" stroke-width="${f2(Math.max(1.6, 3.6 * k))}" stroke-linecap="round" stroke-linejoin="round"/>`; }
  }
  return out;
}
// s15 (2026-11-19): a short, wide sheet: heading on top, options in two columns, always inside the box
function gcPaperWide(x, y, w, h, o) {
  const opts = Array.isArray(o.opts) && o.opts.length === 4 ? o.opts : null, ans = Number.isInteger(o.ans) && o.ans >= 0 && o.ans < 4 ? o.ans : -1;
  const pk = (Array.isArray(o.pk) ? o.pk : []).slice(0, 2), fin = pk.length ? pk[pk.length - 1] : -1, f2 = v => v.toFixed(1);
  const SW = fz => ` stroke="${INK}" stroke-width="${Math.max(0.6, fz * 0.05).toFixed(2)}"`;
  const hs = Math.min(h * 0.36, w * 0.09), cw = w / 2, rows = h - hs * 1.2, lh = rows / 2;
  const nm = i => opts ? String(opts[i].u ? "@" + opts[i].u : opts[i].n || "") : "";
  const LN = opts ? Math.max(6, ...[0, 1, 2, 3].map(i => nm(i).length)) : 6, k = o.hf ? 0.43 : 0.5;
  const fs = Math.min(lh * 0.8, (cw * 0.9) / (1.0 + LN * k));
  const cx = x + w / 2; let out = `<text x="${f2(cx)}" y="${f2(y + hs * 0.9)}" text-anchor="middle" font-family="${HF}" font-size="${f2(hs)}" fill="${INK}"${SW(hs)}>Who wrote it? #${X(String(o.no))}</text>`;
  const L = ["A", "B", "C", "D"];
  for (let i = 0; i < 4; i++) {
    const col = i % 2, row = i >> 1, lx = x + col * cw + cw * 0.04, nx = lx + fs * 0.95, ty = y + hs * 1.2 + lh * row + lh * 0.5 + fs * 0.32, t = nm(i), tw = opts ? t.length * fs * k : cw * 0.5, ex = nx + tw;
    out += `<text x="${f2(lx)}" y="${f2(ty)}" font-family="${HF}" font-size="${f2(fs)}" fill="${INK}"${SW(fs)}>${L[i]}</text>`;
    out += opts ? `<text x="${f2(nx)}" y="${f2(ty)}" font-family="${HF}" font-size="${f2(fs)}" fill="${INK}"${SW(fs)}>${X(t)}</text>` : `<path d="M${f2(nx)} ${f2(ty)} L${f2(ex)} ${f2(ty)}" stroke="${INK}" stroke-width="${f2(Math.max(1, fs * 0.05))}" opacity="0.55"/>`;
    if (pk.includes(i) && i !== ans && ans >= 0) out += `<path d="M${f2(lx - fs * 0.1)} ${f2(ty - fs * 0.28)} L${f2(ex + fs * 0.1)} ${f2(ty - fs * 0.32)}" stroke="${GNO}" stroke-width="${f2(Math.max(1.2, fs * 0.08))}" stroke-linecap="round"/>`;
    if (i === fin) { const rx = (ex - lx) / 2 + fs * 0.4, ry = lh * 0.48, ecx = (lx + ex) / 2, ecy = ty - fs * 0.3; out += `<ellipse cx="${f2(ecx)}" cy="${f2(ecy)}" rx="${f2(rx)}" ry="${f2(ry)}" fill="none" stroke="${INK}" stroke-width="${f2(Math.max(1.2, fs * 0.07))}" transform="rotate(-2 ${f2(ecx)} ${f2(ecy)})"/>`; }
    if (i === ans) { const kx = ex + fs * (i === fin ? 0.55 : 0.25), q = fs / 30; out += `<path d="M${f2(kx)} ${f2(ty - 10 * q)} L${f2(kx + 7 * q)} ${f2(ty - 2 * q)} L${f2(kx + 22 * q)} ${f2(ty - 24 * q)}" fill="none" stroke="${GOK}" stroke-width="${f2(Math.max(1.4, 3.6 * q))}" stroke-linecap="round" stroke-linejoin="round"/>`; }
  }
  return out;
}
// s8 (2026-11-18): one wide scene across the whole card; the question is written on the detected paper (scr, 512-normalised per axis)
function svgGameCard1(o, R) {
  const X0 = 14, Y0 = 14, W = GW - 28, H = GT.h, iw = 896, ih = 512;
  const sc = Math.max(W / iw, H / ih), dw = iw * sc, dh = ih * sc, ox = X0 + (W - dw) / 2, oy = Y0 + (H - dh) / 2;
  let scr = "";
  if (o.scr && o.scr.w > 0) {
    let x = ox + o.scr.x / 512 * dw, y = oy + o.scr.y / 512 * dh, w = o.scr.w / 512 * dw, h = o.scr.h / 512 * dh;
    const ix = w * 0.04, iy = h * 0.02; x += ix; y += iy; w -= 2 * ix; h -= 2 * iy;
    const x0 = Math.max(x, X0 + 6), x1 = Math.min(x + w, X0 + W - 6); x = x0; w = x1 - x0;
    if (w > 420) { const k = (w - 420) / 2; x += k; w = 420; } // keep the handwriting paper-sized on a wide scene
    if (w >= 150 && h >= (w / h > 1.8 ? 50 : 95)) scr = `<g clip-path="url(#g1)"><g transform="rotate(-1.5 ${(x + w / 2).toFixed(1)} ${(y + h / 2).toFixed(1)})">${gcPaperUI(x, y, w, h, o, R)}</g></g>`;
  }
  const img = `<image href="${o.a}" x="${ox.toFixed(1)}" y="${oy.toFixed(1)}" width="${dw.toFixed(1)}" height="${dh.toFixed(1)}" preserveAspectRatio="none" clip-path="url(#g1)"/>`;
  return svgGameCardShell(o, R, `<clipPath id="g1"><rect x="${X0}" y="${Y0}" width="${W}" height="${H}"/></clipPath>`, img + scr);
}
export function svgGameCard(o) {
  const R = gcRes(o.r), T = GT, sc = Math.max(T.w, T.h) / 512, dw = 512 * sc, ox = (T.w - dw) / 2, oy = (T.h - dw) / 2;
  if (o.one) return svgGameCard1(o, R);
  const PA = 1; // 2026-11-18: paper scene (a) on the right, mug/phone scene (b) on the left
  const tiles = [o.a, o.b].map((t, j) => { const i = j === 0 ? PA : 1 - PA; return `<image href="${t}" x="${GX[i] + ox}" y="${T.y + oy}" width="${dw}" height="${dw}" preserveAspectRatio="xMidYMid slice" clip-path="url(#gt${i})"/>`; }).join("");
  let scr = "";
  if (o.scr && o.scr.w > 0) {
    // detected blank paper (512px image coords) -> card px, inset a little, clipped to tile A, written slightly tilted
    let x = GX[PA] + ox + o.scr.x * sc, y = T.y + oy + o.scr.y * sc, w = o.scr.w * sc, h = o.scr.h * sc;
    const ix = w * 0.04, iy = h * 0.05; x += ix; y += iy; w -= 2 * ix; h -= 2 * iy;
    const x0 = Math.max(x, GX[PA] + 6), x1 = Math.min(x + w, GX[PA] + T.w - 6); x = x0; w = x1 - x0;
    if (w >= 150 && h >= 95) scr = `<g clip-path="url(#gt${PA})"><g transform="rotate(-1.5 ${(x + w / 2).toFixed(1)} ${(y + h / 2).toFixed(1)})">${gcPaperUI(x, y, w, h, o, R)}</g></g>`;
  }
  return svgGameCardShell(o, R, GX.map((x, i) => `<clipPath id="gt${i}"><rect x="${x}" y="${T.y}" width="${T.w}" height="${T.h}"/></clipPath>`).join(""), tiles + scr);
}
function svgGameCardShell(o, R, defs, body) {
  const T = GT;
  // no clean paper found: the result is shown only in the bottom strip
  const sy = T.y + T.h + 12, sh = GH - sy, my = sy + sh / 2;
  const mid = `Who wrote it? #${o.no}`;
  const st = +o.s > 0 ? `${o.s}-day streak` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${GW}" height="${GH}" viewBox="0 0 ${GW} ${GH}">
<defs>${defs}</defs>
<rect width="${GW}" height="${GH}" fill="#F6F0E6"/>${body}
<rect x="14" y="${sy}" width="${GW - 28}" height="1.5" fill="#E2D9C9"/>
<text x="30" y="${my + 15}" font-family="Noto Serif" font-weight="700" font-size="42" letter-spacing="2" fill="#1B1A17">FOLIO</text>
<text x="600" y="${my - 6}" text-anchor="middle" font-family="Noto Serif" font-weight="700" font-size="30" fill="#2B2620">${X(mid)}</text>
${(() => { const n = R.res.length, S = 26, g = 7, tw = n * S + (n - 1) * g, hw = R.head.length * 12.2, all = tw + 12 + hw, x0 = 600 - all / 2; return gcSquares(R.res, x0, my + 10, S, g) + `<text x="${(x0 + tw + 12).toFixed(1)}" y="${my + 31}" font-family="Noto Sans" font-weight="700" font-size="22" fill="${R.res.includes(true) ? GOK : GNO}">${X(R.head)}</text>`; })()}
${st ? `<text x="${GW - 30}" y="${my - 6}" text-anchor="end" font-family="Noto Sans" font-weight="700" font-size="25" fill="#A8341C">${X(st)}</text>` : ""}
<text x="${GW - 30}" y="${st ? my + 30 : my + 9}" text-anchor="end" font-family="Noto Sans" font-size="22" fill="#6E675C">${X(o.date || "")}</text>
</svg>`;
}
export async function renderGameCard(wasm, fonts, o) {
  await init(wasm);
  const r = new Resvg(svgGameCard(o), { fitTo: { mode: "width", value: GW }, font: { fontBuffers: o.hf ? [...fonts, o.hf] : fonts, loadSystemFonts: false, defaultFontFamily: "Noto Sans", serifFamily: "Noto Serif" } });
  return r.render().asPng();
}
// find the blank paper (scenes v3; was the laptop screen) in scene A: largest bright, neutral, flat rectangle in the lower 3/4 (64x64 grid).
// returns {x,y,w,h} in 512px image coords, or null
export async function gcScreen(wasm, uri) {
  await init(wasm);
  const N = 64, r = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${N}" height="${N}" viewBox="0 0 ${N} ${N}"><image href="${uri}" x="0" y="0" width="${N}" height="${N}" preserveAspectRatio="none"/></svg>`, { fitTo: { mode: "width", value: N } });
  const im = r.render(), px = im.pixels, W = im.width || N;
  const L = new Float32Array(N * N), B = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * W + x) * 4, R0 = px[i], G = px[i + 1], Bl = px[i + 2]; L[y * N + x] = 0.299 * R0 + 0.587 * G + 0.114 * Bl; B[y * N + x] = (L[y * N + x] > 196 && Math.max(R0, G, Bl) - Math.min(R0, G, Bl) < 30) ? 1 : 0; }
  // flatness: a bright cell next to a strong edge (text, lines) does not count
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) { const k = y * N + x; if (B[k] && (Math.abs(L[k] - L[k - 1]) > 40 || Math.abs(L[k] - L[k + 1]) > 40 || Math.abs(L[k] - L[k - N]) > 40 || Math.abs(L[k] - L[k + N]) > 40)) B[k] = 2; }
  const ok = k => B[k] === 1;
  const y0 = 14, hgt = new Int32Array(N); let best = null;
  for (let y = y0; y < N - 1; y++) {
    for (let x = 0; x < N; x++) hgt[x] = ok(y * N + x) ? hgt[x] + 1 : 0;
    const st = [];
    for (let x = 0; x <= N; x++) {
      const h = x < N ? hgt[x] : 0; let s = x;
      while (st.length && st[st.length - 1][1] >= h) { const [sx, sh] = st.pop(); const w = x - sx, a = w * sh; if (sh >= 5 && w >= 9 && w / sh <= 3.8 && w / sh >= 0.9 && sx > 0 && x < N && (!best || a > best.a)) best = { x: sx, y: y - sh + 1, w, h: sh, a }; s = sx; }
      st.push([s, h]);
    }
  }
  if (!best || best.a < 60) return null;
  let cr = 0, cg = 0, cb = 0, cn = 0;
  for (let y = best.y; y < best.y + best.h; y++) for (let x = best.x; x < best.x + best.w; x++) { if (!ok(y * N + x)) continue; const i = (y * W + x) * 4; cr += px[i]; cg += px[i + 1]; cb += px[i + 2]; cn++; }
  const hx = v => Math.round(v / (cn || 1)).toString(16).padStart(2, "0");
  const k = 512 / N; return { x: best.x * k, y: best.y * k, w: best.w * k, h: best.h * k, c: "#" + hx(cr) + hx(cg) + hx(cb) };
}
// identity check sheet for the scorer: reference + up to 3 candidates, 2x2, rendered at 384px
export function svgGcSheet(ref, cands) {
  const P = [[0, 0], [256, 0], [0, 256], [256, 256]], L = ["REF", "A", "B", "C"];
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#FFFFFF"/>` +
    [ref, ...cands].slice(0, 4).map((u, i) => `<image href="${typeof u === "string" ? u : ""}" x="${P[i][0] + 2}" y="${P[i][1] + 2}" width="252" height="252" preserveAspectRatio="xMidYMid slice"/><rect x="${P[i][0] + 4}" y="${P[i][1] + 4}" width="${i ? 34 : 56}" height="28" fill="#000000"/><text x="${P[i][0] + 10}" y="${P[i][1] + 25}" font-family="Noto Sans" font-weight="700" font-size="20" fill="#FFFFFF">${L[i]}</text>`).join("") + `</svg>`;
}
export async function gcSheet(wasm, fonts, ref, cands) {
  await init(wasm);
  const r = new Resvg(svgGcSheet(ref, cands), { fitTo: { mode: "width", value: 384 }, font: { fontBuffers: fonts, loadSystemFonts: false, defaultFontFamily: "Noto Sans" } });
  return r.render().asPng();
}
// tiny RGB histogram (4x4x4 bins) of an image's centre, for a no-AI identity hint
export async function gcHist(wasm, uri) {
  await init(wasm);
  const N = 40, r = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${N}" height="${N}" viewBox="0 0 ${N} ${N}"><image href="${uri}" x="-10" y="-10" width="60" height="60" preserveAspectRatio="xMidYMid slice"/></svg>`, { fitTo: { mode: "width", value: N } });
  const px = r.render().pixels, h = new Float64Array(64); let n = 0;
  for (let i = 0; i < px.length; i += 4) { if (px[i + 3] < 128) continue; h[(px[i] >> 6) * 16 + (px[i + 1] >> 6) * 4 + (px[i + 2] >> 6)]++; n++; }
  return Array.from(h, v => v / (n || 1));
}
// ---------- Zero Hour (sealed texts) share card, 2026-11-19: 1200x800 (3:2), dark card with gold frame; green when opened ----------
export function svgSealCard(o) {
  const t = clean(o.title) || "Untitled", L = wrap(t, t.length > 60 ? 34 : 28, 3), fs = t.length > 60 ? 54 : 62;
  const open = o.st === "open", wd = o.st === "wd";
  const fr = open ? "#3FA36B" : wd ? "#8A8478" : "#C9A24A", acc = open ? "#7FD3A1" : wd ? "#BDB5A6" : "#E9C46A";
  const ms = Math.max(0, +o.left || 0), d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  const big = open ? "READ IT NOW" : wd ? "WITHDRAWN" : d ? `${d}d ${String(h).padStart(2, "0")}h` : `${h}h ${String(m).padStart(2, "0")}m`;
  const date = new Date(+o.oa || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const sub = open ? "OPENED " + date.toUpperCase() : wd ? "BY THE WRITER" : "OPENS IN";
  const n = +o.n || 0, foot = (open ? n + (n === 1 ? " was" : " were") + " waiting" : n + " waiting") + " \u00B7 Folio";
  const lock = `<g transform="translate(92 92)" fill="none" stroke="${acc}" stroke-width="3.4" stroke-linecap="round"><rect x="0" y="12" width="22" height="17" rx="3"/><path d="M4.5 12V7.5a6.5 6.5 0 0 1 13 0V12"/></g>`;
  const tl = L.map((l, i) => `<text x="92" y="${226 + i * fs * 1.18}" font-family="Noto Serif" font-weight="700" font-size="${fs}" fill="#F4EFE6">${X(l)}</text>`).join("");
  const nm = "@" + clean(o.user || "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B1A17"/><stop offset="1" stop-color="#3A3125"/></linearGradient><clipPath id="pp"><circle cx="124" cy="606" r="32"/></clipPath></defs>
<rect width="1200" height="800" fill="#141310"/>
<rect x="28" y="28" width="1144" height="744" rx="34" fill="url(#g)" stroke="${fr}" stroke-width="5"/>
<rect x="44" y="44" width="1112" height="712" rx="24" fill="none" stroke="${fr}" stroke-opacity=".35" stroke-width="1.5"/>
${lock}<text x="130" y="119" font-family="Noto Sans" font-weight="700" font-size="26" letter-spacing="5" fill="${acc}">ZERO HOUR</text>
${tl}
${o.pfp ? `<image href="${o.pfp}" x="92" y="574" width="64" height="64" preserveAspectRatio="xMidYMid slice" clip-path="url(#pp)"/>` : `<circle cx="124" cy="606" r="32" fill="#5C5244"/>`}
<text x="172" y="616" font-family="Noto Sans" font-weight="700" font-size="28" fill="#E8E0D2">${X(nm.slice(0, 34))}</text>
<text x="1108" y="560" text-anchor="end" font-family="Noto Sans" font-weight="700" font-size="22" letter-spacing="4" fill="${acc}">${X(sub)}</text>
<text x="1108" y="636" text-anchor="end" font-family="Noto Serif" font-weight="700" font-size="${open || wd ? 58 : 76}" fill="${acc}">${X(big)}</text>
<rect x="92" y="672" width="1016" height="1.5" fill="${fr}" fill-opacity=".45"/>
<text x="92" y="718" font-family="Noto Sans" font-size="24" fill="#BDB5A6">${X(foot)}</text>
<text x="1108" y="720" text-anchor="end" font-family="Noto Serif" font-weight="700" font-size="34" fill="#F4EFE6">Folio</text>
</svg>`;
}
export async function renderSealCard(wasm, fonts, o) {
  await init(wasm);
  const r = new Resvg(svgSealCard(o), { fitTo: { mode: "width", value: 1200 }, font: { fontBuffers: fonts, loadSystemFonts: false, defaultFontFamily: "Noto Sans", serifFamily: "Noto Serif" } });
  return r.render().asPng();
}