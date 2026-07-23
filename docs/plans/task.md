# Task Tracker

| Task | Status |
| :--- | :--- |
| 1: Fix inverted settlement math in `calculateCircleNetBalance` | [x] |
| 2: Fix inverted settlement math in `calculateMagicSettle` | [x] |
| 3: Add missing import in `PulseEngine.js` | [x] |
| 4: Migrate circle user names in `completeOnboarding` | [x] |
| 5: Fix broken activity feed sort in `Circles.jsx` | [x] |
| 6: Fix backwards settlement activity text in `Circles.jsx` | [x] |
| 7: Fix settlement amount display sign in `Circles.jsx` | [x] |
| 8: Fix status pill 3-state logic in `Circles.jsx` | [x] |
| 9: Fix "Your share" display for settlements in `Circles.jsx` | [x] |
| 10: Fix "1 days" grammar in `Overview.jsx` | [x] |
| 11: Fix non-unique IDs in `addCircleTransaction` | [x] |
| 12: Fix default hash route in `App.jsx` | [x] |
| 13: Fix mock data seed logic (no circles generated when seed data is OFF) | [x] |
| 14: Sync `state.user.id` from Supabase Auth to enable Realtime Auto-Track Listener | [x] |
| 15: Fix PWA Service Worker caching & place static assets in `public/` | [x] |
| 16: Configure Vercel deployment settings in `vercel.json` | [x] |
| 17: Add explicit **Enable Push Notifications** button with browser permission request & registration | [x] |
| 18: Add live **iOS Shortcut Webhook URL** card with Copy URL & Test Webhook buttons | [x] |
| 19: Rehaul & verify settlement sign math so paying debt reduces debt to 0 | [x] |
| 20: Convert Vercel serverless API functions (`api/*.js`) to ES Modules syntax to fix `FUNCTION_INVOCATION_FAILED` | [x] |
| 21: Rehaul Settle Modal in `Circles.jsx` to support dual directions: **I Paid (Repaid Debt)** vs **I Received (Collected)** + **Send Nudge** feature | [x] |
| 22: Clean up and remove ALL emojis across entire codebase (`src/`, `api/`, toasts, buttons, card headers), replacing with sleek inline SVGs & typography | [x] |
| 23: Rehaul `Activity.jsx` layout: Summary Stat Grid, Live Search, Horizontal Scroll Filters, Collapsible Peer IOUs Drawer, and Glassmorphism Modal Sheets | [x] |
| 24: Rehaul `Settings.jsx` layout: Responsive Profile Hero Banner, Horizontal Scroll Navigation Tabs, Liquid Glass Panels, and Modal Sheet Overlays | [x] |
| 25: Fix debt settlement cashflow mirroring across Circles, Friends, and Peer IOUs so collecting debt instantly updates main available cash balance | [x] |
| 26: Fix raw JSON push notification payload formatting in `api/send-reminder.js`, fix white action button CSS class in Circle Detail modal, and redesign Circle transaction history feed | [x] |
| 27: Integrated direct Web Push VAPID notification dispatch into `api/sms-log.js` so webhooks and webhook tests fire WebPush alerts 100% reliably | [x] |
| 28: Trigger native OS notification banners in `StateContext.jsx` for foreground realtime events & auto-sync Push Subscriptions during Test Webhook | [x] |
| 29: Remove unsupported `actions` key in Service Worker (`sw.js`) to fix Safari (iOS/macOS) WebPush silent notification rejection | [x] |
| 30: Force Service Worker cache update via `reg.update()` and add instant local notification verification on Re-sync tap | [x] |
| 31: Restored pure JSON payload in `api/sms-log.js` and updated Service Worker (`unispend-cache-v5`) to extract `amount` & `description` directly | [x] |
| 32: Eliminated triple duplicate notifications by bypassing `pending_transaction` in `send-reminder.js`, removing redundant triggers in `StateContext.jsx`, and adding `tag` deduplication in `sw.js` | [x] |
| 33: Dynamically re-generate Overview pulse cards on state changes so settled bills disappear instantly, and enhance recurring charge cards with explicit merchant names & charge details (`1bfa4c1`) | [x] |
