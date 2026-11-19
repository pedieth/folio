// minimal Cloudflare D1 shim on node:sqlite for tests
import { DatabaseSync } from "node:sqlite";
export function makeD1() {
  const d = new DatabaseSync(":memory:"); const dl = () => new Promise(z => setTimeout(z, Math.random() * 20));
  const stmt = (sql, args = []) => ({ bind: (...a) => stmt(sql, a), _run() { const p = d.prepare(sql); if (/^\s*select/i.test(sql)) return { results: p.all(...args) }; p.run(...args); return { results: [] }; }, async run() { await dl(); return this._run(); }, async all() { await dl(); return this._run(); }, async first() { await dl(); return (this._run().results || [])[0] || null; } });
  return { prepare: sql => stmt(sql), async batch(list) { await dl(); return list.map(s => s._run()); }, exec: sql => d.exec(sql) };
}
