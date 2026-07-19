import { useEffect, useState } from "react";
import {
  recruitmentApi,
  requireAuth,
  isPengurus,
  type RecruitmentApp,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

export default function RecruitmentPage() {
  const [list, setList] = useState<RecruitmentApp[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");

  async function load() {
    setList(await recruitmentApi.list());
  }

  useEffect(() => {
    const u = requireAuth();
    if (!isPengurus(u.role)) {
      setError("Hanya pengurus");
      return;
    }
    void load().catch((e) => setError(e instanceof Error ? e.message : "Gagal"));
  }, []);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id + action);
    setResult("");
    setError("");
    try {
      if (action === "approve") {
        const res = (await recruitmentApi.approve(id)) as {
          temporaryPassword?: string;
          user?: { email: string; username: string };
        };
        setResult(
          res.temporaryPassword
            ? `Akun dibuat: ${res.user?.email} / temp: ${res.temporaryPassword}`
            : "Approved",
        );
      } else {
        await recruitmentApi.reject(id);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(null);
    }
  }

  return (
    <DashboardShell active="/dashboard/recruitment" title="Rekrutmen" crumbs={["Dashboard", "Rekrutmen"]}>

          {error && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
          )}
          {result && (
            <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
              {result}
            </div>
          )}

          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Calon Anggota</h2>
              <p className="text-sm text-slate-500">{list.length} aplikasi</p>
            </div>
            <a
              href="/recruitment"
              className="rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-700"
            >
              Form publik →
            </a>
          </div>

          <div className="rounded-2xl border border-brand-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Nama</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Kelas</th>
                    <th className="px-5 py-3">Minat</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id} className="border-t border-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{a.fullName}</td>
                      <td className="px-5 py-3 text-slate-500">{a.email}</td>
                      <td className="px-5 py-3 text-slate-500">{a.className ?? "—"}</td>
                      <td className="max-w-[180px] truncate px-5 py-3 text-slate-500">
                        {a.interestNotes ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                          {a.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {a.status === "PENDING" ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={busy === a.id + "approve"}
                              onClick={() => void act(a.id, "approve")}
                              className="rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busy === a.id + "reject"}
                              onClick={() => void act(a.id, "reject")}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!list.length && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                        Belum ada pendaftar
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        
    </DashboardShell>
  );
}
