// Folio Letters: Cloudflare Worker routes (D1 binding: env.DB)
// Live in Folio since 2026-11-25. Schema below; a copy of it is in letters-schema.sql.
//
// Mount from your worker's fetch():
//   import { handleLetters } from "./letters.js";
//   const r = await handleLetters(request, env, verifyFid); if (r) return r;
//
// verifyFid(request) -> Promise<number|null>: your existing Quick Auth check
// (the same one /api/seen uses). It must return the FID or null.
//
// PRIVACY CONTRACT (this file is public so anyone can check it):
//  1. A letter row never contains a FID, a FID hash, a username or an exact time.
//  2. The writer's FID is never stored. The 1-a-day limit keeps only HMAC(fid, today's random salt);
//     the salt is deleted the next day, after which nobody can tell whose quota row it was.
//  3. Replies/hugs reach the writer through a random mailbox key kept on their phone.
//     The server stores only sha256(key); "my letters" is fetched WITHOUT sign-in.
//  4. Nothing on these routes is logged (no console.log of fid, ip or body).
//  5. Not even Folio's developer can see who wrote a letter: the link simply is not stored.
//  6. Sharing is off by default. Only letters whose writer ticked "can be shared" are readable by link (/one).

const DAY = () => new Date().toISOString().slice(0, 10);
const NOW = () => Math.floor(Date.now() / 1000);
const BATCH = 3600;            // letters go live at the next full hour, in random order
const MAX_LEN = 2000, MIN_LEN = 40;
const PER_NIGHT = 3;
const FREE_PER_DAY = 1;        // readers who haven't written today still get one letter           // "up to 3": fewer when the pool is small
const MAX_AGE = 30 * 86400;    // older letters can still be delivered while it's quiet
const HIDE_AT = 3;             // reports before a letter is hidden
const TAGS = ["pain", "joy", "win", "confession", "other"];

const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}

// Stop people from outing themselves by accident.
const PII = [
  /[\w.+-]+@[\w-]+\.[\w.]+/,                 // email
  /(\+?\d[\d\s().-]{7,}\d)/,                 // phone-like
  /(^|\s)@[a-z0-9_.-]{2,}/i,                 // @handle
  /0x[a-f0-9]{40}/i,                         // wallet
  /\b[a-z0-9-]+\.(eth|base\.eth)\b/i,        // ens
  /https?:\/\/|www\./i,                      // links
];
// Crisis words: the letter is not published; the writer sees help instead.
const CRISIS = [/kill myself/i, /suicid/i, /end my life/i, /want to die/i, /self[- ]?harm/i,
  /خودکشی/, /خودمو بکشم/, /خودم را بکشم/, /می‌خوام بمیرم/, /میخوام بمیرم/];


// Tables are created on first use (same as schema.sql in this folder's history).
const SCHEMA = [
 "CREATE TABLE IF NOT EXISTS letters ( id TEXT PRIMARY KEY, body TEXT NOT NULL, tag TEXT NOT NULL, mbox_hash TEXT NOT NULL, publish_at INTEGER NOT NULL, views INTEGER NOT NULL DEFAULT 0, hugs INTEGER NOT NULL DEFAULT 0, reports INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, share INTEGER NOT NULL DEFAULT 0 )",
 "CREATE INDEX IF NOT EXISTS letters_pick ON letters (hidden, publish_at, views)",
 "CREATE INDEX IF NOT EXISTS letters_mbox ON letters (mbox_hash)",
 "DROP TABLE IF EXISTS daily_quota",
 "CREATE TABLE IF NOT EXISTS quota_h ( h TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (h, day) )",
 "CREATE TABLE IF NOT EXISTS quota_salt ( day TEXT PRIMARY KEY, salt TEXT NOT NULL )",
 "CREATE TABLE IF NOT EXISTS deliveries ( fid INTEGER NOT NULL, day TEXT NOT NULL, letter_id TEXT NOT NULL, hugged INTEGER NOT NULL DEFAULT 0, reported INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (fid, letter_id) )",
 "CREATE INDEX IF NOT EXISTS deliveries_day ON deliveries (fid, day)"
];
// Today's random salt lives in D1 for one day only; older salts and quota rows are deleted.
async function quotaHash(db, fid, day) {
  const fresh = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("");
  await db.batch([
    db.prepare("DELETE FROM quota_salt WHERE day<?").bind(day),
    db.prepare("DELETE FROM quota_h WHERE day<?").bind(day),
    db.prepare("INSERT OR IGNORE INTO quota_salt (day, salt) VALUES (?, ?)").bind(day, fresh),
  ]);
  const row = await db.prepare("SELECT salt FROM quota_salt WHERE day=?").bind(day).first();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(row.salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(fid)));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}
