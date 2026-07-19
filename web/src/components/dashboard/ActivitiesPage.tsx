import { useEffect, useState, type FormEvent } from "react";
import { QrCode, Plus, Users } from "lucide-react";
import {
  activitiesApi,
  isPengurus,
  requireAuth,
  type Activity,
  type Attendance,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ActivitiesPage() {
  const [list, setList] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [mine, setMine] = useState<Attendance[]>([]);
  const [error, setError] = useState("");
  const [pengurus, setPengurus] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [qrMode, setQrMode] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(toLocalInput(new Date()));
  const [endTime, setEndTime] = useState(
    toLocalInput(new Date(Date.now() + 2 * 60 * 60 * 1000)),
  );

  async function load() {
    try {
      const [acts, my] = await Promise.all([
        activitiesApi.list(),
        activitiesApi.mine().catch(() => [] as Attendance[]),
      ]);
      setList(acts);
      setMine(my);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal load");
    }
  }

  useEffect(() => {
    const u = requireAuth();
    setPengurus(isPengurus(u.role));
    void load();
  }, []);

  async function openActivity(a: Activity) {
    setSelected(a);
    setQrToken(a.qrToken);
    if (pengurus) {
      try {
        setAttendances(await activitiesApi.byActivity(a.id));
      } catch {
        setAttendances([]);
      }
    }
  }

  async function createActivity(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await activitiesApi.create({
        title,
        location: location || undefined,
        description: description || undefined,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });
      setShowForm(false);
      setTitle("");
      setLocation("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal buat");
    } finally {
      setBusy(false);
    }
  }

  async function checkIn(activity: Activity, method: "MANUAL" | "QR") {
    setBusy(true);
    setError("");
    try {
      await activitiesApi.checkIn({
        activityId: activity.id,
        method,
        ...(method === "QR" ? { qrToken: qrToken || activity.qrToken } : {}),
      });
      await load();
      if (pengurus) {
        setAttendances(await activitiesApi.byActivity(activity.id));
      }
      alert("Check-in berhasil");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal check-in");
    } finally {
      setBusy(false);
    }
  }

  const checkedIds = new Set(mine.map((a) => a.activityId));

  return (
    <DashboardShell active="/dashboard/activities" title="Presensi" crumbs={["Dashboard", "Presensi"]}>

          {error && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Jadwal Kegiatan</h2>
              <p className="text-sm text-slate-500">{list.length} kegiatan</p>
            </div>
            {pengurus && (
              <button
                type="button"
                onClick={() => setShowForm((s) => !s)}
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Plus size={16} />
                Buat kegiatan
              </button>
            )}
          </div>

          {showForm && (
            <form
              onSubmit={createActivity}
              className="mb-6 grid gap-3 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm sm:grid-cols-2"
            >
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Judul kegiatan"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-300 sm:col-span-2"
              />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Lokasi"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-300"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi (opsional)"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-300"
              />
              <label className="text-xs text-slate-500">
                Mulai
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="text-xs text-slate-500">
                Selesai
                <input
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-brand-600 py-2.5 text-sm font-semibold text-white sm:col-span-2 disabled:opacity-50"
              >
                Simpan
              </button>
            </form>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {list.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">{a.title}</h3>
                    <p className="text-xs text-slate-400">
                      {new Date(a.startTime).toLocaleString("id-ID")} —{" "}
                      {new Date(a.endTime).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {a.location && (
                      <p className="mt-1 text-sm text-slate-500">{a.location}</p>
                    )}
                  </div>
                  {checkedIds.has(a.id) && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      Hadir
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!checkedIds.has(a.id) && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => checkIn(a, "MANUAL")}
                        className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        Check-in manual
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(a);
                          setQrMode(true);
                          setQrToken("");
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                      >
                        <QrCode size={14} />
                        QR
                      </button>
                    </>
                  )}
                  {pengurus && (
                    <button
                      type="button"
                      onClick={() => void openActivity(a)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Users size={14} />
                      Rekap
                    </button>
                  )}
                  {pengurus && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(a);
                        setQrMode(false);
                        navigator.clipboard?.writeText(a.qrToken);
                        alert(`QR token disalin:\n${a.qrToken}`);
                      }}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-500"
                    >
                      Copy QR token
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!list.length && (
              <div className="rounded-2xl border border-dashed border-brand-200 bg-white p-10 text-center text-slate-400 lg:col-span-2">
                Belum ada kegiatan
              </div>
            )}
          </div>

          {qrMode && selected && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="font-semibold text-slate-900">Check-in QR</h3>
                <p className="mt-1 text-sm text-slate-500">{selected.title}</p>
                <input
                  value={qrToken}
                  onChange={(e) => setQrToken(e.target.value)}
                  placeholder="Paste QR token"
                  className="mt-4 w-full rounded-full border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-300"
                />
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setQrMode(false)}
                    className="flex-1 rounded-full border border-slate-200 py-2 text-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void checkIn(selected, "QR").then(() => setQrMode(false));
                    }}
                    className="flex-1 rounded-full bg-brand-600 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}

          {selected && !qrMode && pengurus && (
            <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30">
              <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
                <div className="border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{selected.title}</h3>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="text-sm text-slate-400"
                    >
                      Tutup
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    {attendances.length} hadir · token: {selected.qrToken.slice(0, 8)}…
                  </p>
                </div>
                <ul className="flex-1 overflow-y-auto p-4">
                  {attendances.map((att) => (
                    <li
                      key={att.id}
                      className="flex items-center justify-between border-b border-slate-50 py-3 text-sm"
                    >
                      <span className="font-medium text-slate-800">
                        {att.member?.fullName ?? att.memberId}
                      </span>
                      <span className="text-xs text-slate-400">
                        {att.method} ·{" "}
                        {new Date(att.checkedInAt).toLocaleTimeString("id-ID")}
                      </span>
                    </li>
                  ))}
                  {!attendances.length && (
                    <li className="py-8 text-center text-slate-400">Belum ada presensi</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        
    </DashboardShell>
  );
}
