
if (g_kb) {
    g_kb.add('j', function() { move_asset(1); });
    g_kb.add('k', function() { move_asset(-1); });
    g_kb.add('h', function() { move_page(-1); });
    g_kb.add('l', function() { move_page(1); });

    if (g_view == 'list') {
        g_kb.add('d', function() { shortcut_command('remove'); });
        g_kb.add('o', function() { shortcut_command('info'); });
    }

    if (g_view == 'list' || g_view == 'image') {
        g_kb.add('i', function() { shortcut_command('add'); });
    }

    if (g_view == 'list' || g_view == 'tile') {
        g_kb.add('v', function() {
            switch_view_mode();
        });
    }
}

var g_disable_shortcut = false;
function disable_shortcut() {
    if (g_kb) {
        g_disable_shortcut = true;
        g_kb.remove('j');
        g_kb.remove('k');
        g_kb.remove('h');
        g_kb.remove('l');
    }
}

var g_scroll_map = [];
var g_asset_loaded = false;

function add_g_scroll_map(n) {
    var pos = Position.cumulativeOffset(n);
    g_scroll_map.push({id: n.id, y: pos[1] - 20});
}

function calc_scroll_map() {
    g_asset_loaded = false;
    g_scroll_map.clear();

    if ($('paging-prev')) {
        g_scroll_map.push({id: 'prev', y: 0});
    }
    else {
        g_scroll_map.push({id: null, y: 0});
    }

    var nodes = $$('#assets blockquote.asset');
    for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.id.match(/^asset/i)) {
            add_g_scroll_map(n);
        }
    }

    g_scroll_map.sort(function(a, b) {
        return a.y - b.y;
    });

    var last = g_scroll_map.length - 1;

    if ($('paging-next')) {
        g_scroll_map.push({id: 'next', y: document.body.scrollHeight});
    }

    g_asset_loaded = true;

    if (document.referrer.match(location.pathname)) {
        var prev_offset = 0;
        if (document.referrer.match(/[&?]offset=(\d+)/)) {
            prev_offset = RegExp.$1;
        }

        if (prev_offset == g_offset_prev) {
            // move_asset(0, g_scroll_map[1]);
        }
        else if (prev_offset == g_offset_next) {
            move_asset(0, g_scroll_map[last]);
        }
    }
}

var g_ff_ap_enabled = null;
function is_ff_ap_enabled() {
    if (g_ff_ap_enabled == null) {
        // Is this a proper way to detect the autopagerize script?
        g_ff_ap_enabled = $('autopagerize_icon') != null;
    }
    return g_ff_ap_enabled;
}

function move_asset(delta, p) {
    if (g_view == 'tile') {
        var p = where_am_i();
        if (0 < delta && p.is_at_last) {
            move_page_next();
        }
        else if (delta < 0 && p.is_at_top) {
            move_page_prev();
        }
        else {
            keyboard_scroll(0, 160 * delta);
        }

        return true;
    }

    if (!g_asset_loaded) {
        return false;
    }

    if (p == null) {
        p = get_current_asset(delta);
    }

    if (p) {
        if (p.id == 'prev' || p.id == 'next') {
            if (is_ff_ap_enabled()) {
                // If the autopagerize is enabled, then recalc a scroll map.
                if (p.id == 'next') {
                    calc_scroll_map();
                }
            }
            else {
                if (p.id == 'next') {
                    move_page_next();
                }
                else {
                    move_page_prev();
                }
            }

            return false;
        }

        var e = $(p.id + '-link') || $(p.id);
        var x = 0, y = 0;
        if (e) {
            e.focus();
            // x = 150;
            y = p.y;
        }
        else {
            y = p.y;
        }

        window.scrollTo(x, y);
    }

    return true;
}

var g_ma_auto_timer = false;
function move_asset_auto(delta) {
    if (!g_ma_auto_timer) {
        if (!move_asset(delta)) {
            return;
        }

        g_ma_auto_timer = setInterval(function() {
            if (!move_asset(delta)) {
                move_asset_auto_stop();
            }
        }, 200);
    }
}

Event.observe(document, 'mouseup', move_asset_auto_stop);
function move_asset_auto_stop() {
    clearInterval(g_ma_auto_timer);
    g_ma_auto_timer = false;
}

function move_asset_wheel(e) {
    if (g_disable_shortcut) {
        return;
    }

    if (e.preventDefault) {
        e.preventDefault();
    }
    e.returnValue = false;

    var n = - Event.wheel(e);
    move_asset(0 < n ? 1 : -1);
}

function get_current_asset(delta, y) {
    if (y == null) {
        y = getScrollTop();
    }

    var p = g_scroll_map.length - 1;

    for (var i = 0; i < g_scroll_map.length; i++) {
        if (y < g_scroll_map[i].y) {
            p = i - 1;
            break;
        }
    }

    if ((delta < 0 && g_scroll_map[p] && g_scroll_map[p].y == y) || 0 < delta) {
        p += delta;
    }

    if (getWindowBounds().h + getScrollTop() == document.body.scrollHeight && 0 < delta) {
        p++;
    }

    p = Math.max(p, 0);

    return g_scroll_map[p];
}

