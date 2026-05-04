import { html } from "hono/html";

// Faithful 2017 ffffound chrome. Markup mirrors the captured pages (table-based
// layout, original class names) so the original `found-min.r3000.css` styles it
// without modification. Layout structure:
//
//   row 1: 160-wide spacer cell + empty cell  (sets column widths)
//   row 2: logo + "title"   (logo column 160px, title column flexible)
//   row 3: 30-tall spacer
//   row 4: sidebar menu + main content
//
// The sidebar / nav menu reproduces the captured menu items but with all the
// signed-in / interactive ones either removed or stubbed (the site is read-only).
export function Layout(props: { title: string; children: unknown; titleBlock?: unknown }) {
  return html`<!doctype html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=890" />
<title>${props.title} | FFFFOUND!</title>
<link rel="shortcut icon" type="image/ico" href="/favicon.ico" />
<link rel="stylesheet" type="text/css" href="/static/assets/found-min.r3000.css" />
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
          <li id="menu-screensaver"><a href="/screensaver/">Screensaver</a></li>
          <li id="menu-iphone"><a href="/iphone/">iPhone</a></li>
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

    </div>
  </td>

  <td valign="top">${props.children}</td>
</tr>

</table>
</div>

</body>
</html>`;
}
