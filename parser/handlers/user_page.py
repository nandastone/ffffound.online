"""
Handler for /home/<username> pages.

STUB: real selectors filled in during Phase 0. The intent is that the user page
mostly confirms users we've already seen on image pages, plus contributes the
display name / bio / join date if those exist.
"""

from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup

from ..dispatch import ParserContext, username_from_url


def handle(ctx: ParserContext, *, url: str, content_type: str, record: Any) -> None:
    username = username_from_url(url)
    if not username:
        return

    body = record.content_stream().read()
    soup = BeautifulSoup(body, "lxml")

    # ---- TODO Phase 0 ------------------------------------------------------
    display_name = None  # soup.select_one(".display-name") etc.
    bio          = None
    joined_at    = None
    # -----------------------------------------------------------------------

    ctx.db.execute(
        """INSERT INTO users (username, display_name, bio, joined_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(username) DO UPDATE SET
             display_name = COALESCE(excluded.display_name, users.display_name),
             bio          = COALESCE(excluded.bio,          users.bio),
             joined_at    = COALESCE(excluded.joined_at,    users.joined_at)""",
        (username, display_name, bio, joined_at),
    )
