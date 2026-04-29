"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useEffect, useRef, useState, useTransition } from "react";

export function SearchBox(props: {
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <Suspense fallback={<SearchBoxFallback placeholder={props.placeholder} />}>
      <SearchBoxInner {...props} />
    </Suspense>
  );
}

function SearchBoxInner({
  autoFocus = false,
  placeholder = "Cari judul drama"
}: {
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();
  const mounted = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentQuery = searchParams.get("q") ?? "";
      const nextQuery = value.trim();

      if (!mounted.current) {
        mounted.current = true;
        if (nextQuery === currentQuery) return;
      }

      if (nextQuery === currentQuery) return;

      const params = new URLSearchParams(searchParams.toString());
      if (nextQuery) params.set("q", nextQuery);
      else params.delete("q");
      params.delete("page");
      const query = params.toString();
      const href = query ? `${pathname}?${query}` : pathname;

      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [pathname, router, searchParams, value]);

  return (
    <label className="flex h-12 items-center gap-3 rounded-md border border-white/10 bg-white/[0.055] px-4 text-white/80">
      <Search aria-hidden className="h-5 w-5 text-white/45" strokeWidth={1.8} />
      <input
        autoFocus={autoFocus}
        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function SearchBoxFallback({ placeholder }: { placeholder?: string }) {
  return (
    <div className="flex h-12 items-center gap-3 rounded-md border border-white/10 bg-white/[0.055] px-4 text-white/35">
      <Search aria-hidden className="h-5 w-5" strokeWidth={1.8} />
      <span className="text-sm">{placeholder ?? "Cari judul drama"}</span>
    </div>
  );
}
