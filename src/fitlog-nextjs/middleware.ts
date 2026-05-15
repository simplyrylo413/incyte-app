import { NextRequest, NextResponse } from "next/server";

// Build/test-phase middleware (2026-05-13 per pm/nextjs-port-plan.md Phase 0).
// Auth is anonymous via device_id during this phase — there is no real
// Supabase user yet, so any auth redirect would loop. This middleware is a
// pass-through. The original auth-gate version (kept below in a comment) gets
// restored in Phase 8 when the full Supabase auth flow lands.
export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on everything except static assets and Next internals.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

// ----------------------------------------------------------------------------
// Original auth-gate (restore in Phase 8 — auth flow):
//
// import { createServerClient, type CookieOptions } from "@supabase/ssr";
//
// const supabase = createServerClient(URL, KEY, {
//   cookies: { getAll: () => request.cookies.getAll(), setAll: ... },
// });
// const { data: { user } } = await supabase.auth.getUser();
// const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");
// if (!user && !isAuthRoute) return NextResponse.redirect(URL("/login"));
// if (user && pathname === "/login") return NextResponse.redirect(URL("/"));
