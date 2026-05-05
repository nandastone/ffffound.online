import type { Context } from "hono";
import { html } from "hono/html";
import type { Env, UserRow, ImageRow } from "../types";
import { Layout } from "../layout";
import { renderListAsset } from "./_asset_block";
import { absUrl } from "./_url";

const PAGE = 25;

export async function userRoute(c: Context<{ Bindings: Env }>) {
  const username = c.req.param("name");
  const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;

  const user = await c.env.DB.prepare(`SELECT * FROM users WHERE username = ?`)
    .bind(username)
    .first<UserRow>();
  if (!user) return c.notFound();

  const { results } = await c.env.DB.prepare(
    `SELECT i.* FROM saves s
     JOIN images i ON i.image_id = s.image_id
     WHERE s.username = ?
     ORDER BY s.saved_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(username, PAGE, offset)
    .all<ImageRow>();

  const ids = results.map((r) => r.image_id);
  const placeholders = ids.length ? ids.map(() => "?").join(",") : "''";
  const relatedRs = await c.env.DB.prepare(
    `SELECT r.image_id AS source_id, i.image_id, i.r2_key, i.cdn_thumbnail_url, r.position
     FROM image_related r
     JOIN images i ON i.image_id = r.related_id
     WHERE r.image_id IN (${placeholders})
     ORDER BY r.image_id, r.position
     LIMIT 1000`
  )
    .bind(...ids)
    .all<{ source_id: string; image_id: string; r2_key: string | null; cdn_thumbnail_url: string | null; position: number }>();

  const relatedBySource = new Map<string, Array<{ image_id: string; r2_key: string | null; cdn_thumbnail_url: string | null }>>();
  for (const r of relatedRs.results) {
    const list = relatedBySource.get(r.source_id) ?? [];
    if (list.length < 5) list.push(r);
    relatedBySource.set(r.source_id, list);
  }

  const titleBlock = html`
    <h1 style="margin:0;font-size:24px;font-weight:normal">${user.display_name ?? user.username}</h1>
    <h2 style="font-size:14px;color:#909090">@${user.username} · ${user.save_count} saves
      ${user.joined_at ? html` · joined ${new Date(user.joined_at * 1000).toISOString().slice(0, 7)}` : ""}
    </h2>
    ${user.bio ? html`<p style="max-width:60ch">${user.bio}</p>` : ""}
  `;

  const hero = results.find((r) => r.r2_key);
  const ogImage = hero?.r2_key ? absUrl(c, `/img/${hero.r2_key}`) : undefined;
  const userPath = `/home/${username}`;

  return c.html(
    Layout({
      title: `${user.display_name ?? user.username} (@${user.username})`,
      titleBlock,
      meta: {
        description: `${user.save_count.toLocaleString()} images saved by ${user.username} on FFFFOUND!`,
        canonical: absUrl(c, offset > 0 ? `${userPath}?offset=${offset}` : userPath),
        ogType: "website",
        ogImage,
        prev: offset > 0 ? absUrl(c, offset - PAGE > 0 ? `${userPath}?offset=${offset - PAGE}` : userPath) : null,
        next: results.length === PAGE ? absUrl(c, `${userPath}?offset=${offset + PAGE}`) : null,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          "url": absUrl(c, userPath),
          "name": user.display_name ?? user.username,
          "mainEntity": {
            "@type": "Person",
            "name": user.display_name ?? user.username,
            "alternateName": user.username,
            ...(user.bio ? { "description": user.bio } : {}),
            ...(user.joined_at ? { "memberOf": { "@type": "Organization", "name": "FFFFOUND!", "foundingDate": new Date(user.joined_at * 1000).toISOString() } } : {}),
          },
        },
      },
      children: html`
<div id="assets">
${results.map((row) => renderListAsset(row, relatedBySource.get(row.image_id) ?? []))}
</div>
${results.length === PAGE
  ? html`<div style="margin:40px 0;padding-left:20px"><a href="/home/${username}/found?offset=${offset + PAGE}">next →</a></div>`
  : ""}
      `,
    })
  );
}
