import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/", "/landing", "/login", "/register", "/about", "/pricing", "/contact"];

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Allow public paths
	if (PUBLIC_PATHS.some((p) => pathname === p) || pathname.startsWith("/api/")) {
		return NextResponse.next();
	}

	// Check for auth token cookie (set by backend on login)
	const hasToken = request.cookies.has("token") || request.cookies.has("auth_token");

	// Redirect to login if no token on protected routes
	if (!hasToken && !pathname.startsWith("/login") && !pathname.startsWith("/register")) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("redirect", pathname);
		return NextResponse.redirect(loginUrl);
	}

	// Redirect authenticated users away from login/register
	if (hasToken && (pathname.startsWith("/login") || pathname.startsWith("/register"))) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/", "/(zh-CN|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
