// Minimal service worker for stock-monitor signal push alerts. Registered
// from app/dashboard/stock-monitor/page.tsx when the user enables push
// notifications on that device.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Stock signal', {
      body: data.body || '',
      icon: '/icon-192.png',
      data: { url: data.url || '/dashboard/stock-monitor' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard/stock-monitor'
  event.waitUntil(clients.openWindow(url))
})
