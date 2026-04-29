import Image from "next/image";
import Link from "next/link";
import type { Series } from "@/lib/types";

export function SeriesCard({ item, priority = false }: { item: Series; priority?: boolean }) {
  return (
    <Link className="group block min-w-0" href={`/series/${item.id}`} prefetch={false}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-white/[0.055] ring-1 ring-white/10">
        {item.cover_url ? (
          <Image
            alt={item.title}
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            fill
            unoptimized
            priority={priority}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 180px"
            src={item.cover_url}
          />
        ) : (
          <div className="grid h-full place-items-center px-4 text-center text-sm text-white/45">
            DramaNow
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <p className="truncate text-xs text-white/80">
            {item.chapter_count ? `${item.chapter_count} episode` : "Episode"}
          </p>
        </div>
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-white/90">
        {item.title}
      </h3>
      {item.tags?.[0] ? (
        <p className="mt-1 truncate text-xs text-white/45">{item.tags[0]}</p>
      ) : null}
    </Link>
  );
}
