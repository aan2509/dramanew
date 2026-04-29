import Link from "next/link";
import { Search } from "lucide-react";
import { HomeHeroSlider } from "@/components/home-hero-slider";
import { PageShell } from "@/components/page-shell";
import { SearchBox } from "@/components/search-box";
import { SeriesGrid } from "@/components/series-grid";
import { getPopularSeries } from "@/lib/data";

export const revalidate = 180;

export default async function Home() {
  const series = await getPopularSeries(50);
  const heroItems = series.slice(0, 10);
  const popularItems = series.slice(10, 50);

  return (
    <PageShell
      wide
      action={
        <Link
          aria-label="Search"
          className="grid h-10 w-10 place-items-center rounded-md border border-white/10 bg-white/[0.055] text-white/70"
          href="/collections?focus=search"
        >
          <Search className="h-5 w-5" strokeWidth={1.8} />
        </Link>
      }
    >
      <div className="space-y-7">
        <SearchBox placeholder="Cari drama favorit" />

        <HomeHeroSlider items={heroItems} />

        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Pilihan drama populer</h2>
              <p className="text-sm text-white/50">
                Peringkat 11-50 berdasarkan views dari seluruh database.
              </p>
            </div>
            <Link className="text-sm font-medium text-[#d7b46a]" href="/collections">
              Lihat semua
            </Link>
          </div>
          <SeriesGrid items={popularItems} />
        </section>
      </div>
    </PageShell>
  );
}
