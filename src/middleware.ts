import { NextResponse, type NextRequest } from "next/server";

const UPSTREAM = "https://trainer.thetamusic.com";

// Paths that should be proxied as-is (binary assets, no modification)
const BINARY_TYPES = [
  ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".eot", ".mp3", ".wav", ".ogg", ".webm",
  ".webp", ".pdf", ".zip",
];

// Cleanup script injected into HTML to remove login wall, paywall, sign-in prompts
const CLEANUP_SCRIPT = `
<script>
(function() {
  "use strict";
  // Auto-dismiss login/signup modals, paywall, cookie banners
  function cleanup() {
    // Remove login/signup overlays
    document.querySelectorAll(
      '[class*="login"], [class*="signup"], [class*="sign-in"], [class*="modal"], ' +
      '[class*="paywall"], [class*="subscribe"], [class*="upgrade"], [class*="locked"], ' +
      '[id*="login"], [id*="signup"], [id*="modal"], [id*="paywall"], ' +
      '.block-user, .block-user-login, .login-block, .auth-modal, ' +
      '[class*="cookie"], [class*="gdpr"], [class*="consent"], ' +
      '.region-sidebar-first .block-user, .region-sidebar-second .block-user'
    ).forEach(function(el) {
      // Only remove if it's a login/auth/cookie element, not game content
      var t = (el.textContent || '').toLowerCase();
      if (t.includes('sign in') || t.includes('log in') || t.includes('login') ||
          t.includes('sign up') || t.includes('register') || t.includes('create account') ||
          t.includes('subscribe') || t.includes('upgrade') || t.includes('unlock') ||
          t.includes('cookie') || t.includes('gdpr') || t.includes('consent')) {
        el.style.display = 'none';
      }
    });

    // Auto-click "Play as guest" / "Skip" / "Continue as guest" buttons
    document.querySelectorAll('button, a').forEach(function(el) {
      var t = (el.textContent || '').trim().toLowerCase();
      if (t === 'play as guest' || t === 'continue as guest' || t === 'guest' ||
          t === 'skip' || t === 'continue' || t === 'no thanks' || t === 'maybe later' ||
          t === 'close' || t === 'dismiss' || t === 'got it') {
        el.click();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanup);
  } else {
    cleanup();
  }

  // Run periodically for lazy-loaded modals
  var runs = 0;
  var interval = setInterval(function() {
    cleanup();
    runs++;
    if (runs > 20) clearInterval(interval);
  }, 500);

  // MutationObserver for new modals
  var observer = new MutationObserver(function() { cleanup(); });
  function startObs() {
    if (!document.body) { setTimeout(startObs, 10); return; }
    observer.observe(document.body, { childList: true, subtree: true });
  }
  startObs();
})();
</script>
`;

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const url = `${UPSTREAM}${pathname}${search}`;

  // Build fetch options — forward method, headers, body
  const fetchOpts: RequestInit = {
    method: req.method,
    headers: {
      "User-Agent": req.headers.get("user-agent") || "Mozilla/5.0",
      "Accept": req.headers.get("accept") || "*/*",
      "Accept-Language": req.headers.get("accept-language") || "en-US,en;q=0.9",
      "Referer": UPSTREAM,
    },
  };

  // Forward body for POST/PUT
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    fetchOpts.body = await req.text();
    const ct = req.headers.get("content-type");
    if (ct) (fetchOpts.headers as Record<string, string>)["Content-Type"] = ct;
  }

  // Forward cookies
  const cookie = req.headers.get("cookie");
  if (cookie) (fetchOpts.headers as Record<string, string>)["Cookie"] = cookie;

  try {
    const upstream = await fetch(url, fetchOpts);

    // Build response with same status + headers
    const headers = new Headers();
    upstream.headers.forEach((v, k) => {
      // Skip hop-by-hop headers
      if (!["transfer-encoding", "connection", "content-encoding", "content-length"].includes(k.toLowerCase())) {
        headers.set(k, v);
      }
    });

    const contentType = upstream.headers.get("content-type") || "";

    // If HTML, inject cleanup script
    if (contentType.includes("text/html")) {
      let html = await upstream.text();
      // Inject before </head>
      if (html.includes("</head>")) {
        html = html.replace("</head>", CLEANUP_SCRIPT + "</head>");
      } else if (html.includes("</body>")) {
        html = html.replace("</body>", CLEANUP_SCRIPT + "</body>");
      }
      headers.delete("content-length");
      return new NextResponse(html, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    }

    // Non-HTML: stream as-is
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
    // Match everything except Next.js internals and static files we serve locally
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt|cleanup.js).*)",
  ],
};
