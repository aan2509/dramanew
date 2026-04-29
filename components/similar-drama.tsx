import { SeriesGrid } from "@/components/series-grid";
import type { Series } from "@/lib/types";

export function SimilarDrama({ items }: { items: Series[] }) {
  if (!items.length) return null;

  return (
    <section className="mt-12">
      <h2 className="mb-5 text-2xl font-black">Drama Serupa</h2>
      <SeriesGrid items={items.slice(0, 6)} />
    </section>
  );
}
