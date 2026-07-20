import { useEffect, useState, type FormEvent } from "react";
import { QrCode, Plus, Users, RefreshCw, MapPin, BarChart3, Bell } from "lucide-react";
import {
  activitiesApi,
  getCurrentPosition,
  isPengurus,
  requireAuth,
  type Activity,
  type Attendance,
  type AttendanceReport,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function qrExpired(a: Activity) {
  if (!a.qrTokenExpiresAt) return false;
  return new Date(a.qrTokenExpiresAt).getTime() < Date.now();
}

export default function ActivitiesPage() {
  const [list, setList] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [mine, setMine] = useState<Attendance[]>([]);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [pengurus, setPengurus] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [qrMode, setQrMode] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [useGeo, setUseGeo] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [geofenceRadiusM, setGeofenceRadiusM] = useState("100");
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
    setQrMode(false);
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
      const body: Parameters<typeof activitiesApi.create>[0] = {
        title,
        location: location || undefined,
        description: description || undefined,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      };
      if (useGeo && latitude && longitude) {
        body.latitude = Number(latitude);
        body.longitude = Number(longitude);
        body.geofenceRadiusM = Number(geofenceRadiusM) || 100;
      }
      await activitiesApi.create(body);
      setShowForm(false);
      setTitle("");
      setLocation("");
      setDescription("");
      setUseGeo(false);
      await load();
      setOkMsg("Kegiatan dibuat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal buat");
    } finally {
      setBusy(false);
    }
  }

  async function fillMyLocation() {
    try {
      const pos = await getCurrentPosition();
      setLatitude(String(pos.latitude));
      setLongitude(String(pos.longitude));
      setUseGeo(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal GPS");
    }
  }

  async function checkIn(activity: Activity, method: "MANUAL" | "QR") {
    setBusy(true);
    setError("");
    setOkMsg("");
    try {
      let coords: { latitude?: number; longitude?: number } = {};
      const needsGeo =
        activity.latitude != null &&
        activity.longitude != null &&
        (activity.geofenceRadiusM ?? 0) > 0;
      if (needsGeo) {
        const pos = await getCurrentPosition();
        coords = { latitude: pos.latitude, longitude: pos.longitude };
      }
      await activitiesApi.checkIn({
        activityId: activity.id,
        method,
        ...coords,
        ...(method === "QR" ? { qrToken: qrToken || activity.qrToken } : {}),
      });
      await load();
      if (pengurus && selected?.id === activity.id) {
        setAttendances(await activitiesApi.byActivity(activity.id));
      }
      setOkMsg("Check-in berhasil");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal check-in");
    } finally {
      setBusy(false);
    }
  }

  async function rotateQr(a: Activity) {
    setBusy(true);
    setError("");
    try {
      const updated = await activitiesApi.rotateQr(a.id, 15);
      setList((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...updated } : x)));
      setSelected((s) => (s?.id === a.id ? { ...s, ...updated } : s));
      setQrToken(updated.qrToken);
      try {
        await navigator.clipboard?.writeText(updated.qrToken);
      } catch {
        /* ignore */
      }
      setOkMsg(`QR di-rotate (15 mnt). Token disalin.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal rotate QR");
    } finally {
      setBusy(false);
    }
  }

  async function loadMyReport() {
    setBusy(true);
    setError("");
    try {
      setReport(await activitiesApi.report());
      setShowReport(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal load rekap");
    } finally {
      setBusy(false);
    }
  }

  async function runReminders() {
    setBusy(true);
    setError("");
    try {
      const r = await activitiesApi.runReminders();
      setOkMsg(`Reminder: ${r.activities} kegiatan, ${r.sent} notifikasi`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal kirim reminder");
    } finally {
      setBusy(false);
    }
  }

  const checkedIds = new Set(mine.map((a) => a.activityId));

  return (
    <DashboardShell
      active="/dashboard/activities"
      title="Presensi"
      crumbs={["Dashboard", "Presensi"]}
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Jadwal Kegiatan</h2>
          <p className="text-sm text-slate-500">{list.length} kegiatan</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadMyReport()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <BarChart3 size={16} />
            Rekap saya
          </button>
          {pengurus && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runReminders()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Bell size={16} />
                Jalankan H-1
              </button>
              <button
                type="button"
                onClick={() => setShowForm((s) => !s)}
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Plus size={16} />
                Buat kegiatan
              </button>
            </>
          )}
        </div>
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
            placeholder="Lokasi (teks)"
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

          <div className="sm:col-span-2 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={useGeo}
                onChange={(e) => setUseGeo(e.target.checked)}
              />
              Aktifkan geofence (GPS wajib saat check-in)
            </label>
            {useGeo && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <input
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="Latitude"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="Longitude"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={geofenceRadiusM}
                  onChange={(e) => setGeofenceRadiusM(e.target.value)}
                  placeholder="Radius (m)"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void fillMyLocation()}
                  className="inline-flex items-center justify-center gap-1 rounded-full border border-brand-200 py-2 text-xs font-medium text-brand-700 sm:col-span-3"
                >
                  <MapPin size={14} />
                  Isi dari GPS saya
                </button>
              </div>
            )}
          </div>

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
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {a.geofenceRadiusM != null && a.latitude != null && (
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                      Geofence {a.geofenceRadiusM}m
                    </span>
                  )}
                  {a._count && (
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
                      {a._count.attendances} hadir
                    </span>
                  )}
                  {qrExpired(a) && (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600">
                      QR expired
                    </span>
                  )}
                </div>
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
                    onClick={() => void checkIn(a, "MANUAL")}
                    className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    Check-in{a.geofenceRadiusM ? " + GPS" : " manual"}
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
                <>
                  <button
                    type="button"
                    onClick={() => void openActivity(a)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Users size={14} />
                    Rekap
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void rotateQr(a)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <RefreshCw size={14} />
                    Rotate QR
                  </button>
                </>
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
            {selected.geofenceRadiusM != null && (
              <p className="mt-2 text-xs text-sky-600">
                GPS akan diminta (radius {selected.geofenceRadiusM}m)
              </p>
            )}
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
                  void checkIn(selected, "QR").then(() => {
                    if (!error) setQrMode(false);
                  });
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
                {attendances.length} hadir · QR{" "}
                {qrExpired(selected) ? "expired" : "aktif"} ·{" "}
                {selected.qrTokenExpiresAt
                  ? `exp ${new Date(selected.qrTokenExpiresAt).toLocaleTimeString("id-ID")}`
                  : "no expiry"}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void rotateQr(selected)}
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-brand-200 px-3 py-1 text-xs font-medium text-brand-700"
              >
                <RefreshCw size={12} />
                Rotate & copy token
              </button>
              <p className="mt-2 break-all font-mono text-[10px] text-slate-400">
                {selected.qrToken}
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
                <li className="py-8 text-center text-slate-400">
                  Belum ada presensi
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {showReport && report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Rekap kehadiran</h3>
              <button
                type="button"
                onClick={() => setShowReport(false)}
                className="text-sm text-slate-400"
              >
                Tutup
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">{report.member.fullName}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-brand-50 p-3">
                <p className="text-lg font-bold text-brand-700">{report.present}</p>
                <p className="text-[10px] text-slate-500">Hadir</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-lg font-bold text-slate-700">{report.absent}</p>
                <p className="text-[10px] text-slate-500">Absen*</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-lg font-bold text-emerald-700">
                  {report.attendanceRatePercent}%
                </p>
                <p className="text-[10px] text-slate-500">Rate</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              *vs {report.totalPastActivities} kegiatan yang sudah selesai
            </p>
            <ul className="mt-4 space-y-2">
              {report.attendances.map((att) => (
                <li
                  key={att.id}
                  className="rounded-xl border border-slate-100 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-slate-800">
                    {att.activity?.title ?? att.activityId}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(att.checkedInAt).toLocaleString("id-ID")} ·{" "}
                    {att.method}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
