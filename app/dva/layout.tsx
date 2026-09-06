// Deliberately minimal: DVA is its own standalone system, not part of the
// InspectIQ dashboard shell (no Sidebar, BottomNav, or company/project sync).
// It only borrows the InspectIQ brand mark. Sign-in is still enforced by the
// same middleware that gates the rest of the app.

export default function DvaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-deck-bg">
      <header className="border-b border-deck-border bg-deck-surface px-4 py-3 print:hidden">
        <div className="mx-auto flex max-w-4xl items-center gap-2">
          <img src="/icon-192.png" alt="InspectIQ" className="h-7 w-7 rounded-md object-contain" />
          <span className="text-sm font-bold text-deck-text">InspectIQ</span>
        </div>
      </header>
      {children}
    </div>
  )
}
