import { Hono } from "hono";
import type { Env } from "./types";
import { homeRoute } from "./routes/home";
import { imageRoute } from "./routes/image";
import { userRoute } from "./routes/user";
import { cdnRoute } from "./routes/cdn";
import { aboutRoute } from "./routes/about";
import { legalRoute } from "./routes/legal";
import { logRoute } from "./routes/log";
import { robotsRoute, sitemapIndexRoute, sitemapHomeRoute, sitemapImagesRoute, sitemapUsersRoute } from "./routes/seo";

const app = new Hono<{ Bindings: Env }>();

// Normalize trailing slashes — some original ffffound links carried `/`
// (e.g. /home/<user>/found/), so visitors and old indices may hit those.
// Redirect once to the canonical no-slash form for cache + SEO consistency.
app.use("*", async (c, next) => {
  const u = new URL(c.req.url);
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    return c.redirect(u.pathname.replace(/\/+$/, "") + u.search, 301);
  }
  await next();
});

// Edge-cache HTML pages via the Workers Cache API.
// Cloudflare doesn't auto-cache Worker responses — the Cache-Control header
// alone only tells the browser. So we explicitly check + populate caches.default.
// The data is an immutable archive; templates only change on deploy, after which
// we manually purge (see infra/DEPLOY.md). max-age (browser) is kept short so
// a purge propagates fast even into already-loaded tabs.
app.use("*", async (c, next) => {
  if (c.req.method !== "GET") return next();
  const path = new URL(c.req.url).pathname;
  // Routes that set their own Cache-Control / use different cacheable bodies.
  const isHtmlRoute = !(
    path.startsWith("/cdn/") ||
    path.startsWith("/sitemap") || path === "/robots.txt" ||
    path.startsWith("/static/") || path === "/favicon.ico"
  );
  if (!isHtmlRoute) return next();

  const cache = caches.default;
  const cacheKey = new Request(c.req.url, { method: "GET" });

  const cached = await cache.match(cacheKey);
  if (cached) {
    const r = new Response(cached.body, cached);
    r.headers.set("x-cache", "HIT");
    return r;
  }

  await next();

  if (c.res.status === 200 && (c.res.headers.get("content-type") ?? "").includes("text/html")) {
    c.res.headers.set("cache-control", "public, s-maxage=86400, max-age=300");
    c.res.headers.set("x-cache", "MISS");
    // Clone before putting; the original body is still streaming to the client.
    c.executionCtx.waitUntil(cache.put(cacheKey, c.res.clone()));
  }
});

// Routes deliberately mirror the original ffffound URL shapes.
app.get("/", homeRoute);                   // "Top" — recent firehose
app.get("/image/:id", imageRoute);
app.get("/home/:name", userRoute);         // user's saves (root)
app.get("/home/:name/found", userRoute);   // explicit "found" stream
app.get("/home/:name/post", userRoute);

// Static pages — About is reproduced from the captured /about HTML; Legal
// and Change Log are written for the preservation site (the originals are
// preserved verbatim in the source WARC).
app.get("/about", aboutRoute);
app.get("/legal", legalRoute);
app.get("/log", logRoute);

// CDN compatibility shim — used to re-render captured original ffffound HTML
// where image URLs follow ffffound's `<sha1>_<size>.<ext>` filename scheme.
app.get("/cdn/:filename", cdnRoute);

// SEO surfaces.
app.get("/robots.txt", robotsRoute);
app.get("/sitemap.xml", sitemapIndexRoute);
app.get("/sitemap-home.xml", sitemapHomeRoute);
app.get("/sitemap/images/:n", sitemapImagesRoute);
app.get("/sitemap/users/:n", sitemapUsersRoute);

app.notFound((c) => c.text("not found", 404));
app.onError((err, c) => {
  console.error(err);
  return c.text("server error", 500);
});

export default app;
