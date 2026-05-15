import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INCYTE",
  description:
    "Progressive overload tracking for trained lifters. Calibrated feedback, not a hype reel.",
};

// Build/test-phase layout (Phase 0 per pm/nextjs-port-plan.md). Auth is
// anonymous via device_id — there is no logged-in user to query, so the
// original getUser() + conditional Nav is removed. Phase 8 restores
// user-aware chrome.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
