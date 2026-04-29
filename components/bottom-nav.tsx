"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, Compass, Home, UserRound } from "lucide-react";

const items = [
  { href: "/", label: "Beranda", icon: Home },
  { href: "/collections", label: "Koleksi", icon: Clapperboard },
  { href: "/profile", label: "Profil", icon: UserRound }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#08080a]/90 backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-2xl grid-cols-3 px-4 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href.split("?")[0]);

          return (
            <Link
              aria-label={item.label}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] ${
                active ? "text-[#d00064]" : "text-white/65"
              }`}
              href={item.href}
              key={item.label}
            >
              <Icon aria-hidden className="h-5 w-5" strokeWidth={1.8} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TopBrand() {
  return (
    <Link className="inline-flex items-center gap-2" href="/">
      <span className="hidden h-9 w-9 place-items-center rounded-md border border-[#d00064]/35 bg-[#d00064]/15 sm:grid">
        <Compass className="h-5 w-5 text-[#d00064]" strokeWidth={1.8} />
      </span>
      <span className="text-2xl font-black italic tracking-normal text-[#d00064]">
        DramaNow
      </span>
    </Link>
  );
}
