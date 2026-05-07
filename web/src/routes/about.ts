import type { Context } from "hono";
import { html, raw } from "hono/html";
import type { Env } from "../types";
import { Layout } from "../layout";
import { absUrl } from "./_url";

// Captured verbatim from the May 7, 2017 WARC of http://ffffound.com/about,
// with three minimal edits for the preservation site context:
//   - static.ffffound.com asset URLs rewritten to /static/...
//   - the bookmarklet's javascript: link wrapped in <s> (historical, dead)
//   - the IE Extension <s>'d (Found.Install.exe is not preserved)
const ABOUT_BODY = `
<div class="content_block content_main">

<a name="about"></a>
<h3>About FFFFOUND!</h3>
<table border="0" cellspacing="0" cellpadding="0" class="text">

<tr>
<td width="48%" valign="top" class="en">

    <p>FFFFOUND! is a web service that not only allows the users to post and share their favorite images found on the web, but also dynamically recommends each user's tastes and interests for an inspirational image-bookmarking experience!!</p>

</td>
<td width="4%"></td>
<td width="48%" valign="top" class="jp">

    <p>FFFFOUND!とはウェブで見つけたお気に入り画像をメモって、シェアして、さらに好みを反映させることで自分好みの画像がおすすめされて、インスピレーションが湧きまくるサービスです。</p>

</td>
</tr>

</table>

<a name="learn"></a>
<h3>Learn Learn Learn! and Add!</h3>
<table border="0" cellspacing="0" cellpadding="0" class="text">

<tr>
<td width="48%" valign="top" class="en">

    <p>The more you reflect your taste, the better recommendations on the New for you! pages.</p>

</td>
<td width="4%"></td>
<td width="48%" valign="top" class="jp">

    <p>あなたの趣味を反映させることでNew for you!ページでレコメンドされる画像の精度が上がります。</p>

</td>
</tr>

<tr>
<td width="48%" valign="top" class="en">

    <ol>
    <li>Go to the top page to find your favorite images. </li>
    <li>Let the server learn either by clicking on the &quot;I <tt class="heart">&hearts;</tt> THIS&quot; button or by posting new images that suit your interest.<br><img src="/static/assets/ilikethis_help.r3000.gif" width="264" height="194" style="margin:10px 0 10px 0"></li>
    <li>Repeat the above, the better recommendations you get on the New for you! pages.</li>
    </ol>


</td>
<td width="4%"></td>
<td width="48%" valign="top" class="jp">

    <ol>
    <li><a href="/">トップページ</a>に行き好きな画像を探してください。</li>
    <li>気に入った画像の下にある「I <tt class="heart">&hearts;</tt> THIS」ボタンを押すか、お気に入りの画像を追加する事によって、サーバにあなたの好みを学習させてください。<br><img src="/static/assets/ilikethis_help.r3000.gif" width="264" height="194" style="margin:10px 0 10px 0"></li>
    <li>あなたの好みの画像がNew for you!ページに表示されるまで繰り返しましょう！</li>
    </ol>

</td>
</tr>

</table>


<a name="bookmarklet"></a>
<h3>How to use</h3>
<table border="0" cellspacing="0" cellpadding="0" class="text">

<tr>
<td width="48%" valign="top" class="en">

    <p>The bookmarklet allows for an easier bookmarking process. Bookmarked images can be viewed by other users.</p>

    <p>In order to use FFFFOUND!, you need to install either the bookmarklet or an Internet Explorer extension. If you are an IE user on a Windows XP machine, IE extension is recommended; for all others, please download the bookmarklet.</p>

</td>
<td width="4%"></td>
<td width="48%" valign="top" class="jp">

    <p>ブックマークレットを使ってネットで見つけたお気に入り画像を簡単にブックマークできます。ブックマークされた画像は他の人も見ることができます。</p>

    <p>FFFFOUND!を使用するにはブックマークレットまたはIE拡張のいずれかをインストールする必要があります。Windows XPでIEをご使用の方はIE拡張をご使用することをお勧めします。その他のユーザはブックマークレットをご使用ください。</p>

</td>
</tr>

<tr>
<td width="48%" valign="top" class="en">

    <h4>FFFFOUND! Bookmarklet (For all browsers.)</h4>
    <s><div class="bookmarklet linkbox">POST TO FFFFOUND!</div></s>
    <p style="color:#888;font-size:11px;margin-top:6px;">(historical &mdash; the bookmarklet posted to the original FFFFOUND! servers and is no longer functional.)</p>

</td>
<td width="4%"></td>
<td width="48%" valign="top" class="jp">

    <h4>FFFFOUND! ブックマークレット (全ブラウザ向け)</h4>
    <s><div class="bookmarklet linkbox">POST TO FFFFOUND!</div></s>

</td>
</tr>

<tr>
<td width="48%" valign="top" class="en">

    <a name="extension"></a>

    <h4>FFFFOUND! IE Extension for Windows XP</h4>
    <s><div class="download linkbox">FFFFOUND! IE Extension</div></s>
    <p style="color:#888;font-size:11px;margin-top:6px;">(historical &mdash; the .NET&nbsp;1.1 installer was not preserved in the archive.)</p>

</td>
<td width="4%"></td>
<td width="48%" valign="top" class="jp">

    <h4>FFFFOUND! IE拡張 for Windows XP</h4>
    <s><div class="download linkbox">FFFFOUND! IE拡張</div></s>

</td>
</tr>

</table>

</div>
`;

export async function aboutRoute(c: Context<{ Bindings: Env }>) {
  const titleBlock = html`<h1>Find, bookmark and share your favorite images !!</h1>`;

  return c.html(
    Layout({
      title: "About",
      titleBlock,
      env: c.env,
      meta: {
        description: "About FFFFOUND! — the original 2007–2017 about page, preserved.",
        canonical: absUrl(c, "/about"),
        ogType: "article",
      },
      children: raw(ABOUT_BODY),
    }),
  );
}
