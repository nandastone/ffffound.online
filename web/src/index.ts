import { Hono } from "hono";
import type { Env } from "./types";
import { homeRoute } from "./routes/home";
import { imageRoute } from "./routes/image";
import { userRoute } from "./routes/user";
import { tagRoute } from "./routes/tag";
import { searchRoute } from "./routes/search";
import { imgProxyRoute } from "./routes/img";

const app = new Hono<{ Bindings: Env }>();

app.get("/", homeRoute);
app.get("/random", (c) => c.redirect("/?sort=random"));
app.get("/image/:id", imageRoute);
app.get("/user/:name", userRoute);
app.get("/tag/:tag", tagRoute);
app.get("/search", searchRoute);

// R2 image proxy. Worker reads from the IMAGES bucket and re-emits with
// long Cache-Control so Cloudflare caches it at the edge.
app.get("/img/:key{.+}", imgProxyRoute);

app.notFound((c) => c.text("not found", 404));
app.onError((err, c) => {
  console.error(err);
  return c.text("server error", 500);
});

export default app;
