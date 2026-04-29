type JsonRecord = Record<string, unknown>;

export type FreshEpisodeSourceInput = {
  episodeId: string;
  platform?: string | null;
  providerSeriesId?: string | null;
  providerBaseUrl?: string | null;
  episodeIndex?: number | null;
  episodeNumber?: number | null;
  title?: string | null;
  lang?: string | null;
};

export type FreshEpisodeSource = {
  sourceUrl: string;
  matchedBy: string;
  upstreamUrl: string;
};

export class UpstreamSourceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = "UPSTREAM_SOURCE_ERROR") {
    super(message);
    this.name = "UpstreamSourceError";
    this.status = status;
    this.code = code;
  }
}

type PlayableUrl = {
  url: string;
  key: string;
  score: number;
};

type EpisodeCandidate = {
  sourceUrl: string;
  score: number;
  matchedBy: string;
};

const defaultProviderBaseUrl = "https://api.dracinku.site";
const mediaKeyPattern =
  /(aliplay|cdn|file|hls|link|m3u8|mp4|play|source|src|stream|url|video)/i;
const episodeKeyPattern =
  /(chapter|episode|ep|index|number|no|num|order|seq|sort|title)/i;

export async function fetchFreshEpisodeSource(
  input: FreshEpisodeSourceInput
): Promise<FreshEpisodeSource> {
  const apiKey = getUpstreamApiKey();
  if (!apiKey) {
    throw new UpstreamSourceError(
      "DRACINKU_API_KEY belum diset di server.",
      503,
      "UPSTREAM_API_KEY_MISSING"
    );
  }

  const platform = input.platform?.trim();
  const providerSeriesId = input.providerSeriesId?.trim();

  if (!platform || !providerSeriesId) {
    throw new UpstreamSourceError(
      "Episode tidak punya platform atau provider_series_id.",
      422,
      "UPSTREAM_LOOKUP_MISSING"
    );
  }

  const upstreamUrls = buildSeriesUrls({
    baseUrl: input.providerBaseUrl,
    lang: input.lang,
    platform,
    providerSeriesId
  });

  let lastError: UpstreamSourceError | null = null;

  for (const upstreamUrl of upstreamUrls) {
    const response = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "x-api-key": apiKey
      }
    });

    if (!response.ok) {
      lastError = new UpstreamSourceError(
        `Upstream gagal dimuat (${response.status}).`,
        502,
        "UPSTREAM_REQUEST_FAILED"
      );
      continue;
    }

    const payload = (await response.json()) as unknown;
    const candidate = findEpisodeSource(payload, input);

    if (!candidate) {
      lastError = new UpstreamSourceError(
        "URL stream fresh tidak ditemukan dari upstream.",
        404,
        "UPSTREAM_SOURCE_NOT_FOUND"
      );
      continue;
    }

    return {
      sourceUrl: candidate.sourceUrl,
      matchedBy: candidate.matchedBy,
      upstreamUrl
    };
  }

  throw (
    lastError ??
    new UpstreamSourceError(
      "URL stream fresh tidak ditemukan dari upstream.",
      404,
      "UPSTREAM_SOURCE_NOT_FOUND"
    )
  );
}

function getUpstreamApiKey() {
  return (
    process.env.DRACINKU_API_KEY ||
    process.env.DRAMA_API_KEY ||
    process.env.DRAMA_UPSTREAM_API_KEY ||
    ""
  ).trim();
}

function buildSeriesUrls({
  baseUrl,
  lang,
  platform,
  providerSeriesId
}: {
  baseUrl?: string | null;
  lang?: string | null;
  platform: string;
  providerSeriesId: string;
}) {
  const base = normalizeBaseUrl(baseUrl);
  const language = lang?.trim() || "id";
  const cacheUrl = new URL(
    `/cache/series/${encodeURIComponent(providerSeriesId)}`,
    base
  );
  cacheUrl.searchParams.set("platform", platform);
  cacheUrl.searchParams.set("lang", language);

  const liveUrl = new URL(
    `/${encodeURIComponent(platform)}/series/${encodeURIComponent(providerSeriesId)}`,
    base
  );
  liveUrl.searchParams.set("lang", language);

  return [cacheUrl.toString(), liveUrl.toString()];
}

function normalizeBaseUrl(value?: string | null) {
  const baseUrl =
    process.env.DRACINKU_BASE_URL?.trim() ||
    process.env.DRAMA_API_BASE_URL?.trim() ||
    value?.trim() ||
    defaultProviderBaseUrl;
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function findEpisodeSource(
  payload: unknown,
  target: FreshEpisodeSourceInput
): EpisodeCandidate | null {
  const candidates: EpisodeCandidate[] = [];
  walkEpisodeCandidates(payload, target, candidates);
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function walkEpisodeCandidates(
  value: unknown,
  target: FreshEpisodeSourceInput,
  candidates: EpisodeCandidate[],
  arrayIndex?: number
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walkEpisodeCandidates(item, target, candidates, index)
    );
    return;
  }

  if (!isRecord(value)) return;

  const urls = collectPlayableUrls(value);
  if (urls.length) {
    const score = scoreEpisodeObject(value, target, arrayIndex);
    if (score > 0) {
      const bestUrl = urls.sort((a, b) => b.score - a.score)[0];
      candidates.push({
        sourceUrl: bestUrl.url,
        score: score + bestUrl.score,
        matchedBy: buildMatchReason(value, target, arrayIndex, bestUrl.key)
      });
    }
  }

  for (const child of Object.values(value)) {
    walkEpisodeCandidates(child, target, candidates);
  }
}