let ready = null;
function init(db) { if (!ready) ready = db.batch(SCHEMA.map(q => db.prepare(q))).then(() => db.prepare("ALTER TABLE letters ADD COLUMN share INTEGER NOT NULL DEFAULT 0").run().catch(() => {})).catch(e => { ready = null; throw e; }); return ready; }

export async function handleLetters(req, env, verifyFid) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/api/letters/")) return null;
  const route = url.pathname.slice("/api/letters/".length);
  const db = env.DB;
  if (!db) return json({ error: "server" }, 503);

  try {
    await init(db);
    // ---------- write (sign-in needed, only to enforce 1/day) ----------
    if (route === "write" && req.method === "POST") {
      const fid = await verifyFid(req); if (!fid) return json({ error: "auth" }, 401);
      const { body = "", tag = "other", mbox_hash = "", share = false } = await req.json();
      const text = String(body).trim();
      if (text.length < MIN_LEN || text.length > MAX_LEN) return json({ error: "length", min: MIN_LEN, max: MAX_LEN }, 400);
      if (!/^[a-f0-9]{64}$/.test(mbox_hash)) return json({ error: "mbox" }, 400);
      if (CRISIS.some(r => r.test(text))) return json({ error: "crisis", help: "https://findahelpline.com" }, 422);
      if (PII.some(r => r.test(text))) return json({ error: "pii" }, 422);

      const day = DAY();
      const qh = await quotaHash(db, fid, day);
      const used = await db.prepare("SELECT 1 FROM quota_h WHERE h=? AND day=?").bind(qh, day).first();
      if (used) return json({ error: "quota" }, 429);

      const id = crypto.randomUUID();
      const publish_at = (Math.floor(NOW() / BATCH) + 1) * BATCH;
      await db.batch([
        db.prepare("INSERT INTO quota_h (h, day) VALUES (?, ?)").bind(qh, day),
        db.prepare("INSERT INTO letters (id, body, tag, mbox_hash, publish_at, share) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(id, text, TAGS.includes(tag) ? tag : "other", mbox_hash, publish_at, share === true ? 1 : 0),
      ]);
      return json({ ok: true, id, publish_at });
    }

    // ---------- inbox: 1 free letter a day; 3 after you wrote today ----------
    if (route === "inbox" && req.method === "POST") {
      const fid = await verifyFid(req); if (!fid) return json({ error: "auth" }, 401);
      const day = DAY();
      const wrote = await db.prepare("SELECT 1 FROM quota_h WHERE h=? AND day=?").bind(await quotaHash(db, fid, day), day).first();
      const per = wrote ? PER_NIGHT : FREE_PER_DAY;

      // exclude = ids of your own letters, held on your phone. Used for this query only, never stored.
      const { exclude = [] } = await req.json().catch(() => ({}));
      const ex = (Array.isArray(exclude) ? exclude : []).filter(x => /^[0-9a-f-]{36}$/.test(x)).slice(0, 60);

      let got = (await db.prepare(
        "SELECT l.id, l.body, l.tag, l.hugs, l.share, d.hugged FROM deliveries d JOIN letters l ON l.id=d.letter_id WHERE d.fid=? AND d.day=? AND l.hidden=0"
      ).bind(fid, day).all()).results;

      if (got.length < per) {
        const need = per - got.length;
        const skip = [...ex, ...got.map(x => x.id)];
        const ph = skip.map(() => "?").join(",") || "''";
        const fresh = (await db.prepare(
          `SELECT id, body, tag, hugs, share FROM letters
           WHERE hidden=0 AND publish_at<=? AND publish_at>=? AND id NOT IN (${ph})
             AND id NOT IN (SELECT letter_id FROM deliveries WHERE fid=?)
           ORDER BY views ASC, RANDOM() LIMIT ?`
        ).bind(NOW(), NOW() - MAX_AGE, ...skip, fid, need).all()).results;
        if (fresh.length) {
          await db.batch(fresh.flatMap(l => [
            db.prepare("INSERT OR IGNORE INTO deliveries (fid, day, letter_id) VALUES (?, ?, ?)").bind(fid, day, l.id),
            db.prepare("UPDATE letters SET views=views+1 WHERE id=?").bind(l.id),
          ]));
        }
        got = got.concat(fresh.map(l => ({ ...l, hugged: 0 })));
      }
      // light cleanup, no cron needed
      if (Math.random() < 0.05) {
        const old = new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10);
        await db.prepare("DELETE FROM deliveries WHERE day<?").bind(old).run();
      }
      return json({ locked: false, free: !wrote, letters: got, max: per });
    }

    // ---------- hug / report (only letters delivered to you) ----------
    if ((route === "hug" || route === "report") && req.method === "POST") {
      const fid = await verifyFid(req); if (!fid) return json({ error: "auth" }, 401);
      const { id = "" } = await req.json();
      const col = route === "hug" ? "hugged" : "reported";
      const d = await db.prepare(`SELECT ${col} AS done FROM deliveries WHERE fid=? AND letter_id=?`).bind(fid, id).first();
      if (!d) return json({ error: "not_yours" }, 404);
      if (d.done) return json({ ok: true });
      const upd = route === "hug"
        ? "UPDATE letters SET hugs=hugs+1 WHERE id=?"
        : `UPDATE letters SET reports=reports+1, hidden=CASE WHEN reports+1>=${HIDE_AT} THEN 1 ELSE hidden END WHERE id=?`;
      await db.batch([
        db.prepare(`UPDATE deliveries SET ${col}=1 WHERE fid=? AND letter_id=?`).bind(fid, id),
        db.prepare(upd).bind(id),
      ]);
      return json({ ok: true });
    }

    // ---------- my letters: NO sign-in, proven by the mailbox keys on your phone ----------
    if (route === "mine" && req.method === "POST") {
      const { keys = [] } = await req.json();
      const ks = (Array.isArray(keys) ? keys : []).filter(k => /^[a-f0-9]{64}$/.test(k)).slice(0, 60);
      if (!ks.length) return json({ letters: [] });
      const hashes = await Promise.all(ks.map(sha256));
      const rows = (await db.prepare(
        `SELECT id, body, tag, hugs, views, publish_at, hidden FROM letters WHERE mbox_hash IN (${hashes.map(() => "?").join(",")}) ORDER BY publish_at DESC`
      ).bind(...hashes).all()).results;
      return json({ letters: rows });
    }

    // ---------- one shared letter (only if its writer allowed sharing) ----------
    if (route === "one" && req.method === "GET") {
      const id = url.searchParams.get("id") || "";
      if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: "not_found" }, 404);
      const l = await db.prepare("SELECT id, body, tag, hugs FROM letters WHERE id=? AND share=1 AND hidden=0 AND publish_at<=?").bind(id, NOW()).first();
      return l ? json({ letter: l }) : json({ error: "not_found" }, 404);
    }

    // ---------- public stats (so writers know it's quiet) ----------
    if (route === "stats" && req.method === "GET") {
      const r = await db.prepare("SELECT COUNT(*) AS n FROM letters WHERE hidden=0 AND publish_at>=?").bind(NOW() - 86400).first();
      return json({ last24h: r ? r.n : 0 });
    }

    return json({ error: "not_found" }, 404);
  } catch (e) {
    return json({ error: "server" }, 500); // no details, no logging
  }
}
