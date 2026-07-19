import { useEffect, useState, type FormEvent } from "react";
import { Bell, Plus } from "lucide-react";
import {
  communicationApi,
  requireAuth,
  isPengurus,
  type Announcement,
  type AppNotification,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

export default function AnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [pengurus, setPengurus] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  async function load() {
    const [a, n] = await Promise.all([
      communicationApi.announcements(),
      communicationApi.notifications(),
    ]);
    setList(a);
    setNotifs(n);
  }

  useEffect(() => {
    const u = requireAuth();
    setPengurus(isPengurus(u.role));
    void load().catch((e) => setError(e instanceof Error ? e.message : "Gagal"));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await communicationApi.createAnnouncement({ title, content });
      setTitle("");
      setContent("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function markRead(id: string) {
    await communicationApi.markRead(id);
    setNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  }

  const unread = notifs.filter((n) => !n.isRead).length;

  return (
    <DashboardShell active="/dashboard/announcements" title="Pengumuman" crumbs={["Dashboard", "Pengumuman"]}>

          {error && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
          )}

          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Board</h2>
                {pengurus && (
                  <button
                    type="button"
                    onClick={() => setShowForm((s) => !s)}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    <Plus size={16} /> Buat
                  </button>
                )}
              </div>

              {showForm && (
                <form
                  onSubmit={create}
                  className="mb-4 space-y-3 rounded-2xl border border-brand-100 bg-white p-5"
                >
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Judul"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <textarea
                    required
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Isi pengumuman"
                    rows={4}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    Publish
                  </button>
                </form>
              )}

              <div className="space-y-3">
                {list.map((a) => (
                  <article
                    key={a.id}
                    className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm"
                  >
                    <h3 className="font-semibold text-slate-900">{a.title}</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(a.createdAt).toLocaleString("id-ID")}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                      {a.content}
                    </p>
                  </article>
                ))}
                {!list.length && (
                  <div className="rounded-2xl border border-dashed border-brand-200 p-10 text-center text-slate-400">
                    Belum ada pengumuman
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2">
                <Bell size={18} className="text-brand-600" />
                <h2 className="font-semibold text-slate-900">Notifikasi</h2>
                {unread > 0 && (
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {notifs.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void markRead(n.id)}
                    className={`w-full rounded-xl border p-3 text-left text-sm transition ${
                      n.isRead
                        ? "border-slate-100 bg-white text-slate-500"
                        : "border-brand-100 bg-brand-50 text-slate-800"
                    }`}
                  >
                    <p className="font-medium">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs opacity-80">{n.body}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {new Date(n.createdAt).toLocaleString("id-ID")}
                    </p>
                  </button>
                ))}
                {!notifs.length && (
                  <p className="text-center text-sm text-slate-400">Kosong</p>
                )}
              </div>
            </div>
          </div>
        
    </DashboardShell>
  );
}
