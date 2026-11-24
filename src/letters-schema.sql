-- Folio Letters: D1 schema
-- Privacy rule: no table ever holds both a writer's FID and a letter.

CREATE TABLE IF NOT EXISTS letters (
  id           TEXT PRIMARY KEY,          -- random id
  body         TEXT NOT NULL,
  tag          TEXT NOT NULL,             -- pain | joy | win | confession | other
  mbox_hash    TEXT NOT NULL,             -- sha256 of a key that lives only on the writer's phone
  publish_at   INTEGER NOT NULL,          -- unix seconds, rounded to the next batch (no exact write time is stored)
  views        INTEGER NOT NULL DEFAULT 0,
  hugs         INTEGER NOT NULL DEFAULT 0,
  reports      INTEGER NOT NULL DEFAULT 0,
  hidden       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS letters_pick ON letters (hidden, publish_at, views);
CREATE INDEX IF NOT EXISTS letters_mbox ON letters (mbox_hash);

-- One letter per FID per day. Only the date, never the time, never the letter id.
CREATE TABLE IF NOT EXISTS daily_quota (
  fid  INTEGER NOT NULL,
  day  TEXT NOT NULL,                     -- YYYY-MM-DD (UTC)
  PRIMARY KEY (fid, day)
);

-- Which letters a READER received (never the writer). Wiped after 7 days.
CREATE TABLE IF NOT EXISTS deliveries (
  fid        INTEGER NOT NULL,
  day        TEXT NOT NULL,
  letter_id  TEXT NOT NULL,
  hugged     INTEGER NOT NULL DEFAULT 0,
  reported   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (fid, letter_id)
);
CREATE INDEX IF NOT EXISTS deliveries_day ON deliveries (fid, day);
