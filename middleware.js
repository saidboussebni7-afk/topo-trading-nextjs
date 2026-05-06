import { NextResponse } from "next/server";

const ADMIN_COOKIE = "topo_admin_session";
const LICENSE_COOKIE = "topo_license_session";

export function middleware(request) {
  // منع bypass
  if (request.headers.has("x-middleware-subrequest")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const path = request.nextUrl.pathname;

  const adminSession = request.cookies.get(ADMIN_COOKIE)?.value;
  const licenseSession = request.cookies.get(LICENSE_COOKIE)?.value;

  const isAdminPage = path.startsWith("/vip-admin-6d8f2a");
  const isSignalsPage = path.startsWith("/signals");

  // حماية صفحة الأدمن
  if (isAdminPage && !adminSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // حماية صفحة الإشارات
  if (isSignalsPage && !licenseSession && !adminSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  // منع الكاش للصفحات الحساسة
  if (
    path.startsWith("/api/") ||
    path.includes("admin") ||
    path.startsWith("/signals")
  ) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
