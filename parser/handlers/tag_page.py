"""
Handler for /tagged/<tag> pages.

These pages are listings, not the source of truth for tag→image mapping (that
comes from individual /image/<id> pages). We use them to populate the tag's
use_count and confirm the tag exists.
"""

from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup

from ..dispatch import ParserContext, tag_from_url


def handle(ctx: ParserContext, *, url: str, content_type: str, record: Any) -> None:
    tag = tag_from_url(url)
    if not tag:
        return

    body = record.content_stream().read()
    soup = BeautifulSoup(body, "lxml")

    # ---- TODO Phase 0 ------------------------------------------------------
    # Some tag pages show a count somewhere; if not, leave use_count alone and
    # let a later SQL pass set it from image_tags.
    use_count = None
    # -----------------------------------------------------------------------

    if use_count is None:
        ctx.db.execute("INSERT OR IGNORE INTO tags (tag) VALUES (?)", (tag,))
    else:
        ctx.db.execute(
            """INSERT INTO tags (tag, use_count) VALUES (?, ?)
               ON CONFLICT(tag) DO UPDATE SET use_count = MAX(excluded.use_count, tags.use_count)""",
            (tag, use_count),
        )
