"use client";
import { usePathname } from "next/navigation";
import MPCNav from "./MPCNav";

export default function NavGuard() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/auth/")) return null;
  if (pathname === "/today/workout") return null;
  return <MPCNav />;
}
