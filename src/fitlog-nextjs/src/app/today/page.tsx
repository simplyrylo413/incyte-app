"use client";

// Phase 0 smoke test — lives at /today until Phase 3 replaces it with the
// real Today screen. Verifies Supabase connectivity + HTML-schema data layer.

import { useEffect, useState } from "react";
import { listMovements, listWorkouts, listFinishedTodayWorkouts } from "@/lib/db";
import { tryGetDeviceId } from "@/lib/device";
import type { Movement, Workout } from "@/lib/types";

export default function TodayPage() {
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
    return () => { cancelled = true; };
  }, []);

  return (
    <main
      style={{
        padding: "24px 16px",
        fontFamily: "system-ui, sans-serif",
        maxWidth: 760,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#0f1622" }}>
        INCYTE · Phase 0 smoke test
      </h1>
      <p style={{ fontSize: 13, color: "#5e6a82", marginBottom: 24 }}>
        Validating Supabase connectivity + data layer. Phase 3 replaces this with the real Today screen.
      </p>

      <Section label="Device id">
        <code style={{ fontSize: 12 }}>{deviceId ?? "(not yet generated)"}</code>
        <p style={{ fontSize: 12, color: "#8893a8", marginTop: 4 }}>
          Should match <code>fitlog_device_id</code> in your HTML build&apos;s localStorage if
          you want to see the same data across both builds.
        </p>
      </Section>

      {loading && <Section label="Loading">…</Section>}
      {err && <Section label="Error">{err}</Section>}

      {!loading && !err && (
        <>
          <Section label={`Movements (${movements.length})`}>
            {movements.length === 0 ? (
              <p style={{ fontSize: 12, color: "#8893a8" }}>
                No movements for this device_id.
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
    </main>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        marginBottom: 16,
        padding: 14,
        border: "1.2px solid rgba(15,22,34,0.11)",
        borderRadius: 10,
        background: "rgba(255,255,255,0.55)",
      }}
    >
      <div
        style={{
          fontFamily: "Geist Mono, ui-monospace, monospace",
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
