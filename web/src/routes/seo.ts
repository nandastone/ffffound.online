import type { Context } from "hono";
import type { Env } from "../types";
import { absUrl } from "./_url";

const URLS_PER_SITEMAP = 50000;
const PAGE_PRIORITY = "0.5";
const PAGE_CHANGEFREQ = "yearly"; // immutable archive

// ---------------------------------------------------------------------------
// /robots.txt
// ---------------------------------------------------------------------------
export function robotsRoute(c: Context<{ Bindings: Env }>) {
  const body = `User-agent: *
Allow: /
Disallow: /img/
Disallow: /cdn/
Disallow: /static/

Sitemap: ${absUrl(c, "/sitemap.xml")}
`;
  return c.text(body, 200, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": `public, max-age=86400`,
  });
}

// ---------------------------------------------------------------------------
// /sitemap.xml — top-level index pointing at child sitemaps.
// We keep the count rough: COUNT(*)/50000 once per cold cache, then served
// from edge cache for a day.
// ---------------------------------------------------------------------------
export async function sitemapIndexRoute(c: Context<{ Bindings: Env }>) {
  const [imageCount, userCount] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM images`).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users`).first<{ n: number }>(),
  ]);

  const imageSitemaps = Math.ceil((imageCount?.n ?? 0) / URLS_PER_SITEMAP);
  const userSitemaps  = Math.ceil((userCount?.n  ?? 0) / URLS_PER_SITEMAP);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  xml += `  <sitemap><loc>${absUrl(c, "/sitemap-home.xml")}</loc></sitemap>\n`;
  for (let i = 0; i < imageSitemaps; i++) {
    xml += `  <sitemap><loc>${absUrl(c, `/sitemap/images/${i}`)}</loc></sitemap>\n`;
  }
  for (let i = 0; i < userSitemaps; i++) {
    xml += `  <sitemap><loc>${absUrl(c, `/sitemap/users/${i}`)}</loc></sitemap>\n`;
  }
  xml += "</sitemapindex>\n";

  return c.body(xml, 200, {
    "content-type": "application/xml; charset=utf-8",
    "cache-control": "public, max-age=86400",
  });
}

// ---------------------------------------------------------------------------
// /sitemap-home.xml — fixed pages (just / for now).
// ---------------------------------------------------------------------------
export function sitemapHomeRoute(c: Context<{ Bindings: Env }>) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  xml += `  <url><loc>${absUrl(c, "/")}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
  xml += "</urlset>\n";
  return c.body(xml, 200, {
    "content-type": "application/xml; charset=utf-8",
    "cache-control": "public, max-age=86400",
  });
}

// ---------------------------------------------------------------------------
// /sitemap-images-N.xml — N is a 50K-row chunk, ordered by image_id.
// ---------------------------------------------------------------------------
export async function sitemapImagesRoute(c: Context<{ Bindings: Env }>) {
  const idx = parseInt(c.req.param("n") ?? "0", 10);
  if (Number.isNaN(idx) || idx < 0) return c.notFound();
  const offset = idx * URLS_PER_SITEMAP;

  const { results } = await c.env.DB.prepare(
    `SELECT image_id, uploaded_at FROM images ORDER BY image_id LIMIT ? OFFSET ?`
  )
    .bind(URLS_PER_SITEMAP, offset)
    .all<{ image_id: string; uploaded_at: number | null }>();

  if (results.length === 0) return c.notFound();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const r of results) {
    xml += `  <url><loc>${absUrl(c, `/image/${r.image_id}`)}</loc>`;
    if (r.uploaded_at) {
      xml += `<lastmod>${new Date(r.uploaded_at * 1000).toISOString().slice(0, 10)}</lastmod>`;
    }
    xml += `<changefreq>${PAGE_CHANGEFREQ}</changefreq><priority>${PAGE_PRIORITY}</priority></url>\n`;
  }
  xml += "</urlset>\n";

  return c.body(xml, 200, {
    "content-type": "application/xml; charset=utf-8",
    "cache-control": "public, max-age=86400",
  });
}

// ---------------------------------------------------------------------------
// /sitemap-users-N.xml — same shape, for /home/<user>.
// ---------------------------------------------------------------------------
export async function sitemapUsersRoute(c: Context<{ Bindings: Env }>) {
  const idx = parseInt(c.req.param("n") ?? "0", 10);
  if (Number.isNaN(idx) || idx < 0) return c.notFound();
  const offset = idx * URLS_PER_SITEMAP;

  const { results } = await c.env.DB.prepare(
    `SELECT username FROM users WHERE save_count > 0 ORDER BY username LIMIT ? OFFSET ?`
  )
    .bind(URLS_PER_SITEMAP, offset)
    .all<{ username: string }>();

  if (results.length === 0) return c.notFound();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const r of results) {
    xml += `  <url><loc>${absUrl(c, `/home/${encodeURIComponent(r.username)}`)}</loc>`;
    xml += `<changefreq>${PAGE_CHANGEFREQ}</changefreq><priority>${PAGE_PRIORITY}</priority></url>\n`;
  }
  xml += "</urlset>\n";

  return c.body(xml, 200, {
    "content-type": "application/xml; charset=utf-8",
    "cache-control": "public, max-age=86400",
  });
}
