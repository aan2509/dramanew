import { PageShell } from "@/components/page-shell";
import { CollectionsList } from "@/components/collections-list";
import { ProviderTabs } from "@/components/provider-tabs";
import { SearchBox } from "@/components/search-box";
import { CategoryTabs } from "@/components/category-tabs";
import { getCategories, getProviders, getSeriesPage } from "@/lib/data";

export const revalidate = 180;

export default async function CollectionsPage({
  searchParams
}: {
  searchParams: Promise<{
    provider?: string;
    category?: string;
    q?: string;
    focus?: string;
  }>;
}) {
  const params = await searchParams;
  const [providers, categories, seriesPage] = await Promise.all([
    getProviders(),
    getCategories(),
    getSeriesPage({
      providerId: params.provider,
      category: params.category,
      query: params.q
    })
  ]);

  return (
    <PageShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Collections</h1>
          <p className="mt-1 text-sm text-white/50">
            Semua series di database, bisa difilter berdasarkan provider.
          </p>
        </div>
        <SearchBox autoFocus={params.focus === "search"} />
        <ProviderTabs
          activeProviderId={params.provider}
          basePath="/collections"
          providers={providers}
        />
        <CategoryTabs
          activeCategory={params.category}
          basePath="/collections"
          categories={categories}
          providerId={params.provider}
        />
        <CollectionsList
          key={`${params.provider ?? "all"}:${params.category ?? "all"}:${params.q ?? ""}`}
          category={params.category}
          initialItems={seriesPage.items}
          initialNextPage={seriesPage.nextPage}
          providerId={params.provider}
          query={params.q}
        />
      </div>
    </PageShell>
  );
}
