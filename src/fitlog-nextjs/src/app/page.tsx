"use client";

// Phase 0 smoke-test page. Verifies that:
//   1. The Next.js build can reach Supabase using the same device_id the
//      HTML build writes with.
//   2. The new lib/db.ts helpers read against the HTML build's schema
//      successfully (workouts.entries jsonb, no workout_entries join).
//   3. The user's real data flows in.
//
// This page is intentionally bare — no INCYTE design treatment yet. Phase 1
// brings the tokens; Phase 3 replaces this file with the real Today screen.

import { useEffect, useState } from "react";
import { listMovements, listWorkouts, listFinishedTodayWorkouts } from "@/lib/db";
import { tryGetDeviceId } from "@/lib/device";
import type { Movement, Workout } from "@/lib/types";

export default function Phase0SmokePage() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [today, setToday] = useState<Workout[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setDeviceId(tryGetDeviceId());
        const [mv, w, tw] = await Promise.all([
          listMovements(),
          listWorkouts({ limit: 10 }),
          listFinishedTodayWorkouts(),
        ]);
        if (cancelled) return;
        setMovements(mv);
        setWorkouts(w);
        setToday(tw);
      } catch (e) {
        if (!cancelled) setErr(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ padding: "24px", fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        INCYTE · Phase 0 smoke test
      </h1>
      <p style={{ fontSize: 13, color: "#5e6a82", marginBottom: 24 }}>
        Validating Supabase connectivity + new data layer against the HTML build&apos;s schema.
        See <code>pm/nextjs-port-plan.md</code> Phase 0.
      </p>

      <Section label="Device id">
        <code style={{ fontSize: 12 }}>{deviceId ?? "(not yet generated)"}</code>
        <p style={{ fontSize: 12, color: "#8893a8", marginTop: 4 }}>
          Anonymous keying during build phase. Should match what the HTML build
          uses if you opened that first; otherwise this is a fresh id for the
          Next.js build (which means your HTML data is keyed under a
          different id — see note at the bottom).
        </p>
      </Section>

      {loading && <Section label="Loading">…</Section>}
      {err && <Section label="Error">{err}</Section>}

      {!loading && !err && (
        <>
          <Section label={`Movements (${movements.length})`}>
            {movements.length === 0 ? (
              <p style={{ fontSize: 12, color: "#8893a8" }}>
                No movements for this device_id. If you expected to see your HTML build&apos;s
                movements, your HTML build is writing under a different device_id —
                copy it from localStorage (key <code>fitlog_device_id</code>) in your
                HTML build&apos;s browser tab and paste into this build&apos;s localStorage.
              </p>
            ) : (
              <ul style={{ fontSize: 13, lineHeight: 1.5 }}>
                {movements.slice(0, 10).map((m) => (
                  <li key={m.id}>
                    <strong>{m.name}</strong>{" "}
                    <span style={{ color: "#8893a8" }}>
                      · {m.muscle ?? m.bodyPart ?? m.kind ?? "—"}
                      {m.equipmentType ? ` · ${m.equipmentType}` : ""}
                    </span>
                  </li>
                ))}
                {movements.length > 10 && (
                  <li style={{ color: "#8893a8" }}>… and {movements.length - 10} more</li>
                )}
              </ul>
            )}
          </Section>

          <Section label={`Recent workouts (${workouts.length})`}>
            {workouts.length === 0 ? (
              <p style={{ fontSize: 12, color: "#8893a8" }}>No workouts yet.</p>
            ) : (
              <ul style={{ fontSize: 13, lineHeight: 1.5 }}>
                {workouts.map((w) => (
                  <li key={w.id}>
                    <strong>{new Date(w.date).toLocaleString()}</strong>
                    {" · "}
                    {w.finished ? "DONE" : "saved"}
                    {" · "}
                    {(w.entries ?? []).length} entries
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section label={`Finished today (${today.length})`}>
            {today.length === 0 ? (
              <p style={{ fontSize: 12, color: "#8893a8" }}>Nothing finished today yet.</p>
            ) : (
              <ul style={{ fontSize: 13, lineHeight: 1.5 }}>
                {today.map((w) => (
                  <li key={w.id}>
                    {(w.entries ?? []).length} entries · saved{" "}
                    {w.savedAt ? new Date(w.savedAt).toLocaleTimeString() : "—"}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      <hr style={{ margin: "24px 0", border: 0, borderTop: "1px solid rgba(15,22,34,0.11)" }} />
      <p style={{ fontSize: 11, color: "#8893a8" }}>
        Phase 1 (tokens) and Phase 2 (shell + bottom nav) replace this layout. Phase 3 replaces
        this page with the real Today screen.
      </p>
    </main>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        marginBottom: 16,
        padding: 14,
        border: "1px solid rgba(15,22,34,0.11)",
        borderRadius: 10,
        background: "rgba(255,255,255,0.55)",
      }}
    >
      <div
        style={{
          fontFamily:
            "Geist Mono, ui-monospace, monospace",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: "#0f1622",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </section>
  );
}
