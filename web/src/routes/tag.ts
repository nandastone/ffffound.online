import type { Context } from "hono";
import { html } from "hono/html";
import type { Env, ImageRow } from "../types";
import { Layout } from "../layout";

export async function tagRoute(c: Context<{ Bindings: Env }>) {
  const tag = decodeURIComponent(c.req.param("tag"));

  const tagRow = await c.env.DB.prepare(
    `SELECT tag, use_count FROM tags WHERE tag = ?`
  )
    .bind(tag)
    .first<{ tag: string; use_count: number }>();

  if (!tagRow) return c.notFound();

  const { results } = await c.env.DB.prepare(
    `SELECT i.image_id, i.uploader, i.r2_key, i.cdn_thumbnail_url
     FROM image_tags it
     JOIN images i ON i.image_id = it.image_id
     WHERE it.tag = ?
     ORDER BY i.uploaded_at DESC
     LIMIT 120`
  )
    .bind(tag)
    .all<Pick<ImageRow, "image_id" | "uploader" | "r2_key" | "cdn_thumbnail_url">>();

  return c.html(
    Layout({
      title: `#${tag}`,
      children: html`
        <header style="margin-bottom:16px">
          <h2 style="margin:0">#${tag}</h2>
          <p class="meta">${tagRow.use_count} images</p>
        </header>
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