function collectPlayableUrls(
  value: unknown,
  parentKey = "",
  depth = 0
): PlayableUrl[] {
  if (typeof value === "string") {
    const url = normalizePlayableUrl(value);
    if (!url) return [];

    return [
      {
        key: parentKey,
        score: scoreMediaUrl(url, parentKey),
        url
      }
    ];
  }

  if (depth >= 3) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectPlayableUrls(item, parentKey, depth + 1));
  }

  if (!isRecord(value)) return [];

  return Object.entries(value).flatMap(([key, child]) =>
    collectPlayableUrls(child, key, depth + 1)
  );
}

function normalizePlayableUrl(value: string) {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (!looksLikeMediaUrl(trimmed)) return null;
  return trimmed;
}

function looksLikeMediaUrl(value: string) {
  const lower = value.toLowerCase();
  return (
    lower.includes("/aliplay/video/") ||
    lower.includes(".m3u8") ||
    lower.includes(".mp4") ||
    lower.includes("m3u8") ||
    lower.includes("dramabox") ||
    lower.includes("video")
  );
}

function scoreMediaUrl(url: string, key: string) {
  const lowerUrl = url.toLowerCase();
  let score = mediaKeyPattern.test(key) ? 12 : 0;

  if (lowerUrl.includes(".m3u8")) score += 12;
  if (lowerUrl.includes("/aliplay/video/")) score += 10;
  if (lowerUrl.includes(".mp4")) score += 8;
  if (lowerUrl.includes("expires=")) score += 3;

  return score;
}

function scoreEpisodeObject(
  object: JsonRecord,
  target: FreshEpisodeSourceInput,
  arrayIndex?: number
) {
  let score = 0;

  if (arrayIndex !== undefined) {
    if (target.episodeIndex !== null && target.episodeIndex === arrayIndex) {
      score += 35;
    }

    if (
      target.episodeNumber !== null &&
      target.episodeNumber !== undefined &&
      target.episodeNumber === arrayIndex + 1
    ) {
      score += 35;
    }
  }

  for (const [key, rawValue] of Object.entries(object)) {
    if (!episodeKeyPattern.test(key)) continue;

    const keyScore = scoreEpisodeKey(key, rawValue, target);
    score += keyScore;
  }

  return score;
}

function scoreEpisodeKey(
  key: string,
  value: unknown,
  target: FreshEpisodeSourceInput
) {
  const lowerKey = key.toLowerCase();
  const numbers = extractNumbers(value);
  let score = 0;

  for (const number of numbers) {
    if (
      target.episodeNumber !== null &&
      target.episodeNumber !== undefined &&
      number === target.episodeNumber
    ) {
      score += lowerKey.includes("index") ? 28 : 55;
    }

    if (
      target.episodeIndex !== null &&
      target.episodeIndex !== undefined &&
      number === target.episodeIndex
    ) {
      score += lowerKey.includes("index") ? 55 : 24;
    }

    if (
      target.episodeIndex !== null &&
      target.episodeIndex !== undefined &&
      number - 1 === target.episodeIndex
    ) {
      score += 28;
    }
  }

  if (typeof value === "string") {
    score += scoreEpisodeTitle(value, target);
  }

  return score;
}

function extractNumbers(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return [value];
  if (typeof value !== "string") return [];

  return [...value.matchAll(/\d+/g)]
    .map((match) => Number(match[0]))
    .filter((number) => Number.isFinite(number));
}

function scoreEpisodeTitle(value: string, target: FreshEpisodeSourceInput) {
  const normalizedValue = normalizeText(value);
  const normalizedTitle = normalizeText(target.title ?? "");
  let score = 0;

  if (
    normalizedTitle &&
    (normalizedValue.includes(normalizedTitle) ||
      normalizedTitle.includes(normalizedValue))
  ) {
    score += 30;
  }

  if (target.episodeNumber !== null && target.episodeNumber !== undefined) {
    const episodeNumber = String(target.episodeNumber);
    if (
      normalizedValue.includes(`ep ${episodeNumber}`) ||
      normalizedValue.includes(`episode ${episodeNumber}`) ||
      normalizedValue.endsWith(` ${episodeNumber}`)
    ) {
      score += 25;
    }
  }

  return score;
}

function buildMatchReason(
  object: JsonRecord,
  target: FreshEpisodeSourceInput,
  arrayIndex: number | undefined,
  mediaKey: string
) {
  const markers: string[] = [];
  if (arrayIndex !== undefined) markers.push(`arrayIndex=${arrayIndex}`);

  for (const [key, value] of Object.entries(object)) {
    if (!episodeKeyPattern.test(key)) continue;
    const numbers = extractNumbers(value);
    if (numbers.length) markers.push(`${key}=${numbers.join(",")}`);
  }

  if (target.episodeNumber) markers.push(`targetEp=${target.episodeNumber}`);
  if (mediaKey) markers.push(`mediaKey=${mediaKey}`);
  return markers.join("; ") || "generic episode match";
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
