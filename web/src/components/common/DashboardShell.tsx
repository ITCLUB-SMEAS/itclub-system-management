import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { ToastProvider } from "./ToastProvider";
import Sidebar from "../dashboard/Sidebar";
import Topbar from "../dashboard/Topbar";

type ShellCtx = {
  nested: boolean;
  navigate?: (path: string) => void;
};

const DashboardShellContext = createContext<ShellCtx>({ nested: false });

export function useDashboardNavigate() {
  return useContext(DashboardShellContext).navigate;
}

/**
 * Shared shell. Nested shells only render children (for SPA page components).
 */
export default function DashboardShell({
  active,
  title,
  crumbs,
  children,
  navigate,
}: {
  active: string;
  title: string;
  crumbs?: string[];
  children: ReactNode;
  /** SPA client navigation */
  navigate?: (path: string) => void;
}) {
  const parent = useContext(DashboardShellContext);

  // Already inside outer shell → only page body
  if (parent.nested) {
    return <>{children}</>;
  }

  return (
    <ToastProvider>
      <DashboardShellContext.Provider value={{ nested: true, navigate }}>
        <div className="flex h-screen overflow-hidden bg-canvas">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
          >
            Skip to content
          </a>
          <Sidebar active={active} onNavigate={navigate} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar title={title} crumbs={crumbs ?? ["Dashboard", title]} />
            <main
              id="main-content"
              className="flex-1 overflow-y-auto p-6"
              tabIndex={-1}
            >
              {children}
            </main>
          </div>
        </div>
      </DashboardShellContext.Provider>
    </ToastProvider>
  );
}
