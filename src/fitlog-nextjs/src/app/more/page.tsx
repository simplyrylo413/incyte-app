// Phase 2 stub — More screen (History, Movement Library, Settings) built in
// Phase 7 per pm/nextjs-port-plan.md.

export default function MorePage() {
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
        More
      </p>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f1622", margin: 0 }}>
        More
      </h1>
      <p style={{ fontSize: 13, color: "#5e6a82", marginTop: 8 }}>
        History · Movement Library · Settings — built in Phase 7.
      </p>
    </main>
  );
}
