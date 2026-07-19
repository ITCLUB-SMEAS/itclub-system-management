import { useEffect } from "react";
import { requireAuth } from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

export default function PlaceholderPage({
  title,
  href,
}: {
  title: string;
  href: string;
}) {
  useEffect(() => {
    requireAuth();
  }, []);

  return (
    <DashboardShell active={href} title={title} crumbs={["Dashboard", title]}>
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-md rounded-2xl border border-brand-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 font-bold text-brand-600">
            IT
          </div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">
            Modul ini siap dihubungkan ke API. UI shell sudah ada di navigasi.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
