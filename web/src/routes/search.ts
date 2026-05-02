import type { Context } from "hono";
import { html } from "hono/html";
import type { Env, ImageRow } from "../types";
import { Layout } from "../layout";

export async function searchRoute(c: Context<{ Bindings: Env }>) {
  const q = (c.req.query("q") ?? "").trim();

  let results: Array<Pick<ImageRow, "image_id" | "uploader" | "r2_key" | "cdn_thumbnail_url">> = [];

  if (q) {
    // FTS5 MATCH. We escape with double-quotes to treat the input as a phrase
    // (avoids users accidentally hitting the FTS5 query language with a stray colon).
    const escaped = `"${q.replace(/"/g, '""')}"`;
    const rs = await c.env.DB.prepare(
      `SELECT i.image_id, i.uploader, i.r2_key, i.cdn_thumbnail_url
       FROM images_fts f
       JOIN images i ON i.image_id = f.image_id
       WHERE images_fts MATCH ?
       ORDER BY rank
       LIMIT 60`
    )
      .bind(escaped)
      .all<Pick<ImageRow, "image_id" | "uploader" | "r2_key" | "cdn_thumbnail_url">>();
    results = rs.results;
  }

  return c.html(
    Layout({
      title: q ? `search: ${q}` : "search",
      children: html`
        <h2 style="margin:0 0 12px">${q ? html`results for "${q}"` : html`search`}</h2>
        ${q && results.length === 0 ? html`<p>no matches</p>` : ""}
        <div class="grid">
          ${results.map(
            (row) => html`
              <figure>
                <a href="/image/${row.image_id}">
                  <img loading="lazy" src="${row.r2_key ? `/img/${row.r2_key}` : row.cdn_thumbnail_url ?? ""}" alt="" />
                </a>
                <figcaption class="meta"><a href="/user/${row.uploader}">${row.uploader}</a></figcaption>
              </figure>
            `
          )}
        </div>
      `,
    })
  );
}
