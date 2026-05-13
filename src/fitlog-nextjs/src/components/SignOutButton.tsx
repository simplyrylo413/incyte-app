"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const onSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };
  return (
    <button
      onClick={onSignOut}
      className="rounded-md border border-line px-2 py-1 text-xs text-sub hover:text-ink"
    >
      Sign out
    </button>
  );
}
