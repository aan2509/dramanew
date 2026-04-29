"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { SeriesCard } from "@/components/series-card";
import type { Series } from "@/lib/types";

export function CollectionsList({
  initialItems,
  initialNextPage,
  providerId,
  category,
  query
}: {
  initialItems: Series[];
  initialNextPage: number | null;
  providerId?: string;
  category?: string;
  query?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [nextPage, setNextPage] = useState(initialNextPage);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadMore = useCallback(() => {
    if (nextPage === null || isPending) return;

    startTransition(async () => {
      const params = new URLSearchParams({ page: String(nextPage) });
      if (providerId) params.set("providerId", providerId);
      if (category) params.set("category", category);
      if (query) params.set("q", query);

      const response = await fetch(`/api/series?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Gagal memuat koleksi.");
        return;
      }

      setItems((current) => [...current, ...payload.items]);
      setNextPage(payload.nextPage);
    });
  }, [category, isPending, nextPage, providerId, query]);

  if (!items.length) {
    return (
      <div className="surface rounded-md p-6 text-center text-sm text-white/55">
        Tidak ada drama yang cocok.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item, index) => (
          <SeriesCard item={item} key={item.id} priority={index < 4} />
        ))}
      </div>
      {error ? <p className="text-center text-sm text-red-300">{error}</p> : null}
      {nextPage !== null ? (
        <div className="flex justify-center">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.055] px-5 py-3 text-sm font-medium text-white/80 disabled:opacity-60"
            disabled={isPending}
            onClick={loadMore}
            type="button"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Muat Lebih Banyak
          </button>
        </div>
      ) : null}
    </div>
  );
}
