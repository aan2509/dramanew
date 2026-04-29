"use client";

import Hls from "hls.js";
import { useEffect } from "react";
import { isHlsSource } from "@/components/media-source";

export function HlsPreloader({ src }: { src?: string | null }) {
  useEffect(() => {
    if (!src) return;

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = isHlsSource(src) ? "auto" : "metadata";
    video.style.position = "fixed";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    video.style.left = "-9999px";
    document.body.appendChild(video);

    let hls: Hls | null = null;

    if (!isHlsSource(src)) {
      video.src = src;
      video.load();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.load();
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 8,
        startFragPrefetch: true
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.startLoad(0);
    }

    return () => {
      if (hls) hls.destroy();
      video.removeAttribute("src");
      video.load();
      video.remove();
    };
  }, [src]);

  return null;
}
