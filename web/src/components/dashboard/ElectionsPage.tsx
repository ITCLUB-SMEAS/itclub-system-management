import { useEffect, useState, type FormEvent } from "react";
import { Plus, Vote } from "lucide-react";
import {
  electionsApi,
  membersApi,
  orgApi,
  requireAuth,
  isPengurus,
  type Election,
  type Poll,
  type Member,
  type Period,
} from "../../lib/api";
import DashboardShell from "../common/DashboardShell";

export default function ElectionsPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [role, setRole] = useState("");
  const [pengurus, setPengurus] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"elections" | "polls">("elections");

  const [eTitle, setETitle] = useState("");
  const [ePeriod, setEPeriod] = useState("");
  const [showElection, setShowElection] = useState(false);
  const [candMember, setCandMember] = useState("");
  const [selected, setSelected] = useState<Election | null>(null);
  const [results, setResults] = useState<Election | null>(null);

  const [pQuestion, setPQuestion] = useState("");
  const [pOptions, setPOptions] = useState("Ya\nTidak");
  const [showPoll, setShowPoll] = useState(false);

  async function load() {
    const [e, p] = await Promise.all([electionsApi.list(), electionsApi.polls()]);
    setElections(e);
    setPolls(p);
  }

  useEffect(() => {
    const u = requireAuth();
    setRole(u.role ?? "");
    setPengurus(isPengurus(u.role));
    void orgApi.periods().then((ps) => {
      setPeriods(ps);
      const active = ps.find((x) => x.isActive);
      if (active) setEPeriod(active.id);
    });
    if (isPengurus(u.role)) {
      void membersApi.list().then(setMembers).catch(() => {});
    }
    void load().catch((e) => setError(e instanceof Error ? e.message : "Gagal"));
  }, []);

  async function createElection(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await electionsApi.create({ title: eTitle, periodId: ePeriod });
      setETitle("");
      setShowElection(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function addCandidate() {
    if (!selected || !candMember) return;
    setBusy(true);
    try {
      await electionsApi.addCandidate(selected.id, candMember);
      setCandMember("");
      await load();
      const updated = (await electionsApi.list()).find((x) => x.id === selected.id);
      if (updated) setSelected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: Election["status"]) {
    setBusy(true);
    try {
      await electionsApi.setStatus(id, status);
      await load();
      if (selected?.id === id) {
        const updated = (await electionsApi.list()).find((x) => x.id === id);
        if (updated) setSelected(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function vote(electionId: string, candidateId: string) {
    setBusy(true);
    try {
      await electionsApi.vote(electionId, candidateId);
      alert("Suara tercatat");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal vote");
    } finally {
      setBusy(false);
    }
  }

  async function showResults(id: string) {
    try {
      setResults(await electionsApi.results(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal load hasil");
    }
  }

  async function createPoll(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const options = pOptions
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      await electionsApi.createPoll({ question: pQuestion, options });
      setPQuestion("");
      setPOptions("Ya\nTidak");
      setShowPoll(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function closePoll(pollId: string) {
    setBusy(true);
    try {
      await electionsApi.closePoll(pollId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal tutup poll");
    } finally {
      setBusy(false);
    }
  }

  async function pollVote(pollId: string, optionId: string) {
    setBusy(true);
    try {
      await electionsApi.pollVote(pollId, optionId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal vote");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell active="/dashboard/elections" title="Pemilu & Polling" crumbs={["Dashboard", "Pemilu"]}>

          {error && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-full border border-slate-200 bg-white p-1 text-sm">
              <button
                type="button"
                onClick={() => setTab("elections")}
                className={`rounded-full px-4 py-1.5 font-medium ${
                  tab === "elections" ? "bg-brand-600 text-white" : "text-slate-600"
                }`}
              >
                Pemilu
              </button>
              <button
                type="button"
                onClick={() => setTab("polls")}
                className={`rounded-full px-4 py-1.5 font-medium ${
                  tab === "polls" ? "bg-brand-600 text-white" : "text-slate-600"
                }`}
              >
                Polling
              </button>
            </div>
            {tab === "elections" && role === "KETUA" && (
              <button
                type="button"
                onClick={() => setShowElection((s) => !s)}
                className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-2 text-sm font-medium text-white"
              >
                <Plus size={16} /> Buat pemilu
              </button>
            )}
            {tab === "polls" && pengurus && (
              <button
                type="button"
                onClick={() => setShowPoll((s) => !s)}
                className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-2 text-sm font-medium text-white"
              >
                <Plus size={16} /> Buat poll
              </button>
            )}
          </div>

          {tab === "elections" && (
            <>
              {showElection && (
                <form
                  onSubmit={createElection}
                  className="mb-4 grid gap-2 rounded-2xl border border-brand-100 bg-white p-4 sm:grid-cols-3"
                >
                  <input
                    required
                    value={eTitle}
                    onChange={(e) => setETitle(e.target.value)}
                    placeholder="Judul pemilu"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
                  />
                  <select
                    required
                    value={ePeriod}
                    onChange={(e) => setEPeriod(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-full bg-brand-600 py-2 text-sm font-medium text-white sm:col-span-3"
                  >
                    Simpan
                  </button>
                </form>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {elections.map((el) => (
                  <div
                    key={el.id}
                    className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{el.title}</h3>
                        <p className="text-xs text-slate-400">
                          {el.period?.name ?? el.periodId}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          el.status === "OPEN"
                            ? "bg-emerald-50 text-emerald-700"
                            : el.status === "CLOSED"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {el.status}
                      </span>
                    </div>
                    <ul className="mb-3 space-y-1 text-sm text-slate-600">
                      {el.candidates.map((c) => (
                        <li key={c.id} className="flex items-center justify-between">
                          <span>{c.member?.fullName ?? c.memberId}</span>
                          {el.status === "OPEN" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void vote(el.id, c.id)}
                              className="rounded-full bg-brand-600 px-2.5 py-0.5 text-[10px] font-medium text-white"
                            >
                              Vote
                            </button>
                          )}
                        </li>
                      ))}
                      {!el.candidates.length && (
                        <li className="text-xs text-slate-400">Belum ada kandidat</li>
                      )}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      {role === "KETUA" && (
                        <button
                          type="button"
                          onClick={() => setSelected(el)}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                        >
                          Kelola
                        </button>
                      )}
                      {el.status === "DRAFT" && role === "KETUA" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void setStatus(el.id, "OPEN")}
                          className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white"
                        >
                          Buka
                        </button>
                      )}
                      {el.status === "OPEN" && role === "KETUA" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void setStatus(el.id, "CLOSED")}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                        >
                          Tutup
                        </button>
                      )}
                      {pengurus && (
                        <button
                          type="button"
                          onClick={() => void showResults(el.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-brand-200 px-3 py-1 text-xs text-brand-700"
                        >
                          <Vote size={12} /> Hasil
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!elections.length && (
                  <div className="rounded-2xl border border-dashed border-brand-200 p-10 text-center text-slate-400 md:col-span-2">
                    Belum ada pemilu
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "polls" && (
            <>
              {showPoll && (
                <form
                  onSubmit={createPoll}
                  className="mb-4 space-y-2 rounded-2xl border border-brand-100 bg-white p-4"
                >
                  <input
                    required
                    value={pQuestion}
                    onChange={(e) => setPQuestion(e.target.value)}
                    placeholder="Pertanyaan poll"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <textarea
                    required
                    value={pOptions}
                    onChange={(e) => setPOptions(e.target.value)}
                    rows={3}
                    placeholder="Opsi (satu per baris, min 2)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    Publish poll
                  </button>
                </form>
              )}

              <div className="space-y-4">
                {polls.map((poll) => {
                  const total = poll.options.reduce((s, o) => s + o.votesCount, 0) || 1;
                  return (
                    <div
                      key={poll.id}
                      className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm"
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-slate-900">{poll.question}</h3>
                        {poll.closed ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            CLOSED
                          </span>
                        ) : pengurus ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void closePoll(poll.id)}
                            className="text-[10px] font-medium text-rose-600 hover:underline"
                          >
                            Tutup
                          </button>
                        ) : null}
                      </div>
                      <p className="mb-3 text-xs text-slate-400">
                        {new Date(poll.createdAt).toLocaleString("id-ID")}
                        {poll._count ? ` · ${poll._count.votes} suara` : ""}
                      </p>
                      <div className="space-y-2">
                        {poll.options.map((opt) => (
                          <div key={opt.id}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="text-slate-700">{opt.label}</span>
                              <span className="text-xs text-slate-400">
                                {opt.votesCount} ·{" "}
                                {Math.round((opt.votesCount / total) * 100)}%
                              </span>
                            </div>
                            <div className="mb-1 h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-brand-500"
                                style={{
                                  width: `${Math.round((opt.votesCount / total) * 100)}%`,
                                }}
                              />
                            </div>
                            {!poll.closed && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void pollVote(poll.id, opt.id)}
                                className="text-xs font-medium text-brand-600 hover:underline"
                              >
                                Pilih
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!polls.length && (
                  <div className="rounded-2xl border border-dashed border-brand-200 p-10 text-center text-slate-400">
                    Belum ada polling
                  </div>
                )}
              </div>
            </>
          )}

          {selected && role === "KETUA" && (
            <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
              <div className="flex h-full w-full max-w-md flex-col bg-white p-5 shadow-2xl">
                <div className="mb-4 flex justify-between">
                  <h3 className="font-semibold">{selected.title}</h3>
                  <button type="button" onClick={() => setSelected(null)} className="text-sm text-slate-400">
                    Tutup
                  </button>
                </div>
                <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                  Tambah kandidat
                </p>
                <div className="mb-4 flex gap-2">
                  <select
                    value={candMember}
                    onChange={(e) => setCandMember(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Pilih anggota</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void addCandidate()}
                    className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    Add
                  </button>
                </div>
                <ul className="space-y-2 text-sm">
                  {selected.candidates.map((c) => (
                    <li key={c.id} className="rounded-xl bg-brand-50/80 px-3 py-2">
                      {c.member?.fullName ?? c.memberId}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {results && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex justify-between">
                  <h3 className="font-semibold">Hasil — {results.title}</h3>
                  <button type="button" onClick={() => setResults(null)} className="text-sm text-slate-400">
                    Tutup
                  </button>
                </div>
                <ul className="space-y-2">
                  {[...results.candidates]
                    .sort((a, b) => (b._count?.votes ?? 0) - (a._count?.votes ?? 0))
                    .map((c, i) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between rounded-xl bg-brand-50/60 px-3 py-2 text-sm"
                      >
                        <span>
                          #{i + 1} {c.member?.fullName ?? c.memberId}
                        </span>
                        <span className="font-semibold text-brand-700">
                          {c._count?.votes ?? 0} suara
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )}
        
    </DashboardShell>
  );
}
