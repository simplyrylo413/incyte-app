// Root layout — shell, safe-area padding, nav + auth guards.
// NavGuard suppresses BottomNav on /login and /auth/*.
// AuthGuard replaces the server middleware for the static/Capacitor export:
//   unauthenticated users are redirected to /login client-side.

import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavGuard from "@/components/NavGuard";
import AuthGuard from "@/components/AuthGuard";

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
      <head>
        <link rel="stylesheet" href="/odometer-train-station.css" />
      </head>
      <body
        className="min-h-dvh font-sans antialiased"
        style={{
          // Content scrolls above the MPC nav chassis.
          // 110px = chassis height (~90px) + clearance (20px).
          // env() accounts for iOS home-indicator safe area.
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 110px)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        {children}
        <NavGuard />
        <AuthGuard />
      </body>
    </html>
  );
}
