# design.md — iOS-Style Frosted Glass System for Ta_4

**Version:** 1.0 — 2026-06-02
**Inspired by:** Apple iOS 17/18 Materials (UIBlurEffectStyle: systemUltraThin / systemThin / systemMaterial / systemThick / systemUltraThick) + Apple HIG "Materials & Vibrancy"
**Reads with:** `spec.md` (functional spec)
**Predecessor reference:** Ta_1's `glass.css` — keep token NAMING similar so transition is smooth, but replace Ta_1's flat semi-transparent layers with **multi-tier iOS materials**.

---

## 1. Design Philosophy

iOS materials are NOT just "white box with blur." They are:

1. **Multi-tier opacity ladder** — five distinct material thicknesses, each with its own blur amount, saturation lift, and inner shadow.
2. **Vibrancy text** — text on glass uses semi-transparent colors that read the background underneath, giving the photo-like "color bleeds through" effect.
3. **Hairline edges** — every glass surface has a 0.5–1px semi-transparent inner edge that catches the light highlight, creating physical depth.
4. **Layered backdrops** — UI sits on a colored/photographic backdrop. Without something behind it, glass looks dead. Ta_4 backdrop = soft botanical photography blurred to 60% + dynamic color from current pool category.
5. **Movement is light, not motion** — animations are short (180–240ms), curves are gentle (`cubic-bezier(0.25, 0.1, 0.25, 1)`), no aggressive easings.

**Rule:** If you can put your hand behind the screen and feel like you'd see your skin tone tint the panel, the glass is working. If not, increase saturation or thin the material.

---

## 2. Color Tokens

```css
:root {
  /* ─── Ink (foreground) ─── */
  --ink-primary:    rgba(15, 17, 21, 0.92);
  --ink-secondary:  rgba(15, 17, 21, 0.65);
  --ink-tertiary:   rgba(15, 17, 21, 0.42);
  --ink-quaternary: rgba(15, 17, 21, 0.22);
  --ink-on-dark:    rgba(255, 255, 255, 0.92);

  /* ─── Brand accents (use sparingly — only for state & highlights) ─── */
  --accent-evergreen: #2A5D3F;   /* deep botanical green — primary CTA */
  --accent-petal:     #B85A6B;   /* dusty rose — secondary highlight */
  --accent-honey:     #C8A04D;   /* honey amber — warning / report CTA */

  /* ─── Stars / quality ─── */
  --star-filled:   #C8A04D;
  --star-empty:    var(--ink-quaternary);

  /* ─── Material backgrounds (iOS-inspired) ─── */
  --mat-ultraThin: rgba(255, 255, 255, 0.30);
  --mat-thin:      rgba(255, 255, 255, 0.50);
  --mat-regular:   rgba(255, 255, 255, 0.68);
  --mat-thick:     rgba(255, 255, 255, 0.80);
  --mat-ultraThick:rgba(255, 255, 255, 0.92);

  /* ─── Material backgrounds (dark variant, for night mode) ─── */
  --mat-ultraThin-dark: rgba(28, 28, 30, 0.40);
  --mat-thin-dark:      rgba(28, 28, 30, 0.58);
  --mat-regular-dark:   rgba(28, 28, 30, 0.72);
  --mat-thick-dark:     rgba(28, 28, 30, 0.84);
  --mat-ultraThick-dark:rgba(28, 28, 30, 0.94);

  /* ─── Blurs (the secret sauce — match material thickness) ─── */
  --blur-ultraThin: blur(20px) saturate(180%);
  --blur-thin:      blur(28px) saturate(180%);
  --blur-regular:   blur(40px) saturate(180%);
  --blur-thick:     blur(50px) saturate(200%);
  --blur-ultraThick:blur(60px) saturate(200%);

  /* ─── Hairlines & shadows ─── */
  --hairline-light:  rgba(255, 255, 255, 0.65);
  --hairline-dark:   rgba(15, 17, 21, 0.10);
  --shadow-glass-sm: 0 1px 2px rgba(15,17,21,0.04), 0 4px 12px rgba(15,17,21,0.06);
  --shadow-glass-md: 0 2px 4px rgba(15,17,21,0.05), 0 12px 32px rgba(15,17,21,0.10);
  --shadow-glass-lg: 0 4px 8px rgba(15,17,21,0.06), 0 24px 64px rgba(15,17,21,0.14);

  /* ─── Radii (iOS uses generous corners) ─── */
  --r-sheet: 28px;        /* full sheets, modal cards */
  --r-card:  20px;        /* plant cards, content cards */
  --r-chip:  14px;        /* swatch chips, tags */
  --r-pill:  9999px;      /* status pills, action buttons */
  --r-input: 12px;        /* text fields */

  /* ─── Typography ─── */
  --font-display: "Playfair Display", "Noto Serif TC", Georgia, serif;
  --font-body:    -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Noto Sans TC", system-ui, sans-serif;
  --font-mono:    ui-monospace, "SF Mono", Menlo, monospace;
  --font-latin:   "Playfair Display", Georgia, serif;

  /* ─── Motion ─── */
  --ease-glass:  cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --dur-quick:   180ms;
  --dur-normal:  240ms;
  --dur-slow:    400ms;

  /* ─── Spacing scale (4-pt grid) ─── */
  --s-1: 4px;   --s-2: 8px;   --s-3: 12px;  --s-4: 16px;
  --s-5: 24px;  --s-6: 32px;  --s-7: 48px;  --s-8: 64px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --ink-primary:    rgba(255, 255, 255, 0.94);
    --ink-secondary:  rgba(255, 255, 255, 0.65);
    --ink-tertiary:   rgba(255, 255, 255, 0.42);
    --ink-quaternary: rgba(255, 255, 255, 0.22);
    --mat-ultraThin:  var(--mat-ultraThin-dark);
    --mat-thin:       var(--mat-thin-dark);
    --mat-regular:    var(--mat-regular-dark);
    --mat-thick:      var(--mat-thick-dark);
    --mat-ultraThick: var(--mat-ultraThick-dark);
    --hairline-light: rgba(255, 255, 255, 0.10);
    --hairline-dark:  rgba(0, 0, 0, 0.40);
  }
}
```

