# Design Specification: Bronze Glassmorphism & Gold Redesign

## 🎨 Visual Palette (Bronze & Gold)

We are discarding all purple and teal accents and replacing them with a premium dark-bronze and metallic gold aesthetic.

| Color Token | Value | Purpose |
|---|---|---|
| `--bg-body` | `hsl(20, 15%, 2%)` (Pure dark black with warm undertone) | Core application background |
| `--bg-card` | `rgba(26, 22, 20, 0.45)` (Bronze-tinted transparent gray) | Glassmorphic cards |
| `--accent` | `hsl(38, 55%, 52%)` (`#c5a059` Gold Accent) | Interactive indicators, active states |
| `--accent-gradient` | `linear-gradient(135deg, #b08d46, #e6c27e)` | Primary buttons, progress bar fills |
| `--border` | `rgba(197, 160, 89, 0.12)` (Thin gold line) | Standard card outlines |
| `--border-focus` | `rgba(197, 160, 89, 0.35)` | Active input rings |
| `--text-primary` | `hsl(38, 20%, 94%)` (`#f5eedc` Warm Linen) | High-contrast copy |
| `--text-secondary` | `hsl(38, 10%, 65%)` (`#b0a48a` Warm Sand) | Muted explanations, tables |
| `--red` | `hsl(18, 65%, 48%)` (`#c85e3a` Warm Copper-Amber) | Warning flags, overdrafts, negative cashflows |
| `--green` | `hsl(78, 25%, 52%)` (`#8fa878` Soft Olive Gold) | Savings goals, inflows, positive metrics |

## 📐 Layout Details & Grid Hierarchy
- **Card Spacing**: Set strict card spacing using flexbox and grid gaps to avoid massive empty margins.
- **Dashed Dividers**: Replaced high-contrast lines with `border-top: 1px dashed rgba(197, 160, 89, 0.15)`.
- **Text Alignment**: Standardized all values and subheadings to use relative alignment and consistent margin bindings.

## 🤖 AI Command Capsule
- **Container**:
  ```css
  .ai-capsule {
    display: flex;
    align-items: center;
    border-radius: 99px;
    background: rgba(18, 15, 12, 0.7);
    border: 1px solid rgba(197, 160, 89, 0.25);
    padding: 6px 6px 6px 16px;
    margin-bottom: 20px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  }
  ```
- **Input Field**:
  - Borderless style, flex 1, transparent background.
- **Submit Action**:
  - Embedded inside the capsule right-aligned. Styled as a premium circular gold pill button.

## 📋 Typography
- Include `Outfit` (sans-serif) for numbers and subheadings via Google Fonts link: `<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">`.
- Apply `text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; font-family: 'Outfit', sans-serif;` to card status indicators and sub-labels.
