import { useEffect, useState } from "react";
import {
  Users,
  CalendarCheck,
  FolderKanban,
  Trophy,
  TrendingUp,
  Package,
  UserPlus,
} from "lucide-react";
import {
  api,
  membersApi,
  requireAuth,
  isPengurus,
  type Member,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";
import DashLink from "../common/DashLink";
import LoadingSpinner from "../common/LoadingSpinner";
import EmptyState from "../common/EmptyState";

type Overview = {
  membersActive: number;
  membersPending: number;
  projectsCount: number;
  tasksOpen: number;
  activitiesUpcoming: number;
  eventsUpcoming: number;
  achievementsCount: number;
  attendancesWeek: number;
  loansActive: number;
  loansOverdue: number;
  recruitmentPending: number;
  topDivisions: Array<{ divisionId: string; name: string; members: number }>;
  attendanceSeries: Array<{ date: string; count: number }>;
  generatedAt: string;
};

export default function DashboardHome() {
  const [members, setMembers] = useState<Member[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [userLabel, setUserLabel] = useState("");
  const [pengurus, setPengurus] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = requireAuth();
    setUserLabel(u.username);
    setPengurus(isPengurus(u.role));
    void Promise.all([
      api<Overview>("/dashboard/overview"),
      membersApi.list().catch(() => [] as Member[]),
    ])
      .then(([ov, mem]) => {
        setOverview(ov);
        setMembers(mem);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal load"))
      .finally(() => setLoading(false));
  }, []);

  const maxBar = Math.max(
    1,
    ...(overview?.attendanceSeries.map((d) => d.count) ?? [1]),
  );

  const stats = [
    {
      label: "Anggota Aktif",
      value: String(overview?.membersActive ?? "—"),
      delta: overview
        ? `${overview.membersPending} pending`
        : "loading",
      icon: Users,
      tint: "from-brand-50 to-white",
      iconBg: "bg-brand-100 text-brand-600",
      href: "/dashboard/members",
    },
    {
      label: "Projects / Tasks",
      value: String(overview?.projectsCount ?? "—"),
      delta: overview ? `${overview.tasksOpen} open tasks` : "—",
      icon: FolderKanban,
      tint: "from-cyan-50 to-white",
      iconBg: "bg-cyan-100 text-cyan-600",
      href: "/dashboard/projects",
    },
    {
      label: "Kegiatan / Event",
      value: String(
        overview
          ? overview.activitiesUpcoming + overview.eventsUpcoming
          : "—",
      ),
      delta: overview
        ? `${overview.activitiesUpcoming} kegiatan · ${overview.eventsUpcoming} event`
        : "—",
      icon: CalendarCheck,
      tint: "from-sky-50 to-white",
      iconBg: "bg-sky-100 text-sky-600",
      href: "/dashboard/activities",
    },
    {
      label: "Prestasi",
      value: String(overview?.achievementsCount ?? "—"),
      delta: overview
        ? `${overview.attendancesWeek} presensi 7h`
        : "—",
      icon: Trophy,
      tint: "from-indigo-50 to-white",
      iconBg: "bg-indigo-100 text-indigo-600",
      href: "/dashboard/events",
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
            Ringkasan operasional ITCLUB
            {overview?.generatedAt
              ? ` · ${new Date(overview.generatedAt).toLocaleString("id-ID")}`
              : ""}
          </p>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="alert"
        >
          {error} — pastikan API jalan.
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
                <DashLink
                  key={s.label}
                  href={s.href}
                  className={`rounded-2xl border border-brand-100/80 bg-gradient-to-br ${s.tint} p-5 shadow-sm transition hover:shadow-md`}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      {s.label}
                    </p>
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
                </DashLink>
              );
            })}
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Presensi 7 hari
                  </h3>
                  <p className="text-xs text-slate-400">
                    Check-in per hari (real data)
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  {overview?.attendancesWeek ?? 0}
                  <span className="ml-1 text-sm font-normal text-slate-400">
                    total
                  </span>
                </p>
              </div>
              <div className="flex h-28 items-end gap-2" aria-hidden>
                {(overview?.attendanceSeries ?? []).map((d) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-brand-500/80"
                      style={{
                        height: `${Math.max(8, (d.count / maxBar) * 100)}%`,
                        minHeight: d.count ? 8 : 2,
                      }}
                      title={`${d.date}: ${d.count}`}
                    />
                    <span className="text-[9px] text-slate-400">
                      {d.date.slice(8)}
                    </span>
                  </div>
                ))}
                {!overview?.attendanceSeries?.length && (
                  <p className="w-full py-8 text-center text-sm text-slate-400">
                    Belum ada data presensi
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-slate-700">
                  <Package size={16} className="text-brand-600" />
                  <h3 className="text-sm font-semibold">Inventaris</h3>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {overview?.loansActive ?? 0}
                </p>
                <p className="text-xs text-slate-400">
                  pinjaman aktif
                  {overview && overview.loansOverdue > 0
                    ? ` · ${overview.loansOverdue} overdue`
                    : ""}
                </p>
                <DashLink
                  href="/dashboard/inventory"
                  className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline"
                >
                  Kelola →
                </DashLink>
              </div>
              <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-slate-700">
                  <UserPlus size={16} className="text-brand-600" />
                  <h3 className="text-sm font-semibold">Rekrutmen</h3>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {overview?.recruitmentPending ?? 0}
                </p>
                <p className="text-xs text-slate-400">aplikasi pending</p>
                {pengurus && (
                  <DashLink
                    href="/dashboard/recruitment"
                    className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline"
                  >
                    Review →
                  </DashLink>
                )}
              </div>
              {!!overview?.topDivisions?.length && (
                <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">
                    Divisi (periode aktif)
                  </h3>
                  <ul className="space-y-1">
                    {overview.topDivisions.map((d) => (
                      <li
                        key={d.divisionId}
                        className="flex justify-between text-xs text-slate-600"
                      >
                        <span>{d.name}</span>
                        <span className="font-semibold">{d.members}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-brand-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Members</h3>
              <DashLink
                href="/dashboard/members"
                className="rounded-full bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                Lihat semua
              </DashLink>
            </div>
            {!members.length ? (
              <EmptyState
                title="Belum ada data anggota"
                description="Daftar anggota muncul setelah load API."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Nama</th>
                      <th className="px-5 py-3">Kelas</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Approval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.slice(0, 8).map((m) => (
                      <tr key={m.id} className="border-t border-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-800">
                          {m.fullName}
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {m.className ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
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