---

## 3. Glass Utility Classes

```css
/* Reusable material classes — apply where glass surfaces are needed. */

.glass {
  /* Default: regular material */
  background: var(--mat-regular);
  backdrop-filter: var(--blur-regular);
  -webkit-backdrop-filter: var(--blur-regular);  /* Safari */
  border: 0.5px solid var(--hairline-dark);
  box-shadow:
    inset 0 0.5px 0 var(--hairline-light),
    var(--shadow-glass-md);
  border-radius: var(--r-card);
}

.glass--ultraThin { background: var(--mat-ultraThin); backdrop-filter: var(--blur-ultraThin); -webkit-backdrop-filter: var(--blur-ultraThin); }
.glass--thin      { background: var(--mat-thin);      backdrop-filter: var(--blur-thin);      -webkit-backdrop-filter: var(--blur-thin); }
.glass--regular   { background: var(--mat-regular);   backdrop-filter: var(--blur-regular);   -webkit-backdrop-filter: var(--blur-regular); }
.glass--thick     { background: var(--mat-thick);     backdrop-filter: var(--blur-thick);     -webkit-backdrop-filter: var(--blur-thick); }
.glass--ultraThick{ background: var(--mat-ultraThick);backdrop-filter: var(--blur-ultraThick);-webkit-backdrop-filter: var(--blur-ultraThick); }

/* Vibrancy text — sits on glass, picks up tint from backdrop */
.vibrancy-primary   { color: var(--ink-primary);   mix-blend-mode: plus-darker; }
.vibrancy-secondary { color: var(--ink-secondary); mix-blend-mode: plus-darker; }

/* In dark mode, switch blend mode */
@media (prefers-color-scheme: dark) {
  .vibrancy-primary   { mix-blend-mode: plus-lighter; }
  .vibrancy-secondary { mix-blend-mode: plus-lighter; }
}
```

**Important Safari note:** `backdrop-filter` requires `-webkit-` prefix on Safari ≤17. The utility class above includes both.

---

## 4. Backdrop (the canvas under the glass)

Without a visually rich backdrop, frosted glass looks flat. Two layers:

```css
.app-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    /* Top: subtle botanical color wash, rotates by tab */
    radial-gradient(ellipse 80% 60% at 20% 20%, rgba(42, 93, 63, 0.20) 0%, transparent 60%),
    radial-gradient(ellipse 60% 80% at 80% 80%, rgba(184, 90, 107, 0.15) 0%, transparent 60%),
    radial-gradient(ellipse 40% 40% at 60% 40%, rgba(200, 160, 77, 0.10) 0%, transparent 50%),
    /* Base: soft warm gradient */
    linear-gradient(180deg, #F5F2EB 0%, #EBE6DC 50%, #E2DBCB 100%);
}

/* Optional photographic underlay — only if the user uploaded a reference image,
   display it heavily blurred behind the result panels for connective tissue */
.app-backdrop--with-reference {
  background-image: var(--reference-image-url);
  background-size: cover;
  background-position: center;
  filter: blur(60px) saturate(140%) brightness(1.05);
  opacity: 0.35;
}
```

