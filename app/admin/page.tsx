import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getAdminProviderCatalog } from "@/lib/admin-data";

export const metadata: Metadata = {
  title: "Admin"
};

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const activeView = params.view === "sync" ? "sync" : "catalog";
  const providers = await getAdminProviderCatalog();

  return <AdminDashboard activeView={activeView} providers={providers} />;
}
