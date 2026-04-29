"use client";

import {
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  XCircle
} from "lucide-react";
import { useMemo, useState } from "react";
import type { AdminProviderCatalogItem } from "@/lib/admin-data";

type ProviderHealth = {
  checked_at: string;
  latency_ms: number | null;
  message: string;
  name: string;
  provider_id: string;
  slug: string;
  status: "ok" | "error" | "unknown";
  status_code: number | null;
};

type HealthPayload = {
  checked_at?: string;
  results?: ProviderHealth[];
};

export function ProviderHealthPanel({
  providers
}: {
  providers: AdminProviderCatalogItem[];
}) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ProviderHealth[]>([]);
  const resultMap = useMemo(
    () => new Map(results.map((result) => [result.provider_id, result])),
    [results]
  );
  const summary = results.reduce(
    (current, result) => ({
      error: current.error + (result.status === "error" ? 1 : 0),
      ok: current.ok + (result.status === "ok" ? 1 : 0),
      unknown: current.unknown + (result.status === "unknown" ? 1 : 0)
    }),
    { error: 0, ok: 0, unknown: 0 }
  );

  async function checkProviders() {
    setChecking(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/provider-health", {
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as HealthPayload & {
        error?: unknown;
      };

      if (!response.ok || !Array.isArray(payload.results)) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Gagal mengecek health provider."
        );
      }

      setResults(payload.results);
    } catch (healthError) {
      setError(
        healthError instanceof Error
          ? healthError.message
          : "Gagal mengecek health provider."
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sync Provider</h1>
          <p className="mt-1 text-sm text-white/50">
            Status health provider berdasarkan request sample series.
          </p>
        </div>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#d00064] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={checking}
          onClick={checkProviders}
          type="button"
        >
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Cek semua provider
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <HealthSummaryTile label="Online" tone="ok" value={summary.ok} />
        <HealthSummaryTile label="Error" tone="error" value={summary.error} />
        <HealthSummaryTile label="Unknown" tone="unknown" value={summary.unknown} />
      </div>

      <div className="space-y-3">
        {providers.map((provider) => {
          const result = resultMap.get(provider.id);
          return (
            <ProviderHealthRow
              checking={checking}
              key={provider.id}
              provider={provider}
              result={result}
            />
          );
        })}
      </div>
    </div>
  );
}

function ProviderHealthRow({
  checking,
  provider,
  result
}: {
  checking: boolean;
  provider: AdminProviderCatalogItem;
  result?: ProviderHealth;
}) {
  const status = result?.status ?? "unknown";
  const showSpinner = checking && !result;

  return (
    <article className="surface rounded-md p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{provider.name}</h2>
            <span className="rounded-md bg-white/10 px-2 py-1 text-xs text-white/55">
              {provider.slug}
            </span>
          </div>
          <p className="mt-2 truncate text-sm text-white/45">
            {provider.sample_series?.title ?? "Belum ada sample series"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <p className="font-semibold">
              {result?.status_code ? `HTTP ${result.status_code}` : "-"}
            </p>
            <p className="text-white/45">
              {result?.latency_ms !== null && result?.latency_ms !== undefined
                ? `${result.latency_ms} ms`
                : "-"}
            </p>
          </div>
          <span
            className={`grid h-11 w-11 place-items-center rounded-md ${getStatusClass(
              status
            )}`}
          >
            {showSpinner ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : status === "ok" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : status === "error" ? (
              <XCircle className="h-5 w-5" />
            ) : (
              <Clock3 className="h-5 w-5" />
            )}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm text-white/55">
        {result?.message ?? "Belum dicek."}
      </p>
    </article>
  );
}

function HealthSummaryTile({
  label,
  tone,
  value
}: {
  label: string;
  tone: "error" | "ok" | "unknown";
  value: number;
}) {
  return (
    <div className={`rounded-md p-4 ${getStatusClass(tone)}`}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-2 text-3xl font-black">{value.toLocaleString("id-ID")}</p>
    </div>
  );
}

function getStatusClass(status: ProviderHealth["status"]) {
  if (status === "ok") return "bg-emerald-400/15 text-emerald-100";
  if (status === "error") return "bg-red-500/15 text-red-100";
  return "bg-white/10 text-white/55";
}
