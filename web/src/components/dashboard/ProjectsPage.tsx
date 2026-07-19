import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import {
  projectsApi,
  membersApi,
  requireAuth,
  isPengurus,
  type Project,
  type Task,
  type Member,
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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [pengurus, setPengurus] = useState(false);
  const [showProject, setShowProject] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [busy, setBusy] = useState(false);

  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tAssignee, setTAssignee] = useState("");

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
    setTasks(await projectsApi.tasks(id));
  }

  useEffect(() => {
    const u = requireAuth();
    setPengurus(isPengurus(u.role));
    void loadProjects().catch((e) =>
      setError(e instanceof Error ? e.message : "Gagal load"),
    );
    if (isPengurus(u.role)) {
      void membersApi.list().then(setMembers).catch(() => {});
    }
  }, []);

  useEffect(() => {
    void loadTasks(projectId).catch((e) =>
      setError(e instanceof Error ? e.message : "Gagal load tasks"),
    );
  }, [projectId]);

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
    try {
      await projectsApi.createTask({
        projectId,
        title: tTitle,
        description: tDesc || undefined,
        assigneeId: tAssignee || undefined,
      });
      setTTitle("");
      setTDesc("");
      setTAssignee("");
      setShowTask(false);
      await loadTasks(projectId);
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
    try {
      await projectsApi.updateStatus(task.id, status);
      await loadTasks(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal update status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell active="/dashboard/projects" title="Projects" crumbs={["Dashboard", "Projects"]}>

          {error && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
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
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white"
              >
                Add task
              </button>
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
                      className="rounded-xl border border-white bg-white p-3 shadow-sm"
                    >
                      <p className="text-sm font-medium text-slate-900">{task.title}</p>
                      {task.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                          {task.description}
                        </p>
                      )}
                      <p className="mt-2 text-[11px] text-slate-400">
                        {task.assignee?.fullName ?? "Unassigned"}
                      </p>
                      <div className="mt-2 flex gap-1">
                        {PREV[task.status] && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void move(task, "prev")}
                            className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50"
                          >
                            ←
                          </button>
                        )}
                        {NEXT[task.status] && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void move(task, "next")}
                            className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-medium text-white"
                          >
                            → {NEXT[task.status]?.replaceAll("_", " ")}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        
    </DashboardShell>
  );
}
