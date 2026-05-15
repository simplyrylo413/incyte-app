// Phase 0 stub — the old implementation used the scaffold's normalized
// schema (separate workout_entries table) which has been retired. The real
// History page lands in Phase 7 per pm/nextjs-port-plan.md.

export default function HistoryStubPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>History</h1>
      <p style={{ fontSize: 13, color: "#5e6a82", marginTop: 8 }}>
        Rebuilt in Phase 7 of the Next.js port.
      </p>
    </main>
  );
}
