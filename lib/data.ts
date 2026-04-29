import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseClient } from "@/lib/supabase";
import type { Episode, Provider, Series, WatchEpisode } from "@/lib/types";

const pageSize = 20;
type SeriesPreview = Pick<Series, "id" | "title" | "cover_url" | "description">;

function normalizeTitle(title: string) {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

function cleanSeries(item: Series): Series {
  return {
    ...item,
    title: item.title.trim().replace(/\s+/g, " "),
    description: item.description?.trim() || null
  };
}

function uniqueSeriesByTitle(items: Series[]) {
  const seen = new Set<string>();
  const unique: Series[] = [];

  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(cleanSeries(item));
  }

  return unique;
}

export async function getProviders() {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("providers")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Provider[];
}

export async function getSeriesPage({
  providerId,
  category,
  query,
  page = 0
}: {
  providerId?: string;
  category?: string;
  query?: string;
  page?: number;
}) {
  const supabase = createSupabaseClient();
  const fetchSize = pageSize * 3;
  const from = page * fetchSize;
  const to = from + fetchSize - 1;

  let request = supabase
    .from("series")
    .select(
      "id, provider_id, platform, provider_series_id, title, description, cover_url, chapter_count, play_count, tags"
    )
    .not("title", "is", null)
    .neq("title", "")
    .order("title", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);

  if (providerId) request = request.eq("provider_id", providerId);
  if (category) request = request.contains("tags", [category]);
  if (query?.trim()) request = request.ilike("title", `%${query.trim()}%`);

  const { data, error } = await request;
  if (error) throw error;
  const uniqueItems = uniqueSeriesByTitle((data ?? []) as Series[]).slice(0, pageSize);

  return {
    items: uniqueItems,
    nextPage: (data?.length ?? 0) === fetchSize ? page + 1 : null
  };
}

export async function getHomeSeries(providerId?: string) {
  const { items } = await getSeriesPage({ providerId, page: 0 });
  return items;
}

export async function getPopularSeries(limit = 50) {
  const supabase = createSupabaseClient();
  const fetchSize = Math.max(limit * 3, 60);
  const { data, error } = await supabase
    .from("series")
    .select(
      "id, provider_id, platform, provider_series_id, title, description, cover_url, chapter_count, play_count, tags"
    )
    .not("title", "is", null)
    .neq("title", "")
    .not("cover_url", "is", null)
    .neq("cover_url", "")
    .order("play_count", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .range(0, fetchSize - 1);

  if (error) throw error;
  return uniqueSeriesByTitle((data ?? []) as Series[]).slice(0, limit);
}

export async function getCategories(limit = 12) {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("series")
    .select("tags")
    .not("tags", "is", null)
    .limit(600);

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Pick<Series, "tags">[]) {
    for (const tag of row.tags ?? []) {
      const cleanTag = tag.trim();
      if (!cleanTag) continue;
      counts.set(cleanTag, (counts.get(cleanTag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

export async function getSimilarSeries(series: Series, limit = 6) {
  const primaryTag = series.tags?.[0];
  const supabase = createSupabaseClient();

  let request = supabase
    .from("series")
    .select(
      "id, provider_id, platform, provider_series_id, title, description, cover_url, chapter_count, play_count, tags"
    )
    .not("title", "is", null)
    .neq("title", "")
    .not("cover_url", "is", null)
    .neq("cover_url", "")
    .neq("id", series.id)
    .order("play_count", { ascending: false, nullsFirst: false })
    .range(0, limit * 3 - 1);

  if (primaryTag) request = request.contains("tags", [primaryTag]);

  const { data, error } = await request;
  if (error) throw error;

  return uniqueSeriesByTitle((data ?? []) as Series[]).slice(0, limit);
}

export async function getSeriesDetail(id: string) {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("series")
    .select(
      "id, provider_id, platform, provider_series_id, title, description, cover_url, chapter_count, play_count, tags"
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return cleanSeries(data as Series);
}

type EpisodeLookup = {
  id?: string;
  series_id?: string;
  platform?: string | null;
  provider_series_id?: string | null;
};

export async function getSeriesEpisodes(lookup: string | EpisodeLookup) {
  const supabase = createSupabaseClient();
  const seriesId = typeof lookup === "string" ? lookup : (lookup.id ?? lookup.series_id);
  const platform = typeof lookup === "string" ? null : lookup.platform;
  const providerSeriesId =
    typeof lookup === "string" ? null : lookup.provider_series_id;

  let request = supabase
    .from("episodes")
    .select(
      "id, series_id, platform, provider_series_id, title, episode_index, episode_number, source_m3u8_url, subtitle_url, subtitle_language"
    )
    .order("episode_number", { ascending: true })
    .order("episode_index", { ascending: true })
    .range(0, 299);

  if (platform && providerSeriesId) {
    request = request.eq("platform", platform).eq("provider_series_id", providerSeriesId);
  } else if (seriesId) {
    request = request.eq("series_id", seriesId);
  }

  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []) as Episode[];
}

export async function getWatchEpisode(episodeId: string) {
  noStore();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("episodes")
    .select(
      "id, series_id, platform, provider_series_id, title, episode_index, episode_number, source_m3u8_url, subtitle_url, subtitle_language, series(id, title, cover_url, description)"
    )
    .eq("id", episodeId)
    .single();

  if (error) throw error;

  const raw = data as unknown as Omit<WatchEpisode, "series"> & {
    series: SeriesPreview | SeriesPreview[] | null;
  };

  return {
    ...raw,
    series: Array.isArray(raw.series) ? (raw.series[0] ?? null) : raw.series
  } as WatchEpisode;
}

export { pageSize };
