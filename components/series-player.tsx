"use client";

import Hls from "hls.js";
import {
  Bookmark,
  Captions,
  ChevronLeft,
  List,
  Minimize2,
  Pause,
  Play,
  Share2,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HlsPreloader } from "@/components/hls-preloader";
import { getDecodedMediaSource, isHlsSource } from "@/components/media-source";
import type { Episode, Series } from "@/lib/types";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

type RefreshSourcePayload = {
  error?: unknown;
  source_m3u8_url?: unknown;
};

type BatchRefreshSourcePayload = {
  refreshed?: Array<{
    episode_id?: unknown;
    source_m3u8_url?: unknown;
  }>;
};

type FreshSourceOptions = {
  force?: boolean;
};

type SubtitleCue = {
  end: number;
  start: number;
  text: string;
};

type SwipeStart = {
  at: number;
  pointerId: number;
  x: number;
  y: number;
};

type SubtitleBackdrop = "none" | "transparent" | "dark";
type SubtitleSize = "small" | "medium" | "large";

const playbackRates = [1, 1.25, 1.5, 2];
const swipeAxisRatio = 1.25;
const swipeMaxDurationMs = 900;
const swipeMinDistance = 72;
const sourcePrefetchLookAhead = 16;
const sourcePrefetchDelayMs = 900;

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("a,button,input,select,textarea,[role='button']"))
  );
}

