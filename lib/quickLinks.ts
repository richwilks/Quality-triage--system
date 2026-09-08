export type QuickLink = { href: string; label: string; primary?: boolean; restrictedTier?: boolean }

// Shared by the global Quick Access sheet (components/BottomNav.tsx, reachable
// from every page) - kept as plain data so the list only needs updating once.
// `restrictedTier: true` marks the links a restricted-access company's users
// (capped at RESTRICTED_USER_LIMIT seats, see lib/accessTier.ts) still see -
// their plan covers defects, projects, status reports and as-built drawings,
// not the rest of the app.
export const QUICK_LINKS: QuickLink[] = [
  { href: '/dashboard/projects/new', label: 'New Project', primary: true, restrictedTier: true },
  { href: '/dashboard/company-analytics', label: 'Company Performance' },
  { href: '/dashboard/new-defect-video', label: 'From Video', restrictedTier: true },
  { href: '/dashboard/drawings', label: 'Drawings', restrictedTier: true },
  { href: '/dashboard/my-defects', label: 'My Assigned' },
  { href: '/dashboard/project-spec', label: 'Project Spec' },
  { href: '/dashboard/standards', label: 'Standards Library' },
  { href: '/dashboard/reg38', label: 'Regulation 38', restrictedTier: true },
  { href: '/dashboard/golden-thread', label: 'Golden Thread' },
  { href: '/dashboard/inspection/active', label: 'Active Inspection' },
]
