import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  membersApi,
  orgApi,
  requireAuth,
  isPengurus,
  type Member,
  type Division,
  type Period,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

const ROLES = [
  "ANGGOTA",
  "KETUA",
  "WAKIL_KETUA",
  "SEKRETARIS",
  "BENDAHARA",
  "KEPALA_DIVISI",
] as const;

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [status, setStatus] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<Member | null>(null);
  const [assignRole, setAssignRole] = useState("ANGGOTA");
  const [assignDiv, setAssignDiv] = useState("");
  const [assignPeriod, setAssignPeriod] = useState("");

  async function load() {
    try {
      const data = await membersApi.list({
        status: status || undefined,
        divisionId: divisionId || undefined,
        periodId: periodId || undefined,
      });
      setMembers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal load");
    }
  }

  useEffect(() => {
    const u = requireAuth();
    if (!isPengurus(u.role)) {
      setError("Hanya pengurus yang bisa akses halaman members");
      return;
    }
    void orgApi.divisions().then(setDivisions).catch(() => {});
    void orgApi.periods().then((p) => {
      setPeriods(p);
      const active = p.find((x) => x.isActive);
      if (active) {
        setAssignPeriod(active.id);
        setPeriodId(active.id);
      }
    });
  }, []);

  useEffect(() => {
    void load();
  }, [status, divisionId, periodId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return members;
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(s) ||
        m.user?.email.toLowerCase().includes(s) ||
        m.user?.username.toLowerCase().includes(s) ||
        (m.className ?? "").toLowerCase().includes(s),
    );
  }, [members, q]);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id + action);
    setError("");
    try {
      await (action === "approve" ? membersApi.approve(id) : membersApi.reject(id));
      await load();
      if (detail?.id === id) setDetail(await membersApi.get(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(null);
    }
  }

  async function openDetail(id: string) {
    try {
      const m = await membersApi.get(id);
      setDetail(m);
      const active = m.periods?.find((p) => p.period?.isActive) ?? m.periods?.[0];
      if (active) {
        setAssignRole(active.role);
        setAssignDiv(active.divisionId ?? "");
        setAssignPeriod(active.periodId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal load detail");
    }
  }

  async function saveAssign() {
    if (!detail || !assignPeriod) return;
    setBusy("assign");
    setError("");
    try {
      await membersApi.assign(detail.id, {
        periodId: assignPeriod,
        divisionId: assignDiv || undefined,
        role: assignRole,
      });
      setDetail(await membersApi.get(detail.id));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal assign");
    } finally {
      setBusy(null);
    }
  }

  return (
    <DashboardShell
      active="/dashboard/members"
      title="Members"
      crumbs={["Dashboard", "Members"]}
    >
      {error && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, email, kelas..."
            className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="">All status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="ALUMNI">ALUMNI</option>
        </select>
        <select
          value={divisionId}
          onChange={(e) => setDivisionId(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="">All divisi</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={periodId}
          onChange={(e) => setPeriodId(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="">All periode</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isActive ? " (aktif)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Daftar Anggota</h2>
          <p className="text-sm text-slate-500">{filtered.length} ditampilkan</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Class</th>
                <th className="px-5 py-3 font-medium">Divisi / Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Approval</th>
                <th className="px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const active =
                  m.periods?.find((p) => p.period?.isActive) ?? m.periods?.[0];
                return (
                  <tr key={m.id} className="border-t border-slate-50 hover:bg-brand-50/40">
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => void openDetail(m.id)}
                        className="text-left font-medium text-brand-700 hover:underline"
                      >
                        {m.fullName}
                      </button>
                      <p className="text-xs text-slate-400">{m.user?.email}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{m.className ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">
                      <span className="block text-sm">
                        {active?.division?.name ?? "—"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {active?.role?.replaceAll("_", " ") ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                        {m.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs font-medium text-slate-600">
                      {m.approvalStatus}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void openDetail(m.id)}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Detail
                        </button>
                        {m.approvalStatus === "PENDING" && (
                          <>
                            <button
                              type="button"
                              disabled={busy === m.id + "approve"}
                              onClick={() => void act(m.id, "approve")}
                              className="rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busy === m.id + "reject"}
                              onClick={() => void act(m.id, "reject")}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    Tidak ada anggota
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-[2px]">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="font-semibold text-slate-900">{detail.fullName}</h3>
                <p className="text-xs text-slate-400">{detail.user?.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-brand-50/80 p-3">
                  <p className="text-xs text-slate-400">Kelas</p>
                  <p className="font-medium">{detail.className ?? "—"}</p>
                </div>
                <div className="rounded-xl bg-brand-50/80 p-3">
                  <p className="text-xs text-slate-400">Angkatan</p>
                  <p className="font-medium">{detail.batchYear ?? "—"}</p>
                </div>
                <div className="rounded-xl bg-brand-50/80 p-3">
                  <p className="text-xs text-slate-400">Status</p>
                  <p className="font-medium">{detail.status}</p>
                </div>
                <div className="rounded-xl bg-brand-50/80 p-3">
                  <p className="text-xs text-slate-400">Approval</p>
                  <p className="font-medium">{detail.approvalStatus}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Assign divisi & role
                </p>
                <div className="space-y-2">
                  <select
                    value={assignPeriod}
                    onChange={(e) => setAssignPeriod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                  >
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={assignDiv}
                    onChange={(e) => setAssignDiv(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                  >
                    <option value="">Tanpa divisi</option>
                    {divisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={assignRole}
                    onChange={(e) => setAssignRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy === "assign"}
                    onClick={() => void saveAssign()}
                    className="w-full rounded-full bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    Simpan assign
                  </button>
                </div>
              </div>

              {detail.approvalStatus === "PENDING" && (
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => void act(detail.id, "approve")}
                    className="flex-1 rounded-full bg-brand-600 py-2 text-sm font-medium text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(detail.id, "reject")}
                    className="flex-1 rounded-full border border-slate-200 py-2 text-sm font-medium text-slate-600"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
