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
//
// Unlike /img/ (which serves R2 bytes directly via the IMAGES_BASE_URL custom
// domain), this route has to stay on the Worker because of the D1 lookup. The
// bytes are immutable, so we cache the response in the edge Cache API: the D1
// query + R2 read only run on the first request per filename in each colo, and
// every hit after that is served from cache without invoking this handler.
const RE_FILENAME = /^([0-9a-f]{40})_(?:m|s|xs)\.(?:jpe?g|png|gif|webp)$/i;

export async function cdnRoute(c: Context<{ Bindings: Env }>) {
  const filename = c.req.param("filename");
  const m = RE_FILENAME.exec(filename ?? "");
  if (!m) return c.notFound();

  const cache = caches.default;
  const cacheKey = new Request(c.req.url, { method: "GET" });

  const cached = await cache.match(cacheKey);
  if (cached) {
    const r = new Response(cached.body, cached);
    r.headers.set("x-cache", "HIT");
    return r;
  }

  const sha1 = m[1]!.toLowerCase();  // Capture group 1 is guaranteed when m matched.
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
  headers.set("access-control-allow-origin", "*");  // For the cross-origin compare iframe.
  if (!headers.has("content-type")) headers.set("content-type", "application/octet-stream");

  const res = new Response(obj.body, { headers });
  // Clone for the cache before the body streams to the client.
  c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  res.headers.set("x-cache", "MISS");
  return res;
}
