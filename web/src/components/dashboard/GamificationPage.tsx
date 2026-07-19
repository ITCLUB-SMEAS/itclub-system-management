import { useEffect, useState, type FormEvent } from "react";
import { Award, Medal, Plus, Trophy } from "lucide-react";
import {
  gamificationApi,
  membersApi,
  requireAuth,
  isPengurus,
  type Badge,
  type LeaderboardRow,
  type Member,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

export default function GamificationPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [pengurus, setPengurus] = useState(false);
  const [isKetua, setIsKetua] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [showAward, setShowAward] = useState(false);
  const [showCert, setShowCert] = useState(false);
  const [msg, setMsg] = useState("");

  const [bName, setBName] = useState("");
  const [bDesc, setBDesc] = useState("");
  const [awardMember, setAwardMember] = useState("");
  const [awardBadge, setAwardBadge] = useState("");
  const [certMember, setCertMember] = useState("");
  const [certTitle, setCertTitle] = useState("");

  async function load() {
    const [b, l] = await Promise.all([
      gamificationApi.badges(),
      gamificationApi.leaderboard(),
    ]);
    setBadges(b);
    setBoard(l);
  }

  useEffect(() => {
    const u = requireAuth();
    setPengurus(isPengurus(u.role));
    setIsKetua(u.role === "KETUA");
    if (isPengurus(u.role)) {
      void membersApi.list().then(setMembers).catch(() => {});
    }
    void load().catch((e) => setError(e instanceof Error ? e.message : "Gagal"));
  }, []);

  async function createBadge(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await gamificationApi.createBadge({
        name: bName,
        description: bDesc || undefined,
      });
      setBName("");
      setBDesc("");
      setShowBadge(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function award(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await gamificationApi.awardBadge(awardMember, awardBadge);
      setMsg("Badge diberikan");
      setShowAward(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function genCert(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await gamificationApi.generateCertificate({
        memberId: certMember,
        title: certTitle,
      });
      setMsg("Sertifikat dicatat");
      setCertTitle("");
      setShowCert(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell active="/dashboard/gamification" title="Gamifikasi" crumbs={["Dashboard", "Gamifikasi"]}>

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

          <div className="mb-4 flex flex-wrap gap-2">
            {isKetua && (
              <button
                type="button"
                onClick={() => setShowBadge((s) => !s)}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700"
              >
                <Plus size={16} /> Badge
              </button>
            )}
            {pengurus && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAward((s) => !s)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                >
                  <Medal size={16} /> Award
                </button>
                <button
                  type="button"
                  onClick={() => setShowCert((s) => !s)}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-2 text-sm font-medium text-white"
                >
                  <Award size={16} /> Sertifikat
                </button>
              </>
            )}
          </div>

          {showBadge && (
            <form
              onSubmit={createBadge}
              className="mb-4 grid gap-2 rounded-2xl border border-brand-100 bg-white p-4 sm:grid-cols-2"
            >
              <input
                required
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                placeholder="Nama badge"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={bDesc}
                onChange={(e) => setBDesc(e.target.value)}
                placeholder="Deskripsi"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-brand-600 py-2 text-sm font-medium text-white sm:col-span-2"
              >
                Simpan badge
              </button>
            </form>
          )}

          {showAward && (
            <form
              onSubmit={award}
              className="mb-4 grid gap-2 rounded-2xl border border-brand-100 bg-white p-4 sm:grid-cols-3"
            >
              <select
                required
                value={awardMember}
                onChange={(e) => setAwardMember(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Anggota</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
              <select
                required
                value={awardBadge}
                onChange={(e) => setAwardBadge(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Badge</option>
                {badges.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-brand-600 py-2 text-sm font-medium text-white"
              >
                Award
              </button>
            </form>
          )}

          {showCert && (
            <form
              onSubmit={genCert}
              className="mb-4 grid gap-2 rounded-2xl border border-brand-100 bg-white p-4 sm:grid-cols-3"
            >
              <select
                required
                value={certMember}
                onChange={(e) => setCertMember(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Anggota</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
              <input
                required
                value={certTitle}
                onChange={(e) => setCertTitle(e.target.value)}
                placeholder="Judul sertifikat"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-brand-600 py-2 text-sm font-medium text-white"
              >
                Generate
              </button>
            </form>
          )}

          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm lg:col-span-1">
              <div className="mb-3 flex items-center gap-2">
                <Medal className="text-brand-600" size={18} />
                <h3 className="font-semibold text-slate-900">Badges</h3>
              </div>
              <ul className="space-y-2">
                {badges.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-xl border border-brand-50 bg-brand-50/50 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-slate-800">{b.name}</p>
                    {b.description && (
                      <p className="text-xs text-slate-400">{b.description}</p>
                    )}
                  </li>
                ))}
                {!badges.length && (
                  <li className="text-sm text-slate-400">Belum ada badge</li>
                )}
              </ul>
            </div>

            <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="mb-3 flex items-center gap-2">
                <Trophy className="text-brand-600" size={18} />
                <h3 className="font-semibold text-slate-900">Leaderboard</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="pb-2 pr-3">#</th>
                      <th className="pb-2 pr-3">Nama</th>
                      <th className="pb-2 pr-3">Points</th>
                      <th className="pb-2 pr-3">Badge</th>
                      <th className="pb-2 pr-3">Hadir</th>
                      <th className="pb-2">Submit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.map((row, i) => (
                      <tr key={row.memberId} className="border-t border-slate-50">
                        <td className="py-2.5 pr-3 font-semibold text-brand-600">
                          {i + 1}
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-slate-800">
                          {row.fullName}
                        </td>
                        <td className="py-2.5 pr-3 font-semibold">{row.points}</td>
                        <td className="py-2.5 pr-3 text-slate-500">{row.badges}</td>
                        <td className="py-2.5 pr-3 text-slate-500">{row.attendances}</td>
                        <td className="py-2.5 text-slate-500">{row.submissions}</td>
                      </tr>
                    ))}
                    {!board.length && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Kosong
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        
    </DashboardShell>
  );
}
