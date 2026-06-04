import type { Context } from "hono";
import type { Env } from "../types";

// Build an absolute URL for the running deployment, derived from the request.
// Used for canonical / og:url / sitemap entries so a single Worker handles
// both *.workers.dev and the custom domain seamlessly.
export function absUrl(c: Context, path: string): string {
  const u = new URL(c.req.url);
  return `${u.protocol}//${u.host}${path}`;
}

// Absolute URL for an image's bytes, served straight from R2 via its own custom
// domain (IMAGES_BASE_URL). The Worker is not in this path, so Cloudflare's CDN
// caches the bytes and crawlers no longer cost a Worker invocation per image.
// `key` is the raw R2 object key and may contain slashes, which are valid path
// separators on the image host, so we do not encode it.
export function imgUrl(c: Context<{ Bindings: Env }>, key: string): string {
  return `${c.env.IMAGES_BASE_URL}/${key}`;
}
