import { NextResponse, type NextRequest } from "next/server";

const UPSTREAM = "https://trainer.thetamusic.com";

// CSS — hide ALL login/signup/pricing/auth elements. Very aggressive.
const CLEANUP_CSS = `
<style id="__theta_cleanup">
/* Theta Music custom user blocks (the main login bar) */
.block-tmcustom-user, .block-tmcustom-username-link-block,
.block-tmcustom, .block-tmcustom *:not(#gameArea):not(#gameCanvas):not(#gameSVG):not(#gameSVG2),
/* Standard Drupal user blocks */
.block-user-login, .block-user, .block-user-menu,
.login-block, .auth-modal, .user-login-form,
#block-userlogin, #block-userlogin-2,
.region-sidebar-first .block-user,
.region-sidebar-second .block-user,
/* Header buttons */
.signup, .signin, .signup-or-login-dialog-link,
.top_create_account, .top_sign_in,
.landingpage_signup, .landingpage_login,
.sign_in_sign_up, .go-premium-button-anonymous-user,
a.signup, a.signin, a.top_create_account, a.top_sign_in,
button.landingpage_signup, button.landingpage_login,
/* Menu items */
.menu-item--user, .menu-item--login, .menu-item--signup,
li.menu-item--user a, li.menu-item--login a, li.menu-item--signup a,
.nav li a[href*="user/login"], .nav li a[href*="user/register"],
#superfish-main a[href*="user/login"],
#superfish-main a[href*="user/register"],
#superfish-main a[href*="subscription"],
a[href*="pricing"], a[href*="subscription"],
.pricing-link, .menu-item--pricing,
.sf-menu li a.signup, .sf-menu li a.signin,
/* Generic — hide anything with these in class */
[class*="login-modal"], [class*="signup-modal"],
[class*="auth-modal"], [class*="register-form"],
[id*="login-modal"], [id*="signup-modal"],
[class*="paywall"], [class*="subscribe"], [class*="upgrade"],
[class*="locked-content"], [class*="premium-only"],
[class*="membership"], [class*="pricing-table"],
[id*="paywall"], [id*="subscribe"],
[class*="cookie"], [class*="gdpr"], [class*="consent"],
[class*="privacy-banner"], #cookie-banner, #gdpr-banner,
.game-login-overlay, .game-locked, .locked-overlay,
[class*="game-login"], [class*="game-locked"] {
  display: none !important;
}
/* Force game area always visible */
#gameArea, #gameSVG, #gameSVG2, .game-content, .game-canvas,
#main-wrapper, #main, .region-content {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}
</style>
`;

