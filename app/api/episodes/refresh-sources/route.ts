import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import {
  createSupabaseClient,
  createSupabaseWriteClient
} from "@/lib/supabase";
import {
  fetchFreshEpisodeSources,
  type FreshEpisodeSourceResult
} from "@/lib/upstream-source";

type EpisodeRow = {
  id: string;
  series_id: string;
  platform: string | null;
  provider_series_id: string | null;
  episode_index: number | null;
  episode_number: number | null;
  title: string | null;
  lang?: string | null;
};

type SeriesRow = {
  id: string;
  platform: string | null;
  provider_series_id: string | null;
};

type SourceGroup = {
  lang: string | null;
  platform: string;
  providerSeriesId: string;
  targets: Array<{
    episodeId: string;
    episodeIndex: number | null;
    episodeNumber: number | null;
    title: string | null;
  }>;
};

const maxBatchSize = 24;

export async function POST(request: Request) {
  noStore();

  const payload = (await request.json().catch(() => ({}))) as {
    episodeIds?: unknown;
    persist?: unknown;
  };
  const episodeIds = Array.isArray(payload.episodeIds)
    ? [...new Set(payload.episodeIds)]
        .filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
        .slice(0, maxBatchSize)
    : [];
  const shouldPersist = payload.persist === true;

  if (!episodeIds.length) {
    return NextResponse.json(
      { error: "episodeIds wajib diisi." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseClient();
  const { data: episodes, error: episodesError } = await supabase
    .from("episodes")
    .select(
      "id, series_id, platform, provider_series_id, episode_index, episode_number, title, lang"
    )
    .in("id", episodeIds);

  if (episodesError) {
    return NextResponse.json(
      { error: episodesError.message },
      { status: 500 }
    );
  }

  const rows = (episodes ?? []) as EpisodeRow[];
  const seriesMap = await getSeriesMap(
    supabase,
    [...new Set(rows.map((row) => row.series_id).filter(Boolean))]
  );
  const groups = new Map<string, SourceGroup>();
  const missing: Array<{ episode_id: string; error: string }> = [];

  for (const row of rows) {
    const series = seriesMap.get(row.series_id);
    const platform = row.platform ?? series?.platform;
    const providerSeriesId = row.provider_series_id ?? series?.provider_series_id;

    if (!platform || !providerSeriesId) {
      missing.push({
        episode_id: row.id,
        error: "Episode tidak punya platform atau provider_series_id."
      });
      continue;
    }

    const lang = row.lang ?? "id";
    const key = `${platform}:${providerSeriesId}:${lang}`;
    const group =
      groups.get(key) ??
      {
        lang,
        platform,
        providerSeriesId,
        targets: []
      };

    group.targets.push({
      episodeId: row.id,
      episodeIndex: row.episode_index,
      episodeNumber: row.episode_number,
      title: row.title
    });
    groups.set(key, group);
  }

  const refreshed = [];

  for (const group of groups.values()) {
    try {
      const sources = await fetchFreshEpisodeSources({
        lang: group.lang,
        platform: group.platform,
        providerSeriesId: group.providerSeriesId,
        targets: group.targets
      });
      const persisted = shouldPersist
        ? await persistFreshSources(sources)
        : sources.map((source) => ({
            database_update_error: null,
            database_updated: false,
            episode_id: source.episodeId,
            matchedBy: source.matchedBy,
            source_m3u8_url: source.sourceUrl,
            subtitle_language: source.subtitleLanguage,
            subtitle_url: source.subtitleUrl
          }));
      refreshed.push(...persisted);

      const foundIds = new Set(sources.map((source) => source.episodeId));
      for (const target of group.targets) {
        if (foundIds.has(target.episodeId)) continue;
        missing.push({
          episode_id: target.episodeId,
          error: "URL stream fresh tidak ditemukan dari upstream."
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal refresh URL stream.";
      for (const target of group.targets) {
        missing.push({
          episode_id: target.episodeId,
          error: message
        });
      }
    }
  }

  return NextResponse.json(
    {
      missing,
      refreshed
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

async function getSeriesMap(
  supabase: ReturnType<typeof createSupabaseClient>,
  seriesIds: string[]
) {
  const seriesMap = new Map<string, SeriesRow>();
  if (!seriesIds.length) return seriesMap;

  const { data, error } = await supabase
    .from("series")
    .select("id, platform, provider_series_id")
    .in("id", seriesIds);

  if (error) throw error;

  for (const row of (data ?? []) as SeriesRow[]) {
    seriesMap.set(row.id, row);
  }

  return seriesMap;
}

async function persistFreshSources(sources: FreshEpisodeSourceResult[]) {
  const supabase = createSupabaseWriteClient();

  return Promise.all(
    sources.map(async (source) => {
      const values: {
        source_m3u8_url: string;
        subtitle_language?: string;
        subtitle_url?: string;
      } = {
        source_m3u8_url: source.sourceUrl
      };

      if (source.subtitleUrl) {
        values.subtitle_url = source.subtitleUrl;
        values.subtitle_language = source.subtitleLanguage || "id";
      }

      const { error } = await supabase
        .from("episodes")
        .update(values)
        .eq("id", source.episodeId);

      return {
        database_update_error: error?.message ?? null,
        database_updated: !error,
        episode_id: source.episodeId,
        matchedBy: source.matchedBy,
        source_m3u8_url: source.sourceUrl,
        subtitle_language: source.subtitleLanguage,
        subtitle_url: source.subtitleUrl
      };
    })
  );
}
