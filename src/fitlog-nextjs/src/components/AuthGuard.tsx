"use client";

// AuthGuard — client-side auth redirect for the static/Capacitor build.
// Middleware can't run in output:'export', so this component replaces it.
// Lives in the root layout; runs on every navigation.
//
// Public paths (no redirect): /login, /auth/*
// Protected paths: everything else — unauthenticated → /login?next=<pathname>
// Login path: authenticated → /today (or ?next param)

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PUBLIC: string[] = ["/login"];

function isPublic(pathname: string) {
  return (
    PUBLIC.includes(pathname) ||
    pathname.startsWith("/auth/")
  );
}

export default function AuthGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isPublic(pathname)) return;

    const supabase = createClient();
    // getSession() reads from localStorage — no network round-trip.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        const dest = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
        router.replace(`/login${dest}`);
      }
    });
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
