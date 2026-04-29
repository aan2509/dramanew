import Link from "next/link";
import type { Provider } from "@/lib/types";

export function ProviderTabs({
  providers,
  activeProviderId,
  basePath = "/"
}: {
  providers: Provider[];
  activeProviderId?: string;
  basePath?: string;
}) {
  if (!providers.length) return null;

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <Link
        className={`shrink-0 rounded-md border px-3 py-2 text-sm ${
          !activeProviderId
            ? "border-[#d7b46a]/55 bg-[#d7b46a]/15 text-[#f7f3ea]"
            : "border-white/10 bg-white/[0.04] text-white/65"
        }`}
        href={basePath}
      >
        Semua
      </Link>
      {providers.map((provider) => (
        <Link
          className={`shrink-0 rounded-md border px-3 py-2 text-sm ${
            activeProviderId === provider.id
              ? "border-[#d7b46a]/55 bg-[#d7b46a]/15 text-[#f7f3ea]"
              : "border-white/10 bg-white/[0.04] text-white/65"
          }`}
          href={`${basePath}?provider=${provider.id}`}
          key={provider.id}
        >
          {provider.name}
        </Link>
      ))}
    </div>
  );
}
