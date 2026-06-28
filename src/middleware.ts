import { NextResponse, type NextRequest } from "next/server";

const UPSTREAM = "https://trainer.thetamusic.com";

// CSS injected into HTML to hide login wall, paywall, cookie banners.
// Pure CSS — no JS, no DOM manipulation, no infinite loops.
const CLEANUP_CSS = `
<style id="__theta_cleanup">
/* Hide login/signup/auth blocks */
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

/* Hide paywall / subscribe / upgrade prompts */
[class*="paywall"], [class*="subscribe"], [class*="upgrade"],
[class*="locked-content"], [class*="premium-only"],
[class*="membership"], [class*="pricing-table"],
[id*="paywall"], [id*="subscribe"] {
  display: none !important;
}

/* Hide cookie/GDPR banners */
[class*="cookie"], [class*="gdpr"], [class*="consent"],
[class*="privacy-banner"], #cookie-banner, #gdpr-banner {
  display: none !important;
}

/* Hide "sign in to play" overlays */
.game-login-overlay, .game-locked, .locked-overlay,
[class*="game-login"], [class*="game-locked"] {
  display: none !important;
}

/* Make sure game area is visible */
#gameArea, #gameSVG, #gameSVG2, .game-content, .game-canvas {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}
</style>
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

    // HTML: inject CSS cleanup (no JS — no infinite loops)
    if (contentType.includes("text/html")) {
      let html = await upstream.text();
      if (html.includes("</head>")) {
        html = html.replace("</head>", CLEANUP_CSS + "</head>");
      } else if (html.includes("</body>")) {
        html = html.replace("</body>", CLEANUP_CSS + "</body>");
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
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt).*)",
  ],
};
