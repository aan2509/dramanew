import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Home, Play } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { SeriesEpisodesPanel } from "@/components/series-episodes-panel";
import { ShareButton } from "@/components/share-button";
import { SimilarDrama } from "@/components/similar-drama";
import { getSeriesDetail, getSimilarSeries } from "@/lib/data";
import type { Series } from "@/lib/types";

export const revalidate = 120;

export default async function SeriesDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let series: Series;
  let similar: Series[] = [];

  try {
    series = await getSeriesDetail(id);
  } catch {
    notFound();
  }

  try {
    similar = await getSimilarSeries(series);
  } catch {
    similar = [];
  }

  return (
    <PageShell wide>
      <div className="relative -mx-4 -mt-2 overflow-hidden bg-[#1a121e] px-4 pb-10 pt-4 sm:mx-0 sm:rounded-lg lg:px-8">
        {series.cover_url ? (
          <Image
            alt=""
            className="object-cover opacity-25 blur-2xl"
            fill
            priority
            sizes="100vw"
            src={series.cover_url}
            unoptimized
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-[#1a121e]/80 to-[#1a121e]" />

        <div className="relative">
          <nav className="mb-8 flex min-w-0 items-center gap-2 text-sm font-semibold text-white/55">
            <Link className="inline-flex items-center gap-1" href="/">
              <Home className="h-4 w-4" />
              Beranda
            </Link>
            <span>›</span>
            <Link href="/collections">Movie</Link>
            <span>›</span>
            <span className="truncate text-white/80">{series.title}</span>
          </nav>

          <section className="mx-auto max-w-5xl text-center">
            <div className="relative mx-auto aspect-[2/3] w-[58vw] max-w-[250px] overflow-hidden rounded-lg bg-white/[0.055] shadow-2xl ring-1 ring-white/15 lg:max-w-[220px]">
              {series.cover_url ? (
                <Image
                  alt={series.title}
                  className="object-cover"
                  fill
                  priority
                  sizes="(max-width: 640px) 58vw, 250px"
                  src={series.cover_url}
                  unoptimized
                />
              ) : (
                <div className="grid h-full place-items-center text-white/45">
                  DramaNow
                </div>
              )}
            </div>

            <h1 className="mx-auto mt-7 max-w-4xl text-balance text-4xl font-black leading-tight sm:text-5xl">
              {series.title}
            </h1>

            {series.tags?.length ? (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {series.tags.slice(0, 4).map((tag) => (
                  <span
                    className="rounded-md border border-white/50 px-4 py-2 text-sm font-bold text-white/90"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-6 text-xl text-white/85">
              <p>Episodes</p>
              <p className="mt-1 font-black">{series.chapter_count ?? "-"}</p>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                className="inline-flex h-14 w-full max-w-xs items-center justify-center gap-3 rounded-full bg-[#d00064] px-7 text-lg font-black text-white shadow-xl shadow-[#d00064]/20 sm:w-auto"
                href="#episodes"
              >
                <Play className="h-6 w-6" strokeWidth={1.8} />
                Tonton Sekarang
              </a>
              <div className="hidden h-12 w-px bg-white/20 sm:block" />
              <ShareButton title={series.title} />
            </div>
          </section>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-5xl">
        <section>
          <h2 className="text-2xl font-black">Sinopsis</h2>
          <p className="mt-5 text-justify text-lg leading-9 text-white/68 lg:text-xl lg:leading-10">
            {series.description || "Sinopsis belum tersedia."}
          </p>
        </section>

        <div id="episodes">
          <SeriesEpisodesPanel
            platform={series.platform}
            providerSeriesId={series.provider_series_id}
            seriesId={series.id}
          />
        </div>

        <SimilarDrama items={similar} />
      </div>
    </PageShell>
  );
}
