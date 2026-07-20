import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  FolderKanban,
  Trophy,
  Wallet,
  Megaphone,
  BookOpen,
  UserPlus,
  Vote,
  Package,
  Award,
  ClipboardCheck,
  Plug,
  Settings,
  HelpCircle,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { authApi, clearSession, getUser, hydrateSession, isPengurus } from "../../lib/api";
import { useEffect, useMemo, useState, type MouseEvent } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: string[]; // empty = all authenticated
};

const mainNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/dashboard/members",
    label: "Members",
    icon: Users,
    roles: ["KETUA", "WAKIL_KETUA", "SEKRETARIS", "BENDAHARA", "KEPALA_DIVISI"],
  },
  { href: "/dashboard/activities", label: "Presensi", icon: CalendarCheck },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/events", label: "Events", icon: Trophy },
  {
    href: "/dashboard/finance",
    label: "Keuangan",
    icon: Wallet,
    roles: ["KETUA", "BENDAHARA"],
  },
];

const moreNav: NavItem[] = [
  {
    href: "/dashboard/announcements",
    label: "Pengumuman",
    icon: Megaphone,
  },
  { href: "/dashboard/learning", label: "Learning", icon: BookOpen },
  { href: "/dashboard/gamification", label: "Gamifikasi", icon: Award },
  { href: "/dashboard/evaluation", label: "Evaluasi", icon: ClipboardCheck },
  {
    href: "/dashboard/recruitment",
    label: "Rekrutmen",
    icon: UserPlus,
    roles: ["KETUA", "WAKIL_KETUA", "SEKRETARIS", "BENDAHARA", "KEPALA_DIVISI"],
  },
  {
    href: "/dashboard/elections",
    label: "Pemilu",
    icon: Vote,
  },
  { href: "/dashboard/inventory", label: "Inventaris", icon: Package },
  { href: "/dashboard/integrations", label: "Integrasi", icon: Plug },
];

function allowed(item: NavItem, role?: string) {
  if (!item.roles || item.roles.length === 0) return true;
  return !!role && item.roles.includes(role);
}

export default function Sidebar({
  active = "/dashboard",
  onNavigate,
}: {
  active?: string;
  /** Client-side nav (SPA). Falls back to full page load. */
  onNavigate?: (path: string) => void;
}) {
  const [userName, setUserName] = useState("User");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      const u = (await hydrateSession()) ?? getUser();
      if (!u) {
        window.location.href = "/auth/sign-in";
        return;
      }
      setUserName(u.username);
      setEmail(u.email);
      setRole(u.role);
    })();
  }, []);

  const main = useMemo(() => mainNav.filter((i) => allowed(i, role)), [role]);
  const more = useMemo(() => moreNav.filter((i) => allowed(i, role)), [role]);

  function logout() {
    void authApi.logout().finally(() => {
      clearSession();
      window.location.href = "/auth/sign-in";
    });
  }

  function go(e: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!onNavigate) return;
    e.preventDefault();
    onNavigate(href);
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-brand-100 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white shadow-sm shadow-brand-200">
          IT
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">ITCLUB</p>
          <p className="text-[11px] text-slate-400">
            {role ? role.replaceAll("_", " ") : "Member"}
            {isPengurus(role) ? " · Pengurus" : ""}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Main Navigation
        </p>
        <ul className="space-y-0.5">
          {main.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.href;
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={(e) => go(e, item.href)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={18} className={isActive ? "text-brand-600" : "text-slate-400"} />
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>

        <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          More
        </p>
        <ul className="space-y-0.5">
          {more.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.href;
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={(e) => go(e, item.href)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={18} className={isActive ? "text-brand-600" : "text-slate-400"} />
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-brand-50 p-3">
        <a
          href="#"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <HelpCircle size={18} className="text-slate-400" />
          Help Center
        </a>
        <a
          href="#"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <Settings size={18} className="text-slate-400" />
          Settings
        </a>
        <button
          type="button"
          onClick={logout}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} />
          Logout
        </button>

        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-brand-50/80 px-3 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-200 text-xs font-bold text-brand-800">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{userName}</p>
            <p className="truncate text-[11px] text-slate-500">{email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
