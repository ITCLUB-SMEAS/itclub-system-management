import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Send, MessageSquare, Users, Bell } from "lucide-react";
import {
  projectsApi,
  membersApi,
  requireAuth,
  isPengurus,
  getUser,
  type Project,
  type Task,
  type Member,
  type TaskSubmission,
  type MentorPair,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

const COLUMNS: { key: Task["status"]; label: string }[] = [
  { key: "TODO", label: "To Do" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "REVIEW", label: "Review" },
  { key: "DONE", label: "Done" },
];

const NEXT: Record<Task["status"], Task["status"] | null> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "REVIEW",
  REVIEW: "DONE",
  DONE: null,
};

const PREV: Record<Task["status"], Task["status"] | null> = {
  TODO: null,
  IN_PROGRESS: "TODO",
  REVIEW: "IN_PROGRESS",
  DONE: "REVIEW",
};

function isOverdue(t: Task) {
  if (!t.dueDate || t.status === "DONE") return false;
  return new Date(t.dueDate).getTime() < Date.now();
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [mentors, setMentors] = useState<MentorPair[]>([]);
  const [memberId, setMemberId] = useState<string | undefined>();
  const [filterMine, setFilterMine] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [pengurus, setPengurus] = useState(false);
  const [showProject, setShowProject] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [showMentor, setShowMentor] = useState(false);
  const [busy, setBusy] = useState(false);

  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tAssignee, setTAssignee] = useState("");
  const [tDue, setTDue] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [menteeId, setMenteeId] = useState("");

  // submit drawer
  const [submitTask, setSubmitTask] = useState<Task | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  // review drawer
  const [reviewTask, setReviewTask] = useState<Task | null>(null);
  const [subs, setSubs] = useState<TaskSubmission[]>([]);
  const [fbText, setFbText] = useState("");
  const [fbSubId, setFbSubId] = useState("");

  async function loadProjects() {
    const list = await projectsApi.list();
    setProjects(list);
    if (!projectId && list[0]) setProjectId(list[0].id);
  }

  async function loadTasks(id: string) {
    if (!id) {
      setTasks([]);
      return;
    }
    setTasks(
      await projectsApi.tasks(
        id,
        filterMine && memberId ? { assigneeId: memberId } : undefined,
      ),
    );
  }

  async function loadMy() {
    try {
      setMyTasks(await projectsApi.myTasks());
    } catch {
      setMyTasks([]);
    }
  }

  useEffect(() => {
    const u = requireAuth();
    setPengurus(isPengurus(u.role));
    setMemberId(u.memberId);
    void loadProjects().catch((e) =>
      setError(e instanceof Error ? e.message : "Gagal load"),
    );
    void loadMy();
    void projectsApi.myMentors().then(setMentors).catch(() => {});
    void membersApi.list().then(setMembers).catch(() => {});
  }, []);

  useEffect(() => {
    void loadTasks(projectId).catch((e) =>
      setError(e instanceof Error ? e.message : "Gagal load tasks"),
    );
  }, [projectId, filterMine, memberId]);

  const byStatus = useMemo(() => {
    const map: Record<Task["status"], Task[]> = {
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: [],
    };
    for (const t of tasks) map[t.status].push(t);
    return map;
  }, [tasks]);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const p = await projectsApi.create({
        name: pName,
        description: pDesc || undefined,
      });
      setPName("");
      setPDesc("");
      setShowProject(false);
      await loadProjects();
      setProjectId(p.id);
      setOkMsg("Project dibuat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function createTask(e: FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setBusy(true);
    setError("");
    try {
      await projectsApi.createTask({
        projectId,
        title: tTitle,
        description: tDesc || undefined,
        assigneeId: tAssignee || undefined,
        dueDate: tDue ? new Date(tDue).toISOString() : undefined,
      });
      setTTitle("");
      setTDesc("");
      setTAssignee("");
      setTDue("");
      setShowTask(false);
      await loadTasks(projectId);
      await loadMy();
      setOkMsg("Task ditambahkan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function move(task: Task, dir: "next" | "prev") {
    const status = dir === "next" ? NEXT[task.status] : PREV[task.status];
    if (!status) return;
    setBusy(true);
    setError("");
    try {
      await projectsApi.updateStatus(task.id, status);
      await loadTasks(projectId);
      await loadMy();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal update status");
    } finally {
      setBusy(false);
    }
  }

  async function doSubmit(e: FormEvent) {
    e.preventDefault();
    if (!submitTask) return;
    setBusy(true);
    setError("");
    try {
      await projectsApi.submit(submitTask.id, {
        repoUrl: repoUrl || undefined,
        demoUrl: demoUrl || undefined,
        fileUrl: fileUrl || undefined,
      });
      setSubmitTask(null);
      setRepoUrl("");
      setDemoUrl("");
      setFileUrl("");
      await loadTasks(projectId);
      await loadMy();
      setOkMsg("Submission terkirim → status REVIEW");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal submit");
    } finally {
      setBusy(false);
    }
  }

  async function openReview(task: Task) {
    setReviewTask(task);
    setError("");
    try {
      setSubs(await projectsApi.taskSubmissions(task.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal load submissions");
      setSubs([]);
    }
  }

  async function sendFeedback(e: FormEvent) {
    e.preventDefault();
    if (!fbSubId || !fbText.trim()) return;
    setBusy(true);
    try {
      await projectsApi.feedback(fbSubId, fbText.trim());
      setFbText("");
      if (reviewTask) setSubs(await projectsApi.taskSubmissions(reviewTask.id));
      setOkMsg("Feedback terkirim");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal feedback");
    } finally {
      setBusy(false);
    }
  }

  async function pairMentor(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await projectsApi.assignMentor(mentorId, menteeId);
      setMentors(await projectsApi.myMentors());
      setShowMentor(false);
      setOkMsg("Mentor-mentee dipasangkan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal pairing");
    } finally {
      setBusy(false);
    }
  }

  async function runDeadlines() {
    setBusy(true);
    try {
      const r = await projectsApi.runDeadlineReminders();
      setOkMsg(`Deadline reminder: ${r.sent} notifikasi`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  const u = getUser();
  const canActOn = (t: Task) =>
    pengurus || t.assigneeId === u?.memberId || !t.assigneeId;

  return (
    <DashboardShell
      active="/dashboard/projects"
      title="Projects"
      crumbs={["Dashboard", "Projects"]}
    >
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

      {myTasks.length > 0 && (
        <div className="mb-4 rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">
            Tugas saya ({myTasks.length})
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {myTasks.slice(0, 8).map((t) => (
              <li
                key={t.id}
                className={`rounded-full border px-3 py-1 text-xs ${
                  isOverdue(t)
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                {t.project?.name ? `${t.project.name}: ` : ""}
                {t.title} · {t.status.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="min-w-[200px] rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium outline-none"
        >
          {!projects.length && <option value="">Belum ada project</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p._count ? ` (${p._count.tasks})` : ""}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={filterMine}
            onChange={(e) => setFilterMine(e.target.checked)}
          />
          Hanya tugas saya
        </label>
        {pengurus && (
          <>
            <button
              type="button"
              onClick={() => setShowProject((s) => !s)}
              className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700"
            >
              <Plus size={16} /> Project
            </button>
            <button
              type="button"
              disabled={!projectId}
              onClick={() => setShowTask((s) => !s)}
              className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Plus size={16} /> Task
            </button>
            <button
              type="button"
              onClick={() => setShowMentor((s) => !s)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-600"
            >
              <Users size={16} /> Mentor
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runDeadlines()}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-600"
            >
              <Bell size={16} /> Deadline H-1
            </button>
          </>
        )}
      </div>

      {showProject && (
        <form
          onSubmit={createProject}
          className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-brand-100 bg-white p-4"
        >
          <input
            required
            value={pName}
            onChange={(e) => setPName(e.target.value)}
            placeholder="Nama project"
            className="min-w-[180px] flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={pDesc}
            onChange={(e) => setPDesc(e.target.value)}
            placeholder="Deskripsi"
            className="min-w-[180px] flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          >
            Simpan
          </button>
        </form>
      )}

      {showTask && (
        <form
          onSubmit={createTask}
          className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-brand-100 bg-white p-4"
        >
          <input
            required
            value={tTitle}
            onChange={(e) => setTTitle(e.target.value)}
            placeholder="Judul task"
            className="min-w-[160px] flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={tDesc}
            onChange={(e) => setTDesc(e.target.value)}
            placeholder="Deskripsi"
            className="min-w-[160px] flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm"
          />
          <select
            value={tAssignee}
            onChange={(e) => setTAssignee(e.target.value)}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={tDue}
            onChange={(e) => setTDue(e.target.value)}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          >
            Add task
          </button>
        </form>
      )}

      {showMentor && (
        <form
          onSubmit={pairMentor}
          className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-brand-100 bg-white p-4"
        >
          <select
            required
            value={mentorId}
            onChange={(e) => setMentorId(e.target.value)}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Mentor</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
          <select
            required
            value={menteeId}
            onChange={(e) => setMenteeId(e.target.value)}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Mentee</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          >
            Pair
          </button>
          {mentors.length > 0 && (
            <p className="w-full text-xs text-slate-400">
              Pairing saya:{" "}
              {mentors
                .map(
                  (p) =>
                    `${p.mentor?.fullName ?? "?"} → ${p.mentee?.fullName ?? "?"}`,
                )
                .join("; ")}
            </p>
          )}
        </form>
      )}

      <div className="grid min-h-0 flex-1 gap-3 overflow-x-auto pb-2 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className="flex min-h-[320px] min-w-[220px] flex-col rounded-2xl border border-brand-100 bg-brand-50/40"
          >
            <div className="flex items-center justify-between px-3 py-3">
              <h3 className="text-sm font-semibold text-slate-800">{col.label}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-brand-700">
                {byStatus[col.key].length}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3">
              {byStatus[col.key].map((task) => (
                <div
                  key={task.id}
                  className={`rounded-xl border bg-white p-3 shadow-sm ${
                    isOverdue(task) ? "border-rose-200" : "border-white"
                  }`}
                >
                  <p className="text-sm font-medium text-slate-900">{task.title}</p>
                  {task.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                      {task.description}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-slate-400">
                    {task.assignee?.fullName ?? "Unassigned"}
                    {task.dueDate && (
                      <>
                        {" · "}
                        <span className={isOverdue(task) ? "text-rose-600" : ""}>
                          due {new Date(task.dueDate).toLocaleDateString("id-ID")}
                        </span>
                      </>
                    )}
                    {!!task._count?.submissions && (
                      <> · {task._count.submissions} sub</>
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {canActOn(task) && PREV[task.status] && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void move(task, "prev")}
                        className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50"
                      >
                        ←
                      </button>
                    )}
                    {canActOn(task) && NEXT[task.status] && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void move(task, "next")}
                        className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-medium text-white"
                      >
                        → {NEXT[task.status]?.replaceAll("_", " ")}
                      </button>
                    )}
                    {canActOn(task) && task.status !== "DONE" && (
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitTask(task);
                          setRepoUrl("");
                          setDemoUrl("");
                          setFileUrl("");
                        }}
                        className="inline-flex items-center gap-0.5 rounded-full border border-brand-200 px-2 py-0.5 text-[10px] text-brand-700"
                      >
                        <Send size={10} /> Submit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void openReview(task)}
                      className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500"
                    >
                      <MessageSquare size={10} /> Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {submitTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={doSubmit}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h3 className="font-semibold text-slate-900">Submit tugas</h3>
            <p className="mt-1 text-sm text-slate-500">{submitTask.title}</p>
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="Repo URL (https://…)"
              className="mt-4 w-full rounded-full border border-slate-200 px-4 py-2 text-sm"
            />
            <input
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              placeholder="Demo URL"
              className="mt-2 w-full rounded-full border border-slate-200 px-4 py-2 text-sm"
            />
            <input
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="File URL"
              className="mt-2 w-full rounded-full border border-slate-200 px-4 py-2 text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSubmitTask(null)}
                className="flex-1 rounded-full border border-slate-200 py-2 text-sm"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-full bg-brand-600 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Kirim
              </button>
            </div>
          </form>
        </div>
      )}

      {reviewTask && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{reviewTask.title}</h3>
                <button
                  type="button"
                  onClick={() => setReviewTask(null)}
                  className="text-sm text-slate-400"
                >
                  Tutup
                </button>
              </div>
              <p className="text-xs text-slate-400">
                {subs.length} submission
              </p>
            </div>
            <ul className="flex-1 space-y-3 overflow-y-auto p-4">
              {subs.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-slate-100 p-3 text-sm"
                >
                  <p className="font-medium text-slate-800">
                    {s.member?.fullName ?? s.memberId}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(s.submittedAt).toLocaleString("id-ID")}
                  </p>
                  <div className="mt-1 space-y-0.5 text-xs text-brand-700">
                    {s.repoUrl && (
                      <a href={s.repoUrl} target="_blank" rel="noreferrer" className="block truncate hover:underline">
                        {s.repoUrl}
                      </a>
                    )}
                    {s.demoUrl && (
                      <a href={s.demoUrl} target="_blank" rel="noreferrer" className="block truncate hover:underline">
                        {s.demoUrl}
                      </a>
                    )}
                    {s.fileUrl && (
                      <a href={s.fileUrl} target="_blank" rel="noreferrer" className="block truncate hover:underline">
                        {s.fileUrl}
                      </a>
                    )}
                  </div>
                  {s.feedback?.map((f) => (
                    <p
                      key={f.id}
                      className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600"
                    >
                      <span className="font-medium">
                        {f.reviewer?.fullName ?? "Reviewer"}:
                      </span>{" "}
                      {f.content}
                    </p>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFbSubId(s.id)}
                    className="mt-2 text-[10px] font-medium text-brand-600"
                  >
                    + Feedback
                  </button>
                </li>
              ))}
              {!subs.length && (
                <li className="py-8 text-center text-slate-400">
                  Belum ada submission
                </li>
              )}
            </ul>
            {fbSubId && (
              <form
                onSubmit={sendFeedback}
                className="border-t border-slate-100 p-4"
              >
                <textarea
                  required
                  value={fbText}
                  onChange={(e) => setFbText(e.target.value)}
                  placeholder="Tulis feedback…"
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFbSubId("")}
                    className="flex-1 rounded-full border py-2 text-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 rounded-full bg-brand-600 py-2 text-sm font-medium text-white"
                  >
                    Kirim feedback
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
