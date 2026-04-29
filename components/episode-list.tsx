import Link from "next/link";
import type { Episode } from "@/lib/types";

export function EpisodeList({ episodes }: { episodes: Episode[] }) {
  if (!episodes.length) {
    return (
      <div className="surface rounded-md p-5 text-sm text-white/55">
        Episode belum tersedia untuk drama ini.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 xl:grid-cols-16">
      {episodes.map((episode) => (
        <Link
          className="grid aspect-square min-h-14 place-items-center rounded-md border border-white/10 bg-white/[0.055] text-lg font-bold text-white/85 transition hover:border-[#d00064]/55 hover:bg-[#d00064]/15 sm:min-h-16"
          href={`/watch/${episode.id}`}
          key={episode.id}
          prefetch={false}
        >
          {episode.episode_number ?? episode.episode_index ?? "-"}
        </Link>
      ))}
    </div>
  );
}
