export type QuickLink = { href: string; label: string; primary?: boolean }

// Shared by the global Quick Access sheet (components/BottomNav.tsx, reachable
// from every page) - kept as plain data so the list only needs updating once.
export const QUICK_LINKS: QuickLink[] = [
  { href: '/dashboard/projects/new', label: 'New Project', primary: true },
  { href: '/dashboard/company-analytics', label: 'Company Performance' },
  { href: '/dashboard/new-defect-video', label: 'From Video' },
  { href: '/dashboard/drawings', label: 'Drawings' },
  { href: '/dashboard/my-defects', label: 'My Assigned' },
  { href: '/dashboard/project-spec', label: 'Project Spec' },
  { href: '/dashboard/standards', label: 'Standards Library' },
  { href: '/dashboard/reg38', label: 'Regulation 38' },
  { href: '/dashboard/golden-thread', label: 'Golden Thread' },
  { href: '/dashboard/inspection/active', label: 'Active Inspection' },
]
