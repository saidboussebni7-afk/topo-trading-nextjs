import { NextResponse } from "next/server";

const ADMIN_COOKIE = "topo_admin_session";
const LICENSE_COOKIE = "topo_license_session";

function secure(response) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export function middleware(request) {
  if (request.headers.has("x-middleware-subrequest")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const path = request.nextUrl.pathname;

  const adminSession = request.cookies.get(ADMIN_COOKIE)?.value;
  const licenseSession = request.cookies.get(LICENSE_COOKIE)?.value;

  const isAdmin =
    path.startsWith("/vip-admin-6d8f2a") ||
    path.startsWith("/api/admin");

  const isSignals =
    path.startsWith("/signals") ||
    path.startsWith("/legacy/signals.html") ||
    path.startsWith("/api/signals");

  if (isAdmin && !adminSession) {
    if (path.startsWith("/api/")) {
      return secure(
        NextResponse.json({ ok: false, error: "admin_required" }, { status: 401 })
      );
    }

    return secure(NextResponse.redirect(new URL("/", request.url)));
  }

  if (isSignals && !licenseSession && !adminSession) {
    if (path.startsWith("/api/")) {
      return secure(
        NextResponse.json({ ok: false, error: "license_required" }, { status: 401 })
      );
    }

    return secure(NextResponse.redirect(new URL("/", request.url)));
  }

  return secure(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js).*)",
  ],
};
