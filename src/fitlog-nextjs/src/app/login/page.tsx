// Phase 8 — login page.
// AuthForm uses useSearchParams() so it needs a Suspense boundary.

import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
