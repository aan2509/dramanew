import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import {
  getAdminProviderHealthTargets,
  type AdminProviderHealthTarget
} from "@/lib/admin-data";

type ProviderHealthResult = {
  checked_at: string;
  latency_ms: number | null;
  message: string;
  name: string;
  provider_id: string;
  slug: string;
  status: "error" | "ok" | "unknown";
  status_code: number | null;
};

const defaultProviderBaseUrl = "https://api.dracinku.site";
const healthTimeoutMs = 6000;

export async function POST() {
  noStore();

  try {
    const providers = await getAdminProviderHealthTargets();
    const results = await Promise.all(providers.map(checkProviderHealth));

    return NextResponse.json(
      {
        checked_at: new Date().toISOString(),
        results
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Gagal mengecek provider."
      },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 500
      }
    );
  }
}

async function checkProviderHealth(
  provider: AdminProviderHealthTarget
): Promise<ProviderHealthResult> {
  const checkedAt = new Date().toISOString();
  const providerSeriesId = provider.sample_series?.provider_series_id;

  if (!providerSeriesId) {
    return {
      checked_at: checkedAt,
      latency_ms: null,
      message: "Sample series belum tersedia.",
      name: provider.name,
      provider_id: provider.id,
      slug: provider.slug,
      status: "unknown",
      status_code: null
    };
  }

  const upstreamUrl = buildProviderSeriesUrl({
    baseUrl: provider.base_url,
    providerSeriesId,
    slug: provider.slug
  });
  const headers = new Headers({
    accept: "application/json"
  });
  const apiKey = getUpstreamApiKey();
  if (apiKey) headers.set("x-api-key", apiKey);
  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(upstreamUrl, {
      headers
    });
    const latency = Date.now() - startedAt;

    if (!response.ok) {
      return {
        checked_at: checkedAt,
        latency_ms: latency,
        message: `Upstream mengembalikan HTTP ${response.status}.`,
        name: provider.name,
        provider_id: provider.id,
        slug: provider.slug,
        status: "error",
        status_code: response.status
      };
    }

    const payload = await response.json().catch(() => null);

    return {
      checked_at: checkedAt,
      latency_ms: latency,
      message: payload ? "Provider online." : "Respons bukan JSON.",
      name: provider.name,
      provider_id: provider.id,
      slug: provider.slug,
      status: payload ? "ok" : "error",
      status_code: response.status
    };
  } catch (error) {
    return {
      checked_at: checkedAt,
      latency_ms: Date.now() - startedAt,
      message:
        error instanceof Error ? error.message : "Provider tidak merespons.",
      name: provider.name,
      provider_id: provider.id,
      slug: provider.slug,
      status: "error",
      status_code: null
    };
  }
}

function buildProviderSeriesUrl({
  baseUrl,
  providerSeriesId,
  slug
}: {
  baseUrl?: string | null;
  providerSeriesId: string;
  slug: string;
}) {
  const base = normalizeBaseUrl(baseUrl);
  const url = new URL(
    `/${encodeURIComponent(slug)}/series/${encodeURIComponent(providerSeriesId)}`,
    base
  );
  url.searchParams.set("lang", "id");
  return url.toString();
}

function normalizeBaseUrl(value?: string | null) {
  const baseUrl =
    value?.trim() ||
    process.env.DRACINKU_BASE_URL?.trim() ||
    process.env.DRAMA_API_BASE_URL?.trim() ||
    defaultProviderBaseUrl;

  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function getUpstreamApiKey() {
  return (
    process.env.DRACINKU_API_KEY ||
    process.env.DRAMA_API_KEY ||
    process.env.DRAMA_UPSTREAM_API_KEY ||
    ""
  ).trim();
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), healthTimeoutMs);

  try {
    return await fetch(input, {
      ...init,
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Provider timeout.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
