"""
Handler for /image/<id> pages.

STUB: real selectors will be filled in during Phase 0 once we can inspect the
HTML in the WARC. The shape of the work — read response body, BeautifulSoup parse,
upsert into images / tags / image_tags / saves — is locked in here so the spike
just needs to drop in CSS selectors.
"""

from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup

from ..dispatch import ParserContext, image_id_from_url


def handle(ctx: ParserContext, *, url: str, content_type: str, record: Any) -> None:
    image_id = image_id_from_url(url)
    if not image_id:
        return

    body = record.content_stream().read()
    soup = BeautifulSoup(body, "lxml")

    # ---- TODO Phase 0: replace placeholders with real selectors ------------
    uploader          = _select_text(soup, ".uploader-username")        # placeholder
    source_url        = _select_attr(soup, "a.source-link", "href")     # placeholder
    cdn_thumbnail_url = _select_attr(soup, "img.detail-image", "src")   # placeholder
    uploaded_at       = None  # parse a date string off the page
    tags              = [a.get_text(strip=True) for a in soup.select("a.tag")]
    savers            = [a.get_text(strip=True) for a in soup.select("a.saver")]
    # -----------------------------------------------------------------------

    db = ctx.db
    if uploader:
        db.execute(
            "INSERT OR IGNORE INTO users (username) VALUES (?)",
            (uploader,),
        )
    db.execute(
        """INSERT INTO images
             (image_id, uploader, source_url, cdn_thumbnail_url, uploaded_at, save_count)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(image_id) DO UPDATE SET
             uploader          = excluded.uploader,
             source_url        = COALESCE(excluded.source_url, images.source_url),
             cdn_thumbnail_url = COALESCE(excluded.cdn_thumbnail_url, images.cdn_thumbnail_url),
             uploaded_at       = COALESCE(excluded.uploaded_at, images.uploaded_at),
             save_count        = MAX(excluded.save_count, images.save_count)""",
        (image_id, uploader or "_unknown", source_url, cdn_thumbnail_url, uploaded_at, len(savers)),
    )

    for tag in tags:
        db.execute("INSERT OR IGNORE INTO tags (tag) VALUES (?)", (tag,))
        db.execute(
            "INSERT OR IGNORE INTO image_tags (image_id, tag) VALUES (?, ?)",
            (image_id, tag),
        )

    for saver in savers:
        db.execute("INSERT OR IGNORE INTO users (username) VALUES (?)", (saver,))
        db.execute(
            "INSERT OR IGNORE INTO saves (image_id, username) VALUES (?, ?)",
            (image_id, saver),
        )


def _select_text(soup: BeautifulSoup, sel: str) -> str | None:
    el = soup.select_one(sel)
    return el.get_text(strip=True) if el else None


def _select_attr(soup: BeautifulSoup, sel: str, attr: str) -> str | None:
    el = soup.select_one(sel)
    return el.get(attr) if el else None
