"""
Handler for /home/<user>/post/ and /home/<user>/found/ paginated pages.

These are the richest source of structured data: each <blockquote class="asset">
on a user page is a save event with image_id + per-user save date + source URL +
total save count. Image pages don't carry per-saver dates, so user pages are
where most of the relational scaffolding gets built.

A page also implicitly confirms the user exists.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Optional

from bs4 import BeautifulSoup

from ..dispatch import ParserContext, username_from_url, is_stub


_RE_IMAGE_ID = re.compile(r"/image/([0-9a-f]{40})")
_RE_DESC_DATE = re.compile(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})")
_RE_DESC_COUNT = re.compile(r"saved by (\d+)\s+(?:person|people)")


def handle(ctx: ParserContext, *, url: str, content_type: str, record: Any) -> None:
    username = username_from_url(url)
    if not username:
        return

    body = record.content_stream().read()
    if is_stub(body):
        return

    soup = BeautifulSoup(body, "html.parser")
    db = ctx.db

    # Confirm user exists.
    db.execute("INSERT OR IGNORE INTO users (username) VALUES (?)", (username,))

    for asset in soup.select("blockquote.asset"):
        title_link = asset.select_one("div.title a[id$='-link']")
        if not title_link:
            continue

        # Image id comes from the per-asset "saved by N people" link OR the
        # asset's blockquote id; check both.
        image_id = _extract_image_id(asset)
        if not image_id:
            continue

        title         = title_link.get_text(strip=True)
        source_url    = title_link.get("href")
        desc          = asset.select_one("div.description")
        desc_text     = desc.get_text(" ", strip=True) if desc else ""
        saved_at      = _parse_date(desc_text)
        save_count    = _parse_save_count(desc_text)

        # Image upsert (the user page may be the first time we've seen this image).
        db.execute(
            """INSERT INTO images
                 (image_id, uploader, source_url, save_count)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(image_id) DO UPDATE SET
                 source_url = COALESCE(excluded.source_url, images.source_url),
                 save_count = MAX(excluded.save_count, images.save_count)""",
            (image_id, username, source_url, save_count or 0),
        )

        # Save event for THIS user. We have the per-user date here.
        db.execute(
            """INSERT INTO saves (image_id, username, saved_at) VALUES (?, ?, ?)
               ON CONFLICT(image_id, username) DO UPDATE SET
                 saved_at = COALESCE(excluded.saved_at, saves.saved_at)""",
            (image_id, username, saved_at),
        )


def _extract_image_id(asset) -> Optional[str]:
    # Preferred: the "saved by N people" anchor links to /image/<sha1>?c=<id>
    info = asset.select_one("a[id$='-info']")
    if info:
        m = _RE_IMAGE_ID.search(info.get("href", ""))
        if m:
            return m.group(1).lower()
    # Fallback: any anchor inside this asset that links to an image page
    for a in asset.select("a[href]"):
        m = _RE_IMAGE_ID.search(a.get("href", ""))
        if m:
            return m.group(1).lower()
    return None


def _parse_date(text: str) -> Optional[int]:
    m = _RE_DESC_DATE.search(text or "")
    if not m:
        return None
    try:
        dt = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        return int(dt.timestamp())
    except ValueError:
        return None


def _parse_save_count(text: str) -> Optional[int]:
    m = _RE_DESC_COUNT.search(text or "")
    return int(m.group(1)) if m else None
