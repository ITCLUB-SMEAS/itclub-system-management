import { useEffect, useState } from "react";
import {
  Users,
  CalendarCheck,
  FolderKanban,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { membersApi, requireAuth, type Member } from "../../lib/api";
import DashboardShell from "../common/DashboardShell";
import DashLink from "../common/DashLink";
import LoadingSpinner from "../common/LoadingSpinner";
import EmptyState from "../common/EmptyState";

const bars = [40, 55, 35, 70, 60, 85, 50, 75, 90, 65, 80, 95];

export default function DashboardHome() {
  const [members, setMembers] = useState<Member[]>([]);
  const [userLabel, setUserLabel] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = requireAuth();
    setUserLabel(u.username);
    membersApi
      .list()
      .then(setMembers)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal load"))
      .finally(() => setLoading(false));
  }, []);

  const active = members.filter((m) => m.status === "ACTIVE").length;
  const pending = members.filter((m) => m.approvalStatus === "PENDING").length;

  const stats = [
    {
      label: "Anggota Aktif",
      value: String(active || members.length || 0),
      delta: "+2 periode ini",
      icon: Users,
      tint: "from-brand-50 to-white",
      iconBg: "bg-brand-100 text-brand-600",
    },
    {
      label: "Pending Approval",
      value: String(pending),
      delta: "butuh review",
      icon: CalendarCheck,
      tint: "from-sky-50 to-white",
      iconBg: "bg-sky-100 text-sky-600",
    },
    {
      label: "Projects",
      value: "—",
      delta: "modul siap",
      icon: FolderKanban,
      tint: "from-cyan-50 to-white",
      iconBg: "bg-cyan-100 text-cyan-600",
    },
    {
      label: "Prestasi",
      value: "—",
      delta: "tracking on",
      icon: Trophy,
      tint: "from-indigo-50 to-white",
      iconBg: "bg-indigo-100 text-indigo-600",
    },
  ];

  return (
    <DashboardShell
      active="/dashboard"
      title="Dashboard"
      crumbs={["Dashboard", "Overview"]}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Halo, {userLabel || "Admin"}
          </h2>
          <p className="text-sm text-slate-500">
            Ringkasan operasional ITCLUB hari ini
          </p>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="alert"
        >
          {error} — pastikan API jalan & role pengurus.
        </div>
      )}

      {loading ? (
        <LoadingSpinner label="Memuat dashboard..." />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className={`rounded-2xl border border-brand-100/80 bg-gradient-to-br ${s.tint} p-5 shadow-sm`}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <p className="text-sm font-medium text-slate-500">{s.label}</p>
                    <span className={`rounded-xl p-2 ${s.iconBg}`} aria-hidden>
                      <Icon size={18} />
                    </span>
                  </div>
                  <p className="text-3xl font-semibold tracking-tight text-slate-900">
                    {s.value}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-600">
                    <TrendingUp size={12} aria-hidden />
                    {s.delta}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Activity Analytics</h3>
                  <p className="text-xs text-slate-400">Kehadiran & kontribusi (demo chart)</p>
                </div>
              </div>
              <div className="relative h-56" aria-hidden>
                <svg viewBox="0 0 400 160" className="h-full w-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b93f6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3b93f6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,120 C40,100 70,130 100,90 C130,50 160,70 200,55 C240,40 270,80 300,60 C330,40 360,50 400,30 L400,160 L0,160 Z"
                    fill="url(#g1)"
                  />
                  <path
                    d="M0,120 C40,100 70,130 100,90 C130,50 160,70 200,55 C240,40 270,80 300,60 C330,40 360,50 400,30"
                    fill="none"
                    stroke="#3b93f6"
                    strokeWidth="2.5"
                  />
                </svg>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Top Divisi</h3>
                <DashLink
                  href="/dashboard/members"
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  See Details
                </DashLink>
              </div>
              <p className="text-2xl font-semibold text-slate-900">
                {members.length}
                <span className="ml-1 text-sm font-normal text-slate-400">members</span>
              </p>
              <div className="mt-4 flex h-16 items-end gap-1" aria-hidden>
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-brand-400/80"
                    style={{ height: `${h}%`, opacity: 0.4 + (i % 5) * 0.12 }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-brand-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Members</h3>
              <DashLink
                href="/dashboard/members"
                className="rounded-full bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                View All
              </DashLink>
            </div>
            {!members.length ? (
              <div className="p-6">
                <EmptyState
                  title="Belum ada data anggota"
                  description="Anggota akan muncul setelah registrasi & approval."
                  action={{
                    label: "Buka Members",
                    onClick: () => {
                      window.history.pushState({}, "", "/dashboard/members");
                      window.dispatchEvent(new PopStateEvent("popstate"));
                    },
                  }}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <caption className="sr-only">Daftar anggota terbaru</caption>
                  <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Name
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Class
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Email
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Status
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Approval
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.slice(0, 8).map((m) => (
                      <tr key={m.id} className="border-t border-slate-50 hover:bg-brand-50/40">
                        <td className="px-5 py-3 font-medium text-slate-800">
                          {m.fullName}
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {m.className ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {m.user?.email ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                            {m.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              m.approvalStatus === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700"
                                : m.approvalStatus === "PENDING"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-red-50 text-red-600"
                            }`}
                          >
                            {m.approvalStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