// JS — aggressive unlock. Patches drupalSettings, intercepts AJAX auth checks,
// auto-dismisses login dialogs, and fakes membership status.
const UNLOCK_JS = `
<script id="__theta_unlock">
(function() {
  "use strict";

  // ─── 1) Fake drupalSettings ──────────────────────────────────────────
  var fakeSettings = {
    uid: 999999,
    validMembership: true,
    is_student: false,
    is_teacher: false,
    playOrPractice: 1,
    startGameFromPlayScreen: 1,
    allowProblemRetry: true,
  };
  window.drupalSettings = window.drupalSettings || {};
  Object.assign(window.drupalSettings, fakeSettings);

  // Re-apply whenever drupalSettings is reassigned
  var _ds = window.drupalSettings;
  try {
    Object.defineProperty(window, 'drupalSettings', {
      get: function() { return _ds; },
      set: function(v) { _ds = v || {}; Object.assign(_ds, fakeSettings); },
      configurable: true,
    });
  } catch(e) {}

  // ─── 2) Intercept fetch() — fake auth responses ──────────────────────
  var origFetch = window.fetch;
  window.fetch = function(url, opts) {
    var u = typeof url === 'string' ? url : (url && url.url) || '';
    // If it's an auth check endpoint, return fake "logged in" response
    if (u.indexOf('/user/login') >= 0 || u.indexOf('/user/register') >= 0 ||
        u.indexOf('/api/check-auth') >= 0 || u.indexOf('/api/user') >= 0 ||
        u.indexOf('/api/membership') >= 0) {
      return Promise.resolve(new Response(JSON.stringify({
        uid: 999999, logged_in: true, validMembership: true,
        roles: ['authenticated', 'member', 'premium'],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return origFetch.apply(this, arguments);
  };

  // ─── 3) Intercept XMLHttpRequest ─────────────────────────────────────
  var origXHROpen = XMLHttpRequest.prototype.open;
  var origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this.__url = url;
    return origXHROpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    var self = this;
    var url = self.__url || '';
    if (url.indexOf('/user/login') >= 0 || url.indexOf('/user/register') >= 0 ||
        url.indexOf('/api/check-auth') >= 0 || url.indexOf('/api/user') >= 0 ||
        url.indexOf('/api/membership') >= 0) {
      // Fake a successful auth response
      setTimeout(function() {
        Object.defineProperty(self, 'readyState', { value: 4, writable: true });
        Object.defineProperty(self, 'status', { value: 200, writable: true });
        Object.defineProperty(self, 'responseText', {
          value: JSON.stringify({ uid: 999999, logged_in: true, validMembership: true }),
          writable: true,
        });
        Object.defineProperty(self, 'response', {
          value: JSON.stringify({ uid: 999999, logged_in: true, validMembership: true }),
          writable: true,
        });
        if (self.onreadystatechange) self.onreadystatechange();
        if (self.onload) self.onload();
        self.dispatchEvent(new Event('load'));
        self.dispatchEvent(new Event('loadend'));
      }, 10);
      return;
    }
    return origXHRSend.apply(this, arguments);
  };

  // ─── 4) Intercept login redirects ────────────────────────────────────
  var origPush = history.pushState;
  history.pushState = function(state, title, url) {
    if (typeof url === 'string' && (url.indexOf('login') >= 0 || url.indexOf('user/login') >= 0 || url.indexOf('signin') >= 0)) return;
    return origPush.apply(this, arguments);
  };
  var origReplace = history.replaceState;
  history.replaceState = function(state, title, url) {
    if (typeof url === 'string' && (url.indexOf('login') >= 0 || url.indexOf('user/login') >= 0 || url.indexOf('signin') >= 0)) return;
    return origReplace.apply(this, arguments);
  };

  // ─── 5) Auto-dismiss login dialogs / popups ──────────────────────────
  function dismissLoginStuff() {
    // Click "Play as guest" / "Continue" / "Skip" buttons
    document.querySelectorAll('button, a').forEach(function(el) {
      var t = (el.textContent || '').trim().toLowerCase();
      if (t === 'play as guest' || t === 'continue as guest' || t === 'guest' ||
          t === 'skip' || t === 'continue' || t === 'no thanks' ||
          t === 'maybe later' || t === 'close' || t === 'dismiss' ||
          t === 'got it' || t === 'ok' || t === 'x' || t === '×') {
        // Only if it's in a dialog/modal/overlay, not the game itself
        var parent = el.closest('[class*="modal"], [class*="dialog"], [class*="overlay"], [class*="popup"], [role="dialog"]');
        if (parent && parent.getBoundingClientRect().height > 0) {
          el.click();
        }
      }
    });

    // Hide any visible login/signup sections
    document.querySelectorAll(
      '.block-tmcustom-user, .block-tmcustom-username-link-block, ' +
      '.block-tmcustom, .block-user-login, .block-user, ' +
      '.sign_in_sign_up, .signup, .signin, ' +
      '[class*="login-modal"], [class*="signup-modal"], [class*="auth-modal"], ' +
      '[class*="paywall"], [class*="locked"], [class*="premium-only"]'
    ).forEach(function(el) {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
    });
  }

  // Run on DOMContentLoaded + periodically
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', dismissLoginStuff);
  } else {
    dismissLoginStuff();
  }

  var runs = 0;
  var interval = setInterval(function() {
    dismissLoginStuff();
    // Re-apply drupalSettings in case Drupal JS overwrites them
    if (window.drupalSettings) {
      window.drupalSettings.uid = 999999;
      window.drupalSettings.validMembership = true;
      window.drupalSettings.playOrPractice = 1;
      window.drupalSettings.startGameFromPlayScreen = 1;
      window.drupalSettings.allowProblemRetry = true;
    }
    runs++;
    if (runs > 30) clearInterval(interval);
  }, 500);
})();
</script>
`;

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const url = `${UPSTREAM}${pathname}${search}`;

  const fetchOpts: RequestInit = {
    method: req.method,
    headers: {
      "User-Agent": req.headers.get("user-agent") || "Mozilla/5.0",
      "Accept": req.headers.get("accept") || "*/*",
      "Accept-Language": req.headers.get("accept-language") || "en-US,en;q=0.9",
      "Referer": UPSTREAM,
      // Send a fake session cookie to appear logged in
      "Cookie": "theta_uid=999999; theta_membership=valid; SSESSfaketoken=logged_in",
    },
  };

  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    fetchOpts.body = await req.text();
    const ct = req.headers.get("content-type");
    if (ct) (fetchOpts.headers as Record<string, string>)["Content-Type"] = ct;
  }

  // Forward actual cookies too (merge with fake ones)
  const cookie = req.headers.get("cookie");
  if (cookie) {
    (fetchOpts.headers as Record<string, string>)["Cookie"] =
      (fetchOpts.headers as Record<string, string>)["Cookie"] + "; " + cookie;
  }

  try {
    const upstream = await fetch(url, fetchOpts);

    const headers = new Headers();
    upstream.headers.forEach((v, k) => {
      if (!["transfer-encoding", "connection", "content-encoding", "content-length",
            "set-cookie", "x-frame-options"].includes(k.toLowerCase())) {
        headers.set(k, v);
      }
    });
    // Allow framing (remove X-Frame-Options restriction)
    headers.delete("x-frame-options");

    const contentType = upstream.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      let html = await upstream.text();
      // Inject CSS + JS BEFORE any other script
      if (html.includes("<head>")) {
        html = html.replace("<head>", "<head>" + CLEANUP_CSS + UNLOCK_JS);
      } else if (html.includes("</head>")) {
        html = html.replace("</head>", CLEANUP_CSS + UNLOCK_JS + "</head>");
      }
      headers.delete("content-length");
      return new NextResponse(html, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    }

    // For JSON API responses that check auth, override them
    if (contentType.includes("application/json")) {
      const body = await upstream.text();
      // If the response is about user/auth/membership, fake it
      if (pathname.includes("/user/") || pathname.includes("/api/") ||
          pathname.includes("/check") || pathname.includes("/membership")) {
        try {
          const json = JSON.parse(body);
          if (typeof json === "object") {
            json.uid = 999999;
            json.logged_in = true;
            json.validMembership = true;
            json.roles = ['authenticated', 'member', 'premium'];
            return new NextResponse(JSON.stringify(json), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        } catch (e) {
          // not JSON, return as-is
        }
      }
      return new NextResponse(body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch (e) {
    return new NextResponse(`Proxy error: ${e instanceof Error ? e.message : "unknown"}`, {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt).*)",
  ],
};
