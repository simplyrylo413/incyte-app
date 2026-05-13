"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const supabase = createClient();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Check your email to confirm your account, then sign in.");
        setMode("signin");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto mt-16 w-full max-w-sm rounded-lg border border-line bg-panel p-6"
    >
      <h1 className="mb-1 text-xl font-semibold">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>
      <p className="mb-5 text-sm text-sub">
        {mode === "signin"
          ? "Welcome back. Track your next session."
          : "Make an account to start tracking workouts."}
      </p>

      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-sub">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full"
          autoComplete="email"
        />
      </label>
      <label className="mb-4 block text-sm">
        <span className="mb-1 block text-sub">Password</span>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
        />
      </label>

      {err ? <p className="mb-3 text-sm text-bad">{err}</p> : null}
      {msg ? <p className="mb-3 text-sm text-good">{msg}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg hover:opacity-90"
      >
        {busy ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
      </button>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-3 w-full text-xs text-sub hover:text-ink"
      >
        {mode === "signin"
          ? "Need an account? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
