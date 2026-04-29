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

function positionSubtitleCues(track: TextTrack) {
  const cues = [...Array.from(track.cues ?? []), ...Array.from(track.activeCues ?? [])];

  for (const cue of cues) {
    if (!("line" in cue)) continue;
    const vttCue = cue as VTTCue;
    vttCue.snapToLines = false;
    vttCue.line = 74;
    vttCue.position = 50;
    vttCue.size = 88;
    vttCue.align = "center";
  }
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
  const activeEpisodeIdRef = useRef<string | null>(
    episodes[initialIndex]?.id ?? null
  );
  const refreshAttemptedRef = useRef<Set<string>>(new Set());
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

  const active = episodes[activeIndex];
  const next = activeIndex < episodes.length - 1 ? episodes[activeIndex + 1] : null;

  const episodeLabel = useMemo(
    () => `EP.${active?.episode_number ?? active?.episode_index ?? "-"}`,
    [active]
  );
  const sourceCandidates = useMemo(() => {
    const primary = active
      ? (sourceOverrides[active.id] ?? active.source_m3u8_url)
      : null;
    if (!primary) return [];
    const decoded = getDecodedMediaSource(primary);
    return decoded ? [primary, decoded] : [primary];
  }, [active, sourceOverrides]);
  const transitionCoverStyle = series.cover_url
    ? { backgroundImage: `url("${series.cover_url.replace(/"/g, "%22")}")` }
    : undefined;
  const hasSubtitle = Boolean(active?.subtitle_url);
  const subtitleLanguage = active?.subtitle_language?.split("_")[0] || "id";

  const showControls = useCallback(() => {
    setControlsVisible(true);
  }, []);

  const requestFreshSource = useCallback(async () => {
    if (!active?.id) {
      setError(true);
      setIsSwitchingEpisode(false);
      return;
    }

    const episodeId = active.id;
    if (refreshAttemptedRef.current.has(episodeId)) {
      setError(true);
      setIsSwitchingEpisode(false);
      return;
    }

    refreshAttemptedRef.current.add(episodeId);
    setError(false);
    setRefreshError(null);
    setRefreshingSource(true);
    setIsSwitchingEpisode(true);

    try {
      const response = await fetch(`/api/episodes/${episodeId}/refresh-source`, {
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: unknown;
        source_m3u8_url?: unknown;
      };
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

      setSourceOverrides((current) => ({
        ...current,
        [episodeId]: freshSource
      }));

      if (activeEpisodeIdRef.current === episodeId) {
        setSourceIndex(0);
      }
    } catch (loadError) {
      const fallbackMessage =
        loadError instanceof Error
          ? loadError.message
          : "URL stream episode ini sudah tidak tersedia, dan upstream belum mengirim URL pengganti.";
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
  }, [active]);

  const handleSourceFailure = useCallback(() => {
    if (sourceIndex < sourceCandidates.length - 1) {
      setSourceIndex((index) =>
        Math.min(index + 1, Math.max(sourceCandidates.length - 1, 0))
      );
      return;
    }

    void requestFreshSource();
  }, [requestFreshSource, sourceCandidates.length, sourceIndex]);

  useEffect(() => {
    activeEpisodeIdRef.current = active?.id ?? null;
  }, [active?.id]);

  useEffect(() => {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }

    if (controlsVisible && isPlaying && !showEpisodes && !error) {
      controlsTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 2800);
    }

    return () => {
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
      }
    };
  }, [controlsVisible, error, isPlaying, showEpisodes]);

  useEffect(() => {
    const video = videoRef.current;
    const src = sourceCandidates[sourceIndex];
    if (!video) return;
    if (!src) {
      queueMicrotask(() => {
        void requestFreshSource();
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
    video.muted = muted;

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
    muted,
    requestFreshSource,
    sourceCandidates,
    sourceIndex
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const cleanup: Array<() => void> = [];

    for (const track of Array.from(video.textTracks)) {
      track.mode = subtitlesEnabled ? "showing" : "disabled";
      positionSubtitleCues(track);

      const handleCueChange = () => positionSubtitleCues(track);
      track.addEventListener("cuechange", handleCueChange);
      cleanup.push(() => track.removeEventListener("cuechange", handleCueChange));
    }

    const placementTimer = window.setTimeout(() => {
      for (const track of Array.from(video.textTracks)) positionSubtitleCues(track);
    }, 300);

    cleanup.push(() => window.clearTimeout(placementTimer));

    return () => {
      for (const remove of cleanup) remove();
    };
  }, [active?.id, subtitlesEnabled]);

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

  function switchEpisode(index: number) {
    setSourceIndex(0);
    setRefreshError(null);
    setIsSwitchingEpisode(true);
    setActiveIndex(index);
    setShowEpisodes(false);
    if (isPlaying) setControlsVisible(false);
  }

  function handleVideoTap() {
    if (!controlsVisible && isPlaying) {
      showControls();
      return;
    }

    togglePlay();
  }

  const overlayVisible =
    controlsVisible || !isPlaying || showEpisodes || error || refreshingSource;

  return (
    <section
      className="fixed inset-0 z-[60] bg-black text-white"
      onPointerMove={(event) => {
        if (event.pointerType === "mouse") showControls();
      }}
    >
      <HlsPreloader src={next?.source_m3u8_url} />

      <video
        className="absolute inset-0 h-full w-full bg-black object-contain sm:object-cover"
        crossOrigin="anonymous"
        muted={muted}
        playsInline
        preload="auto"
        ref={videoRef}
        title={`${series.title} ${episodeLabel}`}
        onClick={handleVideoTap}
      >
        {subtitlesEnabled && active.subtitle_url ? (
          <track
            default
            key={`${active.id}-subtitle`}
            kind="subtitles"
            label="Indonesia"
            src={active.subtitle_url}
            srcLang={subtitleLanguage}
          />
        ) : null}
      </video>

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
            <p className="text-xl font-bold">Mengambil stream baru</p>
            <p className="mt-2 text-sm text-white/60">
              URL lama kadaluarsa, mencoba mengambil sumber fresh dari upstream.
            </p>
          </div>
        </div>
      ) : null}

      <button
        aria-label={isPlaying ? "Pause" : "Play"}
        className={`absolute left-1/2 top-1/2 z-10 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition sm:h-24 sm:w-24 ${
          isPlaying || isSwitchingEpisode || refreshingSource
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
        className={`absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-4 transition-opacity duration-300 sm:right-5 sm:gap-5 ${
          overlayVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <ActionButton icon={<Bookmark className="h-6 w-6" />} label="Simpan" />
        <ActionButton
          icon={<List className="h-6 w-6" />}
          label="Episode"
          onClick={() => {
            showControls();
            setShowEpisodes(true);
          }}
        />
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
          active={subtitlesEnabled && hasSubtitle}
          disabled={!hasSubtitle}
          icon={<Captions className="h-6 w-6" />}
          label={hasSubtitle ? (subtitlesEnabled ? "CC On" : "CC Off") : "No CC"}
          onClick={() => {
            if (hasSubtitle) setSubtitlesEnabled((enabled) => !enabled);
          }}
        />
        <ActionLink
          href={`/series/${series.id}`}
          icon={<Minimize2 className="h-5 w-5" />}
          label="Kecil"
        />
      </aside>

      <div
        className={`absolute inset-x-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-10 rounded-full bg-black/45 px-4 py-3 backdrop-blur-md transition-opacity duration-300 sm:inset-x-10 ${
          overlayVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex items-center gap-3">
          <button aria-label="Play pause" onClick={togglePlay} type="button">
            {isPlaying ? (
              <Pause className="h-8 w-8 fill-current" strokeWidth={1.6} />
            ) : (
              <Play className="h-8 w-8 fill-current" strokeWidth={1.6} />
            )}
          </button>
          <span className="w-14 text-center text-sm font-semibold">
            {formatTime(currentTime)}
          </span>
          <input
            aria-label="Progress"
            className="h-2 min-w-0 flex-1 accent-white"
            max="100"
            min="0"
            onChange={(event) => seek(event.target.value)}
            type="range"
            value={progress}
          />
          <span className="w-14 text-center text-sm font-semibold">
            {formatTime(duration)}
          </span>
          <button
            aria-label="Mute"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10"
            onClick={() => setAudioMuted(!muted)}
            type="button"
          >
            {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
          </button>
        </div>
      </div>

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
      className={`flex flex-col items-center gap-1.5 text-white transition ${
        disabled ? "opacity-40" : "opacity-100"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span
        className={`grid h-12 w-12 place-items-center rounded-full backdrop-blur-sm sm:h-14 sm:w-14 ${
          active ? "bg-[#d00064] text-white" : "bg-black/45"
        }`}
      >
        {icon}
      </span>
      <span className="text-xs font-bold">{label}</span>
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
    <Link className="flex flex-col items-center gap-1.5 text-white" href={href}>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-black/45 backdrop-blur-sm sm:h-14 sm:w-14">
        {icon}
      </span>
      <span className="text-xs font-bold">{label}</span>
    </Link>
  );
}
