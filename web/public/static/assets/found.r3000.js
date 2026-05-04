
FoundAPI = {
    errmsg: {
          'USER_NOT_EXISTS': 'Username/E-Mail or Password is incorrect.'
        , 'AUTH_FAILED': 'Username/E-Mail or Password is incorrect.'
        , 'LOGGED_IN': 'A logged in user cannot sign-up.'
        , 'INVITATION_CODE': 'Your invitation code is invalid or expired.'
        , 'HOSTNAME': 'You must enter a username(alphabets and numerics only, 4-20 chars).'
        , 'PASSWORD': 'You must enter a password(more than 4 chars).'
        , 'RESET_KEY': 'Your password reset key is invalid.'
        , 'EMAIL': 'You must enter a E-Mail.'
        , 'HOSTNAME_EXISTS': 'The username you entered already exists.'
        , 'EMAIL_EXISTS': 'Your E-Mail is already registered.'
        , 'URL': 'Your URL is invalid format.'
        , 'TARGET_USER_EXISTS': 'The username you entered already exists.'
        , 'TARGET_USER_NOT_EXISTS': 'The username you entered doesn\'t exist'
    }

    , register: function(form) {
        var self = this;
        var params = form.serialize(true);
        params['display_name'] = params['hostname'];

        form.disable();

        new Ajax.Request('/gateway/in/api/register',
            {
                method: 'post',
                parameters: params,

                onComplete: function(req) {
                    try {
                        var res = eval('(' + req.responseText + ')');
                        if (res.success) {
                            location.href = '/home/' + res.hostname;
                        }
                        else {
                            form.enable();
                            var msg = self.errmsg[res.error] || res.error;
                            window.alert(msg);
                        }
                    }
                    catch (e) {
                        form.enable();
                        window.alert(e.message);
                    }
                },

                onFailure: function(req) {
                    form.enable();
                    window.alert('connection failed.');
                }
            }
        );
    }

    , updateProfile: function(form) {
        var self = this;
        new Ajax.Request('/gateway/in/api/update_profile',
            {
                method: 'post',
                parameters: form.serialize(true),

                onComplete: function(req) {
                    try {
                        var res = eval('(' + req.responseText + ')');
                        if (res.success) {
                            window.alert('Your profile is updated.');
                        }
                        else {
                            var msg = self.errmsg[res.error] || res.error;
                            window.alert(msg);
                        }
                    }
                    catch (e) {
                        window.alert(e.message);
                    }
                },

                onFailure: function(req) {
                    window.alert('connection failed.');
                }
            }
        );
    }

    , signin: function(form, href) {
        var self = this;
        new Ajax.Request('/gateway/in/api/login',
            {
                method: 'post',
                parameters: form.serialize(true),

                onComplete: function(req) {
                    try {
                        var res = eval('(' + req.responseText + ')');
                        if (res.success) {
                            if (href == null) {
                                location.reload();
                            }
                            else {
                                if (!href.match(/^\//)) {
                                    href = '/';
                                }

                                location.href = href;
                            }
                        }
                        else {
                            var msg = self.errmsg[res.error] || res.error;
                            window.alert(msg);
                        }
                    }
                    catch (e) {
                        window.alert(e.message);
                    }
                },

                onFailure: function(req) {
                    window.alert('connection failed.');
                }
            }
        );
    }

    , signout: function() {
        new Ajax.Request('/gateway/in/api/logout',
            {
                method: 'post',

                onComplete: function(req) {
                    location.href = '/';
                },

                onFailure: function(req) {
                    window.alert('connection failed.');
                }
            }
        );
    }

    , resetPassword: function(form) {
        var self = this;
        new Ajax.Request('/gateway/in/api/reset_password',
            {
                method: 'post',
                parameters: form.serialize(true),

                onComplete: function(req) {
                    try {
                        var res = eval('(' + req.responseText + ')');
                        if (res.success) {
                            window.alert('We sent you a password reset key by an email.');
                        }
                        else {
                            var msg = self.errmsg[res.error] || res.error;
                            window.alert(msg);
                        }
                    }
                    catch (e) {
                        window.alert(e.message);
                    }
                },

                onFailure: function(req) {
                    window.alert('connection failed.');
                }
            }
        );
    }

    , setPassword: function(form) {
        var self = this;
        new Ajax.Request('/gateway/in/api/set_password',
            {
                method: 'post',
                parameters: form.serialize(true),

                onComplete: function(req) {
                    try {
                        var res = eval('(' + req.responseText + ')');
                        if (res.success) {
                            window.alert('Your new password set successfully.');
                            location.href = '/';
                        }
                        else {
                            var msg = self.errmsg[res.error] || res.error;
                            window.alert(msg);
                        }
                    }
                    catch (e) {
                        window.alert(e.message);
                    }
                },

                onFailure: function(req) {
                    window.alert('connection failed.');
                }
            }
        );
    }

    , report: function(form) {
        var collection_id = $('form-report-collection_id').value;
        if (form) {
            var params = form.serialize(true);
            params.collection_id = collection_id;

            if (params.email.match(/^\s*$/)) {
                window.alert('Please input your E-Mail address.');
                return;
            }

            if (params.description.match(/^\s*$/)) {
                window.alert('Please input the reason.');
                return;
            }

            var self = this;
            new Ajax.Request('/gateway/in/api/report',
                {
                    method: 'post',
                    parameters: params,

                    onComplete: function(req) {
                        try {
                            var res = eval('(' + req.responseText + ')');
                            if (res.success) {
                                window.alert("Thank you for your report.\nWe will review this issue immediately.");
                                g_screen.hide();
                            }
                            else {
                                var msg = self.errmsg[res.error] || res.error;
                                window.alert(msg);
                            }
                        }
                        catch (e) {
                            window.alert(e.message);
                        }
                    },

                    onFailure: function(req) {
                        window.alert('connection failed.');
                    }
                }
        );
        }
        else {
            this.addToMyCollection(collection_id, true);
        }
    }

    , addToMyCollection: function(collection_id, inappropriate) {
        if (inappropriate == true) {
            if (!window.confirm("Do you think this image would be inappropriate?\nこの画像は不適切ですか？")) {
                return true;
            }
        }

        var e1 = $('asset' + collection_id + '-add');
        var eo = [$('asset' + collection_id + '-inappropriate'), $('asset' + collection_id + '-sep')];

        if (!e1) {
            alert('an element not found');
            return;
        }

        e1.hide();
        eo.each(function (e) {
            if (e) {
                e.hide();
            }
        });

        var params = {};
        params.collection_id = collection_id;
        params.inappropriate = inappropriate == true;

        new Ajax.Request('/gateway/in/api/add_asset',
            {
                method: 'post',
                parameters: params,

                onComplete: function(req) {
                    try {
                        var res = eval('(' + req.responseText + ')');
                        if (res.success || res.error == 'EXISTS') {
                        }
                        else {
                            e1.show();
                            eo.each(function (e) {
                                if (e) {
                                    e.show();
                                }
                            });

                            window.alert(res.error);
                        }

                        if (inappropriate) {
                            g_screen.hide();
                        }
                    }
                    catch (e) {
                        window.alert(e.message);
                    }
                },

                onFailure: function(req) {
                    e1.show();
                    eo.each(function (e) {
                        if (e) {
                            e.show();
                        }
                    });

                    window.alert('connection failed.');
                }
            }
        );

        return true;
    }

    , removeAsset: function(collection_id, element) {
        if (!window.confirm('Are you sure to remove this item?')) {
            return false;
        }

        if (g_view == 'image') {
            $(element.id + '-remove').hide();
        }
        else {
            element.hide();
        }

        if (window.calc_scroll_map) {
            calc_scroll_map();
        }

        var params = {};
        params.collection_id = collection_id;

        new Ajax.Request('/gateway/in/api/remove_asset',
            {
                method: 'post',
                parameters: params,

                onComplete: function(req) {
                    try {
                        var res = eval('(' + req.responseText + ')');
                        if (res.success) {
                        }
                        else {
                        }
                    }
                    catch (e) {
                        window.alert(e.message);
                    }
                },

                onFailure: function(req) {
                    window.alert('connection failed.');
                }
            }
        );

        return true;
    }

    // obsolete, but i keep this code here for api lovers.
    , getImageInfo: function(hash_key, collection_id, element) {
        var params = {};
        params.hash_key = hash_key;
        params.collection_id = collection_id;

        new Ajax.Request('/gateway/in/api/get_image_info',
            {
                method: 'get',
                parameters: params,
                onComplete: function(req) {},
                onFailure: function(req) {}
            }
        );
    }

    , getAssets: function (params, callback) {
        this._request('get_assets', params, callback);
    }

    , addRecommender: function(hostname, callback) {
        var params = {};
        params.hostname = hostname;
        this._request('add_recommender', params, callback);
    }

    , removeRecommender: function(hostname, callback) {
        var params = {};
        params.hostname = hostname;
        this._request('remove_recommender', params, callback);
    }

    , getRecommenderSuggestion: function(callback) {
        this._request('get_recommender_suggestion', null, callback);
    }

    , _request: function(method, params, callback) {
        var self = this;
        new Ajax.Request('/gateway/in/api/' + method,
            {
                method: 'post',
                parameters: params,
                onComplete: function(req) {
                    try {
                        var res = eval('(' + req.responseText + ')');
                        if (res.success) {
                            callback(res);
                        }
                        else {
                            var msg = self.errmsg[res.error] || res.error;
                            window.alert(msg);
                        }
                    }
                    catch (e) {
                        window.alert(e.message);
                    }
                },
                onFailure: function(req) {
                    window.alert('connection failed.');
                }
            }
        );
    }

    , calcRectSizeBasedOnMax: function(w, h, max) {
        var nw = 0;
        var nh = 0;

        if (w < max && h < max) {
            nw = w;
            nh = h;
        }
        else if (h < w) {
            nw = max;
            nh = Math.round((max / w) * h);
        }
        else {
            nh = max;
            nw = Math.round((max / h) * w);
        }

        return [nw, nh];
    }
}

function getWindowBounds() {
    var w, h, x, y;

    if (Prototype.Browser.Gecko) {
        var b = document.body;
        w = b.clientWidth;
        h = b.clientHeight;
        x = window.scrollX;
        y = window.scrollY;
    }
    else if (Prototype.Browser.WebKit) {
        w = window.innerWidth;
        h = window.innerHeight;
        x = window.scrollX;
        y = window.scrollY;
    }
    else if (Prototype.Browser.Opera) {
        w = window.innerWidth;
        h = window.innerHeight;
        x = window.pageXOffset;
        y = window.pageYOffset;
    }
    else {
        var d = document.documentElement;
        var b = document.body;
        w = d.clientWidth  ? d.clientWidth  : b.clientWidth  ? b.clientWidth  : 0;
        h = d.clientHeight ? d.clientHeight : b.clientHeight ? b.clientHeight : 0;
        x = d.scrollLeft   ? d.scrollLeft   : b.scrollLeft   ? b.scrollLeft   : 0;
        y = d.scrollTop    ? d.scrollTop    : b.scrollTop    ? b.scrollTop    : 0;
    }

    /*
    if (w == 0 && h == 0 && x == 0 && y == 0) {
        window.alert('failed to get window bounds.');
    }
    */

    return {
        'w': w,
        'h': h,
        'x': x,
        'y': y
    };
}

function getScrollLeft() {
    return window.pageXOffset
        || document.documentElement.scrollLeft
        || document.body.scrollLeft
        || 0;
}

function getScrollTop() {
    return window.pageYOffset
        || document.documentElement.scrollTop
        || document.body.scrollTop
        || 0;
}

function button(img) {
    var s = img.src;
    if (s.match(/_01/)) {
        img.src = s.replace('_01', '_02');
    }
    else if (s.match(/_02/)) {
        img.src = s.replace('_02', '_01');
    }
}

// IE won't set document.referrer when location.href is called, so we use normal anchor tag to change location.
function redirect(href) {
    if (Prototype.Browser.IE) {
        var a = document.createElement('a');
        a.style.display = 'none';
        a.href = href;
        document.body.appendChild(a);
        a.click();
    }
    else {
        location.href = href;
    }
}


var AlphaScreen = Class.create({
    s: null,
    c: null,

    initialize: function() {
        this.s = $(document.createElement('div'));
        this.s.id = '__screen';
        this.s.setStyle({
            display: 'none',
            position: 'absolute',
            backgroundColor: '#ffffff',
            zIndex: 10000
        });

        Event.observe(window, 'resize', this._resize.bind(this));
        Event.observe(window, 'scroll', this._resize.bind(this));
    }

    , init: function() {
        document.body.appendChild(this.s);
        this._resize();
    }

    , _resize: function() {
        var b = getWindowBounds();

        this.s.setStyle({
            top: '0px',
            left: '0px',
            width: (b.w + b.x) + 'px',
            height: (b.h + b.y) + 'px'
        });

        if (this.c) {
            var d = this.c.getDimensions();

            this.c.setStyle({
                top: b.y + (b.h / 2 - d.height / 2) + 'px',
                left: b.x + (b.w / 2 - d.width / 2) + 'px'
            });
        }
    }

    , setAlpha: function(opacity) {
        this.s.setStyle({
            'opacity': opacity
        });
    }

    , onClick: function(func) {
        this.s.onclick = func;
        if (this.c) {
            this.c.onclick = func;
        }
    }

    , onClickScreen: function(func) {
        this.s.onclick = func;
    }

    , onClickContainer: function(func) {
        if (this.c) {
            this.c.onclick = func;
        }
    }

    , setContainer: function(e) {
        this.c = e;
    }

    , setStyle: function(style) {
        this.s.setStyle(style);
    }

    , centerize: function() {
        if (!this.c) {
            return;
        }

        var b = getWindowBounds();

        var d = this.c.getDimensions();

        this.c.setStyle({
            top: b.y + (b.h / 2 - d.height / 2) + 'px',
            left: b.x + (b.w / 2 - d.width / 2) + 'px'
        });
    }

    , show: function() {
        [this.s, this.c].each(function(e) {
            if (e) {
                e.show();
            }
        });
    }

    , hide: function() {
        [this.s, this.c].each(function(e) {
            if (e) {
                e.hide();
            }
        });
    }
});

var g_screen = new AlphaScreen();


//
//
var g_kb = false;
try {
    g_kb = new HotKey();
    g_kb.add('r', function() { location.reload(); });
    g_kb.add('e', function() { location.href = '/'; });
    g_kb.add('m', function() { location.href = '/home/'; });
}
catch (e) {
}

function keyboard_scroll(dx, dy) {
    var x = getScrollLeft() + dx;
    var y = getScrollTop() + dy;
    window.scrollTo(x, y);
}


/*
 * Orginal: http://adomas.org/javascript-mouse-wheel/
 * prototype extension by "Frank Monnerjahn" <themonnie@gmail.com>
 */
Object.extend(Event, {
    wheel:function (event){
        var delta = 0;
        if (!event) event = window.event;
        if (event.wheelDelta) {
            delta = event.wheelDelta/120; 
            if (window.opera) delta = -delta;
        } else if (event.detail) { delta = -event.detail/3; }
        return Math.round(delta); //Safari Round
    }
});


// ui click track
function ga_uct(path) {
    if (g_ga_enabled && window.pageTracker) {
        window.pageTracker._trackEvent('ui', 'click', path);
    }
}

// ui time track
function ga_utt(path, time) {
    if (g_ga_enabled && window.pageTracker) {
        var t = Math.round(time / 1000);
        window.pageTracker._trackEvent('ui', 'time',  path, t);
    }
}

// ui ad track
function ga_uat(path) {
    if (g_ga_enabled && window.pageTracker) {
        //window.pageTracker._trackEvent('ad', 'click', path);
        window.pageTracker._trackPageview('/@ui/click/ad' + path);
    }
}

function ga_install_uat(e, path) {
    var e = $(e);
    if (e) {
        e.onclick = function () {
            ga_uat(path);
        };
    }
}



