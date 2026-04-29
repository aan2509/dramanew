import type { Series } from "@/lib/types";
import { SeriesCard } from "@/components/series-card";

export function SeriesGrid({
  items,
  priorityCount = 0
}: {
  items: Series[];
  priorityCount?: number;
}) {
  if (!items.length) {
    return (
      <div className="surface rounded-md p-6 text-center text-sm text-white/55">
        Belum ada drama yang bisa ditampilkan.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item, index) => (
        <SeriesCard item={item} key={item.id} priority={index < priorityCount} />
      ))}
    </div>
  );
}
