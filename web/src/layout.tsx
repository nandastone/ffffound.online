import { html } from "hono/html";

// Minimal shared layout. Brutalist on purpose — the data is the design.
// Inline CSS keeps the Worker single-file and avoids a static asset deploy.
export function Layout(props: { title: string; children: unknown }) {
  return html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${props.title} — ffffound</title>
    <link rel="icon" href="data:," />
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body {
        font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        margin: 0;
        background: #fafafa;
        color: #111;
      }
      @media (prefers-color-scheme: dark) {
        body { background: #0e0e0e; color: #e8e8e8; }
        a { color: #9cf; }
      }
      header {
        padding: 12px 20px;
        border-bottom: 1px solid rgba(127,127,127,0.2);
        display: flex; gap: 16px; align-items: baseline;
      }
      header h1 { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: 0.02em; }
      header nav { display: flex; gap: 12px; font-size: 13px; }
      header form { margin-left: auto; }
      header input[type=search] {
        font: inherit; padding: 4px 8px; min-width: 220px;
        border: 1px solid rgba(127,127,127,0.4); border-radius: 3px; background: transparent; color: inherit;
      }
      main { padding: 20px; max-width: 1280px; margin: 0 auto; }
      a { color: inherit; text-decoration: none; border-bottom: 1px solid rgba(127,127,127,0.4); }
      a:hover { border-bottom-color: currentColor; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
      .grid figure { margin: 0; }
      .grid img { width: 100%; height: 220px; object-fit: cover; display: block; background: #ddd; }
      .meta { font-size: 12px; opacity: 0.7; padding: 4px 0; }
      .image-detail { display: grid; grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr); gap: 24px; }
      .image-detail img { max-width: 100%; height: auto; display: block; }
      .image-detail dl { margin: 0; }
      .image-detail dt { font-weight: 600; opacity: 0.6; margin-top: 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
      .image-detail dd { margin: 4px 0 0; }
      .tags a, .savers a { display: inline-block; margin: 2px 4px 2px 0; padding: 2px 6px; border: 1px solid rgba(127,127,127,0.3); border-radius: 3px; }
      .dead { opacity: 0.5; text-decoration: line-through; }
      footer { padding: 24px 20px; font-size: 11px; opacity: 0.5; text-align: center; }
    </style>
  </head>
  <body>
    <header>
      <h1><a href="/" style="border:none">ffffound</a></h1>
      <nav>
        <a href="/">recent</a>
        <a href="/random">random</a>
      </nav>
      <form action="/search" method="get">
        <input type="search" name="q" placeholder="search…" />
      </form>
    </header>
    <main>${props.children}</main>
    <footer>preserved from the 2017 ArchiveTeam capture · read-only</footer>
  </body>
</html>`;
}