**Backdrop accent rotation:** As user switches between 灌木 / 草本 / 地被 tabs, animate the radial gradient hue (250ms ease-glass) to subtly distinguish context without redrawing layout.

---

## 5. Key Component Specs

### 5.1 Plant Card (≥4★ match)

```
┌──────────────────────────────────────────┐  <- glass--regular, --r-card
│  ┌────────┐                              │
│  │ photo  │  野牡丹                       │  <- Playfair / 22px / vibrancy-primary
│  │ 80×80  │  *Melastoma candidum*         │  <- Latin / 14px / vibrancy-secondary italic
│  │ rounded│  ●●●●○  82.5                  │  <- stars + score pill
│  └────────┘                              │
│                                          │
│  葉形:  橢圓卵形,5-7脈,硬毛               │  <- 14px / vibrancy-secondary
│  高度:  1-3m   ·   花期:  夏 (6-8月)      │
│  花色:  ◯紫 ◯紅      葉色: ◯綠            │  <- inline color dots, --r-pill
│                                          │
│  ┌────[ 對應到 P1, P3 ]──────────────┐    │  <- hairline divider, then
│  │ 匹配理由: 同為灌木叢生型,葉脈相  │    │     vibrancy-secondary footer
│  │ 似,夏季穗狀花序對應...           │    │
│  └────────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

- **Hover:** lift `translateY(-2px)`, shadow `--shadow-glass-lg`, 200ms.
- **Click:** flips card (Y-axis 3D rotate 300ms) to show DB notes, ecology, source suggestion.
- **Star pill:** background `--mat-ultraThin`, fixed width, stars use `--star-filled` solid.

### 5.2 Color Tray (drag-drop palette UI)

```
┌─ Available swatches (glass--thin) ───────────────────────┐
│  ◯紅  ◯橙  ◯黃  ◯綠  ◯藍  ◯紫  ◯粉  ◯白  ◯黑  ◯棕  ◯灰  ◯銀
└──────────────────────────────────────────────────────────┘

      ↓ drag                  ↓ drag

┌─ Selected palette (glass--thick, --r-pill, animated) ────┐
│        ◯紫    ◯粉              [ × clear all ]            │
│        ↑ click to remove                                  │
└──────────────────────────────────────────────────────────┘

