// Phase 2 shell layout — adds the BottomNav + safe-area padding.
// Auth is anonymous via device_id during the build/test phase (no getUser).
// Phase 8 restores user-aware chrome (per pm/nextjs-port-plan.md).

import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "INCYTE",
  description:
    "Progressive overload tracking for trained lifters. Calibrated feedback, not a hype reel.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "INCYTE",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // enables env(safe-area-inset-*) on iOS
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className="min-h-dvh font-sans antialiased"
        style={{
          // Content scrolls under the floating nav pill.
          // 88px = nav pill height (~56px) + bottom gap (16px) + clearance (16px).
          // env() accounts for iOS home-indicator safe area.
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
