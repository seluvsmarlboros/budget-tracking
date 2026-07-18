# Design Document: UniSpend Premium Redesign & React Migration

**Date**: 2026-07-19  
**Status**: Approved

## 1. Goal & Objectives
Refactor UniSpend from a primitive, bug-prone Vanilla HTML/JS app into a premium, responsive, and robust budget-tracking application.

### Key Objectives
- **React + Vite Migration**: Standardize components and routing, replacing direct DOM-manipulation spaghetti.
- **Electric Teal & Cobalt Aesthetic**: Premium dark theme featuring modern typography (`Outfit`/`Inter`), glassmorphism cards, and interactive visual elements. (No purple colors).
- **Reactive State Sync**: Rebuild the state provider (`StateContext.jsx`) so that categories, transactions, friend splits, and settings updates propagate instantly and bug-free across all views.
- **Supabase Realtime Sync**: Maintain and improve the real-time database sync for partnerships, ledger settlements, and live notifications.
- **Vercel Build Compatibility**: Configure serverless functions and Single Page App routing in Vercel using `vercel.json`.

---

## 2. Design System & Aesthetics
A modern, tech-focused dark theme:
- **Base Background**: `hsl(222, 25%, 8%)` (Deep dark Obsidian slate)
- **Glassmorphic Cards**: `rgba(18, 23, 37, 0.65)` with `16px` backdrop-filter blur and `1px solid rgba(255, 255, 255, 0.06)` border.
- **Primary Accent**: `hsl(185, 95%, 48%)` (Neon Electric Cyan/Teal)
- **Accent Glow**: `hsla(185, 95%, 48%, 0.12)`
- **Success / Income**: `hsl(150, 75%, 42%)` (Emerald Green)
- **Expense / Warning**: `hsl(8, 85%, 60%)` (Coral Crimson Red)
- **Typography**: `Outfit` for headings and primary metrics; `Inter` for numbers and tabular forms.
- **Transitions**: Smooth width transitions on progress bars, hover translations on interactive buttons, and fade-in animations on route changes.

---

## 3. Architecture & File Layout
We will restructure the project source code as follows:
```
/
├── api/                   # Vercel serverless Node.js endpoints (unchanged location)
├── assets/                # App icons and media assets
├── public/                # Static assets (manifest.json, icons, sw.js)
├── src/
│   ├── main.jsx           # App entry point
│   ├── App.jsx            # Router and layout view switcher
│   ├── index.css          # Design system stylesheet, variables, and global classes
│   ├── components/        # Reusable UI elements (ProgressBar, Modal, etc.)
│   ├── contexts/
│   │   └── StateContext.jsx # Global React State Provider (replacing js/state.js)
│   ├── services/
│   │   ├── supabase.js    # Client integration with Supabase Auth/DB
│   │   ├── ai.js          # API parser for Groq, Gemini, and OpenRouter
│   │   ├── smsParser.js   # UPI SMS regex cleaner & parser
│   │   └── ocr.js         # Receipt reading engine
│   └── views/             # Major view screens:
│       ├── Overview.jsx   # Dashboard (Budget rings, Burn rate, AI bar, Recent)
│       ├── Log.jsx        # Logging form (Expense, Income, Splits, OCR upload)
│       ├── Friends.jsx    # Supabase connection panel, Settlements, Ledgers
│       ├── Activity.jsx   # Feed filter & Spike tracker
│       ├── Insights.jsx   # CSS/SVG Category spending charts
│       └── Settings.jsx   # Preferences, custom categories, AI model keys
├── package.json           # NPM scripts and React dependencies
├── vite.config.js         # Vite configuration
└── vercel.json            # Vercel serverless API & SPA rewrites configuration
```

---

## 4. Global State & Real-time Synchronization
- **State Store**: Exposes a reactive state object populated from `localStorage` on boot. Every update triggers an state reload, syncing state back to browser cache.
- **Supabase Realtime Channel**: Hooks into the `notifications` and `shared_expenses` tables, pushing updates directly to the state context and triggering immediate visual alerts (Toasts).

---

## 5. Deployment Setup (Vercel)
We will introduce `vercel.json` to manage API endpoints and routing:
1. **API Rewrites**: Maps `/api/*` requests to the Vercel Serverless Function folder `api/*`.
2. **Static Build**: Directs Vercel to compile React with `npm run build` and serve files out of the `dist/` directory.
3. **SPA Fallback**: Configures wildcards to route back to `index.html` for clean, client-side routing.
