import { useEffect, useState, type FormEvent } from "react";
import {
  Plus,
  Trophy,
  Users,
  Image as ImageIcon,
  Bell,
  MapPin,
} from "lucide-react";
import {
  eventsApi,
  membersApi,
  requireAuth,
  isPengurus,
  type ClubEvent,
  type EventRegistration,
  type EventAchievement,
  type GalleryItem,
  type Member,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

const EVENT_TYPES = ["WORKSHOP", "LOMBA", "INTERNAL", "EKSTERNAL", "LAINNYA"];

function regBadge(status: string) {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-700";
  if (status === "REJECTED") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
}

export default function EventsPage() {
  const [list, setList] = useState<ClubEvent[]>([]);
  const [myRegs, setMyRegs] = useState<EventRegistration[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [achievements, setAchievements] = useState<EventAchievement[]>([]);
  const [pengurus, setPengurus] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filterUpcoming, setFilterUpcoming] = useState<"all" | "up" | "past">(
    "all",
  );
  const [busy, setBusy] = useState(false);
  const [regs, setRegs] = useState<EventRegistration[]>([]);
  const [selected, setSelected] = useState<ClubEvent | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tab, setTab] = useState<"events" | "gallery" | "prestasi">("events");

  const [title, setTitle] = useState("");
  const [type, setType] = useState("WORKSHOP");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [achTitle, setAchTitle] = useState("");
  const [achRank, setAchRank] = useState("");
  const [achMember, setAchMember] = useState("");
  const [galUrl, setGalUrl] = useState("");
  const [galCaption, setGalCaption] = useState("");

  async function load() {
    const q =
      filterUpcoming === "up"
        ? { upcoming: true as const }
        : filterUpcoming === "past"
          ? { upcoming: false as const }
          : undefined;
    const [evs, mine, gal, ach] = await Promise.all([
      eventsApi.list(q),
      eventsApi.myRegistrations().catch(() => [] as EventRegistration[]),
      eventsApi.gallery().catch(() => [] as GalleryItem[]),
      eventsApi.achievements().catch(() => [] as EventAchievement[]),
    ]);
    setList(evs);
    setMyRegs(mine);
    setGallery(gal);
    setAchievements(ach);
  }

  useEffect(() => {
    const u = requireAuth();
    setPengurus(isPengurus(u.role));
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : "Gagal"),
    );
    void membersApi.list().then(setMembers).catch(() => {});
  }, [filterUpcoming]);

  const myRegMap = new Map(myRegs.map((r) => [r.eventId, r]));

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await eventsApi.create({
        title,
        type,
        description: description || undefined,
        location: location || undefined,
        capacity: capacity ? Number(capacity) : undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      });
      setShowForm(false);
      setTitle("");
      setDescription("");
      setLocation("");
      setCapacity("");
      await load();
      setOkMsg("Event dibuat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function register(id: string) {
    setBusy(true);
    setError("");
    try {
      await eventsApi.register(id);
      await load();
      setOkMsg("Pendaftaran terkirim (pending approval)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal daftar");
    } finally {
      setBusy(false);
    }
  }

  async function cancelReg(id: string) {
    setBusy(true);
    try {
      await eventsApi.cancelRegister(id);
      await load();
      setOkMsg("Pendaftaran dibatalkan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function openRegs(ev: ClubEvent) {
    setSelected(ev);
    setError("");
    try {
      const [detail, r] = await Promise.all([
        eventsApi.get(ev.id),
        eventsApi.registrations(ev.id),
      ]);
      setSelected(detail);
      setRegs(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    }
  }

  async function setStatus(regId: string, status: "APPROVED" | "REJECTED") {
    if (!selected) return;
    setBusy(true);
    try {
      await eventsApi.setRegistrationStatus(selected.id, regId, status);
      setRegs(await eventsApi.registrations(selected.id));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal update status");
    } finally {
      setBusy(false);
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
      setSelected(await eventsApi.get(selected.id));
      setAchievements(await eventsApi.achievements());
      setOkMsg("Prestasi dicatat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function addGallery(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await eventsApi.addGallery(selected.id, {
        imageUrl: galUrl,
        caption: galCaption || undefined,
      });
      setGalUrl("");
      setGalCaption("");
      setSelected(await eventsApi.get(selected.id));
      setGallery(await eventsApi.gallery());
      setOkMsg("Foto galeri ditambah");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function runReminders() {
    setBusy(true);
    try {
      const r = await eventsApi.runReminders();
      setOkMsg(`H-1: ${r.events} event, ${r.sent} notifikasi`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell
      active="/dashboard/events"
      title="Events"
      crumbs={["Dashboard", "Events"]}
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
          <h2 className="text-lg font-semibold text-slate-900">
            Event & Prestasi
          </h2>
          <p className="text-sm text-slate-500">
            {list.length} event · {myRegs.length} pendaftaran saya
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-full border border-slate-200 bg-white p-0.5 text-xs">
            {(
              [
                ["events", "Event"],
                ["gallery", "Galeri"],
                ["prestasi", "Prestasi"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`rounded-full px-3 py-1.5 font-medium ${
                  tab === k
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {pengurus && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runReminders()}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-600"
              >
                <Bell size={14} /> H-1
              </button>
              <button
                type="button"
                onClick={() => setShowForm((s) => !s)}
                className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-2 text-sm font-medium text-white"
              >
                <Plus size={16} /> Event
              </button>
            </>
          )}
        </div>
      </div>

      {tab === "events" && (
        <>
          <div className="mb-3 flex gap-2 text-xs">
            {(
              [
                ["all", "Semua"],
                ["up", "Mendatang"],
                ["past", "Selesai"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilterUpcoming(k)}
                className={`rounded-full px-3 py-1 font-medium ${
                  filterUpcoming === k
                    ? "bg-brand-100 text-brand-800"
                    : "bg-slate-50 text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {showForm && (
            <form
              onSubmit={create}
              className="mb-6 grid gap-3 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm sm:grid-cols-2"
            >
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Judul event"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Lokasi"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Kuota (opsional)"
                type="number"
                min={1}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
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
            {list.map((ev) => {
              const mine = myRegMap.get(ev.id);
              return (
                <div
                  key={ev.id}
                  className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-700">
                        {ev.type}
                      </span>
                      <h3 className="mt-2 font-semibold text-slate-900">
                        {ev.title}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {new Date(ev.startDate).toLocaleString("id-ID")}
                      </p>
                      {ev.location && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin size={12} /> {ev.location}
                        </p>
                      )}
                    </div>
                    <Trophy className="text-brand-400" size={20} />
                  </div>
                  {ev.description && (
                    <p className="mb-3 line-clamp-2 text-sm text-slate-500">
                      {ev.description}
                    </p>
                  )}
                  <div className="mb-3 flex flex-wrap gap-1.5 text-[10px]">
                    {ev._count && (
                      <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-500">
                        {ev._count.registrations} daftar
                        {ev.capacity != null ? ` / ${ev.capacity}` : ""}
                      </span>
                    )}
                    {ev._count && ev._count.achievements > 0 && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                        {ev._count.achievements} prestasi
                      </span>
                    )}
                    {mine && (
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${regBadge(mine.status)}`}
                      >
                        {mine.status}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!mine && ev.registrationOpen !== false && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void register(ev.id)}
                        className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Daftar
                      </button>
                    )}
                    {mine && mine.status === "PENDING" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void cancelReg(ev.id)}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                      >
                        Batalkan
                      </button>
                    )}
                    {pengurus && (
                      <button
                        type="button"
                        onClick={() => void openRegs(ev)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                      >
                        <Users size={12} /> Kelola
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!list.length && (
              <div className="rounded-2xl border border-dashed border-brand-200 p-10 text-center text-slate-400 md:col-span-2">
                Belum ada event
              </div>
            )}
          </div>
        </>
      )}

      {tab === "gallery" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map((g) => (
            <a
              key={g.id}
              href={g.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm"
            >
              <div className="flex h-40 items-center justify-center bg-slate-50">
                <img
                  src={g.imageUrl}
                  alt={g.caption ?? "gallery"}
                  className="max-h-40 w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <ImageIcon className="absolute text-slate-300" size={32} />
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-slate-700">
                  {g.event?.title ?? "—"}
                </p>
                {g.caption && (
                  <p className="text-xs text-slate-400">{g.caption}</p>
                )}
              </div>
            </a>
          ))}
          {!gallery.length && (
            <div className="col-span-full rounded-2xl border border-dashed border-brand-200 p-10 text-center text-slate-400">
              Galeri kosong
            </div>
          )}
        </div>
      )}

      {tab === "prestasi" && (
        <ul className="space-y-2">
          {achievements.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-white p-4 shadow-sm"
            >
              <Trophy className="mt-0.5 shrink-0 text-amber-500" size={18} />
              <div>
                <p className="font-semibold text-slate-900">{a.title}</p>
                <p className="text-xs text-slate-400">
                  {a.event?.title ?? "—"}
                  {a.rank ? ` · Rank ${a.rank}` : ""}
                  {a.member ? ` · ${a.member.fullName}` : ""}
                </p>
                {a.description && (
                  <p className="mt-1 text-sm text-slate-500">{a.description}</p>
                )}
              </div>
            </li>
          ))}
          {!achievements.length && (
            <li className="rounded-2xl border border-dashed border-brand-200 p-10 text-center text-slate-400">
              Belum ada prestasi tercatat
            </li>
          )}
        </ul>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
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
                {regs.length} pendaftar ·{" "}
                {selected._count?.achievements ?? 0} prestasi ·{" "}
                {selected._count?.galleries ?? 0} foto
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-slate-400">
                  Pendaftar
                </h4>
                <ul className="space-y-2">
                  {regs.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {r.member?.fullName ?? r.memberId}
                        </p>
                        <span
                          className={`text-[10px] font-medium ${regBadge(r.status)} rounded-full px-1.5 py-0.5`}
                        >
                          {r.status}
                        </span>
                      </div>
                      {r.status === "PENDING" && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void setStatus(r.id, "APPROVED")}
                            className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white"
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void setStatus(r.id, "REJECTED")}
                            className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] text-white"
                          >
                            X
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                  {!regs.length && (
                    <li className="py-4 text-center text-xs text-slate-400">
                      Belum ada pendaftar
                    </li>
                  )}
                </ul>
              </div>

              <form
                onSubmit={addAchievement}
                className="space-y-2 rounded-xl border border-slate-100 p-3"
              >
                <h4 className="text-xs font-semibold uppercase text-slate-400">
                  Catat prestasi
                </h4>
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
                  placeholder="Rank / juara"
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

              <form
                onSubmit={addGallery}
                className="space-y-2 rounded-xl border border-slate-100 p-3"
              >
                <h4 className="text-xs font-semibold uppercase text-slate-400">
                  Tambah galeri (URL)
                </h4>
                <input
                  required
                  value={galUrl}
                  onChange={(e) => setGalUrl(e.target.value)}
                  placeholder="https://… image URL"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={galCaption}
                  onChange={(e) => setGalCaption(e.target.value)}
                  placeholder="Caption"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full border border-brand-200 py-2 text-sm font-medium text-brand-700"
                >
                  Tambah foto
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
