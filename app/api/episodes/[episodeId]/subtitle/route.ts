import { unstable_noStore as noStore } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
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
  subtitle_language: string | null;
  subtitle_url: string | null;
};

type SeriesRow = {
  provider_id: string | null;
  platform: string | null;
  provider_series_id: string | null;
};

type ProviderRow = {
  base_url: string | null;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ episodeId: string }> }
) {
  noStore();

  const { episodeId } = await context.params;
  const requestedLang = request.nextUrl.searchParams.get("lang") || "id";
  const supabase = createSupabaseClient();

  try {
    const { data: episode, error: episodeError } = await supabase
      .from("episodes")
      .select(
        "id, series_id, platform, provider_series_id, episode_index, episode_number, title, lang, subtitle_url, subtitle_language"
      )
      .eq("id", episodeId)
      .single();

    if (episodeError) throw episodeError;

    const episodeRow = episode as EpisodeRow;
    let freshError: unknown = null;

    try {
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
        lang: episodeRow.lang ?? requestedLang,
        platform,
        providerBaseUrl,
        providerSeriesId,
        title: episodeRow.title
      });

      if (!freshSource.subtitleUrl) {
        throw new UpstreamSourceError(
          "Subtitle Indonesia tidak ditemukan dari upstream.",
          404,
          "UPSTREAM_SUBTITLE_NOT_FOUND"
        );
      }

      const freshSubtitle = await tryFetchSubtitle(freshSource.subtitleUrl);
      if (!freshSubtitle) {
        throw new UpstreamSourceError(
          "Subtitle Indonesia dari upstream belum bisa dimuat.",
          404,
          "UPSTREAM_SUBTITLE_UNAVAILABLE"
        );
      }

      return subtitleResponse(freshSubtitle);
    } catch (error) {
      freshError = error;
    }

    const existingSubtitle = await tryFetchSubtitle(episodeRow.subtitle_url);
    if (existingSubtitle) {
      return subtitleResponse(existingSubtitle);
    }

    throw freshError instanceof Error
      ? freshError
      : new UpstreamSourceError(
          "Subtitle Indonesia tidak ditemukan dari upstream.",
          404,
          "UPSTREAM_SUBTITLE_NOT_FOUND"
        );
  } catch (error) {
    const status = error instanceof UpstreamSourceError ? error.status : 500;
    const code =
      error instanceof UpstreamSourceError
        ? error.code
        : "SUBTITLE_LOAD_FAILED";
    const message =
      error instanceof Error ? error.message : "Gagal memuat subtitle.";

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

async function tryFetchSubtitle(url?: string | null) {
  if (!url) return null;

  const candidates = [url, decodeDracinkuSubtitleUrl(url)].filter(
    (candidate): candidate is string => Boolean(candidate)
  );

  for (const candidate of candidates) {
    const response = await fetch(candidate, {
      cache: "no-store",
      headers: {
        accept: "text/vtt,text/plain,*/*"
      }
    }).catch(() => null);

    if (!response?.ok) continue;

    const text = await response.text();
    if (looksLikeVtt(text)) return text;
  }

  return null;
}

function decodeDracinkuSubtitleUrl(value: string) {
  try {
    const url = new URL(value);
    const marker = "/aliplay/subtitle/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const encoded = decodeURIComponent(
      url.pathname.slice(markerIndex + marker.length)
    );
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    return /^https?:\/\//i.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function looksLikeVtt(text: string) {
  const trimmed = text.trimStart();
  return trimmed.startsWith("WEBVTT") || trimmed.includes("-->");
}

function subtitleResponse(text: string) {
  return new NextResponse(text, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/vtt; charset=utf-8"
    }
  });
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
