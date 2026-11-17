import type { LucideIcon } from 'lucide-react';

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return <div className="skeleton-rows" role="status" aria-label="Loading content" aria-busy="true">{Array.from({ length: count }, (_, index) => <div className="skeleton-row" key={index} aria-hidden="true"><span className="skeleton skeleton-icon"/><span className="skeleton skeleton-line"/><span className="skeleton skeleton-meta"/></div>)}</div>;
}

export function WorkspaceSkeleton() {
  return <div className="workspace-skeleton" role="status" aria-label="Opening workspace" aria-busy="true"><div className="skeleton-rail"><span className="skeleton skeleton-line"/><span className="skeleton skeleton-line"/><span className="skeleton skeleton-line"/></div><div className="skeleton-workspace"><div className="skeleton-header"/><div className="skeleton-page"><span className="skeleton skeleton-title"/><SkeletonRows/></div></div><span className="sr-only">Opening workspace…</span></div>;
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-state-icon"><Icon size={26}/></span><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}
