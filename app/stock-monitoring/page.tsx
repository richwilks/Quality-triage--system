// Top-level route so this page can be pinned to a home-screen icon with
// its own manifest/start_url (see ./layout.tsx) - the site-wide manifest's
// start_url is "/dashboard", so "Add to Home Screen" from any page nested
// under /dashboard always relaunches at /dashboard instead of the page
// that was actually bookmarked. Same underlying page as
// /dashboard/stock-monitor - see components/StockMonitorDashboard.tsx.
export { default } from '@/components/StockMonitorDashboard'
