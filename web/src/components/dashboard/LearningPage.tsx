import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, Download, ExternalLink, Plus } from "lucide-react";
import {
  learningApi,
  orgApi,
  requireAuth,
  isPengurus,
  type LearningPath,
  type LearningResource,
  type LearningPathSummary,
  type Division,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

export default function LearningPage() {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [summary, setSummary] = useState<LearningPathSummary[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [pathId, setPathId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [pengurus, setPengurus] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [showPath, setShowPath] = useState(false);
  const [showRes, setShowRes] = useState(false);
  const [busy, setBusy] = useState(false);

  const [pName, setPName] = useState("");
  const [pLevel, setPLevel] = useState("JUNIOR");
  const [pDiv, setPDiv] = useState("");
  const [rTitle, setRTitle] = useState("");
  const [rType, setRType] = useState("PDF");
  const [rUrl, setRUrl] = useState("");
  const [rPath, setRPath] = useState("");
  const [rDiv, setRDiv] = useState("");

  async function load() {
    const [p, r, s] = await Promise.all([
      learningApi.paths(divisionId || undefined),
      learningApi.resources({
        pathId: pathId || undefined,
        divisionId: divisionId || undefined,
      }),
      learningApi.progressSummary().catch(() => [] as LearningPathSummary[]),
    ]);
    setPaths(p);
    setResources(r);
    setSummary(s);
  }

  useEffect(() => {
    const u = requireAuth();
    setPengurus(isPengurus(u.role));
    void orgApi.divisions().then(setDivisions).catch(() => {});
    void load().catch((e) => setError(e instanceof Error ? e.message : "Gagal"));
  }, []);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Gagal"));
  }, [pathId, divisionId]);

  async function createPath(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await learningApi.createPath({
        name: pName,
        level: pLevel,
        divisionId: pDiv || undefined,
      });
      setPName("");
      setShowPath(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function createRes(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await learningApi.createResource({
        title: rTitle,
        type: rType,
        url: rUrl,
        learningPathId: rPath || pathId || undefined,
        divisionId: rDiv || divisionId || undefined,
      });
      setRTitle("");
      setRUrl("");
      setShowRes(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function openDownload(id: string) {
    try {
      const { url } = await learningApi.download(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal download");
    }
  }

  async function toggleComplete(r: LearningResource) {
    setBusy(true);
    setError("");
    try {
      if (r.completed) await learningApi.uncomplete(r.id);
      else await learningApi.complete(r.id);
      await load();
      setOkMsg(r.completed ? "Progress dibatalkan" : "Materi ditandai selesai");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal update progress");
    } finally {
      setBusy(false);
    }
  }

  const summaryMap = new Map(summary.map((s) => [s.pathId, s]));

  return (
    <DashboardShell active="/dashboard/learning" title="Learning" crumbs={["Dashboard", "Learning"]}>

          {error && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
          )}
          {okMsg && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {okMsg}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <select
                value={pathId}
                onChange={(e) => setPathId(e.target.value)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Semua path</option>
                {paths.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.level})
                  </option>
                ))}
              </select>
              <select
                value={divisionId}
                onChange={(e) => setDivisionId(e.target.value)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Semua divisi</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            {pengurus && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPath((s) => !s)}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700"
                >
                  <Plus size={16} /> Path
                </button>
                <button
                  type="button"
                  onClick={() => setShowRes((s) => !s)}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-2 text-sm font-medium text-white"
                >
                  <Plus size={16} /> Materi
                </button>
              </div>
            )}
          </div>

          {showPath && (
            <form
              onSubmit={createPath}
              className="mb-4 grid gap-2 rounded-2xl border border-brand-100 bg-white p-4 sm:grid-cols-4"
            >
              <input
                required
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder="Nama path"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <select
                value={pLevel}
                onChange={(e) => setPLevel(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="JUNIOR">Junior</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="SENIOR">Senior</option>
              </select>
              <select
                value={pDiv}
                onChange={(e) => setPDiv(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Tanpa divisi</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-brand-600 py-2 text-sm font-medium text-white sm:col-span-4"
              >
                Simpan path
              </button>
            </form>
          )}

          {showRes && (
            <form
              onSubmit={createRes}
              className="mb-4 grid gap-2 rounded-2xl border border-brand-100 bg-white p-4 sm:grid-cols-2"
            >
              <input
                required
                value={rTitle}
                onChange={(e) => setRTitle(e.target.value)}
                placeholder="Judul materi"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={rType}
                onChange={(e) => setRType(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="PDF">PDF</option>
                <option value="VIDEO">Video</option>
                <option value="ARTICLE">Artikel</option>
                <option value="REPO">Repo</option>
              </select>
              <input
                required
                type="url"
                value={rUrl}
                onChange={(e) => setRUrl(e.target.value)}
                placeholder="https://..."
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <select
                value={rPath}
                onChange={(e) => setRPath(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Path (opsional)</option>
                {paths.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={rDiv}
                onChange={(e) => setRDiv(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Divisi (opsional)</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-brand-600 py-2 text-sm font-medium text-white sm:col-span-2"
              >
                Simpan materi
              </button>
            </form>
          )}

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paths.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPathId(p.id === pathId ? "" : p.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  pathId === p.id
                    ? "border-brand-300 bg-brand-50 shadow-sm"
                    : "border-brand-100 bg-white hover:border-brand-200"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-brand-600">
                  <BookOpen size={18} />
                  <span className="text-[10px] font-semibold uppercase tracking-wide">
                    {p.level}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {p.division?.name ?? "Umum"} ·{" "}
                  {p._count?.resources ?? p.resources?.length ?? 0} materi
                </p>
                {summaryMap.get(p.id) && (
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{
                          width: `${summaryMap.get(p.id)!.percent}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {summaryMap.get(p.id)!.completed}/
                      {summaryMap.get(p.id)!.total} ·{" "}
                      {summaryMap.get(p.id)!.percent}%
                    </p>
                  </div>
                )}
              </button>
            ))}
            {!paths.length && (
              <div className="rounded-2xl border border-dashed border-brand-200 p-8 text-center text-slate-400 sm:col-span-2 lg:col-span-3">
                Belum ada learning path
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-brand-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Materi</h3>
              <p className="text-sm text-slate-500">{resources.length} item</p>
            </div>
            <ul className="divide-y divide-slate-50">
              {resources.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {r.completed ? "✓ " : ""}
                      {r.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {r.type}
                      {r.learningPath ? ` · ${r.learningPath.name}` : ""}
                      {r.division ? ` · ${r.division.name}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleComplete(r)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                        r.completed
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      {r.completed ? "Selesai" : "Tandai selesai"}
                    </button>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <ExternalLink size={12} /> Buka
                    </a>
                    <button
                      type="button"
                      onClick={() => void openDownload(r.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      <Download size={12} /> Download
                    </button>
                  </div>
                </li>
              ))}
              {!resources.length && (
                <li className="px-5 py-10 text-center text-slate-400">Belum ada materi</li>
              )}
            </ul>
          </div>
        
    </DashboardShell>
  );
}
