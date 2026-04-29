import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseClient } from "@/lib/supabase";

export type AdminProviderCatalogItem = {
  id: string;
  slug: string;
  name: string;
  base_url: string | null;
  is_active: boolean;
  series_count: number;
  episode_count: number;
  sample_series: {
    id: string;
    title: string | null;
    provider_series_id: string | null;
  } | null;
};

export type AdminProviderHealthTarget = Pick<
  AdminProviderCatalogItem,
  "base_url" | "id" | "is_active" | "name" | "sample_series" | "slug"
>;

type ProviderRow = {
  id: string;
  slug: string;
  name: string;
  base_url: string | null;
  is_active: boolean | null;
};

type SampleSeriesRow = {
  chapter_count: number | null;
  id: string;
  provider_id?: string;
  title: string | null;
  provider_series_id: string | null;
};

const adminPageSize = 1000;

export async function getAdminProviderCatalog() {
  noStore();

  const [providers, seriesRows] = await Promise.all([
    getAdminProviders(),
    getSeriesCatalogRows()
  ]);
  const seriesCountByProvider = new Map<string, number>();
  const episodeCountByProvider = new Map<string, number>();
  const sampleSeriesByProvider = new Map<string, SampleSeriesRow>();

  for (const row of seriesRows) {
    if (!row.provider_id) continue;
    seriesCountByProvider.set(
      row.provider_id,
      (seriesCountByProvider.get(row.provider_id) ?? 0) + 1
    );
    episodeCountByProvider.set(
      row.provider_id,
      (episodeCountByProvider.get(row.provider_id) ?? 0) +
        Math.max(0, row.chapter_count ?? 0)
    );

    if (row.provider_series_id && !sampleSeriesByProvider.has(row.provider_id)) {
      sampleSeriesByProvider.set(row.provider_id, row);
    }
  }

  return providers.map((provider) => ({
    base_url: provider.base_url,
    episode_count: episodeCountByProvider.get(provider.id) ?? 0,
    id: provider.id,
    is_active: provider.is_active ?? false,
    name: provider.name,
    sample_series: sampleSeriesByProvider.get(provider.id) ?? null,
    series_count: seriesCountByProvider.get(provider.id) ?? 0,
    slug: provider.slug
  }));
}

export async function getAdminProviderHealthTargets() {
  noStore();

  const [providers, seriesRows] = await Promise.all([
    getAdminProviders(),
    getSeriesCatalogRows()
  ]);
  const sampleSeriesByProvider = new Map<string, SampleSeriesRow>();

  for (const row of seriesRows) {
    if (
      row.provider_id &&
      row.provider_series_id &&
      !sampleSeriesByProvider.has(row.provider_id)
    ) {
      sampleSeriesByProvider.set(row.provider_id, row);
    }
  }

  return providers.map((provider) => ({
    base_url: provider.base_url,
    id: provider.id,
    is_active: provider.is_active ?? false,
    name: provider.name,
    sample_series: sampleSeriesByProvider.get(provider.id) ?? null,
    slug: provider.slug
  }));
}

async function getAdminProviders() {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("providers")
    .select("id, slug, name, base_url, is_active")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProviderRow[];
}

async function getSeriesCatalogRows() {
  return fetchAllRows<SampleSeriesRow>((from, to) =>
    createSupabaseClient()
      .from("series")
      .select("id, provider_id, title, provider_series_id, chapter_count")
      .range(from, to)
  );
}

async function fetchAllRows<T>(
  requestPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>
) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await requestPage(from, from + adminPageSize - 1);
    if (error) throw error;

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < adminPageSize) break;
    from += adminPageSize;
  }

  return rows;
}
