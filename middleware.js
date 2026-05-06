import { NextResponse } from "next/server";

export function middleware(request) {
  // منع bypass
  if (request.headers.has("x-middleware-subrequest")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const path = request.nextUrl.pathname;
  const token = request.cookies.get("admin_token")?.value;

  const isAdminPage = path.startsWith("/vip-admin-6d8f2a");
  const isAdminApi = path.startsWith("/api/admin");

  // حماية الأدمن
  if ((isAdminPage || isAdminApi) && !token) {
    if (path.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

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

  // منع الكاش للأدمن و API و signals
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
