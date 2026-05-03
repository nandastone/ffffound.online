# Phase 0 spike notes

Findings from the May 2017 ArchiveTeam WARC capture, after probing chunks 1 and 5.

## Major finding: ffffound was flapping during the capture

The site was officially shutting down. Across the 8-day capture window
(May 7–15 2017) the server alternated between:

- Live (returns the real HTML page) — title is `FFFFOUND! | <page title>`, page is 5–80 KB
- Maintenance stub (~951 bytes) — title `FFFFOUND! | Sorry!!!`, body is "is under maintanance" (their typo)
- Bare stub (~940 bytes) — title `FFFFOUND!`, same maintenance body
- 404 (~219 bytes) — title `404 Not FFFFOUND!`

Distribution across one full chunk (~100K records):

| label                | count  |
| -------------------- | -----: |
| 404                  | 13,219 |
| FFFFOUND!            |  6,445 |
| Sorry!!!             |  5,237 |
| Real HTML pages      | ~25,000 |
| Image bytes          | 47,392 |

So roughly **a quarter of the WARC records are recoverable HTML pages**, plus
a hefty payload of image bytes. The brief's headline "~3.99M pages" is true
in raw URL count, but a lot of those are stubs or 404s.

The parser's `is_stub()` short-circuits on these so they don't make it to BS4.

## Schema reality vs. the brief

The brief's mental model of ffffound was off in a couple of ways:

1. **No tags.** The `/tagged/<tag>` endpoint had zero hits in 100K records, and
   no `tag` markup is present on image pages. The `tags` / `image_tags` / FTS5
   tag dimension is dead weight for the data we actually have. Kept the tables
   in case a sample of `/tagged/*` URLs turns up later, but search will need
   to lean on **page titles** (which the brief did not anticipate storing) and
   **source-host names** instead.

2. **No "uploader" concept.** Every image is "saved by N users". The first
   chronological saver acts as the de facto uploader. We populate
   `images.uploader` with whichever username we see first, but this is a
   data-quality compromise, not a strict semantic.

3. **No comments.** The brief planned to skip comment text; turns out there's
   no comment surface at all on the captured pages. (The `comment_count`
   column stays as 0 and can be dropped in a 0002 migration.)

4. **What we DO have, that wasn't in the brief:**
   - **Per-image page title** (the `Quoted from:` link text — e.g. "SUICIDE
     BOMBERS FOR JESUS"). This is *the* most useful search dimension we have.
   - **Posted date** (when the image was first saved) — `images.uploaded_at`.
   - **Per-user save date** (when each saver added it) — `saves.saved_at`.
     This comes from user pages, not image pages.
   - **Related images** (`<div class="related_to">`). Free "more like this"
     data from ffffound itself — much cheaper than CLIP embeddings if we just
     want a v1.

## URL patterns confirmed

```
/image/<sha1>                          — image detail (40-char hex id)
/image/<sha1>?c=<num>                  — same, but came in via a save
/home/<user>                           — user root
/home/<user>/found/                    — user's saves
/home/<user>/post/                     — user's posts
/home/<user>/found/offset/<n>/         — paginated saves
/home/<user>/post/?offset=<n>          — paginated posts
/outbound/<hash>                       — link redirector — IGNORE
```

CDN hosts:

```
img.ffffound.com         /static-data/assets/<bucket>/<sha1>_m.jpg     (medium)
img-thumb.ffffound.com   /static-data/assets/<bucket>/<sha1>_s.jpg     (small)
img-thumb.ffffound.com   /static-data/assets/<bucket>/<sha1>_xs.jpg    (xs)
```

The `<bucket>` is a single hex char (so far). The SHA1 in the URL matches the
SHA1 in `/image/<sha1>`. `stitch.py` uses this to wire images→bytes.

## Decisions to make when you're back

These all want a yes/no:

1. **Add `images.title TEXT` (the "Quoted from" page name)?** It's the only
   real string we have to feed FTS5. Without it, search is just usernames and
   source hostnames. → I'd say yes, ship a 0002 migration.

2. **Drop `tags` / `image_tags` / `comment_count` from the schema?** The data
   doesn't exist. → Yes, simplify.

3. **Persist `related_to` edges?** Each image page lists ~10 related images;
   that's cheap to extract and gives "more like this" without ML. → Yes, add
   `image_related (image_id, related_id, position)`.

4. **Two passes or one for the parser?** Currently `extract.py` walks each
   WARC once. Stitching CDN-URL → image_id is a separate `stitch.py` pass.
   This is fine and lets us re-run stitch without re-parsing. → Keep as is.

5. **The April 2017 sanity-check WARC** (22 GB, separate torrent) was earlier
   in the capture — likely has a higher live-page ratio. Worth grabbing to
   fill gaps once the May parse is done? → Probably; defer until we see how
   many unique image_ids the May data covers.

## What the parse run is doing right now

`out/test.db` and `out/test-images/` are populating from chunk 5 of the
ArchiveTeam torrent. Once it finishes:

```bash
python -m parser.stats   out/test.db        # row counts, coverage, top users
python -m parser.stitch  out/test.db        # link CDN bytes to image rows
python -m parser.stats   out/test.db        # rerun to confirm r2_key population
```

Then we can either:
- Dump the SQLite to D1 for a Worker smoke test against real data, or
- Run extract.py over all 12 chunks first (expect ~5–6 hr on this disk).
