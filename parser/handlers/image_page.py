"""
Handler for /image/<sha1> pages.

Extracts: image_id, title (the "Quoted from:" page name), source_url (deep link),
posted_at, savers list, and related_to edges.

Selectors are real (Phase 0 spike confirmed against live captures).
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Optional

from bs4 import BeautifulSoup

from ..dispatch import ParserContext, image_id_from_url, is_stub


_RE_DATE = re.compile(r"posted on (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})")
_RE_SAVER_HREF = re.compile(r"^/home/([^/]+)/found/?$", re.I)
_RE_RELATED_HREF = re.compile(r"/image/([0-9a-f]{40})")


def handle(ctx: ParserContext, *, url: str, content_type: str, record: Any) -> None:
    image_id = image_id_from_url(url)
    if not image_id:
        return

    body = record.content_stream().read()
    if is_stub(body):
        return

    soup = BeautifulSoup(body, "html.parser")

    asset = soup.select_one("blockquote.asset")
    if not asset:
        return

    # ---- title (the "Quoted from:" link text) ------------------------------
    title_link = asset.select_one("div.title a[id$='-link']")
    title = title_link.get_text(strip=True) if title_link else None

    # ---- source URL: prefer the deep image link, fall back to title link ---
    src_link = asset.select_one("a[id$='-link-img']") or title_link
    source_url = src_link.get("href") if src_link else None

    # ---- main image src ----------------------------------------------------
    img_el = asset.select_one("img[id^='asset'][id$='-img']")
    cdn_thumbnail_url = img_el.get("src") if img_el else None
    width  = _maybe_int(img_el.get("width"))  if img_el else None
    height = _maybe_int(img_el.get("height")) if img_el else None

    # ---- "posted on YYYY-MM-DD HH:MM:SS" -----------------------------------
    date_el = asset.select_one("div.date")
    posted_at = _parse_posted(date_el.get_text(strip=True)) if date_el else None

    # ---- savers list -------------------------------------------------------
    saver_block = asset.select_one("div.saved_by")
    savers: list[str] = []
    if saver_block:
        for a in saver_block.select("a[href]"):
            m = _RE_SAVER_HREF.match(a.get("href", ""))
            if m:
                savers.append(m.group(1))
    save_count = _extract_save_count(saver_block)

    # ---- "you may like these" related images -------------------------------
    related_block = asset.select_one("div.related_to")
    related_ids: list[str] = []
    if related_block:
        seen = set()
        for a in related_block.select("a[href]"):
            m = _RE_RELATED_HREF.search(a.get("href", ""))
            if m:
                rid = m.group(1).lower()
                if rid != image_id and rid not in seen:
                    seen.add(rid)
                    related_ids.append(rid)

    # ---- DB upserts --------------------------------------------------------
    db = ctx.db
    db.execute(
        """INSERT INTO images
             (image_id, uploader, title, source_url, cdn_thumbnail_url,
              width, height, uploaded_at, save_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(image_id) DO UPDATE SET
             title             = COALESCE(excluded.title,             images.title),
             source_url        = COALESCE(excluded.source_url,        images.source_url),
             cdn_thumbnail_url = COALESCE(excluded.cdn_thumbnail_url, images.cdn_thumbnail_url),
             width             = COALESCE(excluded.width,             images.width),
             height            = COALESCE(excluded.height,            images.height),
             uploaded_at       = COALESCE(excluded.uploaded_at,       images.uploaded_at),
             save_count        = MAX(excluded.save_count, images.save_count)""",
        (
            image_id,
            savers[0] if savers else "_unknown",
            title,
            source_url,
            cdn_thumbnail_url,
            width,
            height,
            posted_at,
            max(save_count or 0, len(savers)),
        ),
    )

    for u in savers:
        db.execute("INSERT OR IGNORE INTO users (username) VALUES (?)", (u,))
        db.execute(
            "INSERT OR IGNORE INTO saves (image_id, username, saved_at) VALUES (?, ?, ?)",
            (image_id, u, None),
        )

    for pos, rid in enumerate(related_ids):
        # Insert a placeholder image row for the related id if it's brand new,
        # so the FK is happy (we'll fill in details when we encounter it).
        db.execute(
            "INSERT OR IGNORE INTO images (image_id, uploader) VALUES (?, '_unknown')",
            (rid,),
        )
        db.execute(
            """INSERT INTO image_related (image_id, related_id, position)
               VALUES (?, ?, ?)
               ON CONFLICT(image_id, related_id) DO UPDATE SET position = excluded.position""",
            (image_id, rid, pos),
        )


def _parse_posted(text: str) -> Optional[int]:
    m = _RE_DATE.search(text or "")
    if not m:
        return None
    try:
        dt = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        return int(dt.timestamp())
    except ValueError:
        return None


def _extract_save_count(block) -> Optional[int]:
    if not block:
        return None
    span = block.select_one("span.saved_by")
    if not span:
        return None
    m = re.search(r"saved by (\d+)\s+(?:person|people)", span.get_text(strip=True))
    return int(m.group(1)) if m else None


def _maybe_int(s) -> Optional[int]:
    try:
        return int(s) if s is not None else None
    except (TypeError, ValueError):
        return None
