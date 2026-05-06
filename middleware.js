import { NextResponse } from "next/server";

const ADMIN_COOKIE = "topo_admin_session";
const LICENSE_COOKIE = "topo_license_session";

function addSecurityHeaders(response) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
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

  const isAdminPage = path.startsWith("/vip-admin-6d8f2a");
  const isSignalsPage = path.startsWith("/signals");

  const isAdminApi = path.startsWith("/api/admin");
  const isSignalsApi = path.startsWith("/api/signals");

  // حماية صفحة الأدمن
  if (isAdminPage && !adminSession) {
    const redirect = NextResponse.redirect(new URL("/", request.url));
    return addSecurityHeaders(redirect);
  }

  // حماية صفحة الإشارات
  if (isSignalsPage && !licenseSession && !adminSession) {
    const redirect = NextResponse.redirect(new URL("/", request.url));
    return addSecurityHeaders(redirect);
  }

  // حماية API الأدمن
  if (isAdminApi && !adminSession) {
    const response = NextResponse.json(
      { ok: false, error: "admin_required" },
      { status: 401 }
    );
    return addSecurityHeaders(response);
  }

  // حماية API الإشارات
  if (isSignalsApi && !licenseSession && !adminSession) {
    const response = NextResponse.json(
      { ok: false, error: "license_required" },
      { status: 401 }
    );
    return addSecurityHeaders(response);
  }

  const response = NextResponse.next();

  if (
    path.startsWith("/api/") ||
    path.includes("admin") ||
    path.startsWith("/signals")
  ) {
    return addSecurityHeaders(response);
  }

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js).*)"],
};
