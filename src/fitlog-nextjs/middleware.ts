// Phase 8 — auth gate middleware.
// Unauthenticated users are redirected to /login for all app routes.
// Authenticated users hitting /login are sent to /today.
// Auth callback (/auth/callback) is always allowed through.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow through: static assets, Next internals, auth routes.
  if (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Build a response we'll pass cookies through.
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the session server-side (not just local cookie check).
  const { data: { user } } = await supabase.auth.getUser();

  const isLoginRoute = pathname === "/login";

  if (!user && !isLoginRoute) {
    // Not signed in — send to /login, preserving the intended destination.
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLoginRoute) {
    // Already signed in — skip the login page.
    const next = request.nextUrl.searchParams.get("next") ?? "/today";
    const dest = request.nextUrl.clone();
    dest.pathname = next;
    dest.searchParams.delete("next");
    return NextResponse.redirect(dest);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
