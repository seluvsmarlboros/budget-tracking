# Bronze Glassmorphism & Gold Redesign Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Redesign the entire UniSpend React application to use a premium, human-like black and bronze-glassmorphic style with gold highlights.

**Architecture:** Update central CSS design tokens in `src/index.css` to introduce pitch black, warm bronze transparency with high frosted blur saturation, and copper/olive states. Standardize view files to render unified layout parameters, clean up alignment issues, and embed the "Ask AI" button inline inside a pill capsule.

**Tech Stack:** React, CSS Custom Properties, Vite

---

### Task 1: Setup Isolated Worktree
**Files:**
- Create: `.worktrees/bronze-gold-redesign` (via worktree creation)

**Step 1: Create worktree**
Run:
```bash
git worktree add -b feature/bronze-gold-redesign .worktrees/bronze-gold-redesign main
```
Expected: New worktree directory created.

**Step 2: Commit init**
Run:
```bash
git add . && git commit -m "chore: initialize worktree"
```

---

### Task 2: CSS Tokens & Global Redesign
**Files:**
- Modify: `src/index.css`

**Step 1: Replace visual CSS rules**
Update custom properties block:
```css
:root {
  --bg-body: hsl(20, 15%, 2%);
  --bg-card: rgba(26, 22, 20, 0.45);
  --accent: hsl(38, 55%, 52%);
  --accent-hover: hsl(38, 65%, 60%);
  --accent-light: rgba(197, 160, 89, 0.08);
  --accent-gradient: linear-gradient(135deg, #b08d46 0%, #e6c27e 100%);
  
  --border: rgba(197, 160, 89, 0.12);
  --border-focus: rgba(197, 160, 89, 0.35);
  
  --text-primary: hsl(38, 20%, 94%);
  --text-secondary: hsl(38, 10%, 65%);
  --text-muted: hsl(38, 8%, 45%);
  
  --red: hsl(18, 65%, 48%);
  --green: hsl(78, 25%, 52%);
  --radius: 12px;
  --radius-sm: 8px;
}
```

Apply high frosted-glass properties to `.card` and `.glass-card`:
```css
.card, .glass-card {
  background: var(--bg-card);
  backdrop-filter: blur(24px) saturate(140%);
  border: 1px solid var(--border);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8);
  border-radius: var(--radius);
}
```

Add AI Capsule input wrapper properties:
```css
.ai-capsule {
  display: flex;
  align-items: center;
  border-radius: 99px;
  background: rgba(18, 15, 12, 0.7);
  border: 1px solid rgba(197, 160, 89, 0.25);
  padding: 6px 6px 6px 16px;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}
.ai-capsule input {
  flex: 1;
  background: transparent !important;
  border: none !important;
  outline: none !important;
  color: var(--text-primary);
  font-size: 13.5px;
  padding: 8px 0;
}
.ai-capsule button {
  border-radius: 99px;
  background: var(--accent-gradient);
  color: #000;
  font-weight: 700;
  border: none;
  padding: 8px 20px;
  cursor: pointer;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: opacity 0.2s;
}
```

**Step 2: Commit Task 2**
Run:
```bash
git add src/index.css
git commit -m "style: define bronze-glass and gold accent CSS tokens"
```

---

### Task 3: App Navigation Sidebar styling
**Files:**
- Modify: `src/App.jsx`
- Modify: `index.html`

**Step 1: Check in index.html to load Outfit font**
Modify: `index.html` to add google font links:
```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

**Step 2: Style navigation items in App.jsx**
Replace active sidebar classes to highlight active routes in elegant gold underline or glow capsule.
Ensure layout matches Outfit font style and proper header margins.

**Step 3: Commit Task 3**
Run:
```bash
git add index.html src/App.jsx
git commit -m "style: update App navigation and load Outfit fonts"
```

---

### Task 4: Refactor Overview view
**Files:**
- Modify: `src/views/Overview.jsx`

**Step 1: Update AI Command input to use .ai-capsule layout**
Refactor the input row:
```jsx
<form onSubmit={handleCommandSubmit} className="ai-capsule">
  <input
    type="text"
    placeholder="Ask AI: 'add 120 for lunch' or 'generate tips'..."
    value={commandText}
    onChange={e => setCommandText(e.target.value)}
    disabled={loading}
  />
  <button type="submit" disabled={loading}>
    {loading ? 'Thinking...' : 'Ask AI'}
  </button>
</form>
```

**Step 2: Modify colors & progress elements**
Ensure budget fill uses `var(--accent-gradient)`, warning banners use copper background borders, and widget stats list is clean and readable.

**Step 3: Commit Task 4**
Run:
```bash
git add src/views/Overview.jsx
git commit -m "style: embed AI command capsule and gold progress bars in Overview"
```

---

### Task 5: Refactor Log view
**Files:**
- Modify: `src/views/Log.jsx`

**Step 1: Update forms & scan elements**
Clean up paddings, border styles, and replace teal colors inside input fields/switches with golden warm tones.

**Step 2: Commit Task 5**
Run:
```bash
git add src/views/Log.jsx
git commit -m "style: theme transaction log views in gold/bronze"
```

---

### Task 6: Refactor Friends view
**Files:**
- Modify: `src/views/Friends.jsx`

**Step 1: Update collaborative pages**
Update invitation codes, input split fields, and transaction items inside the live friends feed to match glassmorphic bronze colors.

**Step 2: Commit Task 6**
Run:
```bash
git add src/views/Friends.jsx
git commit -m "style: adjust Friends group lists to luxury theme"
```

---

### Task 7: Refactor Insights view
**Files:**
- Modify: `src/views/Insights.jsx`

**Step 1: Theme analytics bars**
Change `COBALT_TEAL_PALETTE` in `src/views/Insights.jsx` to a gorgeous gradient list of warm metallic golds and bronze:
```javascript
const COBALT_TEAL_PALETTE = [
  '#b08d46', // Medium Gold
  '#e6c27e', // Champagne Gold
  '#8c6e3b', // Deep Amber Gold
  '#d4b978', // Warm Gold
  '#6e562c', // Dark Bronze
  '#998052'  // Sand Gold
];
```

**Step 2: Commit Task 7**
Run:
```bash
git add src/views/Insights.jsx
git commit -m "style: change insights chart segments palette to bronze gold gradient"
```

---

### Task 8: Refactor Settings view
**Files:**
- Modify: `src/views/Settings.jsx`

**Step 1: Update Settings card layouts**
Clean up tab navigation pills, sync check fields, and update backup controls.

**Step 2: Commit Task 8**
Run:
```bash
git add src/views/Settings.jsx
git commit -m "style: customize Settings configuration layouts in bronze themes"
```

---

### Task 9: Verification & Integration
**Files:**
- Modify: `docs/plans/task.md`

**Step 1: Run project build check**
Run:
```bash
npm run build
```
Verify exit code is 0.

**Step 2: Merge branch feature/bronze-gold-redesign**
Checkout `main` and merge. Remove worktree.

**Step 3: Commit final layout tracker**
Run:
```bash
git add docs/plans/task.md
git commit -m "docs: finalize bronze gold redesign plan checklist"
```
