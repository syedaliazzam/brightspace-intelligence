import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const roleToDashboard = {
  admin: "/admin/dashboard",
  coordinator: "/coordinator/dashboard",
  teacher: "/teacher/dashboard",
  parent: "/parent/dashboard",
  student: "/student/dashboard",
};

const protectedPrefixes = ["/admin", "/coordinator", "/teacher", "/parent", "/student"];
const sharedProtectedPaths = [
  "/coordinator/registration-leads",
  "/coordinator/fee-vouchers",
  "/coordinator/payments",
];

function getDashboardPath(role) {
  return roleToDashboard[String(role || "").toLowerCase()] || "/login";
}

function getProtectedRole(pathname) {
  return protectedPrefixes.find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )?.slice(1);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const sessionRole = String(req.auth?.user?.role || "").toLowerCase();
  const dashboard = getDashboardPath(sessionRole);
  const protectedRole = getProtectedRole(pathname);
  const isSharedProtectedPath = sharedProtectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!req.auth) {
    if (pathname === "/login" || pathname === "/") {
      return pathname === "/login" ? NextResponse.next() : NextResponse.redirect(new URL("/login", req.url));
    }

    if (protectedRole) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
  }

  if (pathname === "/login" || pathname === "/") {
    return NextResponse.redirect(new URL(dashboard, req.url));
  }

  if (isSharedProtectedPath && (sessionRole === "admin" || sessionRole === "coordinator")) {
    return NextResponse.next();
  }

  if (protectedRole && protectedRole !== sessionRole) {
    return NextResponse.redirect(new URL(dashboard, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/coordinator/:path*", "/teacher/:path*", "/parent/:path*", "/student/:path*"],
};