function where_am_i() {
    var st = document.body.scrollTop;
    var sl = document.body.scrollLeft;
    var sh = document.body.scrollHeight;
    var ch = 0;

    if (navigator.userAgent.indexOf('Chrome/') > -1) {
        ch = document.body.clientHeight;
    }
    else if (Prototype.Browser.WebKit) {
        ch = window.innerHeight;
    }
    else {
        ch = document.body.clientHeight;
    }

    return {
        'top': st,
        'left': sl,
        'height': sh,
        'clientHeight': ch,

        'is_at_top': st == 0 && sl == 0,
        'is_at_last': st + ch == sh && sl == 0 
    }
}

function move_page(delta) {
    /*
    if (delta < 0) {
        if ($('paging-prev')) {
            redirect($('paging-prev').href);
            disable_shortcut();
        }
    }
    else {
        if ($('paging-next')) {
            redirect($('paging-next').href);
            disable_shortcut();
        }
    }
    */

    var p = where_am_i();

    if (delta < 0) {
        if (p.is_at_top) {
            move_page_prev();
        }
        else {
            window.scroll(0, 0);
        }
    }
    else {
        if (p.is_at_last) {
            move_page_next();
        }
        else {
            window.scroll(0, p.height);
        }
    }
}

function move_page_next() {
    if ($('paging-next')) {
        redirect($('paging-next').href);
        disable_shortcut();
        return true;
    }
    else {
        return false;
    }
}

function move_page_prev() {
    if ($('paging-prev')) {
        redirect($('paging-prev').href);
        disable_shortcut();
        return true;
    }
    else {
        return false;
    }
}

function shortcut_command(type) {
    if (!g_asset_loaded) {
        return;
    }

    var p = null;
    if (g_view == 'image') {
        var nodes = $$('#assets blockquote.asset');
        if (0 < nodes.length) {
            p = { 'id': nodes[0].id };
        }
    }
    else {
        var b = getWindowBounds();
        var y = b.y + (b.h / 2);
        p = get_current_asset(0, y);
    }

    if (p && p.id && p.id.match(/^asset/i)) {
        var e = $(p.id);
        if (e) {
            var a = $(p.id + '-' + type);
            if (a && a.onclick) {
                a.onclick();

                if (type == 'add') {
                    var t = setInterval(function () {
                        if (e.style.backgroundColor == '') {
                            e.style.backgroundColor = 'yellow';
                            setTimeout(function () {
                                e.style.backgroundColor = '';
                            }, 100);
                        }
                    }, 200);

                    setTimeout(function () {
                        clearInterval(t);
                        e.style.backgroundColor = '';
                    }, 1000);
                }
            }
            else if (a && a.href) {
                location.href = a.href;
            }
        }
    }
}

function recalcNaviPosition() {
    var b = getWindowBounds();
    $('float-navi').setStyle({
        'position': 'absolute',
        'top': b.y + 10,
        'left': b.x + b.w - 230
    });
}

function switch_view_mode() {
    var nm = 'tile';
    if (g_view == nm) {
        nm = 'list';
    }

    var d = new Date(new Date().getTime() + (60 * 60 * 24 * 365 * 10));
    document.cookie = 'v=' + nm + ';expires=Thu, 01-Jan-1970 00:00:01 GMT';
    document.cookie = 'v=' + nm + ';expires=' + d.toGMTString() + ';path=/';
    location.reload();
}

function build_pagination(el, s, e, pl, c) {
    var html = [];
    for (var i = s; i <= e; i++) {
        var n = i + 1;
        if (i == c) {
            html.push('<span class="paging selected">');
            html.push('&nbsp;', n, '&nbsp;');
            html.push('</span>', "\n");
        }
        else {
            html.push('<span class="paging">');
            html.push('<a href="?offset=', i * pl,'&">&nbsp;', n, '&nbsp;</a>');
            html.push('</span>', "\n");
        }
    }
    el.update(html.join(''));
}

//

function initAssetsPage() {
    if (Prototype.Browser.MobileSafari) {
        return;
    }

    $(document).observe('dom:loaded', function() {
        calc_scroll_map();

        Event.observe($('float-navi'), 'mousewheel', move_asset_wheel, false);
        Event.observe($('float-navi'), 'DOMMouseScroll', move_asset_wheel, false);

        $('float-navi').show();
        recalcNaviPosition();
        Event.observe(window, 'scroll', recalcNaviPosition);
        Event.observe(window, 'resize', recalcNaviPosition);
    });
}

function initImagePage() {
    $(document).observe('dom:loaded', function() {
        g_asset_loaded = true;
    });
}

