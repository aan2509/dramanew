"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const dismissedKey = "dramanow-pwa-dismissed";

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (window.localStorage.getItem(dismissedKey) === "1") return;
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (!visible || !installEvent) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-xl rounded-lg border border-white/20 bg-[#34293b]/95 p-4 shadow-2xl backdrop-blur-xl sm:bottom-24">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-white">Install DramaNow</p>
          <p className="mt-1 text-sm leading-5 text-white/65">
            Buka lebih cepat dari layar utama.
          </p>
        </div>
        <button
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[#d00064] px-4 py-3 text-sm font-bold text-white"
          onClick={async () => {
            await installEvent.prompt();
            await installEvent.userChoice.catch(() => undefined);
            setVisible(false);
          }}
          type="button"
        >
          <Download className="h-4 w-4" />
          Install
        </button>
        <button
          aria-label="Tutup"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-white/75"
          onClick={() => {
            window.localStorage.setItem(dismissedKey, "1");
            setVisible(false);
          }}
          type="button"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
