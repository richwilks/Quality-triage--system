'use client'

import { useEffect, useState } from 'react'

// Chrome/Edge/Android fire `beforeinstallprompt` and let us trigger the
// native install dialog directly. iOS Safari has no equivalent API at all -
// Apple only allows Add to Home Screen via the manual Share-sheet action, so
// there is no way to "auto-install" there. This component detects which
// case applies and shows the right thing rather than overpromising a
// one-tap install on platforms that don't support it.
type InstallState = 'checking' | 'installed' | 'installable' | 'ios' | 'unsupported'

export default function InstallAppButton() {
  const [state, setState] = useState<InstallState>('checking')
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true

    if (isStandalone) {
      setState('installed')
      return
    }

    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e)
      setState('installable')
    }

    function handleAppInstalled() {
      setState('installed')
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Chrome fires beforeinstallprompt asynchronously - fall back to the iOS
    // instructions or the generic message if it hasn't fired shortly after load.
    const timer = setTimeout(() => {
      setState((current) => (current === 'checking' ? (isIOS ? 'ios' : 'unsupported') : current))
    }, 800)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      clearTimeout(timer)
    }
  }, [])

  async function handleInstallClick() {
    if (!deferredPrompt) return
    setInstalling(true)
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setInstalling(false)
  }

  if (state === 'checking') return null

  return (
    <div className="rounded-xl border border-deck-border bg-deck-surface p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-deck-dim">Install InspectIQ</p>

      {state === 'installed' && (
        <p className="mt-2 text-sm text-deck-body">
          <span className="font-medium text-deck-success">Installed</span> - InspectIQ is already on this device's
          home screen.
        </p>
      )}

      {state === 'installable' && (
        <>
          <p className="mt-1 text-sm text-deck-dim">
            Add InspectIQ to your home screen for one-tap access, full-screen with no browser bar.
          </p>
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className="mt-3 w-full rounded-md bg-deck-accent px-3 py-2 text-sm font-medium text-deck-bg disabled:opacity-50"
          >
            {installing ? 'Opening install prompt...' : 'Install app'}
          </button>
        </>
      )}

      {state === 'ios' && (
        <>
          <p className="mt-1 text-sm text-deck-dim">
            Apple doesn't allow apps to trigger this automatically, but it only takes two taps in Safari:
          </p>
          <ol className="mt-3 space-y-2 text-sm text-deck-body">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-deck-raised text-xs font-semibold text-deck-text">
                1
              </span>
              <span>
                Tap the <strong>Share</strong> icon
                <svg
                  className="mx-1 inline-block h-4 w-4 align-text-bottom"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 14v5a2 2 0 002 2h12a2 2 0 002-2v-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                in Safari's toolbar (not the Claude/browser menu - the square with an arrow pointing up).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-deck-raised text-xs font-semibold text-deck-text">
                2
              </span>
              <span>
                Scroll down and tap <strong>Add to Home Screen</strong>.
              </span>
            </li>
          </ol>
          <p className="mt-3 text-xs text-deck-dim">
            This only works in Safari, not inside another app's built-in browser - open this page in Safari directly
            first if you got here from a link.
          </p>
        </>
      )}

      {state === 'unsupported' && (
        <p className="mt-1 text-sm text-deck-dim">
          Your browser doesn't support one-tap install here. Check your browser's menu for an "Install app" or "Add
          to Home Screen" option - on Chrome/Edge look for an install icon in the address bar.
        </p>
      )}
    </div>
  )
}
