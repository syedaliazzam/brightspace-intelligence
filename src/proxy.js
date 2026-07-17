import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const roleToDashboard = {
  superadmin: "/superadmin/dashboard",
  admin: "/admin/dashboard",
  coordinator: "/coordinator/dashboard",
  teacher: "/teacher/dashboard",
  parent: "/parent/dashboard",
  student: "/student/dashboard",
};

const protectedPrefixes = ["/admin", "/coordinator", "/teacher", "/parent", "/student"];
const superadminPrefixes = ["/superadmin"];
const sharedProtectedPaths = [
  "/coordinator/registration-leads",
  "/coordinator/fee-vouchers",
  "/coordinator/payments",
];

function matchesProtectedRole(protectedRole, sessionRole) {
  if (protectedRole === "admin") {
    return sessionRole === "admin";
  }

  return protectedRole === sessionRole;
}

function getDashboardPath(role) {
  return roleToDashboard[String(role || "").toLowerCase()] || "/login";
}

function getProtectedRole(pathname) {
  return protectedPrefixes.find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )?.slice(1);
}

function getSuperadminProtected(pathname) {
  return superadminPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default async function middleware(req) {
  const { pathname } = req.nextUrl;
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });
  const sessionRole = String(token?.role || "").toLowerCase();
  const dashboard = getDashboardPath(sessionRole);
  const protectedRole = getProtectedRole(pathname);
  const isSharedProtectedPath = sharedProtectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!token) {
    if (pathname === "/login" || pathname === "/") {
      return pathname === "/login" ? NextResponse.next() : NextResponse.redirect(new URL("/login", req.url));
    }

    if (protectedRole || getSuperadminProtected(pathname)) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
  }

  if (pathname === "/login" || pathname === "/") {
    return NextResponse.redirect(new URL(dashboard, req.url));
  }

  if (isSharedProtectedPath && (sessionRole === "superadmin" || sessionRole === "admin" || sessionRole === "coordinator")) {
    return NextResponse.next();
  }

  if (protectedRole && !matchesProtectedRole(protectedRole, sessionRole)) {
    return NextResponse.redirect(new URL(dashboard, req.url));
  }

  if (getSuperadminProtected(pathname) && sessionRole !== "superadmin" && sessionRole !== "admin") {
    return NextResponse.redirect(new URL(dashboard, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/superadmin/:path*", "/admin/:path*", "/coordinator/:path*", "/teacher/:path*", "/parent/:path*", "/student/:path*"],
};
