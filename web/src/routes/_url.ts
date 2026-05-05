import type { Context } from "hono";

// Build an absolute URL for the running deployment, derived from the request.
// Used for canonical / og:url / sitemap entries so a single Worker handles
// both *.workers.dev and the custom domain seamlessly.
export function absUrl(c: Context, path: string): string {
  const u = new URL(c.req.url);
  return `${u.protocol}//${u.host}${path}`;
}
