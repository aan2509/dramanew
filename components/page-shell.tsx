import { TopBrand } from "@/components/bottom-nav";

export function PageShell({
  children,
  action,
  wide = false
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <TopBrand />
        {action}
      </header>
      <div className={wide ? "lg:-mx-6 xl:-mx-10 2xl:-mx-16" : undefined}>
        {children}
      </div>
    </main>
  );
}
