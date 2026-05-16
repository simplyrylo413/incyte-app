"use client";

// Auth callback — client-side PKCE exchange.
// Replaces the server route.ts so the build can use output: 'export' for Capacitor.
// The code param comes from Supabase's redirect after email confirmation / OAuth.

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/today";

    if (!code) {
      router.replace("/login?error=auth_callback_failed");
      return;
    }

    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        router.replace("/login?error=auth_callback_failed");
      } else {
        router.replace(next);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  );
}