▸ 9 / 25 株符合選色   <- live count, vibrancy-secondary
```

- **Drag mechanic:** `@dnd-kit` recommended. Drag preview = solid colored disk 32×32 with spring scale 1.1.
- **Drop animation:** swatch flies into tray, then a 320ms `ease-spring` bounce into final slot.
- **Empty tray state:** "拖入色票以縮小範圍 — 不選等於全部" placeholder in `--ink-tertiary`.
- **Accessibility:** Each swatch has both color dot AND label name. Keyboard: Tab to swatch, Space to add to tray, Esc to clear.
- **Pantone input:** Below tray, expandable "+ Pantone 色號" → text input. Submits to `palette_advisor` agent for soft mapping; does not affect deterministic filter.

### 5.3 Upload Dropzone

```
╔══════════════════════════════════════════╗  <- glass--ultraThin, dashed border
║                                          ║     animated when dragging
║         📷  拖入你想模仿的植物景觀         ║
║                                          ║
║         或  [選擇圖片]                    ║
║                                          ║
║         JPG / PNG / WebP · 最大 10 MB     ║
║                                          ║
╚══════════════════════════════════════════╝
```

- **Drag-over state:** border solid `--accent-evergreen`, background lifts to `--mat-thin`, scale 1.02.
- **Uploading state:** show inline progress arc (SVG, animated stroke), label "壓縮中... → 辨識中..."

### 5.4 Identified List (transparency layer — ALWAYS visible)

```
┌─ AI 看到了 15 株植物 (Sonnet 4.6)  [展開 ▼] ─┐
│ P1 銀葉菊         草本    羽狀深裂, 0.3-0.6m  │
│ P2 觀賞蔥         草本    線形基生, 0.4-0.8m  │
│ ...                                          │
└──────────────────────────────────────────────┘
```

- Folded by default to 3 rows + "展開全部" CTA.
- Even if pool[*] is empty, this section MUST render. The user must see what AI saw.
- Glass: `--mat-ultraThin`, no shadow (recedes), 14px text.

### 5.5 Empty State Card

```
┌─ 灌木 ─────────────────────────────────────┐  <- glass--thin, dashed left edge
│                                            │
│  目前 DB 25/1000 種,本類別暫無強匹配。     │
│                                            │
│  進度  ████░░░░░░░░░░░░░░░░  25/1000        │
│                                            │
│  [ 也可以參考(弱匹配 3★) ▼ ]                │  <- if any 3★ exist
│  [ 回報您要找的植物 →    ]                  │
│                                            │
└────────────────────────────────────────────┘
```

### 5.6 Header

```
[ 植徑 Ta_4 ]       DB v2026.05.30 · 25 種        [ ↻ 新查詢 ]
```

- Logo: Playfair display, 24px, `vibrancy-primary`
- DB chip: pill, `--mat-thin`, mono font
- Sticky on scroll, glass `--ultraThick` to remain readable

---

## 6. Layout (responsive)

```
   < 600px (mobile)              ≥ 1024px (desktop)
   ┌─────────────────┐           ┌─────────┬───────────────┐
   │ Header (sticky) │           │ Header (sticky)         │
   ├─────────────────┤           ├─────────┴───────────────┤
   │ Upload          │           │ Upload (40% width)      │
   ├─────────────────┤           ├──────────┬──────────────┤
   │ Identified      │           │ Identif. │ Color tray   │
   ├─────────────────┤           ├──────────┴──────────────┤
   │ Color tray      │           │ Tabs: 灌木 草本 地被    │
   ├─────────────────┤           ├──────────────────────────┤
   │ Tabs            │           │ Card grid 3-col          │
   ├─────────────────┤           ├──────────────────────────┤
   │ Cards (1-col)   │           │ Weak match accordion     │
   └─────────────────┘           └──────────────────────────┘
```

Breakpoints: 600px (mobile→tablet), 1024px (tablet→desktop). Use CSS grid.

---

## 7. Animation Principles

| Element | Trigger | Duration | Easing |
|---|---|---|---|
| Card hover lift | mouseenter | 200ms | `--ease-glass` |
| Card flip detail | click | 300ms | `--ease-glass` |
| Swatch drag preview | drag | — | follows pointer 1:1 |
| Swatch drop into tray | dragend | 320ms | `--ease-spring` |
| Tab change (灌木→草本) | tab click | 250ms | `--ease-glass`, fade+slide 12px |
| Backdrop hue rotate | tab change | 250ms | `--ease-glass` |
| Empty state appearance | data load | 240ms | `--ease-glass`, fade+scale 0.96→1 |
| Reduced motion (`prefers-reduced-motion`) | — | 0ms | fade only |

---

## 8. Accessibility & Contrast Rules

iOS glass surfaces can fail WCAG if not handled. Rules:

1. **Never use `--mat-ultraThin` for body text background.** Minimum `--mat-thin` for any text-bearing surface.
2. **Body text** uses `--ink-primary` (0.92 opacity → ≥ 7:1 against `--mat-regular` over typical backdrop).
3. **Tertiary metadata** (color names, dates) may use `--ink-secondary` but MUST also have an icon or shape cue.
4. **Color swatches** always have a text label inline. Color is NEVER the sole differentiator.
5. **Focus ring:** 2px solid `--accent-evergreen` + 2px outer offset. Visible on glass.
6. **Reduced transparency mode** (`prefers-reduced-transparency`):
   ```css
   @media (prefers-reduced-transparency: reduce) {
     .glass { backdrop-filter: none; background: rgba(245, 242, 235, 0.96); }
   }
   ```

---

## 9. What NOT to Do

- ❌ No neumorphism / soft shadows that look like extruded clay. Glass is FLAT but layered.
- ❌ No gradient text. Vibrancy text uses solid color with blend mode.
- ❌ No emoji-heavy interface. Botanical icons (SVG line art) only.
- ❌ No drop shadows on text. Use vibrancy + opacity.
- ❌ No more than 3 glass material tiers in a single viewport — anything more confuses depth perception.
- ❌ No saturation > 200% — colors start looking radioactive.
- ❌ No accent color for category gates. Categories distinguish by typography rhythm and icon, NOT by color (so palette swatches remain the dominant color signal).
