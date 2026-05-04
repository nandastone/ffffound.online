import type { Context } from "hono";
import type { Env } from "../types";

// Serves images using their original ffffound CDN filename pattern:
//   /cdn/<sha1>_<m|s|xs>.<jpg|png|gif|webp>
// This exists so we can re-render captured ffffound HTML pages (which use
// img.ffffound.com / img-thumb.ffffound.com URLs rewritten to /cdn/...) with
// real image bytes flowing through our local R2.
//
// We resolve sha1 -> r2_key via D1 (image_id IS the sha1). Whatever variant
// we have locally is what gets served, regardless of which size was requested.
const RE_FILENAME = /^([0-9a-f]{40})_(?:m|s|xs)\.(?:jpe?g|png|gif|webp)$/i;

export async function cdnRoute(c: Context<{ Bindings: Env }>) {
  const filename = c.req.param("filename");
  const m = RE_FILENAME.exec(filename ?? "");
  if (!m) return c.notFound();

  const sha1 = m[1].toLowerCase();
  const row = await c.env.DB.prepare(
    `SELECT r2_key FROM images WHERE image_id = ?`
  )
    .bind(sha1)
    .first<{ r2_key: string | null }>();

  if (!row?.r2_key) return c.notFound();

  const obj = await c.env.IMAGES.get(row.r2_key);
  if (!obj) return c.notFound();

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", `public, max-age=${c.env.CACHE_MAX_AGE}, immutable`);
  headers.set("access-control-allow-origin", "*");  // for cross-origin compare iframe
  if (!headers.has("content-type")) headers.set("content-type", "application/octet-stream");

  return new Response(obj.body, { headers });
}
