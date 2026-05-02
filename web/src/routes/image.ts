import type { Context } from "hono";
import { html } from "hono/html";
import type { Env, ImageRow } from "../types";
import { Layout } from "../layout";

export async function imageRoute(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");

  const image = await c.env.DB.prepare(
    `SELECT * FROM images WHERE image_id = ?`
  )
    .bind(id)
    .first<ImageRow>();

  if (!image) return c.notFound();

  // Two follow-up queries in parallel — both are tiny and well-indexed.
  const [tagsResult, saversResult] = await Promise.all([
    c.env.DB.prepare(`SELECT tag FROM image_tags WHERE image_id = ? ORDER BY tag`)
      .bind(id)
      .all<{ tag: string }>(),
    c.env.DB.prepare(
      `SELECT username FROM saves WHERE image_id = ? ORDER BY saved_at DESC LIMIT 50`
    )
      .bind(id)
      .all<{ username: string }>(),
  ]);

  const tags = tagsResult.results.map((r) => r.tag);
  const savers = saversResult.results.map((r) => r.username);

  return c.html(
    Layout({
      title: `image ${image.image_id}`,
      children: html`
        <article class="image-detail">
          <div>
            ${image.r2_key
              ? html`<img src="/img/${image.r2_key}" alt="" />`
              : html`<p style="opacity:0.5">image bytes not in archive</p>`}
          </div>
          <aside>
            <dl>
              <dt>uploader</dt>
              <dd><a href="/user/${image.uploader}">${image.uploader}</a></dd>

              ${image.uploaded_at
                ? html`<dt>uploaded</dt><dd>${formatDate(image.uploaded_at)}</dd>`
                : ""}

              <dt>source</dt>
              <dd>
                ${image.source_url
                  ? html`<a class="${image.source_dead ? "dead" : ""}" href="${image.source_url}" rel="noopener nofollow">${image.source_url}</a>`
                  : html`<span style="opacity:0.5">unknown</span>`}
              </dd>

              ${tags.length
                ? html`<dt>tags</dt><dd class="tags">${tags.map((t) => html`<a href="/tag/${encodeURIComponent(t)}">${t}</a>`)}</dd>`
                : ""}

              ${savers.length
                ? html`<dt>savers (${image.save_count})</dt><dd class="savers">${savers.map((u) => html`<a href="/user/${u}">${u}</a>`)}</dd>`
                : ""}
            </dl>
          </aside>
        </article>
      `,
    })
  );
}

function formatDate(epoch: number): string {
  return new Date(epoch * 1000).toISOString().slice(0, 10);
}
