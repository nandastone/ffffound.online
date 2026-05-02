import type { Context } from "hono";
import type { Env } from "../types";

// R2 → response proxy. Cloudflare caches the response at the edge based on
// Cache-Control, so subsequent requests skip the Worker entirely.
export async function imgProxyRoute(c: Context<{ Bindings: Env }>) {
  const key = c.req.param("key");
  const obj = await c.env.IMAGES.get(key);
  if (!obj) return c.notFound();

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", `public, max-age=${c.env.CACHE_MAX_AGE}, immutable`);
  if (!headers.has("content-type")) headers.set("content-type", "application/octet-stream");

  return new Response(obj.body, { headers });
}
