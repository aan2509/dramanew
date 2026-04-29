import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import {
  createSupabaseClient,
  createSupabaseWriteClient
} from "@/lib/supabase";
import {
  fetchFreshEpisodeSource,
  UpstreamSourceError
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
  provider_id: string | null;
  platform: string | null;
  provider_series_id: string | null;
};

type ProviderRow = {
  base_url: string | null;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ episodeId: string }> }
) {
  noStore();

  const { episodeId } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as {
    force?: unknown;
    persist?: unknown;
  };
  const forceFresh = payload.force === true;
  const shouldPersist = payload.persist === true;
  const supabase = createSupabaseClient();

  try {
    const { data: episode, error: episodeError } = await supabase
      .from("episodes")
      .select(
        "id, series_id, platform, provider_series_id, episode_index, episode_number, title, lang"
      )
      .eq("id", episodeId)
      .single();

    if (episodeError) throw episodeError;

    const episodeRow = episode as EpisodeRow;
    const series = await getSeriesFallback(supabase, episodeRow.series_id);
    const platform = episodeRow.platform ?? series?.platform;
    const providerSeriesId =
      episodeRow.provider_series_id ?? series?.provider_series_id;
    const providerBaseUrl = await getProviderBaseUrl(supabase, {
      platform,
      providerId: series?.provider_id
    });

    const freshSource = await fetchFreshEpisodeSource({
      episodeId: episodeRow.id,
      episodeIndex: episodeRow.episode_index,
      episodeNumber: episodeRow.episode_number,
      forceFresh,
      lang: episodeRow.lang,
      platform,
      providerBaseUrl,
      providerSeriesId,
      title: episodeRow.title
    });
    const persistence = shouldPersist
      ? await persistFreshSource({
          episodeId: episodeRow.id,
          sourceUrl: freshSource.sourceUrl,
          subtitleLanguage: freshSource.subtitleLanguage,
          subtitleUrl: freshSource.subtitleUrl
        })
      : {
          error: null,
          updated: false
        };

    return NextResponse.json(
      {
        database_update_error: persistence.error,
        database_updated: persistence.updated,
        matchedBy: freshSource.matchedBy,
        source_m3u8_url: freshSource.sourceUrl,
        subtitle_language: freshSource.subtitleLanguage,
        subtitle_url: freshSource.subtitleUrl
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    const status = error instanceof UpstreamSourceError ? error.status : 500;
    const code =
      error instanceof UpstreamSourceError
        ? error.code
        : "REFRESH_SOURCE_FAILED";
    const message =
      error instanceof Error ? error.message : "Gagal refresh URL stream.";

    return NextResponse.json(
      {
        code,
        error: message
      },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status
      }
    );
  }
}

async function persistFreshSource({
  episodeId,
  sourceUrl,
  subtitleLanguage,
  subtitleUrl
}: {
  episodeId: string;
  sourceUrl: string;
  subtitleLanguage?: string | null;
  subtitleUrl?: string | null;
}) {
  const supabase = createSupabaseWriteClient();
  const values: {
    source_m3u8_url: string;
    subtitle_language?: string;
    subtitle_url?: string;
  } = {
    source_m3u8_url: sourceUrl
  };

  if (subtitleUrl) {
    values.subtitle_url = subtitleUrl;
    values.subtitle_language = subtitleLanguage || "id";
  }

  const { error } = await supabase
    .from("episodes")
    .update(values)
    .eq("id", episodeId);

  if (error) {
    return {
      error: error.message,
      updated: false
    };
  }

  return {
    error: null,
    updated: true
  };
}

async function getSeriesFallback(
  supabase: ReturnType<typeof createSupabaseClient>,
  seriesId: string
) {
  const { data, error } = await supabase
    .from("series")
    .select("provider_id, platform, provider_series_id")
    .eq("id", seriesId)
    .maybeSingle();

  if (error) throw error;
  return data as SeriesRow | null;
}

async function getProviderBaseUrl(
  supabase: ReturnType<typeof createSupabaseClient>,
  {
    platform,
    providerId
  }: {
    platform?: string | null;
    providerId?: string | null;
  }
) {
  let data: ProviderRow | null = null;
  let error: unknown = null;

  if (providerId) {
    const result = await supabase
      .from("providers")
      .select("base_url")
      .eq("id", providerId)
      .maybeSingle();
    data = result.data as ProviderRow | null;
    error = result.error;
  }

  if (!data && platform) {
    const result = await supabase
      .from("providers")
      .select("base_url")
      .eq("slug", platform)
      .maybeSingle();
    data = result.data as ProviderRow | null;
    error = result.error;
  }

  if (error) throw error;
  return data?.base_url ?? null;
}
