import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trophy, Users } from "lucide-react";
import {
  eventsApi,
  membersApi,
  requireAuth,
  isPengurus,
  type ClubEvent,
  type EventRegistration,
  type Member,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

export default function EventsPage() {
  const [list, setList] = useState<ClubEvent[]>([]);
  const [pengurus, setPengurus] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [regs, setRegs] = useState<EventRegistration[]>([]);
  const [selected, setSelected] = useState<ClubEvent | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [achTitle, setAchTitle] = useState("");
  const [achRank, setAchRank] = useState("");
  const [achMember, setAchMember] = useState("");

  const [title, setTitle] = useState("");
  const [type, setType] = useState("WORKSHOP");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function load() {
    setList(await eventsApi.list());
  }

  useEffect(() => {
    const u = requireAuth();
    setPengurus(isPengurus(u.role));
    void load().catch((e) => setError(e instanceof Error ? e.message : "Gagal"));
    if (isPengurus(u.role)) {
      void membersApi.list().then(setMembers).catch(() => {});
    }
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await eventsApi.create({
        title,
        type,
        description: description || undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      });
      setShowForm(false);
      setTitle("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function register(id: string) {
    setBusy(true);
    try {
      await eventsApi.register(id);
      alert("Pendaftaran terkirim");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal daftar");
    } finally {
      setBusy(false);
    }
  }

  async function openRegs(ev: ClubEvent) {
    setSelected(ev);
    try {
      setRegs(await eventsApi.registrations(ev.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal load");
    }
  }

  async function addAchievement(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await eventsApi.addAchievement(selected.id, {
        title: achTitle,
        rank: achRank || undefined,
        memberId: achMember || undefined,
      });
      setAchTitle("");
      setAchRank("");
      setAchMember("");
      alert("Prestasi dicatat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell active="/dashboard/events" title="Events" crumbs={["Dashboard", "Events"]}>

          {error && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
          )}

          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Event & Lomba</h2>
              <p className="text-sm text-slate-500">{list.length} event</p>
            </div>
            {pengurus && (
              <button
                type="button"
                onClick={() => setShowForm((s) => !s)}
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white"
              >
                <Plus size={16} /> Buat event
              </button>
            )}
          </div>

          {showForm && (
            <form
              onSubmit={create}
              className="mb-6 grid gap-3 rounded-2xl border border-brand-100 bg-white p-5 sm:grid-cols-2"
            >
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Judul"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="WORKSHOP">Workshop</option>
                <option value="COMPETITION">Lomba</option>
                <option value="INTERNAL">Internal</option>
                <option value="EXTERNAL">Eksternal</option>
              </select>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <label className="text-xs text-slate-500">
                Mulai
                <input
                  type="datetime-local"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-slate-500">
                Selesai
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-brand-600 py-2.5 text-sm font-semibold text-white sm:col-span-2"
              >
                Simpan
              </button>
            </form>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {list.map((ev) => (
              <div
                key={ev.id}
                className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-700">
                      {ev.type}
                    </span>
                    <h3 className="mt-2 font-semibold text-slate-900">{ev.title}</h3>
                    <p className="text-xs text-slate-400">
                      {new Date(ev.startDate).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <Trophy className="text-brand-400" size={20} />
                </div>
                {ev.description && (
                  <p className="mb-3 line-clamp-2 text-sm text-slate-500">{ev.description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void register(ev.id)}
                    className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Daftar
                  </button>
                  {pengurus && (
                    <button
                      type="button"
                      onClick={() => void openRegs(ev)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                    >
                      <Users size={12} /> Pendaftar
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!list.length && (
              <div className="rounded-2xl border border-dashed border-brand-200 p-10 text-center text-slate-400 md:col-span-2">
                Belum ada event
              </div>
            )}
          </div>

          {selected && (
            <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
              <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
                <div className="border-b border-slate-100 px-5 py-4">
                  <div className="flex justify-between">
                    <h3 className="font-semibold">{selected.title}</h3>
                    <button type="button" onClick={() => setSelected(null)} className="text-sm text-slate-400">
                      Tutup
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">{regs.length} pendaftar</p>
                </div>
                <ul className="max-h-48 overflow-y-auto border-b border-slate-50 px-4">
                  {regs.map((r) => (
                    <li key={r.id} className="flex justify-between py-2 text-sm">
                      <span>{r.member?.fullName ?? r.memberId}</span>
                      <span className="text-xs text-slate-400">{r.status}</span>
                    </li>
                  ))}
                  {!regs.length && (
                    <li className="py-6 text-center text-sm text-slate-400">Kosong</li>
                  )}
                </ul>
                <form onSubmit={addAchievement} className="space-y-2 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Catat prestasi
                  </p>
                  <input
                    required
                    value={achTitle}
                    onChange={(e) => setAchTitle(e.target.value)}
                    placeholder="Judul prestasi"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    value={achRank}
                    onChange={(e) => setAchRank(e.target.value)}
                    placeholder="Peringkat (opsional)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <select
                    value={achMember}
                    onChange={(e) => setAchMember(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Anggota (opsional)</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-full bg-brand-600 py-2 text-sm font-medium text-white"
                  >
                    Simpan prestasi
                  </button>
                </form>
              </div>
            </div>
          )}
        
    </DashboardShell>
  );
}
