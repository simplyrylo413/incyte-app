"use client";
import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

export default function NavGuard() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/auth/")) return null;
  if (pathname === "/today/workout") return null;
  // /today renders its own inline nav inside the 430px column
  if (pathname === "/today" || pathname === "/") return null;
  return <BottomNav />;
}
