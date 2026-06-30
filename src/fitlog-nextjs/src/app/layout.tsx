import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Dock } from "@/components/dock/Dock";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "INCYTE",
  description: "Progressive overload tracking for trained lifters.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "INCYTE",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 110px)",
        paddingTop: "env(safe-area-inset-top, 0px)",
        minHeight: "100dvh",
        background: "var(--color-bg-app)",
      }}>
        <Providers>
          <main id="page-region">{children}</main>
          <Dock />
        </Providers>
      </body>
    </html>
  );
}
