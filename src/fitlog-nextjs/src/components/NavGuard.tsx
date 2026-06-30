"use client";
import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

// Pages that manage their own CassetteNav — suppress the global BottomNav there.
const CASSETTE_PAGES = ["/today", "/momentum", "/plan", "/more"];

export default function NavGuard() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/auth/")) return null;
  if (pathname === "/today/workout") return null;
  if (CASSETTE_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  return <BottomNav />;
}
