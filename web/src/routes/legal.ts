import type { Context } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { Layout } from "../layout";
import { absUrl } from "./_url";

export async function legalRoute(c: Context<{ Bindings: Env }>) {
  const titleBlock = html`<h1>Legal</h1>`;

  return c.html(
    Layout({
      title: "Legal",
      titleBlock,
      env: c.env,
      meta: {
        description: "Privacy and terms for the FFFFOUND! preservation site.",
        canonical: absUrl(c, "/legal"),
        ogType: "article",
      },
      children: html`
<div class="content_block content_main">

<a name="privacy_policy"></a>
<h3>Privacy Policy</h3>
<table border="0" cellspacing="0" cellpadding="0" class="text">
<tr><td valign="top" class="en">
  <p>This site is a read-only archive. There are no accounts, no sign-up, no
  user submissions, and no personalised content. We do not set tracking
  cookies and we do not run analytics scripts.</p>
  <p>Requests are served by Cloudflare. Your browser's IP address and
  user-agent reach Cloudflare's edge as part of the standard HTTP request, and
  Cloudflare may retain those in routine access logs for a limited period.
  We do not access, store, or share that data ourselves.</p>
  <p>If advertising is enabled on this deployment, the ad provider (Google
  AdSense) may set its own cookies; see Google's privacy policy for details.
  Ads can be blocked client-side without affecting the archive.</p>
</td></tr>
</table>

<a name="term_of_use"></a>
<h3>Terms of Use</h3>
<table border="0" cellspacing="0" cellpadding="0" class="text">
<tr><td valign="top" class="en">
  <p>FFFFOUND! operated from 2007 to 2017 and was created by Yosuke Abe and
  Keita Kitamura at Tha (Yugo Nakamura). This site is an unofficial
  read-only preservation built from publicly distributed WARC captures of
  May 7, 2017 and April 27, 2017. It is provided for historical and reference
  purposes.</p>
  <p>Image bytes and page content are reproduced as captured. Original
  copyrights remain with their respective rights-holders. If you are a
  rights-holder and want a specific image removed, contact us via the address
  on the <a href="#contact">Contact</a> section below.</p>
  <p>This site is not affiliated with, endorsed by, or operated by the
  original FFFFOUND! team or Tha. No warranty of any kind is offered.</p>
</td></tr>
</table>

<a name="contact"></a>
<h3>Contact</h3>
<table border="0" cellspacing="0" cellpadding="0" class="text">
<tr><td valign="top" class="en">
  <p>For takedown requests or operational issues, email
  <a href="mailto:hello@ffffound.online">hello@ffffound.online</a>.</p>
</td></tr>
</table>

</div>
      `,
    }),
  );
}
