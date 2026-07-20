import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, GitBranch, MessageSquare } from "lucide-react";
import DashboardShell from "../common/DashboardShell";
import { useToast } from "../common/ToastProvider";
import { requireAuth, isPengurus, integrationsApi } from "../../lib/api";

export default function IntegrationsPage() {
  const toast = useToast();
  const [pengurus, setPengurus] = useState(false);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("ITCLUB");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Awaited<
    ReturnType<typeof integrationsApi.status>
  > | null>(null);

  useEffect(() => {
    const u = requireAuth();
    setPengurus(isPengurus(u.role));
    if (isPengurus(u.role)) {
      void integrationsApi.status().then(setStatus).catch(() => {});
    }
  }, []);

  async function downloadIcs() {
    try {
      const blob = await integrationsApi.downloadIcs();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "itclub-kegiatan.ics";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Kalender ICS diunduh");
    } catch {
      toast.error("Gagal unduh kalender ICS");
    }
  }

  async function sendDiscord(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    try {
      const res = (await integrationsApi.discordNotify({
        message,
        title: title || undefined,
      })) as { queued?: boolean; stub?: boolean };
      if (res.stub) {
        toast.info("Discord stub — set DISCORD_WEBHOOK_URL di API");
      } else {
        toast.success("Notifikasi Discord terkirim");
      }
      setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal kirim Discord");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell
      active="/dashboard/integrations"
      title="Integrasi"
      crumbs={["Dashboard", "Integrasi"]}
    >
      {status && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded-full px-3 py-1 font-medium ${
              status.github.configured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            GitHub webhook: {status.github.configured ? "OK" : "belum di-set"}
          </span>
          <span
            className={`rounded-full px-3 py-1 font-medium ${
              status.discord.configured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            Discord: {status.discord.configured ? "OK" : "stub"}
          </span>
          <span className="rounded-full bg-slate-50 px-3 py-1 text-slate-600">
            ICS: {status.calendar.icsPath}
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <CalendarDays size={20} aria-hidden />
          </div>
          <h2 className="font-semibold text-slate-900">Google / Apple Calendar</h2>
          <p className="mt-1 text-xs text-slate-500">
            {status?.calendar.googleCalendar.note ??
              "Export jadwal kegiatan + event sebagai file ICS (alarm H-1)."}
          </p>
          <button
            type="button"
            onClick={() => void downloadIcs()}
            className="mt-4 w-full rounded-full bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Download .ics
          </button>
          <p className="mt-2 break-all text-[10px] text-slate-400">
            GET /integrations/calendar/sync.ics
          </p>
        </div>

        <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <GitBranch size={20} aria-hidden />
          </div>
          <h2 className="font-semibold text-slate-900">GitHub Webhook</h2>
          <p className="mt-1 text-xs text-slate-500">
            Push event commit → update githubCommitCount di submission repo.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-slate-600">
            <li>Repo Settings → Webhooks → Add</li>
            <li>
              Payload URL:{" "}
              <code className="rounded bg-slate-100 px-1">
                {"{API}"}/integrations/github/webhook
              </code>
            </li>
            <li>Content type: application/json</li>
            <li>Secret = GITHUB_WEBHOOK_SECRET</li>
            <li>Event: Just the push event</li>
          </ol>
        </div>

        <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <MessageSquare size={20} aria-hidden />
          </div>
          <h2 className="font-semibold text-slate-900">Discord Notify</h2>
          <p className="mt-1 text-xs text-slate-500">
            Set DISCORD_WEBHOOK_URL di API. Pengurus bisa kirim pesan manual.
          </p>
          {pengurus ? (
            <form onSubmit={sendDiscord} className="mt-3 space-y-2">
              <label className="sr-only" htmlFor="discord-title">
                Judul
              </label>
              <input
                id="discord-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Judul embed"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <label className="sr-only" htmlFor="discord-msg">
                Pesan
              </label>
              <textarea
                id="discord-msg"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Pesan ke channel Discord"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-brand-600 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Kirim
              </button>
            </form>
          ) : (
            <p className="mt-3 text-xs text-slate-400">Hanya pengurus</p>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
