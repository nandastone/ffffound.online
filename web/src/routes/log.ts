import type { Context } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { Layout } from "../layout";
import { absUrl } from "./_url";

// Legacy entries reproduced from the captured /log/ index page.  Inline images
// are dropped — most weren't captured in the archive, and the textual content
// is what carries historical interest.
const LEGACY_ENTRIES: Array<{
  title: string;
  author: string;
  date: string;
  body?: ReturnType<typeof html>;
}> = [
  {
    title: "SSSSHOP!",
    author: "yoabe",
    date: "February 6, 2008 at 3:31 pm",
  },
  {
    title: "FFFFOUND! LOG",
    author: "yoabe",
    date: "December 21, 2007 at 5:46 pm",
  },
  {
    title: "FFFFOUND! T-shirt",
    author: "yoabe",
    date: "December 21, 2007 at 12:16 pm",
  },
  {
    title: "FFFFOUND! T-shirt",
    author: "yoabe",
    date: "December 20, 2007 at 5:57 pm",
  },
  {
    title: "FFFFOUND! T-shirt",
    author: "yoabe",
    date: "December 20, 2007 at 4:30 pm",
  },
  {
    title: "Site Updates",
    author: "keita",
    date: "October 26, 2007 at 1:22 pm",
    body: html`
      <p>Howdy! Long time no updates. And no more handwritten blog entry which
        actually loses my motivation to write small updates.</p>
      <p>We&#8217;ve just updated a couple of functions,</p>
      <ul>
        <li>Keyboard shortcut edits &#8211; when you hit the last image, Next(j) will take you to the start of the next page. Prev(k) likewise.</li>
        <li>Bring the cursor to the upper-right navigation and play with the mousewheel &#8230;</li>
        <li>Now iPhone/iPod touch compatible! Same url, same look.</li>
      </ul>
      <p>オッス！長い間更新無かった。手書き記事は実のところ僕のやる気が無くなるからやめた。</p>
      <p>いくつかの機能を更新した。</p>
      <ul>
        <li>キーボードショートカットの修正 &#8211; 最後の画像で、Next(j)をすればあなたを次のページへ連れて行く。Prev(k)も同様。</li>
        <li>カーソルを右上のナビゲーションに持っていってホイールで遊ぶと&#8230;</li>
        <li>今からiPhone/iPod touchコンパチブル！同じURL、同じ顔！</li>
      </ul>
    `,
  },
  {
    title: "Site Updates",
    author: "keita",
    date: "August 13, 2007 at 6:04 pm",
  },
  {
    title: "Screensaver Updates",
    author: "taro",
    date: "July 27, 2007 at 11:45 pm",
  },
];

export async function logRoute(c: Context<{ Bindings: Env }>) {
  const titleBlock = html`<h1>Change Log</h1>`;

  return c.html(
    Layout({
      title: "Change Log",
      titleBlock,
      env: c.env,
      meta: {
        description: "Change log for the FFFFOUND! preservation site, plus the original 2007–2008 FFFFOUND! LOG posts.",
        canonical: absUrl(c, "/log"),
        ogType: "article",
      },
      children: html`
<div class="content_block content_main">

<table border="0" cellspacing="0" cellpadding="0" class="text">
<tr><td valign="top" class="en">

  <h3>Current</h3>
  <ul>
    <li>April 27, 2017 capture ingested as gap-fill against the May 7, 2017
      baseline. Adds the image pages and saves the later crawl caught only as
      maintenance stubs, plus image bytes the May crawl never visited.</li>
    <li>Read-only preservation site launched. Approximately 1.28&nbsp;million
      image pages, 12&nbsp;thousand curators, six and a half million save
      events, sourced from the May 7, 2017 archive of FFFFOUND!.</li>
  </ul>

  <h3 style="margin-top:30px">Legacy &mdash; the original FFFFOUND! LOG (2007–2008)</h3>
  <p style="color:#888;font-size:12px">
    Reproduced from the captured <code>/log/</code> index. Inline images from the
    original posts are not included; most were not preserved.
  </p>

  ${LEGACY_ENTRIES.map((e) => html`
    <div style="margin:24px 0;padding-left:0">
      <h4 style="margin:0 0 4px 0;font-weight:bold">${e.title}</h4>
      <div style="color:#888;font-size:12px;margin-bottom:8px">log &mdash; ${e.author} on ${e.date}</div>
      ${e.body ?? ""}
    </div>
  `)}

</td></tr>
</table>

</div>
      `,
    }),
  );
}
