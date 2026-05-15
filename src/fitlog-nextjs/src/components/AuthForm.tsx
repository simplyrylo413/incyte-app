"use client";

// Phase 8 — INCYTE-styled auth form.
// Modes: sign-in, sign-up, reset (password reset email).
// On successful sign-in, adoptDeviceRowsIfNeeded() migrates existing
// anonymous rows to the user's uid before navigating to /today.

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { adoptDeviceRowsIfNeeded } from "@/lib/db";
import s from "./AuthForm.module.css";

type Mode = "signin" | "signup" | "reset";

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/today";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function switchMode(m: Mode) {
    setMode(m);
    setErr(null);
    setMsg(null);
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const supabase = createClient();

    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/callback?next=/today`,
        });
        if (error) throw error;
        setMsg("Check your email for a reset link.");
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Check your email to confirm, then sign in.");
        switchMode("signin");
        return;
      }

      // Sign in
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Migrate any anonymous rows before navigating.
      if (data.user) {
        await adoptDeviceRowsIfNeeded(data.user.id);
      }

      router.push(next);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "signin" ? "Sign in"
    : mode === "signup" ? "Create account"
    : "Reset password";

  const sub =
    mode === "signin" ? "Track your next session."
    : mode === "signup" ? "Your data. Your lifts."
    : "We'll send a reset link to your email.";

  const cta =
    mode === "signin" ? "Sign in"
    : mode === "signup" ? "Create account"
    : "Send reset link";

  return (
    <div className={s.wrap}>
      {/* Logo / wordmark */}
      <div className={s.logo}>INCYTE</div>

      <form onSubmit={onSubmit} className={s.card} noValidate>
        <h1 className={s.title}>{title}</h1>
        <p className={s.sub}>{sub}</p>

        <div className={s.field}>
          <label className={s.label} htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            className={s.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        {mode !== "reset" && (
          <div className={s.field}>
            <label className={s.label} htmlFor="auth-pw">Password</label>
            <input
              id="auth-pw"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className={s.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "6+ characters" : "••••••••"}
            />
          </div>
        )}

        {err && <p className={s.errMsg}>{err}</p>}
        {msg && <p className={s.okMsg}>{msg}</p>}

        <button type="submit" disabled={busy || !email} className={s.btnPrimary}>
          {busy ? "Working…" : cta}
        </button>

        {/* Mode switcher links */}
        <div className={s.links}>
          {mode === "signin" && (
            <>
              <button type="button" className={s.link} onClick={() => switchMode("signup")}>
                Need an account?
              </button>
              <button type="button" className={s.link} onClick={() => switchMode("reset")}>
                Forgot password
              </button>
            </>
          )}
          {mode === "signup" && (
            <button type="button" className={s.link} onClick={() => switchMode("signin")}>
              Already have an account?
            </button>
          )}
          {mode === "reset" && (
            <button type="button" className={s.link} onClick={() => switchMode("signin")}>
              Back to sign in
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
