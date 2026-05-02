-- ffffound preservation site — initial schema
-- Target: Cloudflare D1 (SQLite). Keep all DDL idempotent so we can re-run during dev.

CREATE TABLE IF NOT EXISTS users (
  username      TEXT PRIMARY KEY,
  display_name  TEXT,
  joined_at     INTEGER,                  -- unix epoch seconds
  bio           TEXT,
  save_count    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS images (
  image_id          TEXT PRIMARY KEY,     -- ffffound's internal id (string to be safe)
  uploader          TEXT NOT NULL,
  source_url        TEXT,                 -- original hot-linked URL (often dead)
  source_dead       INTEGER NOT NULL DEFAULT 0,  -- bool, populated by later HEAD-check pass
  cdn_thumbnail_url TEXT,                 -- ffffound's own CDN thumb URL (if captured)
  r2_key            TEXT,                 -- key into R2 where we stored bytes; NULL if missing
  width             INTEGER,
  height            INTEGER,
  uploaded_at       INTEGER,
  comment_count     INTEGER NOT NULL DEFAULT 0,
  save_count        INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (uploader) REFERENCES users(username)
);

CREATE INDEX IF NOT EXISTS idx_images_uploader    ON images(uploader);
CREATE INDEX IF NOT EXISTS idx_images_uploaded_at ON images(uploaded_at DESC);

CREATE TABLE IF NOT EXISTS saves (
  image_id  TEXT NOT NULL,
  username  TEXT NOT NULL,
  saved_at  INTEGER,
  PRIMARY KEY (image_id, username),
  FOREIGN KEY (image_id) REFERENCES images(image_id),
  FOREIGN KEY (username) REFERENCES users(username)
);

CREATE INDEX IF NOT EXISTS idx_saves_username ON saves(username);
CREATE INDEX IF NOT EXISTS idx_saves_saved_at ON saves(saved_at DESC);

CREATE TABLE IF NOT EXISTS tags (
  tag        TEXT PRIMARY KEY,
  use_count  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS image_tags (
  image_id  TEXT NOT NULL,
  tag       TEXT NOT NULL,
  PRIMARY KEY (image_id, tag),
  FOREIGN KEY (image_id) REFERENCES images(image_id),
  FOREIGN KEY (tag)      REFERENCES tags(tag)
);

CREATE INDEX IF NOT EXISTS idx_image_tags_tag ON image_tags(tag);

-- FTS5 virtual table for /search. We index uploader + tags + a denormalized text blob.
-- Populated by triggers below so the parser doesn't have to think about it.
CREATE VIRTUAL TABLE IF NOT EXISTS images_fts USING fts5(
  image_id UNINDEXED,
  uploader,
  tags_text,
  tokenize = 'porter unicode61'
);

-- Tracking table for the parser: which WARC files (and offsets) have been processed.
-- Lets us re-run extract.py and pick up where we left off.
CREATE TABLE IF NOT EXISTS warc_progress (
  warc_path     TEXT PRIMARY KEY,
  last_offset   INTEGER NOT NULL DEFAULT 0,
  records_seen  INTEGER NOT NULL DEFAULT 0,
  finished_at   INTEGER
);
