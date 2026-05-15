// Phase 2 stub — Plan screen built in Phase 6 per pm/nextjs-port-plan.md.

export default function PlanPage() {
  return (
    <main style={{ padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <p
        style={{
          fontFamily: "Geist Mono, ui-monospace, monospace",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "#8893a8",
          marginBottom: 8,
        }}
      >
        Plan
      </p>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f1622", margin: 0 }}>
        Weekly Plan
      </h1>
      <p style={{ fontSize: 13, color: "#5e6a82", marginTop: 8 }}>
        Built in Phase 6 of the Next.js port.
      </p>
    </main>
  );
}
