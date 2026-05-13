"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "./SignOutButton";

const TABS = [
  { href: "/", label: "Today" },
  { href: "/movements", label: "Movements" },
  { href: "/history", label: "History" },
  { href: "/progress", label: "Progress" },
];

export default function Nav({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <nav className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          fitlog
        </Link>
        <ul className="flex flex-1 items-center gap-2 sm:gap-4">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className={`rounded-md px-2 py-1 text-sm transition-colors ${
                    active ? "bg-panel2 text-ink" : "text-sub hover:text-ink"
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-3 text-sm text-sub">
          <span className="hidden sm:inline">{email}</span>
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}
