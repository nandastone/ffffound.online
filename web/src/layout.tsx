import { html, raw } from "hono/html";
import type { Env } from "./types";

// SEO + social-meta props plumbed in by each route.
export interface LayoutMeta {
  description?: string;          // <meta name="description"> + og:description
  canonical?: string;            // canonical URL (path; we prefix the host)
  ogType?: "website" | "article";
  ogImage?: string;              // absolute URL for og:image / twitter:image
  prev?: string | null;          // rel=prev (paginated routes)
  next?: string | null;          // rel=next
  jsonLd?: object;               // structured data; serialized into a <script>
  noindex?: boolean;             // <meta name="robots" content="noindex"> for thin / stub pages
}

const SITE_NAME = "FFFFOUND!";
const SITE_TAGLINE = "Image bookmarking, preserved.";

// Faithful 2017 ffffound chrome. Markup mirrors the captured pages (table-based
// layout, original class names) so the original `found-min.r3000.css` styles it
// without modification.
export function Layout(props: { title: string; children: unknown; titleBlock?: unknown; meta?: LayoutMeta; env?: Env }) {
  const m = props.meta ?? {};
  const desc = m.description ?? `${SITE_TAGLINE} The 2007–2017 ffffound corpus, browsable again.`;
  const canonical = m.canonical;
  const ogType = m.ogType ?? "website";
  const ogImage = m.ogImage;
  const adsensePub = props.env?.ADSENSE_PUBLISHER_ID;
  const adsenseSlot = props.env?.ADSENSE_SLOT_ID;
  const adsenseEnabled = !!(adsensePub && adsenseSlot);

  return html`<!doctype html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=890" />
<title>${SITE_NAME} | ${props.title}</title>
<meta name="description" content="${desc}" />
${m.noindex ? html`<meta name="robots" content="noindex,follow" />` : ""}
${canonical ? html`<link rel="canonical" href="${canonical}" />` : ""}
${m.prev ? html`<link rel="prev" href="${m.prev}" />` : ""}
${m.next ? html`<link rel="next" href="${m.next}" />` : ""}

<!-- Open Graph -->
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:title" content="${props.title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:type" content="${ogType}" />
${canonical ? html`<meta property="og:url" content="${canonical}" />` : ""}
${ogImage ? html`<meta property="og:image" content="${ogImage}" />` : ""}

<!-- Twitter Card -->
<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}" />
<meta name="twitter:title" content="${props.title}" />
<meta name="twitter:description" content="${desc}" />
${ogImage ? html`<meta name="twitter:image" content="${ogImage}" />` : ""}

${m.jsonLd ? html`<script type="application/ld+json">${raw(JSON.stringify(m.jsonLd))}</script>` : ""}

<link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
<link rel="stylesheet" type="text/css" href="/static/assets/found-min.r3000.css" />
<link rel="stylesheet" type="text/css" media="only screen and (max-device-width:480px)" href="/static/assets/found-pda-min.r3000.css" />
<style>
/* Constrain thumbnails — original ffffound served pre-sized _xs/_s variants;
   our archive only kept the medium variant, so we cover-crop to fit the cell. */
.related_to_item img,
.related_to_item_xs img { width:170px; height:170px; object-fit:cover; display:block; }
.more_images_item img   { width:100px; height:100px; object-fit:cover; display:block; }
</style>
${adsenseEnabled
  ? html`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsensePub}" crossorigin="anonymous"></script>`
  : ""}
</head>
<body>

<div id="content">
<table border="0" cellspacing="0" cellpadding="0" width="99%">

<tr>
  <td width="160"><img src="/static/assets/blank.r3000.gif" width="160" height="1" alt="" /></td>
  <td></td>
</tr>

<tr>
  <td valign="top">
    <div id="logo" class="content_block">
      <a href="/"><img src="/static/assets/found_01.r3000.gif" width="131" height="158" alt="FFFFOUND!" /></a>
    </div>
  </td>
  <td valign="top">
    <div id="title">${props.titleBlock ?? ""}</div>
  </td>
</tr>

<tr>
  <td><img src="/static/assets/blank.r3000.gif" width="1" height="30" alt="" /></td>
  <td></td>
</tr>

<tr>
  <td valign="top">
    <div class="content_block">

      <div id="menu-main">
        <ul class="menu">
          <li id="menu-top" style="margin-bottom:10px;"><a href="/">Top</a></li>
          <li id="menu-about"><a href="/about">About</a></li>
          <li id="menu-screensaver"><a href="javascript:void(0);" style="text-decoration:line-through;">Screensaver</a></li>
          <li id="menu-iphone"><a href="javascript:void(0);" style="text-decoration:line-through;">iPhone</a></li>
          <li id="menu-register"><a href="javascript:void(0);" style="text-decoration:line-through;">Register</a></li>
        </ul>
      </div>

      <div id="menu-legal">
        <ul class="submenu">
          <li><a href="/legal#privacy_policy">Privacy Policy</a></li>
          <li><a href="/legal#term_of_use">Terms of Service</a></li>
        </ul>
      </div>

      <div id="menu-etc">
        <ul class="submenu">
          <li><a href="/log/">Change Log</a></li>
        </ul>
      </div>

      ${adsenseEnabled ? html`
      <div id="menu-ads">
        <ul class="ads">
          <li class="header"><i>advertisement</i></li>
          <li class="ad" id="ad-deck">
            <ins class="adsbygoogle"
                 style="display:block;width:120px"
                 data-ad-client="${adsensePub}"
                 data-ad-slot="${adsenseSlot}"
                 data-ad-format="auto"
                 data-full-width-responsive="false"></ins>
            <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
          </li>
        </ul>
      </div>
      ` : ""}

    </div>
  </td>

  <td valign="top">${props.children}</td>
</tr>

</table>
</div>

</body>
</html>`;
}
