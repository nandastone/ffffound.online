import type { Context } from "hono";
import { html } from "hono/html";
import type { Env, ImageRow } from "../types";
import { Layout } from "../layout";
import { absUrl } from "./_url";

interface ThumbRow {
  image_id: string;
  r2_key: string | null;
  cdn_thumbnail_url: string | null;
}

interface SaverRow {
  username: string;
  image_id: string;
  saved_at: number | null;
  r2_key: string | null;
  cdn_thumbnail_url: string | null;
}

const MAX_SAVER_GRIDS = 10;
const THUMBS_PER_SAVER = 5;

export async function imageRoute(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  const image = await c.env.DB.prepare(`SELECT * FROM images WHERE image_id = ?`).bind(id).first<ImageRow>();
  if (!image) return c.notFound();

  const [saversResult, relatedResult, latestPostsResult] = await Promise.all([
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
      .all<ThumbRow>(),
    c.env.DB.prepare(
      `WITH first_savers AS (
         SELECT username FROM saves
         WHERE image_id = ? AND saved_at IS NOT NULL
         ORDER BY saved_at ASC
         LIMIT ?
       )
       SELECT s.username, s.image_id, s.saved_at, i.r2_key, i.cdn_thumbnail_url
       FROM saves s
       JOIN first_savers fs ON fs.username = s.username
       JOIN images i ON i.image_id = s.image_id
       WHERE s.image_id != ?
       ORDER BY s.username, s.saved_at DESC`
    )
      .bind(id, MAX_SAVER_GRIDS, id)
      .all<SaverRow>(),
  ]);

  const savers = saversResult.results.map((r) => r.username);
  // Only show grid items where we actually have bytes — otherwise <img src="">
  // would render as a broken image. ~36% of corpus has no r2_key.
  const related = relatedResult.results.filter((r) => r.r2_key);

  const latestByUser = new Map<string, SaverRow[]>();
  for (const row of latestPostsResult.results) {
    if (!row.r2_key) continue;  // skip thumbs without bytes; would render broken
    const list = latestByUser.get(row.username) ?? [];
    if (list.length < THUMBS_PER_SAVER) list.push(row);
    latestByUser.set(row.username, list);
  }

  const assetEl = `assetf${image.image_id}`;
  const titleText = image.title ?? `image ${image.image_id.slice(0, 8)}`;
  const sourceUrl = image.source_url ?? "#";
  const detailHref = `/image/${image.image_id}`;
  const imgSrc = image.r2_key ? `/img/${image.r2_key}` : (image.cdn_thumbnail_url ?? "");
  const sourceHostPath = sourceUrlDescription(image.source_url);
  const postedDate = image.uploaded_at ? formatPostedAt(image.uploaded_at) : "";

  // SEO description: blend page title, save count, posted date, and source host.
  const sourceHost = image.source_url ? new URL(image.source_url).hostname : null;
  const description = [
    image.title ? `“${image.title}”.` : null,
    `Saved by ${image.save_count} ${image.save_count === 1 ? "person" : "people"} on FFFFOUND!`,
    image.uploaded_at ? `Posted ${formatPostedDate(image.uploaded_at)}.` : null,
    sourceHost ? `Source: ${sourceHost}.` : null,
  ].filter(Boolean).join(" ");

  return c.html(
    Layout({
      title: titleText,
      env: c.env,
      meta: {
        description,
        canonical: absUrl(c, detailHref),
        ogType: "article",
        ogImage: image.r2_key ? absUrl(c, `/img/${image.r2_key}`) : undefined,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "ImageObject",
          "name": titleText,
          "description": description,
          "contentUrl": image.r2_key ? absUrl(c, `/img/${image.r2_key}`) : undefined,
          "datePublished": image.uploaded_at ? new Date(image.uploaded_at * 1000).toISOString() : undefined,
          "url": absUrl(c, detailHref),
          "isPartOf": { "@type": "WebSite", "name": "FFFFOUND!", "url": absUrl(c, "/") },
          "creator": { "@type": "Person", "name": image.uploader, "url": absUrl(c, `/home/${image.uploader}`) },
          "interactionStatistic": {
            "@type": "InteractionCounter",
            "interactionType": "https://schema.org/LikeAction",
            "userInteractionCount": image.save_count,
          },
          ...(sourceHost ? { "isBasedOn": image.source_url } : {}),
          ...(image.width && image.height ? { "width": image.width, "height": image.height } : {}),
        },
      },
      children: html`
<div id="assets">

<blockquote id="${assetEl}" class="asset">
<a name="${assetEl}"></a>

<div class="header">
<div class="title"><span class="quote">Quoted from:</span> <a id="${assetEl}-link" href="${sourceUrl}" title="${sourceUrl}" target="_blank" rel="noopener nofollow">${titleText}</a></div>
<div class="description">${sourceHostPath}</div>
</div>

<div>
<table border="0" cellspacing="0" cellpadding="0"><tr>
<td valign="top" width="520">

${image.r2_key
  ? html`<a id="${assetEl}-link-img" href="${sourceUrl}" target="_blank" rel="noopener nofollow"><img id="${assetEl}-img" src="${imgSrc}" alt="${titleText}" ${image.width ? html` width="${Math.min(image.width, 520)}"` : ""}${image.height && image.width ? html` height="${Math.round(image.height * Math.min(image.width, 520) / image.width)}"` : ""}></a>`
  : html`<p style="color:#909090">image bytes not in archive</p>`}

<div class="button"><a class="link" style="text-decoration:line-through;">FLAG THIS IMAGE</a></div>
</td>
<td valign="top" class=""></td>
</tr></table>
</div>

${postedDate ? html`<div class="date">posted on ${postedDate}</div>` : ""}

${savers.length
  ? html`<div class="saved_by">
<span class="saved_by">saved by ${image.save_count} ${image.save_count === 1 ? "person" : "people"}: </span>
${savers.map((u, i) => html`<a href="/home/${u}/found">${u}</a>${i < savers.length - 1 ? ", " : ""}`)}
</div>`
  : ""}

${related.length
  ? html`<div class="related_to">
<p class="related_to">You may like these images.</p>
${related.map((r) => html`<div class="related_to_item"><table border="0" cellspacing="0" cellpadding="0"><tr><td width="170" height="170" align="center"><a href="/image/${r.image_id}"><img src="${r.r2_key ? `/img/${r.r2_key}` : r.cdn_thumbnail_url ?? ""}" alt=""></a></td></tr></table></div>`)}
<br clear="all">
</div>`
  : ""}

${latestByUser.size
  ? html`<div class="more_images_container">
${Array.from(latestByUser.entries()).map(([user, posts]) => html`
<div class="more_images">
<p><a href="/home/${user}/post">${user}'s</a> latest post.</p>
${posts.map((p) => html`<div class="more_images_item"><table border="0" cellspacing="0" cellpadding="0"><tr><td width="100" height="100" align="center"><a href="/image/${p.image_id}"><img src="${p.r2_key ? `/img/${p.r2_key}` : p.cdn_thumbnail_url ?? ""}" alt="" width="100" height="100"></a></td></tr></table></div>`)}
<br clear="all">
</div>
`)}
</div>`
  : ""}

</blockquote>

</div>
      `,
    })
  );
}

function formatPostedAt(epoch: number): string {
  const d = new Date(epoch * 1000);
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function formatPostedDate(epoch: number): string {
  const d = new Date(epoch * 1000);
  // Human-friendly: "October 12, 2010" — Google likes natural prose in descriptions.
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function sourceUrlDescription(source: string | null): string {
  if (!source) return "";
  const stripped = source.replace(/^https?:\/\//, "");
  return stripped.length > 100 ? stripped.slice(0, 99) + "…" : stripped;
}
