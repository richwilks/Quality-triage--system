import './globals.css'

export const metadata = {
  title: 'Quality Triage',
  description: 'Defect tracking system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
