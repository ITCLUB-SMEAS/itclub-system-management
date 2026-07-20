import { useEffect, useState } from "react";
import {
  recruitmentApi,
  requireAuth,
  isPengurus,
  type RecruitmentApp,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

const STAGES = ["FORM", "TEST", "INTERVIEW", "ANNOUNCEMENT"] as const;

const ONBOARDING_KEYS = [
  "akun_dibuat",
  "join_grup",
  "perkenalan",
  "akses_materi",
  "divisi_ditetapkan",
] as const;

function stageLabel(s: string) {
  return s.replaceAll("_", " ");
}

export default function RecruitmentPage() {
  const [list, setList] = useState<RecruitmentApp[]>([]);
  const [filterStage, setFilterStage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [selected, setSelected] = useState<RecruitmentApp | null>(null);

  async function load() {
    setList(
      await recruitmentApi.list(
        filterStage ? { stage: filterStage } : undefined,
      ),
    );
  }

  useEffect(() => {
    const u = requireAuth();
    if (!isPengurus(u.role)) {
      setError("Hanya pengurus");
      return;
    }
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : "Gagal"),
    );
  }, [filterStage]);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id + action);
    setResult("");
    setError("");
    try {
      if (action === "approve") {
        const res = (await recruitmentApi.approve(id)) as {
          temporaryPassword?: string;
          user?: { email: string; username: string };
          message?: string;
        };
        setResult(
          res.temporaryPassword
            ? `Akun dibuat (dev): ${res.user?.email} / temp: ${res.temporaryPassword}`
            : res.message || "Approved — credentials emailed",
        );
      } else {
        await recruitmentApi.reject(id);
        setResult("Ditolak");
      }
      await load();
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(null);
    }
  }

  async function advance(id: string) {
    setBusy(id + "adv");
    try {
      await recruitmentApi.advance(id);
      await load();
      if (selected?.id === id) {
        setSelected(await recruitmentApi.get(id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal advance");
    } finally {
      setBusy(null);
    }
  }

  async function toggleOnboard(key: string, value: boolean) {
    if (!selected) return;
    setBusy("ob");
    try {
      const updated = await recruitmentApi.onboarding(selected.id, {
        [key]: value,
      });
      setSelected(updated as RecruitmentApp);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal onboarding");
    } finally {
      setBusy(null);
    }
  }

  const pending = list.filter((a) => a.status === "PENDING");

  return (
    <DashboardShell
      active="/dashboard/recruitment"
      title="Rekrutmen"
      crumbs={["Dashboard", "Rekrutmen"]}
    >
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Calon Anggota
          </h2>
          <p className="text-sm text-slate-500">
            {list.length} aplikasi · {pending.length} pending
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Semua tahap</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {stageLabel(s)}
              </option>
            ))}
          </select>
          <a
            href="/recruitment"
            className="rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-700"
          >
            Form publik →
          </a>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {STAGES.map((s) => {
          const n = list.filter((a) => a.stage === s).length;
          return (
            <span
              key={s}
              className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600"
            >
              {stageLabel(s)}: {n}
            </span>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50/80 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Tahap</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Divisi minat</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-t border-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {a.fullName}
                  {a.className && (
                    <span className="block text-xs text-slate-400">
                      {a.className}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{a.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                    {stageLabel(a.stage)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      a.status === "APPROVED"
                        ? "bg-emerald-50 text-emerald-700"
                        : a.status === "REJECTED"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {a.divisionPreference ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setSelected(a)}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    Detail
                  </button>
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Belum ada aplikasi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{selected.fullName}</h3>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-sm text-slate-400"
                >
                  Tutup
                </button>
              </div>
              <p className="text-xs text-slate-400">{selected.email}</p>
              <p className="mt-1 text-xs text-slate-500">
                {stageLabel(selected.stage)} · {selected.status}
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {selected.interestNotes && (
                <p className="text-sm text-slate-600">{selected.interestNotes}</p>
              )}
              {selected.divisionPreference && (
                <p className="text-xs text-slate-500">
                  Minat divisi: {selected.divisionPreference}
                </p>
              )}

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-slate-400">
                  Pipeline
                </h4>
                <div className="flex flex-wrap gap-1">
                  {STAGES.map((s) => (
                    <span
                      key={s}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        selected.stage === s
                          ? "bg-brand-600 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {stageLabel(s)}
                    </span>
                  ))}
                </div>
                {selected.status === "PENDING" &&
                  selected.stage !== "ANNOUNCEMENT" && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void advance(selected.id)}
                      className="mt-2 rounded-full border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700"
                    >
                      Maju tahap →
                    </button>
                  )}
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-slate-400">
                  Onboarding checklist
                </h4>
                <ul className="space-y-2">
                  {ONBOARDING_KEYS.map((key) => {
                    const checked = !!selected.onboarding?.[key];
                    return (
                      <li key={key}>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!!busy}
                            onChange={(e) =>
                              void toggleOnboard(key, e.target.checked)
                            }
                          />
                          {key.replaceAll("_", " ")}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {selected.status === "PENDING" && (
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void act(selected.id, "approve")}
                    className="flex-1 rounded-full bg-emerald-600 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Approve + buat akun
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void act(selected.id, "reject")}
                    className="flex-1 rounded-full bg-rose-500 py-2 text-sm font-medium text-white disabled:opacity-50"
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
