import { useEffect, useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import {
  evaluationApi,
  membersApi,
  orgApi,
  projectsApi,
  requireAuth,
  type EvaluationSummary,
  type Member,
  type Period,
  type PeerReview,
  type Project,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

const TARGET_ROLES = [
  "KETUA",
  "WAKIL_KETUA",
  "SEKRETARIS",
  "BENDAHARA",
  "KEPALA_DIVISI",
];

export default function EvaluationPage() {
  const [role, setRole] = useState("");
  const [memberId, setMemberId] = useState("");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<EvaluationSummary | null>(null);
  const [myReviews, setMyReviews] = useState<PeerReview[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"eval" | "peer">("eval");

  const [targetRole, setTargetRole] = useState("KETUA");
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");

  const [revieweeId, setRevieweeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [peerScore, setPeerScore] = useState(5);
  const [peerComment, setPeerComment] = useState("");
  const [viewMember, setViewMember] = useState("");

  useEffect(() => {
    const u = requireAuth();
    setRole(u.role ?? "");
    setMemberId(u.memberId ?? "");
    void orgApi.periods().then((p) => {
      setPeriods(p);
      const active = p.find((x) => x.isActive);
      if (active) setPeriodId(active.id);
    });
    void projectsApi.list().then(setProjects).catch(() => {});
    void membersApi
      .list()
      .then(setMembers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (role === "KETUA" && periodId) {
      void evaluationApi
        .summary(periodId)
        .then(setSummary)
        .catch(() => setSummary(null));
    }
  }, [role, periodId]);

  useEffect(() => {
    const id = viewMember || memberId;
    if (!id) return;
    void evaluationApi
      .peerReviewsFor(id)
      .then(setMyReviews)
      .catch(() => setMyReviews([]));
  }, [viewMember, memberId]);

  async function submitEval(e: FormEvent) {
    e.preventDefault();
    if (!periodId) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await evaluationApi.create({
        periodId,
        targetRole,
        score,
        comment: comment || undefined,
      });
      setMsg("Evaluasi terkirim");
      setComment("");
      if (role === "KETUA") {
        setSummary(await evaluationApi.summary(periodId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function submitPeer(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await evaluationApi.peerReview({
        revieweeId,
        projectId: projectId || undefined,
        score: peerScore,
        comment: peerComment || undefined,
      });
      setMsg("Peer review terkirim");
      setPeerComment("");
      const id = viewMember || memberId;
      if (id) setMyReviews(await evaluationApi.peerReviewsFor(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell active="/dashboard/evaluation" title="Evaluasi" crumbs={["Dashboard", "Evaluasi"]}>

          {error && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
          )}
          {msg && (
            <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
              {msg}
            </div>
          )}

          <div className="mb-4 flex rounded-full border border-slate-200 bg-white p-1 text-sm w-fit">
            <button
              type="button"
              onClick={() => setTab("eval")}
              className={`rounded-full px-4 py-1.5 font-medium ${
                tab === "eval" ? "bg-brand-600 text-white" : "text-slate-600"
              }`}
            >
              Evaluasi pengurus
            </button>
            <button
              type="button"
              onClick={() => setTab("peer")}
              className={`rounded-full px-4 py-1.5 font-medium ${
                tab === "peer" ? "bg-brand-600 text-white" : "text-slate-600"
              }`}
            >
              Peer review
            </button>
          </div>

          {tab === "eval" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <form
                onSubmit={submitEval}
                className="space-y-3 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm"
              >
                <h3 className="font-semibold text-slate-900">Beri evaluasi</h3>
                <select
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  required
                >
                  <option value="">Pilih periode</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {TARGET_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                <label className="block text-sm text-slate-600">
                  Skor (1–5): <strong>{score}</strong>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                    className="mt-1 w-full accent-brand-600"
                  />
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Komentar (opsional)"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full bg-brand-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Kirim evaluasi
                </button>
              </form>

              {role === "KETUA" && (
                <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 font-semibold text-slate-900">
                    Ringkasan (Ketua)
                  </h3>
                  <p className="mb-4 text-sm text-slate-500">
                    {summary?.totalResponses ?? 0} respons
                  </p>
                  <ul className="space-y-3">
                    {(summary?.byRole ?? []).map((r) => (
                      <li
                        key={r.role}
                        className="flex items-center justify-between rounded-xl bg-brand-50/70 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-slate-800">
                          {r.role.replaceAll("_", " ")}
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
                          <Star size={14} />
                          {r.average.toFixed(2)}
                          <span className="text-xs font-normal text-slate-400">
                            ({r.count})
                          </span>
                        </span>
                      </li>
                    ))}
                    {!summary?.byRole?.length && (
                      <li className="text-sm text-slate-400">Belum ada data</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {tab === "peer" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <form
                onSubmit={submitPeer}
                className="space-y-3 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm"
              >
                <h3 className="font-semibold text-slate-900">Peer review</h3>
                <select
                  required
                  value={revieweeId}
                  onChange={(e) => setRevieweeId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Pilih anggota</option>
                  {members
                    .filter((m) => m.id !== memberId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                </select>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Project (opsional)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <label className="block text-sm text-slate-600">
                  Skor (1–5): <strong>{peerScore}</strong>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={peerScore}
                    onChange={(e) => setPeerScore(Number(e.target.value))}
                    className="mt-1 w-full accent-brand-600"
                  />
                </label>
                <textarea
                  value={peerComment}
                  onChange={(e) => setPeerComment(e.target.value)}
                  rows={3}
                  placeholder="Feedback"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full bg-brand-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Kirim review
                </button>
              </form>

              <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">Review diterima</h3>
                  <select
                    value={viewMember}
                    onChange={(e) => setViewMember(e.target.value)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs"
                  >
                    <option value="">Saya</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <ul className="space-y-3">
                  {myReviews.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-slate-50 bg-slate-50/80 px-3 py-2 text-sm"
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {r.reviewer?.fullName ?? r.reviewerId}
                        </span>
                        <span className="text-brand-700 font-semibold">
                          {r.score}/5
                        </span>
                      </div>
                      {r.project && (
                        <p className="text-xs text-slate-400">{r.project.name}</p>
                      )}
                      {r.comment && (
                        <p className="mt-1 text-slate-600">{r.comment}</p>
                      )}
                    </li>
                  ))}
                  {!myReviews.length && (
                    <li className="text-sm text-slate-400">Belum ada review</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        
    </DashboardShell>
  );
}