async function fetchEpisodeFreshSource(
  episodeId: string,
  options: FreshSourceOptions = {}
) {
  const response = await fetch(`/api/episodes/${episodeId}/refresh-source`, {
    body: JSON.stringify({
      force: options.force === true,
      persist: false
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const payload = (await response.json().catch(() => ({}))) as RefreshSourcePayload;
  const freshSource =
    typeof payload.source_m3u8_url === "string"
      ? payload.source_m3u8_url.trim()
      : "";

  if (!response.ok || !freshSource) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Gagal mengambil stream baru."
    );
  }

  return freshSource;
}

async function fetchEpisodeFreshSources(episodeIds: string[]) {
  if (!episodeIds.length) return new Map<string, string>();

  const response = await fetch("/api/episodes/refresh-sources", {
    body: JSON.stringify({ episodeIds, persist: false }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const payload = (await response.json().catch(() => ({}))) as BatchRefreshSourcePayload;

  if (!response.ok) return new Map<string, string>();

  return new Map(
    (payload.refreshed ?? []).flatMap((item) => {
      const episodeId =
        typeof item.episode_id === "string" ? item.episode_id.trim() : "";
      const sourceUrl =
        typeof item.source_m3u8_url === "string"
          ? item.source_m3u8_url.trim()
          : "";

      return episodeId && sourceUrl ? [[episodeId, sourceUrl] as const] : [];
    })
  );
}

function parseVttTimestamp(value: string) {
  const parts = value.trim().replace(",", ".").split(":");
  if (parts.length < 2) return null;

  const seconds = Number(parts.pop());
  const minutes = Number(parts.pop());
  const hours = parts.length ? Number(parts.pop()) : 0;

  if (![hours, minutes, seconds].every(Number.isFinite)) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function parseVtt(text: string): SubtitleCue[] {
  const blocks = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.flatMap((block) => {
    const lines = block.split(/\r?\n/);
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) return [];

    const [startText, endText] = lines[timingIndex].split("-->");
    const start = parseVttTimestamp(startText);
    const end = parseVttTimestamp(endText.trim().split(/\s+/)[0]);
    const cueText = lines
      .slice(timingIndex + 1)
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

    if (start === null || end === null || !cueText) return [];

    return {
      end,
      start,
      text: cueText
    };
  });
}

export function SeriesPlayer({
  series,
  episodes,
  initialEpisodeId
}: {
  series: Pick<Series, "id" | "title" | "cover_url">;
  episodes: Episode[];
  initialEpisodeId?: string;
}) {
  const initialIndex = Math.max(
    0,
    episodes.findIndex((episode) => episode.id === initialEpisodeId)
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const suppressNextTapRef = useRef(false);
  const swipeStartRef = useRef<SwipeStart | null>(null);
  const activeEpisodeIdRef = useRef<string | null>(
    episodes[initialIndex]?.id ?? null
  );
  const refreshAttemptedRef = useRef<Set<string>>(new Set());
  const forceRefreshAttemptedRef = useRef<Set<string>>(new Set());
  const prefetchAttemptedRef = useRef<Set<string>>(new Set());
  const prefetchInFlightRef = useRef<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSwitchingEpisode, setIsSwitchingEpisode] = useState(false);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [error, setError] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [sourceOverrides, setSourceOverrides] = useState<Record<string, string>>({});
  const [refreshingSource, setRefreshingSource] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [userStartedPlayback, setUserStartedPlayback] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [showSubtitleSettings, setShowSubtitleSettings] = useState(false);
  const [subtitleBackdrop, setSubtitleBackdrop] =
    useState<SubtitleBackdrop>("transparent");
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitleSize, setSubtitleSize] = useState<SubtitleSize>("medium");
  const [subtitleUnavailable, setSubtitleUnavailable] = useState<Record<string, boolean>>({});
  const [playbackRate, setPlaybackRate] = useState(1);

  const active = episodes[activeIndex];
  const next = activeIndex < episodes.length - 1 ? episodes[activeIndex + 1] : null;

  const episodeLabel = useMemo(
    () => `EP.${active?.episode_number ?? active?.episode_index ?? "-"}`,
    [active]
  );
  const activeSource = active ? (sourceOverrides[active.id] ?? null) : null;
  const sourceCandidates = useMemo(() => {
    if (!activeSource) return [];
    const decoded = getDecodedMediaSource(activeSource);
    return decoded ? [activeSource, decoded] : [activeSource];
  }, [activeSource]);
  const nextSource = next ? (sourceOverrides[next.id] ?? null) : null;
  const transitionCoverStyle = series.cover_url
    ? { backgroundImage: `url("${series.cover_url.replace(/"/g, "%22")}")` }
    : undefined;
  const subtitleLanguage = active?.subtitle_language?.split("_")[0] || "id";
  const mayHaveSubtitle = Boolean(
    active?.subtitle_url || active?.platform === "dramadash"
  );
  const hasSubtitle = Boolean(
    mayHaveSubtitle && active && !subtitleUnavailable[active.id]
  );
  const activeSubtitleText = useMemo(() => {
    if (!subtitlesEnabled || !subtitleCues.length) return "";

    return subtitleCues
      .filter((cue) => currentTime >= cue.start && currentTime <= cue.end)
      .map((cue) => cue.text)
      .join("\n");
  }, [currentTime, subtitleCues, subtitlesEnabled]);
  const subtitleSizeClass =
    subtitleSize === "small"
      ? "text-sm sm:text-lg"
      : subtitleSize === "large"
        ? "text-lg sm:text-2xl"
        : "text-base sm:text-xl";
  const subtitleBackdropClass =
    subtitleBackdrop === "none"
      ? "bg-transparent"
      : subtitleBackdrop === "dark"
        ? "bg-black/85"
        : "bg-black/60";

  const showControls = useCallback(() => {
    setControlsVisible(true);
  }, []);

  const applySourceOverride = useCallback(
    (episodeId: string, sourceUrl: string) => {
      setSourceOverrides((current) => ({
        ...current,
        [episodeId]: sourceUrl
      }));
    },
    []
  );

  const prefetchFreshSources = useCallback(
    async (items: Episode[]) => {
      const activeEpisodeId = activeEpisodeIdRef.current;
      const targets = items
        .filter(
          (episode) =>
            episode.id &&
            episode.id !== activeEpisodeId &&
            !prefetchAttemptedRef.current.has(episode.id) &&
            !prefetchInFlightRef.current.has(episode.id)
        )
        .slice(0, sourcePrefetchLookAhead);

      if (!targets.length) return;

      const episodeIds = targets.map((episode) => episode.id);
      for (const episodeId of episodeIds) {
        prefetchAttemptedRef.current.add(episodeId);
        prefetchInFlightRef.current.add(episodeId);
      }

      try {
        const refreshed = await fetchEpisodeFreshSources(episodeIds);
        for (const [episodeId, sourceUrl] of refreshed) {
          if (episodeId === activeEpisodeIdRef.current) continue;
          applySourceOverride(episodeId, sourceUrl);
        }

        for (const episodeId of episodeIds) {
          if (!refreshed.has(episodeId)) {
            prefetchAttemptedRef.current.delete(episodeId);
          }
        }
      } catch {
        for (const episodeId of episodeIds) {
          prefetchAttemptedRef.current.delete(episodeId);
        }
      } finally {
        for (const episodeId of episodeIds) {
          prefetchInFlightRef.current.delete(episodeId);
        }
      }
    },
    [applySourceOverride]
  );

  const requestFreshSource = useCallback(async (forceFresh = false) => {
    if (!active?.id) {
      setError(true);
      setIsSwitchingEpisode(false);
      return;
    }

    const episodeId = active.id;
    if (
      (!forceFresh && refreshAttemptedRef.current.has(episodeId)) ||
      (forceFresh && forceRefreshAttemptedRef.current.has(episodeId))
    ) {
      setError(true);
      setIsSwitchingEpisode(false);
      return;
    }

    refreshAttemptedRef.current.add(episodeId);
    if (forceFresh) forceRefreshAttemptedRef.current.add(episodeId);
    setError(false);
    setRefreshError(null);
    setRefreshingSource(true);
    setIsSwitchingEpisode(true);

    try {
      const freshSource = await fetchEpisodeFreshSource(episodeId, {
        force: forceFresh
      });
      applySourceOverride(episodeId, freshSource);

      if (activeEpisodeIdRef.current === episodeId) {
        setSourceIndex(0);
      }

      void prefetchFreshSources(
        episodes.slice(activeIndex + 1, activeIndex + 1 + sourcePrefetchLookAhead)
      );
    } catch (loadError) {
      const fallbackMessage =
        loadError instanceof Error
          ? loadError.message
          : "Sumber upstream belum mengirim URL stream terbaru.";
      if (activeEpisodeIdRef.current === episodeId) {
        setRefreshError(fallbackMessage);
        setError(true);
        setIsSwitchingEpisode(false);
      }
    } finally {
      if (activeEpisodeIdRef.current === episodeId) {
        setRefreshingSource(false);
      }
    }
  }, [active, activeIndex, applySourceOverride, episodes, prefetchFreshSources]);

  const handleSourceFailure = useCallback(() => {
    if (sourceIndex < sourceCandidates.length - 1) {
      setSourceIndex((index) =>
        Math.min(index + 1, Math.max(sourceCandidates.length - 1, 0))
      );
      return;
    }

    void requestFreshSource(true);
  }, [requestFreshSource, sourceCandidates.length, sourceIndex]);

  useEffect(() => {
    activeEpisodeIdRef.current = active?.id ?? null;
  }, [active?.id]);

  useEffect(() => {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }

    if (
      controlsVisible &&
      isPlaying &&
      !showEpisodes &&
      !showSubtitleSettings &&
      !error
    ) {
      controlsTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 2800);
    }

    return () => {
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
      }
    };
  }, [controlsVisible, error, isPlaying, showEpisodes, showSubtitleSettings]);

  useEffect(() => {
    const video = videoRef.current;
    const src = sourceCandidates[sourceIndex];
    if (!video) return;
    if (!src) {
      queueMicrotask(() => {
        void requestFreshSource(true);
      });
      return;
    }

    let disposed = false;
    let hls: Hls | null = null;
    let networkRetries = 0;
    queueMicrotask(() => {
      if (disposed) return;
      setError(false);
      setCurrentTime(0);
      setDuration(0);
    });

    const markReady = () => {
      if (video.readyState >= 2) setIsSwitchingEpisode(false);
    };
    const syncState = () => {
      setCurrentTime(video.currentTime || 0);
      setDuration(video.duration || 0);
      setIsPlaying(!video.paused);
      markReady();
    };
    const onError = () => handleSourceFailure();

    video.addEventListener("timeupdate", syncState);
    video.addEventListener("loadedmetadata", syncState);
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("canplay", markReady);
    video.addEventListener("playing", markReady);
    video.addEventListener("play", syncState);
    video.addEventListener("pause", syncState);
    video.addEventListener("error", onError);

    if (!isHlsSource(src)) {
      video.src = src;
      video.load();
      video.play().catch(() => setIsSwitchingEpisode(false));
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.load();
      video.play().catch(() => setIsSwitchingEpisode(false));
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => setIsSwitchingEpisode(false));
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

        void requestFreshSource();
      });
    } else {
      queueMicrotask(() => {
        void requestFreshSource();
      });
    }

    return () => {
      disposed = true;
      video.removeEventListener("timeupdate", syncState);
      video.removeEventListener("loadedmetadata", syncState);
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
      video.removeEventListener("playing", markReady);
      video.removeEventListener("play", syncState);
      video.removeEventListener("pause", syncState);
      video.removeEventListener("error", onError);
      if (hls) hls.destroy();
    };
  }, [
    active,
    handleSourceFailure,
    requestFreshSource,
    sourceCandidates,
    sourceIndex
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [active?.id, muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackRate;
  }, [active?.id, playbackRate]);

  useEffect(() => {
    if (!active?.id) return;

    const timer = window.setTimeout(() => {
      void prefetchFreshSources(
        episodes.slice(activeIndex + 1, activeIndex + 1 + sourcePrefetchLookAhead)
      );
    }, sourcePrefetchDelayMs);

    return () => window.clearTimeout(timer);
  }, [active?.id, activeIndex, episodes, prefetchFreshSources]);

  useEffect(() => {
    if (!active?.id || !mayHaveSubtitle) {
      queueMicrotask(() => setSubtitleCues([]));
      return;
    }

    const controller = new AbortController();
    queueMicrotask(() => {
      setSubtitleCues([]);
      setSubtitleUnavailable((current) => ({
        ...current,
        [active.id]: false
      }));
    });

    fetch(`/api/episodes/${active.id}/subtitle?lang=${subtitleLanguage}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Subtitle unavailable");
        return response.text();
      })
      .then((text) => {
        const cues = parseVtt(text);
        setSubtitleCues(cues);
        if (!cues.length) {
          setSubtitleUnavailable((current) => ({
            ...current,
            [active.id]: true
          }));
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSubtitleCues([]);
        setSubtitleUnavailable((current) => ({
          ...current,
          [active.id]: true
        }));
      });

    return () => controller.abort();
  }, [active?.id, mayHaveSubtitle, subtitleLanguage]);

  if (!episodes.length || !active) {
    return (
      <div className="surface rounded-md p-5 text-sm text-white/55">
        Episode belum tersedia untuk drama ini.
      </div>
    );
  }

  const progress = duration ? (currentTime / duration) * 100 : 0;

  function setAudioMuted(value: boolean) {
    const video = videoRef.current;
    setMuted(value);
    if (video) video.muted = value;
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    showControls();
    if (video.paused) {
      if (!userStartedPlayback) {
        setUserStartedPlayback(true);
        setAudioMuted(false);
      }
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }

  function seek(value: string) {
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = (Number(value) / 100) * duration;
  }

  function cyclePlaybackRate() {
    const currentIndex = playbackRates.indexOf(playbackRate);
    const nextRate = playbackRates[(currentIndex + 1) % playbackRates.length];
    setPlaybackRate(nextRate);
    showControls();
  }

  function switchEpisode(index: number) {
    if (index < 0 || index >= episodes.length || index === activeIndex) return;

    void prefetchFreshSources(
      episodes.slice(index + 1, index + 1 + sourcePrefetchLookAhead)
    );
    setShowSubtitleSettings(false);
    setSourceIndex(0);
    setRefreshError(null);
    setIsSwitchingEpisode(true);
    setActiveIndex(index);
    setShowEpisodes(false);
    if (isPlaying) setControlsVisible(false);
  }

  function handleVideoTap() {
    if (suppressNextTapRef.current) {
      suppressNextTapRef.current = false;
      return;
    }

    if (!controlsVisible && isPlaying) {
      showControls();
      return;
    }

    togglePlay();
  }

  function handleSwipePointerDown(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") return;
    if (showEpisodes || showSubtitleSettings || isSwitchingEpisode) return;
    if (isInteractiveTarget(event.target)) return;

    swipeStartRef.current = {
      at: Date.now(),
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
  }

  function handleSwipePointerUp(event: React.PointerEvent<HTMLElement>) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;

    if (!start || start.pointerId !== event.pointerId) return;
    if (showEpisodes || showSubtitleSettings || isSwitchingEpisode || refreshingSource) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const elapsed = Date.now() - start.at;

    if (
      absY < swipeMinDistance ||
      absY < absX * swipeAxisRatio ||
      elapsed > swipeMaxDurationMs
    ) {
      return;
    }

    const nextIndex = deltaY < 0 ? activeIndex + 1 : activeIndex - 1;
    if (nextIndex < 0 || nextIndex >= episodes.length) {
      showControls();
      return;
    }

    event.preventDefault();
    suppressNextTapRef.current = true;
    window.setTimeout(() => {
      suppressNextTapRef.current = false;
    }, 350);
    switchEpisode(nextIndex);
  }

  function handleSwipePointerCancel() {
    swipeStartRef.current = null;
  }

  const overlayVisible =
    controlsVisible ||
    !isPlaying ||
    showEpisodes ||
    showSubtitleSettings ||
    error ||
    refreshingSource;

  return (
    <section
      className="fixed inset-0 z-[60] bg-black text-white"
      onPointerCancel={handleSwipePointerCancel}
      onPointerDown={handleSwipePointerDown}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse") showControls();
      }}
      onPointerUp={handleSwipePointerUp}
    >
      <HlsPreloader src={nextSource} />

      <video
        className="absolute inset-0 h-full w-full bg-black object-cover"
        crossOrigin="anonymous"
        muted={muted}
        playsInline
        preload="auto"
        ref={videoRef}
        title={`${series.title} ${episodeLabel}`}
        onClick={handleVideoTap}
      />

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-[#171019] transition-opacity duration-300 ${
          isSwitchingEpisode && !error ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="absolute inset-[-2rem] scale-110 bg-cover bg-center blur-2xl"
          style={transitionCoverStyle}
        />
        <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" />
      </div>

      <div
        className={`pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-black/70 via-black/5 to-black/75 transition-opacity duration-300 ${
          overlayVisible ? "opacity-100" : "opacity-0"
        }`}
      />

      {activeSubtitleText ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-28 z-10 flex justify-center px-8 sm:bottom-32">
          <p
            className={`max-w-3xl whitespace-pre-line rounded px-3 py-1.5 text-center font-semibold leading-snug text-white shadow-lg ${subtitleSizeClass} ${subtitleBackdropClass}`}
            style={{ textShadow: "0 1px 3px rgba(0,0,0,.9)" }}
          >
            {activeSubtitleText}
          </p>
        </div>
      ) : null}

      <header
        className={`absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] transition-opacity duration-300 ${
          overlayVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <Link
          aria-label="Kembali"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/25 text-white"
          href={`/series/${series.id}`}
        >
          <ChevronLeft className="h-7 w-7" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-black sm:text-2xl">
          {series.title}
        </h1>
        <span className="shrink-0 text-xl font-black">{episodeLabel}</span>
      </header>

      {error ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/80 px-6 text-center">
          <div>
            <p className="text-xl font-bold">Video tidak tersedia</p>
            <p className="mt-2 text-sm text-white/60">
              {refreshError ??
                "URL stream episode ini sudah tidak tersedia atau sudah kedaluwarsa."}
            </p>
          </div>
        </div>
      ) : null}

      {refreshingSource && !error ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 px-6 text-center">
          <div>
            <p className="text-xl font-bold">Mengambil stream terbaru</p>
            <p className="mt-2 text-sm text-white/60">
              Menghubungi sumber upstream untuk URL episode terbaru.
            </p>
          </div>
        </div>
      ) : null}

      <button
        aria-label={isPlaying ? "Pause" : "Play"}
        className={`absolute left-1/2 top-1/2 z-10 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition sm:h-24 sm:w-24 ${
          isSwitchingEpisode || refreshingSource || !overlayVisible
            ? "pointer-events-none opacity-0"
            : "opacity-100"
        }`}
        onClick={togglePlay}
        type="button"
      >
        {isPlaying ? (
          <Pause className="h-10 w-10 fill-current sm:h-12 sm:w-12" strokeWidth={1.6} />
        ) : (
          <Play className="ml-1 h-10 w-10 fill-current sm:h-12 sm:w-12" strokeWidth={1.6} />
        )}
      </button>

      <aside
        className={`absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-3 transition-opacity duration-300 sm:right-5 ${
          overlayVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <ActionButton
          active={!muted}
          icon={muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
          label={muted ? "Mute" : "Suara"}
          onClick={() => setAudioMuted(!muted)}
        />
        <ActionButton icon={<Bookmark className="h-6 w-6" />} label="Simpan" />
        <ActionButton
          icon={<Share2 className="h-6 w-6" />}
          label="Bagikan"
          onClick={async () => {
            const url = window.location.href;
            if (navigator.share) {
              await navigator.share({ title: series.title, url }).catch(() => undefined);
              return;
            }
            await navigator.clipboard?.writeText(url).catch(() => undefined);
          }}
        />
        <ActionButton
          icon={<List className="h-6 w-6" />}
          label="Episode"
          onClick={() => {
            showControls();
            setShowSubtitleSettings(false);
            void prefetchFreshSources(
              episodes.slice(
                activeIndex + 1,
                activeIndex + 1 + sourcePrefetchLookAhead
              )
            );
            setShowEpisodes(true);
          }}
        />
        <ActionButton
          active={subtitlesEnabled && hasSubtitle}
          disabled={!hasSubtitle}
          icon={<Captions className="h-6 w-6" />}
          label={hasSubtitle ? (subtitlesEnabled ? "CC On" : "CC Off") : "No CC"}
          onClick={() => {
            if (!hasSubtitle) return;
            showControls();
            setShowEpisodes(false);
            setShowSubtitleSettings(true);
          }}
        />
        <ActionButton
          icon={<span className="text-sm font-black">{playbackRate}x</span>}
          label="Speed"
          onClick={cyclePlaybackRate}
        />
        <ActionLink
          href={`/series/${series.id}`}
          icon={<Minimize2 className="h-5 w-5" />}
          label="Kecil"
        />
      </aside>

      <div
        className={`absolute inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-10 transition-opacity duration-300 sm:inset-x-10 ${
          overlayVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <input
          aria-label="Progress"
          className="h-1 w-full accent-[#6663ff]"
          max="100"
          min="0"
          onChange={(event) => seek(event.target.value)}
          type="range"
          value={progress}
        />
        <div className="mt-2 flex items-center justify-between text-sm font-semibold text-white drop-shadow sm:text-base">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {showSubtitleSettings ? (
        <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-[1.75rem] bg-[#17181c]/95 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-white shadow-2xl backdrop-blur-xl sm:mx-auto sm:max-w-xl">
          <div className="mx-auto mb-5 h-1.5 w-20 rounded-full bg-white/25" />
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-black">Subtitle</h2>
            <button
              aria-label="Tutup subtitle"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10"
              onClick={() => setShowSubtitleSettings(false)}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-7 flex items-center justify-between gap-4">
            <span className="text-lg font-semibold">Tampilkan Subtitle</span>
            <button
              aria-pressed={subtitlesEnabled}
              className={`relative h-12 w-20 rounded-full p-1 transition ${
                subtitlesEnabled ? "bg-[#6663ff]" : "bg-white/15"
              }`}
              onClick={() => setSubtitlesEnabled((enabled) => !enabled)}
              type="button"
            >
              <span
                className={`block h-10 w-10 rounded-full bg-white transition ${
                  subtitlesEnabled ? "translate-x-8" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <p className="mb-3 text-sm font-bold uppercase tracking-wide text-white/45">
            Ukuran Teks
          </p>
          <div className="mb-7 grid grid-cols-3 gap-3">
            <SubtitleOption
              active={subtitleSize === "small"}
              label="Kecil"
              onClick={() => setSubtitleSize("small")}
            />
            <SubtitleOption
              active={subtitleSize === "medium"}
              label="Sedang"
              onClick={() => setSubtitleSize("medium")}
            />
            <SubtitleOption
              active={subtitleSize === "large"}
              label="Besar"
              onClick={() => setSubtitleSize("large")}
            />
          </div>

          <p className="mb-3 text-sm font-bold uppercase tracking-wide text-white/45">
            Latar Belakang
          </p>
          <div className="grid grid-cols-3 gap-3">
            <SubtitleOption
              active={subtitleBackdrop === "none"}
              label="Tanpa"
              onClick={() => setSubtitleBackdrop("none")}
            />
            <SubtitleOption
              active={subtitleBackdrop === "transparent"}
              label="Transparan"
              onClick={() => setSubtitleBackdrop("transparent")}
            />
            <SubtitleOption
              active={subtitleBackdrop === "dark"}
              label="Gelap"
              onClick={() => setSubtitleBackdrop("dark")}
            />
          </div>
        </div>
      ) : null}

      {showEpisodes ? (
        <div className="absolute inset-x-0 bottom-0 z-30 max-h-[58dvh] overflow-hidden rounded-t-[2rem] border-t border-white/25 bg-[#2b2430]/95 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
          <div className="mx-auto mb-6 h-2 w-32 rounded-full bg-white/80" />
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex-1 text-center text-2xl font-black">Pilih Episode</h2>
            <button
              aria-label="Tutup episode"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10"
              onClick={() => setShowEpisodes(false)}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="max-h-[42dvh] overflow-y-auto pb-4">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-8">
              {episodes.map((episode, index) => (
                <button
                  className={`rounded-md px-3 py-4 text-lg font-black ${
                    index === activeIndex
                      ? "bg-[#d00064] text-white"
                      : "bg-white/10 text-white/90"
                  }`}
                  key={episode.id}
                  onClick={() => {
                    switchEpisode(index);
                  }}
                  type="button"
                >
                  EP.{episode.episode_number ?? episode.episode_index ?? "-"}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ActionButton({
  active,
  disabled,
  icon,
  label,
  onClick
}: {
  active?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      className={`flex w-16 flex-col items-center gap-1.5 text-white transition ${
        disabled ? "opacity-40" : "opacity-100"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span
        className={`grid h-14 w-14 place-items-center rounded-2xl border border-white/10 shadow-lg backdrop-blur-md ${
          active ? "bg-[#6663ff]/90 text-white" : "bg-white/15"
        }`}
      >
        {icon}
      </span>
      <span className="max-w-full truncate text-xs font-bold drop-shadow">{label}</span>
    </button>
  );
}

function ActionLink({
  href,
  icon,
  label
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link className="flex w-16 flex-col items-center gap-1.5 text-white" href={href}>
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/15 shadow-lg backdrop-blur-md">
        {icon}
      </span>
      <span className="max-w-full truncate text-xs font-bold drop-shadow">{label}</span>
    </Link>
  );
}

function SubtitleOption({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-14 rounded-md text-base font-bold transition ${
        active ? "bg-[#6663ff] text-white" : "bg-white/10 text-white/55"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
