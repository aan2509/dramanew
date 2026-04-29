"use client";

import { Share2 } from "lucide-react";

export function ShareButton({ title }: { title: string }) {
  return (
    <button
      className="inline-flex h-14 min-w-36 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.035] px-6 text-base font-bold text-white/80"
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          await navigator.share({ title, url }).catch(() => undefined);
          return;
        }
        await navigator.clipboard?.writeText(url).catch(() => undefined);
      }}
      type="button"
    >
      <Share2 className="h-5 w-5" />
      Bagikan
    </button>
  );
}
