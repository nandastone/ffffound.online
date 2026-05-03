-- ffffound preservation site — initial schema.
--
-- The goal is faithful reconstruction of the original ffffound (defunct 2017),
-- not a new site over its data. Schema reflects what the site actually had:
--   - Images with a "Quoted from: <title>" source link
--   - Users who "save" images
--   - "You may like these" related-image recommendations
-- No tags, no comments, no search box (the original had none of those).
--
-- Target: Cloudflare D1 (SQLite). All DDL is idempotent so we can re-run during dev.

CREATE TABLE IF NOT EXISTS users (
  username      TEXT PRIMARY KEY,
  display_name  TEXT,
  joined_at     INTEGER,                  -- unix epoch seconds
  bio           TEXT,
  save_count    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS images (
  image_id          TEXT PRIMARY KEY,     -- ffffound's SHA1 image id
  uploader          TEXT NOT NULL,        -- effective uploader = first chronological saver
  title             TEXT,                 -- the "Quoted from:" link text (page name at the source)
  source_url        TEXT,                 -- original hot-linked URL (often dead)
  source_dead       INTEGER NOT NULL DEFAULT 0,  -- bool, populated by later HEAD-check pass
  cdn_thumbnail_url TEXT,                 -- ffffound's own CDN thumb URL (if captured)
  r2_key            TEXT,                 -- key into R2 where we stored bytes; NULL if missing
  width             INTEGER,
  height            INTEGER,
  uploaded_at       INTEGER,              -- "posted on" date from image page
  save_count        INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (uploader) REFERENCES users(username)
);

CREATE INDEX IF NOT EXISTS idx_images_uploader    ON images(uploader);
CREATE INDEX IF NOT EXISTS idx_images_uploaded_at ON images(uploaded_at DESC);

CREATE TABLE IF NOT EXISTS saves (
  image_id  TEXT NOT NULL,
  username  TEXT NOT NULL,
  saved_at  INTEGER,                       -- when THIS user saved it (from user pages)
  PRIMARY KEY (image_id, username),
  FOREIGN KEY (image_id) REFERENCES images(image_id),
  FOREIGN KEY (username) REFERENCES users(username)
);

CREATE INDEX IF NOT EXISTS idx_saves_username ON saves(username);
CREATE INDEX IF NOT EXISTS idx_saves_saved_at ON saves(saved_at DESC);

-- "You may like these" edges from image-detail pages. Directed and ordered:
-- image_page A shows related_id B at position N. Not necessarily symmetric.
CREATE TABLE IF NOT EXISTS image_related (
  image_id    TEXT NOT NULL,
  related_id  TEXT NOT NULL,
  position    INTEGER NOT NULL,            -- 0..N, the order they appeared on the page
  PRIMARY KEY (image_id, related_id),
  FOREIGN KEY (image_id)   REFERENCES images(image_id),
  FOREIGN KEY (related_id) REFERENCES images(image_id)
);

CREATE INDEX IF NOT EXISTS idx_image_related_image ON image_related(image_id, position);

-- Tracking table for the parser: which WARC files (and offsets) have been processed.
-- Lets us re-run extract.py and pick up where we left off.
CREATE TABLE IF NOT EXISTS warc_progress (
  warc_path     TEXT PRIMARY KEY,
  last_offset   INTEGER NOT NULL DEFAULT 0,
  records_seen  INTEGER NOT NULL DEFAULT 0,
  finished_at   INTEGER
);
