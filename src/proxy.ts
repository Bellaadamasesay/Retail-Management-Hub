import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { canAccessPath, FORBIDDEN_PATH, landingPath } from "@/lib/rbac/routes";

/**
 * Route protection (UX layer; the API stays the authority):
 * - signed-out visitors go to /login, remembering where they were headed
 * - signed-in users skip /login and land on their role's home
 * - signed-in users on a route their role can't use go to /forbidden
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    return session
      ? NextResponse.redirect(new URL(landingPath[session.role], request.url))
      : NextResponse.next();
  }

  if (!session) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(landingPath[session.role], request.url));
  }

  if (!canAccessPath(session.role, pathname)) {
    return NextResponse.redirect(new URL(FORBIDDEN_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except API routes, Next internals, the dev-only /design page, images and any
  // path with a file extension (favicon.ico, ...). A character class
  // stands in for an escaped dot because Next strips backslashes from matcher strings.
  matcher: ["/((?!api|_next|design|images|.*[.].*).*)"],
};
