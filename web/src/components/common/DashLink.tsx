import type { MouseEvent, ReactNode } from "react";
import { useDashboardNavigate } from "./DashboardShell";

/** Internal dashboard link — SPA navigate when inside DashboardApp */
export default function DashLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const navigate = useDashboardNavigate();

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!navigate || !href.startsWith("/dashboard")) return;
    e.preventDefault();
    navigate(href);
  }

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
