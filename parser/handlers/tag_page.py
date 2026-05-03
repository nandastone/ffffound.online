"""
Handler for /tagged/<tag> pages.

Phase 0 spike: zero /tagged/* URLs in 100K WARC records. ffffound's UI doesn't
appear to expose tag pages (or they exist but ArchiveTeam didn't crawl them).
Left as a no-op stub so dispatch.py stays consistent if any do show up.
"""

from __future__ import annotations

from typing import Any

from ..dispatch import ParserContext, tag_from_url, is_stub


def handle(ctx: ParserContext, *, url: str, content_type: str, record: Any) -> None:
    tag = tag_from_url(url)
    if not tag:
        return
    body = record.content_stream().read()
    if is_stub(body):
        return
    ctx.db.execute("INSERT OR IGNORE INTO tags (tag) VALUES (?)", (tag,))
