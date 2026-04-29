import {
  Activity,
  Database,
  Layers3,
  Server,
  Tv
} from "lucide-react";
import Link from "next/link";
import { TopBrand } from "@/components/bottom-nav";
import { ProviderHealthPanel } from "@/components/admin/provider-health-panel";
import type { AdminProviderCatalogItem } from "@/lib/admin-data";

type AdminView = "catalog" | "sync";

export function AdminDashboard({
  activeView,
  providers
}: {
  activeView: AdminView;
  providers: AdminProviderCatalogItem[];
}) {
  const totals = providers.reduce(
    (current, provider) => ({
      episodes: current.episodes + provider.episode_count,
      series: current.series + provider.series_count
    }),
    { episodes: 0, series: 0 }
  );

  return (
    <main className="min-h-dvh px-4 py-5 sm:px-6 lg:px-8">
      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="surface h-fit rounded-md p-4 lg:sticky lg:top-5">
          <div className="mb-6">
            <TopBrand />
            <p className="mt-2 text-sm text-white/45">Admin panel</p>
          </div>
          <nav className="space-y-2">
            <AdminNavLink
              active={activeView === "catalog"}
              href="/admin?view=catalog"
              icon={<Database className="h-5 w-5" />}
              label="Katalog"
            />
            <AdminNavLink
              active={activeView === "sync"}
              href="/admin?view=sync"
              icon={<Activity className="h-5 w-5" />}
              label="Sync"
            />
          </nav>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile
              icon={<Server className="h-5 w-5" />}
              label="Provider"
              value={providers.length}
            />
            <SummaryTile
              icon={<Layers3 className="h-5 w-5" />}
              label="Series"
              value={totals.series}
            />
            <SummaryTile
              icon={<Tv className="h-5 w-5" />}
              label="Episode"
              value={totals.episodes}
            />
          </div>

          {activeView === "catalog" ? (
            <CatalogView providers={providers} />
          ) : (
            <ProviderHealthPanel providers={providers} />
          )}
        </section>
      </div>
    </main>
  );
}

function CatalogView({
  providers
}: {
  providers: AdminProviderCatalogItem[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Katalog Provider</h1>
        <p className="mt-1 text-sm text-white/50">
          Ringkasan jumlah series dan episode per provider.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {providers.map((provider) => (
          <article className="surface rounded-md p-4" key={provider.id}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold">{provider.name}</h2>
                <p className="mt-1 truncate text-sm text-white/45">
                  {provider.slug}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${
                  provider.is_active
                    ? "bg-emerald-400/15 text-emerald-200"
                    : "bg-white/10 text-white/50"
                }`}
              >
                {provider.is_active ? "Aktif" : "Nonaktif"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricBlock label="Series" value={provider.series_count} />
              <MetricBlock label="Episode" value={provider.episode_count} />
            </div>

            <div className="mt-4 border-t border-white/10 pt-4 text-sm">
              <p className="truncate text-white/45">
                Base: {provider.base_url ?? "-"}
              </p>
              <p className="mt-2 truncate text-white/65">
                Sample: {provider.sample_series?.title ?? "-"}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function AdminNavLink({
  active,
  href,
  icon,
  label
}: {
  active: boolean;
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition ${
        active ? "bg-[#d00064] text-white" : "text-white/65 hover:bg-white/10"
      }`}
      href={href}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function SummaryTile({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="surface rounded-md p-4">
      <div className="mb-3 flex items-center justify-between text-white/55">
        <span className="text-sm font-semibold">{label}</span>
        {icon}
      </div>
      <p className="text-3xl font-black">{value.toLocaleString("id-ID")}</p>
    </div>
  );
}

function MetricBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white/[0.055] p-3">
      <p className="text-xs font-semibold uppercase text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-black">{value.toLocaleString("id-ID")}</p>
    </div>
  );
}
