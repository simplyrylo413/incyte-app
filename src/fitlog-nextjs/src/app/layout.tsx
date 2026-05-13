import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Fitlog — Workout Tracker",
  description: "Track lifts and cardio. Spot progress and skipped movements.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        {user ? <Nav email={user.email ?? ""} /> : null}
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
