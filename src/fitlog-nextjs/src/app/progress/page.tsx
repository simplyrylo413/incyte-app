// Phase 0 stub — Momentum (the canonical name) lands in Phase 7 per
// pm/nextjs-port-plan.md. The old scaffold's progress page used the
// normalized schema's listAllEntriesForMovement helper which has been
// retired in favor of the HTML build's inline-entries schema.

export default function ProgressStubPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>Momentum</h1>
      <p style={{ fontSize: 13, color: "#5e6a82", marginTop: 8 }}>
        Rebuilt in Phase 7 of the Next.js port.
      </p>
    </main>
  );
}
