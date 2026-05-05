import type { Context } from "hono";
import { html } from "hono/html";
import type { Env, ImageRow } from "../types";
import { Layout } from "../layout";
import { renderListAsset } from "./_asset_block";
import { absUrl } from "./_url";

const PAGE = 25;

export async function homeRoute(c: Context<{ Bindings: Env }>) {
  const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;

  const { results } = await c.env.DB.prepare(
    `SELECT i.image_id, i.uploader, i.title, i.source_url, i.cdn_thumbnail_url,
            i.r2_key, i.width, i.height, i.uploaded_at, i.save_count,
            MAX(s.saved_at) AS last_save
     FROM images i
     JOIN saves s ON s.image_id = i.image_id
     WHERE s.saved_at IS NOT NULL
     GROUP BY i.image_id
     ORDER BY last_save DESC
     LIMIT ? OFFSET ?`
  )
    .bind(PAGE, offset)
    .all<ImageRow & { last_save: number }>();

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

  const titleBlock = html`<h1 style="margin:0;font-size:24px;font-weight:normal">Top</h1>`;

  // Hero image for og:image: first image in the feed that has bytes.
  const hero = results.find((r) => r.r2_key);
  const ogImage = hero?.r2_key ? absUrl(c, `/img/${hero.r2_key}`) : undefined;

  return c.html(
    Layout({
      title: offset > 0 ? `Top — page ${Math.floor(offset / PAGE) + 1}` : "Top",
      titleBlock,
      meta: {
        description: "FFFFOUND! preserved. The 2007–2017 image bookmarking site, browsable again. 1.28M images, 12K curators, ten years of internet aesthetic.",
        canonical: absUrl(c, offset > 0 ? `/?offset=${offset}` : "/"),
        ogType: "website",
        ogImage,
        prev: offset > 0 ? absUrl(c, offset - PAGE > 0 ? `/?offset=${offset - PAGE}` : "/") : null,
        next: results.length === PAGE ? absUrl(c, `/?offset=${offset + PAGE}`) : null,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": "FFFFOUND! — Top",
          "url": absUrl(c, "/"),
          "description": "Recent saves on FFFFOUND!",
        },
      },
      children: html`
<div id="assets">
${results.map((row) => renderListAsset(row, relatedBySource.get(row.image_id) ?? []))}
</div>
${results.length === PAGE
  ? html`<div style="margin:40px 0;padding-left:20px"><a href="/?offset=${offset + PAGE}">next →</a></div>`
  : ""}
      `,
    })
  );
}
