import type { Context } from "hono";
import { html } from "hono/html";
import type { Env, ImageRow } from "../types";
import { imgUrl } from "./_url";

interface RelatedThumb {
  image_id: string;
  r2_key: string | null;
  cdn_thumbnail_url: string | null;
}

// Renders a single <blockquote class="asset"> block in the user-page / top-page
// format: image on the left, vertical "vline" column of small related thumbs on
// the right. The image-detail page uses its own (richer) markup in routes/image.ts.
export function renderListAsset(c: Context<{ Bindings: Env }>, row: ImageRow, relatedThumbs: RelatedThumb[] = []) {
  const elId   = `asset${row.image_id.slice(0, 12)}`;
  const title  = row.title ?? row.image_id.slice(0, 12);
  const detail = `/image/${row.image_id}`;
  const imgSrc = row.r2_key ? imgUrl(c, row.r2_key) : (row.cdn_thumbnail_url ?? "");
  const desc   = sourceDescription(row.source_url);
  const date   = row.uploaded_at ? formatPosted(row.uploaded_at) : "";
  const w      = row.width ? Math.min(row.width, 480) : null;
  const h      = (row.height && row.width) ? Math.round(row.height * (w as number) / row.width) : null;

  return html`<blockquote id="${elId}" class="asset">
<a name="${elId}"></a>
<div class="header">
<div class="title"><span class="quote">Quoted from:</span> <a id="${elId}-link" href="${row.source_url ?? "#"}" title="${row.source_url ?? ""}" target="_blank" rel="noopener nofollow">${title}</a></div>
<div class="description">${desc}${date ? html`<br>${date}  ` : ""}<a id="${elId}-info" href="${detail}">saved by ${row.save_count} ${row.save_count === 1 ? "person" : "people"}</a></div>
</div>
<div>
<table border="0" cellspacing="0" cellpadding="0"><tr>
<td valign="top" width="520">
${row.r2_key
  ? html`<a id="${elId}-link-img" href="${detail}"><img id="${elId}-img" src="${imgSrc}" alt="${title}"${w ? html` width="${w}"` : ""}${h ? html` height="${h}"` : ""}></a>`
  : html`<p style="color:#909090">image bytes not in archive</p>`}
<div class="button"><a class="link" style="text-decoration:line-through;">FLAG THIS IMAGE</a></div>
</td>
<td valign="top" class="${relatedThumbs.length ? "vline" : ""}">
${relatedThumbs.filter((r) => r.r2_key).map((r) => html`<div class="related_to_item_xs"><a href="/image/${r.image_id}"><img src="${imgUrl(c, r.r2_key!)}" width="100"></a></div>`)}
</td>
</tr></table>
</div>
</blockquote>`;
}

function sourceDescription(source: string | null): string {
  if (!source) return "";
  const stripped = source.replace(/^https?:\/\//, "");
  return stripped.length > 100 ? stripped.slice(0, 99) + "…" : stripped;
}

function formatPosted(epoch: number): string {
  return new Date(epoch * 1000).toISOString().replace("T", " ").slice(0, 19);
}
