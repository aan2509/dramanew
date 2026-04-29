"use client";

import Link from "next/link";
import { Loader2, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EpisodeList } from "@/components/episode-list";
import type { Episode } from "@/lib/types";

export function SeriesEpisodesPanel({
  seriesId,
  platform,
  providerSeriesId
}: {
  seriesId: string;
  platform?: string | null;
  providerSeriesId?: string | null;
}) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (platform) params.set("platform", platform);
    if (providerSeriesId) params.set("providerSeriesId", providerSeriesId);
    const query = params.toString();
    return `/api/series/${seriesId}/episodes${query ? `?${query}` : ""}`;
  }, [platform, providerSeriesId, seriesId]);

  useEffect(() => {
    let cancelled = false;

    async function loadEpisodes() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(endpoint);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Gagal memuat episode.");
        }

        if (!cancelled) {
          setEpisodes(payload.episodes ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Gagal memuat episode."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEpisodes();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const firstEpisode = episodes[0];

  return (
    <section className="mt-8">
      <div className="mb-3">
        <h2 className="text-2xl font-black">Daftar Episode</h2>
      </div>

      {firstEpisode ? (
        <Link
          className="mb-4 inline-flex items-center gap-2 rounded-md bg-[#d7b46a] px-5 py-3 text-sm font-semibold text-black"
          href={`/watch/${firstEpisode.id}`}
          prefetch={false}
        >
          <Play className="h-4 w-4 fill-current" strokeWidth={1.8} />
          Tonton Sekarang
        </Link>
      ) : null}

      {loading ? (
        <div className="surface flex items-center gap-2 rounded-md p-5 text-sm text-white/55">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat episode
        </div>
      ) : (
        <EpisodeList episodes={episodes} />
      )}

      {error ? (
        <p className="mt-3 rounded-md border border-[#d7b46a]/25 bg-[#d7b46a]/10 px-3 py-2 text-sm text-[#e7c982]">
          Detail drama berhasil dimuat, tetapi daftar episode sedang lambat dari database.
        </p>
      ) : null}
    </section>
  );
}
