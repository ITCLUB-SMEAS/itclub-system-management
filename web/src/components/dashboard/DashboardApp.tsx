import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { requireAuth } from "../../lib/api";
import DashboardShell from "../common/DashboardShell";
import DashboardHome from "./DashboardHome";
import MembersPage from "./MembersPage";
import ActivitiesPage from "./ActivitiesPage";
import ProjectsPage from "./ProjectsPage";
import EventsPage from "./EventsPage";
import FinancePage from "./FinancePage";
import AnnouncementsPage from "./AnnouncementsPage";
import LearningPage from "./LearningPage";
import GamificationPage from "./GamificationPage";
import EvaluationPage from "./EvaluationPage";
import RecruitmentPage from "./RecruitmentPage";
import ElectionsPage from "./ElectionsPage";
import InventoryPage from "./InventoryPage";
import IntegrationsPage from "./IntegrationsPage";
import PlaceholderPage from "./PlaceholderPage";

type Route = {
  path: string;
  title: string;
  crumbs: string[];
  Page: ComponentType;
};

const ROUTES: Route[] = [
  {
    path: "/dashboard",
    title: "Dashboard",
    crumbs: ["Dashboard", "Overview"],
    Page: DashboardHome,
  },
  {
    path: "/dashboard/members",
    title: "Members",
    crumbs: ["Dashboard", "Members"],
    Page: MembersPage,
  },
  {
    path: "/dashboard/activities",
    title: "Presensi",
    crumbs: ["Dashboard", "Presensi"],
    Page: ActivitiesPage,
  },
  {
    path: "/dashboard/projects",
    title: "Projects",
    crumbs: ["Dashboard", "Projects"],
    Page: ProjectsPage,
  },
  {
    path: "/dashboard/events",
    title: "Events",
    crumbs: ["Dashboard", "Events"],
    Page: EventsPage,
  },
  {
    path: "/dashboard/finance",
    title: "Keuangan",
    crumbs: ["Dashboard", "Keuangan"],
    Page: FinancePage,
  },
  {
    path: "/dashboard/announcements",
    title: "Pengumuman",
    crumbs: ["Dashboard", "Pengumuman"],
    Page: AnnouncementsPage,
  },
  {
    path: "/dashboard/learning",
    title: "Learning",
    crumbs: ["Dashboard", "Learning"],
    Page: LearningPage,
  },
  {
    path: "/dashboard/gamification",
    title: "Gamifikasi",
    crumbs: ["Dashboard", "Gamifikasi"],
    Page: GamificationPage,
  },
  {
    path: "/dashboard/evaluation",
    title: "Evaluasi",
    crumbs: ["Dashboard", "Evaluasi"],
    Page: EvaluationPage,
  },
  {
    path: "/dashboard/recruitment",
    title: "Rekrutmen",
    crumbs: ["Dashboard", "Rekrutmen"],
    Page: RecruitmentPage,
  },
  {
    path: "/dashboard/elections",
    title: "Pemilu",
    crumbs: ["Dashboard", "Pemilu"],
    Page: ElectionsPage,
  },
  {
    path: "/dashboard/inventory",
    title: "Inventaris",
    crumbs: ["Dashboard", "Inventaris"],
    Page: InventoryPage,
  },
  {
    path: "/dashboard/integrations",
    title: "Integrasi",
    crumbs: ["Dashboard", "Integrasi"],
    Page: IntegrationsPage,
  },
];

function matchRoute(pathname: string): Route {
  const clean = pathname.replace(/\/$/, "") || "/dashboard";
  const found = ROUTES.find((r) => r.path === clean);
  if (found) return found;
  // fallback placeholder for unknown dashboard paths
  return {
    path: clean,
    title: "Dashboard",
    crumbs: ["Dashboard"],
    Page: () => <PlaceholderPage title="Page" href={clean} />,
  };
}

function pathFromLocation() {
  if (typeof window === "undefined") return "/dashboard";
  return window.location.pathname.replace(/\/$/, "") || "/dashboard";
}

/**
 * Single React SPA for entire /dashboard/* tree.
 * Navigation updates state + history without remounting React root.
 */
export default function DashboardApp() {
  const [path, setPath] = useState(pathFromLocation);

  useEffect(() => {
    requireAuth();
  }, []);

  useEffect(() => {
    const onPop = () => setPath(pathFromLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((next: string) => {
    const clean = next.replace(/\/$/, "") || "/dashboard";
    if (clean === pathFromLocation()) {
      setPath(clean);
      return;
    }
    window.history.pushState({}, "", clean);
    setPath(clean);
  }, []);

  const route = useMemo(() => matchRoute(path), [path]);
  const { Page } = route;

  // Key by path so page state resets on navigate, but shell/sidebar stay mounted
  return (
    <DashboardShell
      active={route.path}
      title={route.title}
      crumbs={route.crumbs}
      navigate={navigate}
    >
      <Page key={route.path} />
    </DashboardShell>
  );
}
