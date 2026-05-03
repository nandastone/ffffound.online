import type { Context } from "hono";
import { html } from "hono/html";
import type { Env, UserRow, ImageRow } from "../types";
import { Layout } from "../layout";

export async function userRoute(c: Context<{ Bindings: Env }>) {
  const username = c.req.param("name");

  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE username = ?`
  )
    .bind(username)
    .first<UserRow>();

  if (!user) return c.notFound();

  const { results } = await c.env.DB.prepare(
    `SELECT i.image_id, i.uploader, i.title, i.r2_key, i.cdn_thumbnail_url
     FROM saves s
     JOIN images i ON i.image_id = s.image_id
     WHERE s.username = ?
     ORDER BY s.saved_at DESC
     LIMIT 120`
  )
    .bind(username)
    .all<Pick<ImageRow, "image_id" | "uploader" | "title" | "r2_key" | "cdn_thumbnail_url">>();

  return c.html(
    Layout({
      title: username,
      children: html`
        <header style="margin-bottom:16px">
          <h2 style="margin:0">${user.display_name ?? user.username}</h2>
          <p class="meta">@${user.username} · ${user.save_count} saves</p>
          ${user.bio ? html`<p style="max-width:60ch">${user.bio}</p>` : ""}
        </header>
        <div class="grid">
          ${results.map(
            (row) => html`
              <figure>
                <a href="/image/${row.image_id}">
                  <img loading="lazy" src="${row.r2_key ? `/img/${row.r2_key}` : row.cdn_thumbnail_url ?? ""}" alt="${row.title ?? ""}" />
                </a>
              </figure>
            `
          )}
        </div>
      `,
    })
  );
}
