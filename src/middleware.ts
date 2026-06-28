import { NextResponse, type NextRequest } from "next/server";

const UPSTREAM = "https://trainer.thetamusic.com";

// CSS to hide login wall, paywall, cookie banners (pure CSS, no loops)
const CLEANUP_CSS = `
<style id="__theta_cleanup">
.block-user-login, .block-user, .block-user-menu,
.login-block, .auth-modal, .user-login-form,
#block-userlogin, #block-userlogin-2,
.region-sidebar-first .block-user,
.region-sidebar-second .block-user,
[class*="login-modal"], [class*="signup-modal"],
[class*="auth-modal"], [class*="register-form"],
[id*="login-modal"], [id*="signup-modal"] {
  display: none !important;
}
[class*="paywall"], [class*="subscribe"], [class*="upgrade"],
[class*="locked-content"], [class*="premium-only"],
[class*="membership"], [class*="pricing-table"],
[id*="paywall"], [id*="subscribe"] {
  display: none !important;
}
[class*="cookie"], [class*="gdpr"], [class*="consent"],
[class*="privacy-banner"], #cookie-banner, #gdpr-banner {
  display: none !important;
}
.game-login-overlay, .game-locked, .locked-overlay,
[class*="game-login"], [class*="game-locked"] {
  display: none !important;
}
#gameArea, #gameSVG, #gameSVG2, .game-content, .game-canvas {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}
</style>
`;

// JS to fake login state — runs BEFORE the game bundle loads.
// Sets drupalSettings.uid (non-zero = logged in), validMembership = true,
// and playOrPractice = 1 (allow play). Also intercepts any login redirect.
const UNLOCK_JS = `
<script id="__theta_unlock">
(function() {
  "use strict";
  // Initialize drupalSettings if not present
  window.drupalSettings = window.drupalSettings || {};
  // Fake a logged-in user with valid membership
  window.drupalSettings.uid = 999999;
  window.drupalSettings.validMembership = true;
  window.drupalSettings.is_student = false;
  window.drupalSettings.is_teacher = false;
  window.drupalSettings.playOrPractice = 1;
  window.drupalSettings.startGameFromPlayScreen = 1;
  window.drupalSettings.allowProblemRetry = true;

  // Intercept any attempt to redirect to login page
  var origAssign = window.location.assign;
  var origReplace = window.location.replace;
  function checkRedirect(url) {
    if (typeof url === 'string' && (url.indexOf('login') >= 0 || url.indexOf('user/login') >= 0 || url.indexOf('signin') >= 0)) {
      console.log('[clone] Blocked redirect to login:', url);
      return true;
    }
    return false;
  }
  // Can't override window.location directly, but we can intercept pushState
  var origPush = history.pushState;
  history.pushState = function(state, title, url) {
    if (checkRedirect(url)) return;
    return origPush.apply(this, arguments);
  };
  var origReplaceState = history.replaceState;
  history.replaceState = function(state, title, url) {
    if (checkRedirect(url)) return;
    return origReplaceState.apply(this, arguments);
  };

  // Watch for drupalSettings being set later by Drupal's JS and re-apply
  var ds = window.drupalSettings;
  Object.defineProperty(window, 'drupalSettings', {
    get: function() { return ds; },
    set: function(val) {
      ds = val || {};
      ds.uid = 999999;
      ds.validMembership = true;
      ds.playOrPractice = 1;
      ds.startGameFromPlayScreen = 1;
      ds.allowProblemRetry = true;
    },
    configurable: true,
  });
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
    },
  };

  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    fetchOpts.body = await req.text();
    const ct = req.headers.get("content-type");
    if (ct) (fetchOpts.headers as Record<string, string>)["Content-Type"] = ct;
  }

  const cookie = req.headers.get("cookie");
  if (cookie) (fetchOpts.headers as Record<string, string>)["Cookie"] = cookie;

  try {
    const upstream = await fetch(url, fetchOpts);

    const headers = new Headers();
    upstream.headers.forEach((v, k) => {
      if (!["transfer-encoding", "connection", "content-encoding", "content-length"].includes(k.toLowerCase())) {
        headers.set(k, v);
      }
    });

    const contentType = upstream.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      let html = await upstream.text();
      // Inject CSS + JS BEFORE the first <script> so drupalSettings is faked
      // before any Drupal/game JS runs.
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
