import Link from "next/link";

export function CategoryTabs({
  categories,
  activeCategory,
  providerId,
  basePath = "/collections"
}: {
  categories: string[];
  activeCategory?: string;
  providerId?: string;
  basePath?: string;
}) {
  if (!categories.length) return null;

  function hrefFor(category?: string) {
    const params = new URLSearchParams();
    if (providerId) params.set("provider", providerId);
    if (category) params.set("category", category);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <Link
        className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
          !activeCategory
            ? "bg-[#d00064] text-white"
            : "bg-white/[0.07] text-white/70"
        }`}
        href={hrefFor()}
      >
        Semua
      </Link>
      {categories.map((category) => (
        <Link
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
            activeCategory === category
              ? "bg-[#d00064] text-white"
              : "bg-white/[0.07] text-white/70"
          }`}
          href={hrefFor(category)}
          key={category}
        >
          {category}
        </Link>
      ))}
    </div>
  );
}
