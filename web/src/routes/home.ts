import type { Context } from "hono";
import { html } from "hono/html";
import type { Env, ImageRow } from "../types";
import { Layout } from "../layout";

export async function homeRoute(c: Context<{ Bindings: Env }>) {
  const { results } = await c.env.DB.prepare(
    `SELECT image_id, uploader, r2_key, cdn_thumbnail_url, width, height, uploaded_at
     FROM images
     ORDER BY uploaded_at DESC
     LIMIT 60`
  ).all<Pick<ImageRow, "image_id" | "uploader" | "r2_key" | "cdn_thumbnail_url" | "width" | "height" | "uploaded_at">>();

  return c.html(
    Layout({
      title: "top",
      children: html`
        <h2 style="margin:0 0 12px;font-size:13px;text-transform:uppercase;opacity:0.5;letter-spacing:0.06em">top</h2>
        <div class="grid">
          ${results.map(
            (row) => html`
              <figure>
                <a href="/image/${row.image_id}">
                  <img loading="lazy" src="${thumbSrc(row)}" alt="" />
                </a>
                <figcaption class="meta">
                  <a href="/home/${row.uploader}">${row.uploader}</a>
                </figcaption>
              </figure>
            `
          )}
        </div>
      `,
    })
  );
}

function thumbSrc(row: { r2_key: string | null; cdn_thumbnail_url: string | null }): string {
  if (row.r2_key) return `/img/${row.r2_key}`;
  return row.cdn_thumbnail_url ?? "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>";
}
