import { UserRound } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export default function ProfilePage() {
  return (
    <PageShell>
      <div className="surface mx-auto mt-12 max-w-md rounded-md p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-md bg-white/[0.06] text-[#d7b46a]">
          <UserRound className="h-6 w-6" strokeWidth={1.8} />
        </div>
        <h1 className="text-xl font-semibold">Profil belum aktif</h1>
        <p className="mt-2 text-sm leading-6 text-white/55">
          MVP ini dibuat publik tanpa login, favorit, atau riwayat tontonan.
        </p>
      </div>
    </PageShell>
  );
}
