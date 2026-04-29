"use client";

import Hls from "hls.js";
import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getDecodedMediaSource, isHlsSource } from "@/components/media-source";

export function HlsPlayer({
  src,
  poster,
  title,
  showLoadingOverlay = false,
  autoPlay = false
}: {
  src: string | null;
  poster?: string | null;
  title: string;
  showLoadingOverlay?: boolean;
  autoPlay?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    src ? "loading" : "error"
  );
  const [sourceIndex, setSourceIndex] = useState(0);
  const sourceCandidates = useMemo(
    () => (src ? [src, getDecodedMediaSource(src)].filter(Boolean) : []),
    [src]
  );

  useEffect(() => {
    const video = videoRef.current;
    const activeSrc = sourceCandidates[sourceIndex];
    if (!video || !activeSrc) {
      setStatus("error");
      return;
    }

    let hls: Hls | null = null;
    let networkRetries = 0;
    setStatus("loading");

    const onReady = () => setStatus("ready");
    const onError = () => setStatus("error");

    if (!isHlsSource(activeSrc)) {
      video.src = activeSrc;
      video.addEventListener("loadedmetadata", onReady);
      video.addEventListener("canplay", onReady);
      video.addEventListener("error", onError);
      video.load();
      if (autoPlay) {
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => undefined);
        });
      }
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = activeSrc;
      video.addEventListener("loadedmetadata", onReady);
      video.addEventListener("canplay", onReady);
      video.addEventListener("error", onError);
      video.load();
      if (autoPlay) {
        video.play().catch(() => undefined);
      }
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false
      });
      hls.loadSource(activeSrc);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        onReady();
        if (autoPlay) {
          video.play().catch(() => undefined);
        }
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        if (
          data.type === Hls.ErrorTypes.NETWORK_ERROR &&
          sourceIndex < sourceCandidates.length - 1
        ) {
          setSourceIndex((index) => index + 1);
          return;
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 2) {
          networkRetries += 1;
          hls?.startLoad();
          return;
        }

        setStatus("error");
      });
    } else {
      queueMicrotask(() => setStatus("error"));
    }

    return () => {
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
      if (hls) hls.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [autoPlay, sourceCandidates, sourceIndex]);

  useEffect(() => {
    queueMicrotask(() => setSourceIndex(0));
  }, [src]);

  return (
    <div className="relative overflow-hidden rounded-md border border-white/10 bg-black">
      <video
        className="aspect-video w-full bg-black"
        autoPlay={autoPlay}
        controls
        muted={autoPlay}
        playsInline
        preload="auto"
        poster={poster ?? undefined}
        ref={videoRef}
        title={title}
      >
      </video>

      {showLoadingOverlay && status === "loading" ? (
        <div className="pointer-events-none absolute inset-0 bg-black/25" />
      ) : null}

      {status === "error" ? (
        <div className="absolute inset-0 grid place-items-center bg-black/85 px-6 text-center">
          <div>
            <AlertCircle className="mx-auto mb-3 h-7 w-7 text-[#d7b46a]" />
            <p className="font-medium">Stream tidak tersedia</p>
            <p className="mt-1 text-sm text-white/55">
              Episode ini belum memiliki URL video yang bisa diputar.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
