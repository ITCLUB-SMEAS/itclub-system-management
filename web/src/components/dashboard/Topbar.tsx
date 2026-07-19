import { useEffect, useState } from "react";
import { Bell, Search, CalendarDays } from "lucide-react";
import { communicationApi, type AppNotification } from "../../lib/api";
import DashLink from "../common/DashLink";

const API_URL = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export default function Topbar({
  title = "Dashboard",
  crumbs = ["Dashboard"],
}: {
  title?: string;
  crumbs?: string[];
}) {
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void communicationApi
      .notifications()
      .then(setNotifs)
      .catch(() => {});
  }, []);

  const unread = notifs.filter((n) => !n.isRead).length;

  async function mark(id: string) {
    try {
      await communicationApi.markRead(id);
      setNotifs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch {
      /* ignore */
    }
  }

  function downloadIcs() {
    const token =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("accessToken")
        : null;
    void fetch(`${API_URL}/integrations/calendar/sync.ics`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Gagal unduh kalender");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "itclub-kegiatan.ics";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => alert("Gagal unduh kalender ICS"));
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-50 bg-white/80 px-6 py-4 backdrop-blur">
      <div>
        <nav
          className="mb-1 flex items-center gap-1.5 text-xs text-slate-400"
          aria-label="Breadcrumb"
        >
          <ol className="flex items-center gap-1.5">
            {crumbs.map((c, i) => (
              <li key={`${c}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>/</span>}
                <span
                  className={i === crumbs.length - 1 ? "text-slate-600" : ""}
                  aria-current={i === crumbs.length - 1 ? "page" : undefined}
                >
                  {c}
                </span>
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="relative hidden max-w-xs flex-1 md:block">
          <label htmlFor="topbar-search" className="sr-only">
            Cari
          </label>
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            id="topbar-search"
            type="search"
            placeholder="Search..."
            className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <button
          type="button"
          onClick={downloadIcs}
          className="hidden items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 sm:flex"
          title="Download kalender ICS"
        >
          <CalendarDays size={16} aria-hidden />
          Kalender
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="relative rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-400"
            aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`}
            aria-expanded={open}
            aria-haspopup="true"
          >
            <Bell size={18} aria-hidden />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500" />
            )}
          </button>
          {open && (
            <div
              className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-xl"
              role="menu"
            >
              <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Notifikasi
              </div>
              <ul className="max-h-72 overflow-y-auto">
                {notifs.slice(0, 8).map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void mark(n.id)}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-brand-50/60 ${
                        n.isRead ? "text-slate-500" : "bg-brand-50/40 text-slate-800"
                      }`}
                    >
                      <p className="font-medium">{n.title}</p>
                      <p className="line-clamp-2 text-xs opacity-80">{n.body}</p>
                    </button>
                  </li>
                ))}
                {!notifs.length && (
                  <li className="px-4 py-8 text-center text-xs text-slate-400">
                    Tidak ada notifikasi
                  </li>
                )}
              </ul>
              <DashLink
                href="/dashboard/announcements"
                className="block border-t border-slate-100 px-4 py-2 text-center text-xs font-medium text-brand-600 hover:bg-brand-50"
              >
                Lihat semua
              </DashLink>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
