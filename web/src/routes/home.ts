import type { Context } from "hono";
import { html } from "hono/html";
import type { Env, ImageRow } from "../types";
import { Layout } from "../layout";
import { renderListAsset } from "./_asset_block";
import { absUrl, imgUrl } from "./_url";

const PAGE = 25;
// "Top" is a volatile recent-saves firehose, so deep pages carry no stable
// indexing value (item discovery is the sitemap's job) and deep offsets cost
// O(offset) to compute. Cap the depth; beyond it we 404 so the offset parameter
// is a finite space rather than an infinite crawl trap.
const MAX_OFFSET = 500;

export async function homeRoute(c: Context<{ Bindings: Env }>) {
  const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;
  if (offset < 0 || offset > MAX_OFFSET) return c.notFound();

  // Original ffffound's "Top" was a recent-saves firehose. The naive query
  // (GROUP BY image_id with MAX(saved_at)) blows past D1's 30-second timeout
  // on 6.5M saves. Instead: walk the saves table in saved_at-DESC order via
  // the existing index, dedupe by image_id in JS, return PAGE rows.
  // Worst-case fetch is PAGE * over-fetch_factor; a few savers re-saving the
  // same hot image don't blow the budget.
  const overFetch = (offset + PAGE) * 4;  // grow with offset; supports paging
  const { results: saveRows } = await c.env.DB.prepare(
    `SELECT i.image_id, i.uploader, i.title, i.source_url, i.cdn_thumbnail_url,
            i.r2_key, i.width, i.height, i.uploaded_at, i.save_count,
            s.saved_at AS last_save
     FROM saves s
     JOIN images i ON i.image_id = s.image_id
     WHERE s.saved_at IS NOT NULL
     ORDER BY s.saved_at DESC
     LIMIT ?`
  )
    .bind(overFetch)
    .all<ImageRow & { last_save: number }>();

  // Dedupe by image_id, keep first occurrence (= most recent save event).
  const seen = new Set<string>();
  const deduped: typeof saveRows = [];
  for (const row of saveRows) {
    if (seen.has(row.image_id)) continue;
    seen.add(row.image_id);
    deduped.push(row);
  }
  const results = deduped.slice(offset, offset + PAGE);

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
  const ogImage = hero?.r2_key ? imgUrl(c, hero.r2_key) : undefined;

  return c.html(
    Layout({
      title: offset > 0 ? `Top — page ${Math.floor(offset / PAGE) + 1}` : "Top",
      titleBlock,
      env: c.env,
      meta: {
        description: "FFFFOUND! preserved. The 2007–2017 image bookmarking site, browsable again. 1.28M images, 12K curators, ten years of internet aesthetic.",
        canonical: absUrl(c, offset > 0 ? `/?offset=${offset}` : "/"),
        ogType: "website",
        ogImage,
        prev: offset > 0 ? absUrl(c, offset - PAGE > 0 ? `/?offset=${offset - PAGE}` : "/") : null,
        next: results.length === PAGE && offset + PAGE <= MAX_OFFSET ? absUrl(c, `/?offset=${offset + PAGE}`) : null,
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
${results.map((row) => renderListAsset(c, row, relatedBySource.get(row.image_id) ?? []))}
</div>
${results.length === PAGE && offset + PAGE <= MAX_OFFSET
  ? html`<div style="margin:40px 0;padding-left:20px"><a href="/?offset=${offset + PAGE}">next →</a></div>`
  : ""}
      `,
    })
  );
}
