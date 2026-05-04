import type { Context } from "hono";
import { html } from "hono/html";
import type { Env, ImageRow } from "../types";
import { Layout } from "../layout";
import { renderListAsset } from "./_asset_block";

export async function homeRoute(c: Context<{ Bindings: Env }>) {
  const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;
  const PAGE = 25;

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

  // For each asset, fetch up to 5 related thumbnails (the vline column).
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

  return c.html(
    Layout({
      title: "Top",
      titleBlock,
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
