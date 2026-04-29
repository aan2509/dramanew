"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { Series } from "@/lib/types";

export function HomeHeroSlider({ items }: { items: Series[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = items[activeIndex];
  const previous = items[(activeIndex - 1 + items.length) % items.length];
  const next = items[(activeIndex + 1) % items.length];

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % items.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [items.length]);

  if (!active) return null;

  return (
    <section className="relative -mx-4 overflow-hidden bg-black sm:mx-0 sm:rounded-lg sm:border sm:border-white/10">
      {active.cover_url ? (
        <Image
          alt=""
          className="object-cover opacity-20 blur-2xl"
          fill
          priority
          sizes="100vw"
          src={active.cover_url}
          unoptimized
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/55 to-black" />

      <div className="relative px-4 pb-7 pt-8 lg:grid lg:min-h-[520px] lg:grid-cols-[minmax(580px,1.05fr)_minmax(440px,0.95fr)] lg:items-center lg:gap-10 lg:px-12 xl:grid-cols-[minmax(720px,1.15fr)_minmax(520px,0.85fr)]">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-center gap-4 overflow-hidden lg:justify-center xl:gap-6">
          <HeroSidePoster
            item={previous}
            onClick={() =>
              setActiveIndex((index) => (index - 1 + items.length) % items.length)
            }
            side="left"
          />
          <Link
            className="relative aspect-[2/3] w-[64vw] max-w-[280px] shrink-0 overflow-hidden rounded-lg bg-white/[0.055] ring-2 ring-white/20 lg:w-[280px] xl:w-[320px] xl:max-w-[320px]"
            href={`/series/${active.id}`}
            prefetch={false}
          >
            {active.cover_url ? (
              <Image
                alt={active.title}
                className="object-cover"
                fill
                priority
                sizes="(max-width: 640px) 64vw, (max-width: 1280px) 280px, 320px"
                src={active.cover_url}
                unoptimized
              />
            ) : null}
          </Link>
          <HeroSidePoster
            item={next}
            onClick={() => setActiveIndex((index) => (index + 1) % items.length)}
            side="right"
          />
        </div>

        <div className="mx-auto mt-5 max-w-xl text-center lg:mt-0 lg:text-left xl:max-w-2xl">
          <div className="mb-3 flex justify-center gap-2 lg:justify-start">
            <span className="rounded bg-[#d00064] px-2 py-1 text-xs font-black uppercase tracking-wide text-white">
              Top Trending
            </span>
            <span className="rounded border border-white/15 px-2 py-1 text-xs font-black uppercase tracking-wide text-white/70">
              #{activeIndex + 1}
            </span>
          </div>
          <h1 className="text-balance text-3xl font-bold leading-tight lg:text-4xl xl:text-5xl">
            {active.title}
          </h1>
          <p className="mx-auto mt-3 line-clamp-3 max-w-xl text-sm leading-6 text-white/60 lg:mx-0">
            {active.description || "Drama populer pilihan minggu ini."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
            {active.tags?.slice(0, 3).map((tag) => (
              <span
                className="rounded border border-white/10 bg-white/[0.06] px-2 py-1 text-xs text-white/70"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-center gap-3 lg:justify-start">
            <Link
              className="inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-[#d00064] px-6 py-4 text-base font-bold text-white shadow-lg shadow-[#d00064]/20 lg:w-auto lg:rounded-md"
              href={`/series/${active.id}`}
              prefetch={false}
            >
              <Play className="h-5 w-5 fill-current" strokeWidth={1.8} />
              Tonton Sekarang
            </Link>
            <button
              aria-label="Slide sebelumnya"
              className="hidden h-12 w-12 place-items-center rounded-md border border-white/10 bg-white/[0.06] text-white/75 lg:grid"
              onClick={() =>
                setActiveIndex((index) => (index - 1 + items.length) % items.length)
              }
              type="button"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              aria-label="Slide berikutnya"
              className="hidden h-12 w-12 place-items-center rounded-md border border-white/10 bg-white/[0.06] text-white/75 lg:grid"
              onClick={() => setActiveIndex((index) => (index + 1) % items.length)}
              type="button"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 flex justify-center gap-2 lg:justify-start">
            {items.map((item, index) => (
              <button
                aria-label={`Tampilkan slide ${index + 1}`}
                className={`h-2 rounded-full transition-all ${
                  index === activeIndex ? "w-7 bg-[#d00064]" : "w-2 bg-white/35"
                }`}
                key={item.id}
                onClick={() => setActiveIndex(index)}
                type="button"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroSidePoster({
  item,
  onClick,
  side
}: {
  item?: Series;
  onClick: () => void;
  side: "left" | "right";
}) {
  if (!item) return null;

  return (
    <button
      aria-label={side === "left" ? "Slide sebelumnya" : "Slide berikutnya"}
      className="relative aspect-[2/3] w-[28vw] max-w-[150px] shrink-0 overflow-hidden rounded-md bg-white/[0.055] opacity-45 ring-1 ring-white/10 sm:w-32 lg:w-44 xl:w-52 xl:max-w-[208px]"
      onClick={onClick}
      type="button"
    >
      {item.cover_url ? (
        <Image
          alt=""
          className="object-cover"
          fill
          sizes="(max-width: 640px) 28vw, (max-width: 1280px) 176px, 208px"
          src={item.cover_url}
          unoptimized
        />
      ) : null}
    </button>
  );
}
