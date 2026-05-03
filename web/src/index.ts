import { Hono } from "hono";
import type { Env } from "./types";
import { homeRoute } from "./routes/home";
import { imageRoute } from "./routes/image";
import { userRoute } from "./routes/user";
import { imgProxyRoute } from "./routes/img";

const app = new Hono<{ Bindings: Env }>();

// Routes deliberately mirror the original ffffound URL shapes.
app.get("/", homeRoute);                   // "Top" — recent firehose
app.get("/image/:id", imageRoute);
app.get("/home/:name", userRoute);         // user's saves (root)
app.get("/home/:name/found", userRoute);   // explicit "found" stream
app.get("/home/:name/post", userRoute);

// R2 image proxy. Worker reads from the IMAGES bucket and re-emits with
// long Cache-Control so Cloudflare caches it at the edge.
app.get("/img/:key{.+}", imgProxyRoute);

app.notFound((c) => c.text("not found", 404));
app.onError((err, c) => {
  console.error(err);
  return c.text("server error", 500);
});

export default app;
