import type { Context } from "hono";
import { html } from "hono/html";
import type { Env, ImageRow } from "../types";
import { Layout } from "../layout";

interface RelatedRow {
  image_id: string;
  r2_key: string | null;
  cdn_thumbnail_url: string | null;
}

export async function imageRoute(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");

  const image = await c.env.DB.prepare(
    `SELECT * FROM images WHERE image_id = ?`
  )
    .bind(id)
    .first<ImageRow>();

  if (!image) return c.notFound();

  const [saversResult, relatedResult] = await Promise.all([
    c.env.DB.prepare(
      `SELECT username FROM saves WHERE image_id = ? ORDER BY saved_at ASC LIMIT 50`
    )
      .bind(id)
      .all<{ username: string }>(),
    c.env.DB.prepare(
      `SELECT i.image_id, i.r2_key, i.cdn_thumbnail_url
       FROM image_related r
       JOIN images i ON i.image_id = r.related_id
       WHERE r.image_id = ?
       ORDER BY r.position ASC
       LIMIT 10`
    )
      .bind(id)
      .all<RelatedRow>(),
  ]);

  const savers = saversResult.results.map((r) => r.username);
  const related = relatedResult.results;

  return c.html(
    Layout({
      title: image.title ?? `image ${image.image_id.slice(0, 8)}`,
      children: html`
        <article class="image-detail">
          <div>
            ${image.r2_key
              ? html`<img src="/img/${image.r2_key}" alt="${image.title ?? ""}" />`
              : html`<p style="opacity:0.5">image bytes not in archive</p>`}

            ${image.title
              ? html`<p style="margin-top:12px;font-size:13px;opacity:0.7"><span style="opacity:0.5">Quoted from:</span> <strong>${image.title}</strong></p>`
              : ""}
          </div>
          <aside>
            <dl>
              <dt>uploader</dt>
              <dd><a href="/home/${image.uploader}">${image.uploader}</a></dd>

              ${image.uploaded_at
                ? html`<dt>posted</dt><dd>${formatDate(image.uploaded_at)}</dd>`
                : ""}

              <dt>source</dt>
              <dd>
                ${image.source_url
                  ? html`<a class="${image.source_dead ? "dead" : ""}" href="${image.source_url}" rel="noopener nofollow">${truncate(image.source_url, 60)}</a>`
                  : html`<span style="opacity:0.5">unknown</span>`}
              </dd>

              ${savers.length
                ? html`<dt>saved by ${image.save_count} ${image.save_count === 1 ? "person" : "people"}</dt><dd class="savers">${savers.map((u) => html`<a href="/home/${u}">${u}</a>`)}</dd>`
                : ""}
            </dl>
          </aside>
        </article>

        ${related.length
          ? html`
              <section class="related">
                <h3>you may like these</h3>
                <div class="related-grid">
                  ${related.map(
                    (r) => html`
                      <a href="/image/${r.image_id}">
                        <img loading="lazy" src="${r.r2_key ? `/img/${r.r2_key}` : r.cdn_thumbnail_url ?? ""}" alt="" />
                      </a>
                    `
                  )}
                </div>
              </section>
            `
          : ""}
      `,
    })
  );
}

function formatDate(epoch: number): string {
  return new Date(epoch * 1000).toISOString().slice(0, 10);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
