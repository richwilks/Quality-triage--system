'use client'

import PageHeader from '@/components/PageHeader'

export default function CreditsPage() {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title="Credits" />
        <p className="mt-1 text-sm text-deck-dim">
          Third-party datasets and research InspectIQ's detection capabilities are built on.
        </p>

        <div className="mt-6 rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-deck-text">Structural defect detection (MBDD2025)</p>
          <p className="mt-2 text-sm text-deck-body">
            &ldquo;A dataset of building surface defects collected by UAVs for machine learning-based detection.&rdquo;{' '}
            <em>Scientific Data</em> 12, 2031 (2025).{' '}
            <a
              href="https://doi.org/10.1038/s41597-025-06318-5"
              target="_blank"
              rel="noopener noreferrer"
              className="text-deck-accent underline"
            >
              https://doi.org/10.1038/s41597-025-06318-5
            </a>
          </p>
          <p className="mt-2 text-xs text-deck-dim">
            Full author list available at the DOI above.
          </p>
          <p className="mt-3 text-xs text-deck-dim">
            Licensed under{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-deck-accent underline"
            >
              CC BY 4.0
            </a>
            . No changes have been made to the dataset itself.
          </p>
        </div>
      </div>
    </div>
  )
}
