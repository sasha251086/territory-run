# Territory Run — Paper Atlas Style Guide

**Version:** 1.0  
**Date:** 25 June 2026  
**Figma file structure:** `Territory Run / Paper Atlas / Components`  
**Tokens import:** `docs/design/paper-atlas.tokens.json` (Figma Tokens / Variables)

---

## 1. Brand & art direction

**One-liner:** «Ты не просто пробежал — ты расширил карту города.»

**Visual metaphor:** vintage city atlas + field journal. Territory cells = ink stamps on paper. UI = editorial magazine, not gaming HUD.

**Do**
- Cream backgrounds, sage green as single brand accent
- Serif headlines (Fraunces), sans body (DM Sans), mono for numbers
- Game colors **only** on map hexes, hex badges, celebration, PvP feed accents
- Soft paper shadows, no blur, no neon

**Don't**
- Lime `#8dff42`, purple/cyan accents in UI chrome
- More than 1 colored CTA per screen
- Grey wireframe pills as primary buttons
- `backdrop-filter: blur`

---

## 2. Figma setup checklist

### 2.1 Create variable collections

| Collection | Mode(s) |
|------------|---------|
| `color/canvas` | Light (default) |
| `color/ink` | Light |
| `color/game` | Light |
| `color/cta` | Light |
| `radius` | — |
| `space` | — |

Import values from `paper-atlas.tokens.json` or copy from §3.

### 2.2 Text styles (Figma → Text styles)

| Style name | Font | Size | Weight | Line | Letter | Use |
|------------|------|------|--------|------|--------|-----|
| `Display/H1` | Fraunces | 28 | 600 | 120% | -0.02em | Celebration headline |
| `Display/H2` | Fraunces | 22 | 600 | 120% | -0.01em | Cell popup title |
| `Display/H3` | Fraunces | 18 | 600 | 125% | 0 | Page titles |
| `Body/Large` | DM Sans | 16 | 500 | 145% | 0 | Feed body, callouts |
| `Body/Default` | DM Sans | 15 | 400 | 145% | 0 | General UI |
| `Body/Small` | DM Sans | 13 | 400 | 140% | 0 | Meta, timestamps |
| `Label/Caps` | DM Sans | 11 | 600 | 100% | 0.06em | Section labels (uppercase) |
| `Data/Large` | JetBrains Mono | 24 | 600 | 120% | 0 | Celebration stats |
| `Data/Default` | JetBrains Mono | 15 | 500 | 120% | 0 | Hex badge, influence |
| `Data/Small` | JetBrains Mono | 13 | 500 | 120% | 0 | HUD counters |

### 2.3 Effect styles

| Name | Value |
|------|-------|
| `Shadow/Card` | X0 Y4 Blur20 #2C2825 @6% |
| `Shadow/Sheet` | X0 Y-8 Blur32 #2C2825 @10% |
| `Shadow/Celebration` | X0 Y12 Blur40 #2C2825 @12% |

### 2.4 Grid & frame

- **Mobile frame:** 390 × 844 (iPhone 14)
- **Content width:** 358px (16px side padding)
- **8pt spacing grid**
- **Component corner radius default:** 12px (`radius/md`)

---

## 3. Design tokens (copy-paste)

### 3.1 Color

```
Canvas
  bg              #F7F4EE
  surface         #FFFFFF
  surface-muted   #F0EBE3

Ink
  primary         #2C2825
  secondary       #5C564E
  muted           #8A8378

Line
  soft            #E5DDD2
  medium          #D4C9BA
  strong          #2C2825

Brand
  sage            #5B8A72
  sage-dark       #466B58
  sage-light      #E8F0EB

Game (map + semantic UI only)
  own             #5B8A72   fill: rgba(91,138,114,0.22)
  rival           #6B7FA3   fill: rgba(107,127,163,0.20)
  contest         #C4A35A   fill: #FBF3E0
  danger          #B85C5C   fill: #F9EDED

CTA
  primary-bg      #5B8A72
  primary-text    #FFFFFF
  secondary-bg    #F0EBE3
  secondary-text  #2C2825
```

### 3.2 Typography (Google Fonts)

- **Fraunces** — `opsz` 9..144, `wght` 600 for display
- **DM Sans** — 400, 500, 600
- **JetBrains Mono** — 500, 600

### 3.3 Spacing scale

`4 · 8 · 12 · 16 · 24 · 32 · 48`

### 3.4 Radius

`8 (sm) · 12 (md) · 16 (lg) · 20 (xl) · 999 (pill) · 6 (hex clip)`

---

## 4. Shared primitives (build first in Figma)

### 4.1 Hex badge

Used in ActivityCard, Feed, map legend.

| Property | Value |
|----------|-------|
| Size | 48 × 48 px |
| Shape | Regular hexagon (point-top), corner clip 6px or SVG |
| Border | 1.5px `game/own` or state color |
| Fill | state fill token |
| Number | `Data/Default`, centered |
| Min tap | 48px |

**Variants (component property `state`):**

| State | Fill | Border | Text |
|-------|------|--------|------|
| `default` | `#F0EBE3` | `#D4C9BA` | `#8A8378` (—) |
| `captured` | `#E8F0EB` | `#5B8A72` | `#2C2825` |
| `pvp` | `#E8F0EB` | `#5B8A72` | `#2C2825` + small rival dot |
| `processing` | `#F0EBE3` | `#D4C9BA` | animated `…` |
| `failed` | `#F9EDED` | `#B85C5C` | `#8A8378` |

### 4.2 Paper card

| Property | Value |
|----------|-------|
| Fill | `#FFFFFF` |
| Border | 1px `#E5DDD2` |
| Radius | 12px |
| Padding | 16px |
| Shadow | Shadow/Card |

### 4.3 Buttons

**Primary (CTA)**
- H 48px, padding 16px 24px, radius pill
- Fill `#5B8A72`, text `#FFFFFF`, `Body/Default` 600

**Secondary**
- H 44px, fill `#F0EBE3`, text `#2C2825`, border 1px `#D4C9BA`

**Ghost**
- H 36px, no fill, text `#5C564E`, border 1px `#E5DDD2`, radius 8px

### 4.4 Progress bar (influence)

| Property | Value |
|----------|-------|
| Track H | 6px (leaderboard) / 8px (capture) |
| Track | `#F0EBE3`, border 1px `#E5DDD2`, radius 4px |
| Fill | `#5B8A72` (own) / `#6B7FA3` (rival) / `#C4A35A` (contest) |

### 4.5 Feed badge (pill)

| Property | Value |
|----------|-------|
| H | 24px |
| Padding | 4px 10px |
| Radius | pill |
| Text | `Label/Caps` 10px |

| Variant | BG | Text |
|---------|-----|------|
| `capture` | `#E8F0EB` | `#466B58` |
| `pvp` | `#E8F0EB` | `#466B58` |
| `siege` | `#FBF3E0` | `#8A6B20` |
| `error` | `#F9EDED` | `#B85C5C` |
| `king` | `#EDE8F5` | `#6B5F8A` |

---

## 5. Component — ActivityCard

**Figma name:** `ActivityCard`  
**Maps to:** `ActivityCard.tsx` → `.run-row`

### 5.1 Anatomy

```
┌──────────────────────────────────────────────────────┐
│ [HexBadge 48]  │  Distance (strong)     │ [Ghost btn]│
│                │  Date (muted)          │  «Карта»   │
│                │  Meta line (optional)  │            │
└──────────────────────────────────────────────────────┘
```

### 5.2 Layout (Auto layout)

| Layer | Direction | Gap | Padding |
|-------|-----------|-----|---------|
| Root `ActivityCard` | Horizontal | 12px | 14px 16px |
| Body | Vertical | 2px | — |
| Actions | Vertical | 4px | align center |

| Property | Value |
|----------|-------|
| Min height | 72px |
| Width | Fill container (358px) |
| Background | `#FFFFFF` |
| Border | 1px `#E5DDD2` |
| Radius | 12px |
| Shadow | Shadow/Card |

### 5.3 Text content

| Element | Style | Example |
|---------|-------|---------|
| Distance | `Body/Large` 600 `#2C2825` | `10.1 км` |
| Date | `Body/Small` `#8A8378` | `24 июн. 2026 г.` |
| Processing | `Body/Small` `#8A8378` | `Обработка…` |
| Failed | `Body/Small` `#B85C5C` | `Слишком короткая дистанция` |
| PvP meta | `Body/Small` `#6B7FA3` | `PvP: 2` |

### 5.4 Hex badge content

- **Primary value:** `cellsCaptured` as integer (`7`, not `—`)
- **Empty/null:** show `—` in muted default state
- **Processing:** `…` with subtle pulse opacity 0.5→1, 1.2s

### 5.5 States (component variants)

| Variant | Hex | Body clickable | Right action |
|---------|-----|----------------|--------------|
| `completed` | captured (+N) | yes | «Карта» ghost |
| `completed-pvp` | captured | yes | «Карта» + PvP meta |
| `processing` | processing | no | pending pill |
| `failed` | failed | no | «Пересчёт» ghost |
| `failed-no-reprocess` | failed | no | — |

### 5.6 Interaction

- Whole row OR hex + body → navigate `/?activity={id}`
- Hover (web): bg `#F7F4EE`, cursor pointer
- Active: scale hex 0.96

### 5.7 Figma component props

```
state: completed | completed-pvp | processing | failed
cellsCaptured: number (swap hex label)
distance: string
date: string
showMapButton: boolean
```

---

## 6. Component — CellPopup

**Figma name:** `CellPopup / Sheet`  
**Maps to:** `CellPopup.tsx` in bottom sheet on map

### 6.1 Container

| Property | Value |
|----------|-------|
| Type | Bottom sheet (map overlay) |
| Width | 390px (full bleed) |
| Max height | 55% viewport |
| BG | `#FFFFFF` |
| Radius top | 20px |
| Shadow | Shadow/Sheet |
| Padding | 20px 16px 24px + safe area |
| Handle | 36×4px, `#D4C9BA`, radius pill, centered top 8px |

### 6.2 Anatomy

```
        ─── handle ───
┌─────────────────────────────┐
│ Title (Display/H2)          │  ← cell status
│                             │
│ LABEL: Влияние в клетке     │
│ ┌ Leader row ─── bar ───┐   │
│ ├ Rank 2 row ─── bar ───┤   │  max 5 rows
│ └ Rank 3 row ─── bar ───┘   │
│                             │
│ ┌ Callout (contest/info) ┐  │  optional
│ └────────────────────────┘  │
│                             │
│ LABEL: История              │
│ from → to          date     │  max 3
└─────────────────────────────┘
```

### 6.3 Title variants (`status`)

| Status | Text color | Example |
|--------|------------|---------|
| `own` | `#2C2825` | `Ваша клетка` |
| `contested-own` | `#8A6B20` | `Спорная · вы ведёте` |
| `contested-challenger` | `#8A6B20` | `Спорная · отстаёте на 2` |
| `rival-owned` | `#2C2825` | `Владелец: runner_alex` |
| `neutral` | `#5C564E` | `Свободная клетка` |

### 6.4 Leaderboard row

| Property | Value |
|----------|-------|
| Row padding | 10px 12px |
| Row gap | 6px vertical |
| Row radius | 8px |
| Default border | 1px `#E5DDD2` |
| `isMe` border | 1.5px `#5B8A72` |
| `isMe` bg | `#F7FBF8` |

| Element | Style |
|---------|-------|
| Rank + name | `Body/Default` `#2C2825` |
| `(вы)` | same, 600 weight |
| Influence | `Data/Default` `#2C2825` |
| Share bar fill | % of leader = width |

**Leader row fill color:** rank 1 `#5B8A72`, rank 2 `#6B7FA3`, rank 3+ `#8A8378` at 60% opacity

### 6.5 Callout blocks

**Info (owner lead)**
- BG `#F7F4EE`, border 1px `#E5DDD2`
- Text `Body/Small` `#5C564E`
- Example: `Вы лидируете · запас до 2-го места: +2`

**Contest (challenger)**
- BG `#FBF3E0`, border 1px `#E8D080`
- Title `Body/Large` `#2C2825`
- Progress bar fill `#C4A35A`
- Meta `Body/Small` `#8A6B20`

### 6.6 History list

| Property | Value |
|----------|-------|
| Row layout | Horizontal space-between |
| Event text | `Body/Small` `#5C564E` |
| Date | `Body/Small` `#8A8378` |
| Separator | 1px `#E5DDD2` between rows |

### 6.7 Loading / error

- **Loading:** 3 skeleton rows, `#F0EBE3` shimmer
- **Error:** `#F9EDED` callout, `#B85C5C` text

### 6.8 Figma component props

```
status: own | contested-own | contested-challenger | rival-owned | neutral
contested: boolean
players: 0-5 (instance swap)
showCallout: boolean
showHistory: boolean
```

---

## 7. Component — FeedItem

**Figma name:** `FeedItem`  
**Maps to:** `FeedPage.tsx` → `.feed-row`

### 7.1 Anatomy

```
┌─────────────────────────────────────────────────────┐
│ ▌ nickname                          [badge pill]    │  ← optional left accent
│   event body text (1-2 lines)                       │
│   [Ghost: На карте]              timestamp          │
└─────────────────────────────────────────────────────┘
```

### 7.2 Layout

| Property | Value |
|----------|-------|
| Padding | 16px |
| Gap | 8px vertical |
| BG | `#FFFFFF` |
| Border | 1px `#E5DDD2` |
| Radius | 12px |
| Left accent | 3px width, only for `siege` / `pvp-capture` |

### 7.3 Variants by event type

| Type | Left accent | Badge | Body example |
|------|-------------|-------|----------------|
| `activity_completed` | none | `+7 клеток` sage | `пробежал 1.4 км · захвачено 7 клеток` |
| `activity_pvp` | none | `+3 клеток` sage | `… (2 у соперников)` |
| `cell_captured` | none | `+1 клетка` | `захватил клетку у runner_alex` |
| `cell_siege` | `#C4A35A` 3px | `осада` ochre | `runner_alex атакует вашу клетку — 98%` |
| `district_captured` | none | `король` purple | `стал королём района «Центр»` |
| `activity_failed` | `#B85C5C` 3px | `ERR` red | `пробежка отклонена проверкой GPS` |

### 7.4 Typography

| Element | Style |
|---------|-------|
| Nickname | `Body/Default` 600 `#2C2825` |
| Body | `Body/Default` `#5C564E` |
| Timestamp | `Body/Small` `#8A8378` |
| «На карте» | Ghost button, only `cell_siege` |

### 7.5 Density rule

**One activity = one feed row.** Never show 20× `cell_captured` for single run (product rule, not visual).

### 7.6 Figma component props

```
eventType: activity | capture | siege | king | error
badge: string
accent: none | contest | danger
showMapLink: boolean
nickname: string
body: string
timestamp: string
```

---

## 8. Component — Celebration

**Figma name:** `Celebration / PostRun`  
**Maps to:** `RunCelebrationOverlay.tsx`, `ActivityResultsModal.tsx`

### 8.1 Structure

Full-screen overlay — **the only screen allowed multiple accent colors + illustration.**

```
┌─────────────────────────────────────┐
│  ░░░ cream bg #F7F4EE ░░░░░░░░░░░░░ │
│                                     │
│     [botanical line art optional]   │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ EYEBROW: Great run!           │  │
│  │ HEADLINE: +7 cells captured   │  │  Display/H1
│  │ SUB: 2 у соперников · +14 infl│  │
│  │                               │  │
│  │  ┌─────┐ ┌─────┐ ┌─────┐     │  │
│  │  │  7  │ │  2  │ │ +14 │     │  │  stat chips
│  │  │cells│ │ PvP │ │infl │     │  │
│  │  └─────┘ └─────┘ └─────┘     │  │
│  │                               │  │
│  │  [Secondary: Share]           │  │
│  │  [Primary: View Territory →]│  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

### 8.2 Overlay

| Property | Value |
|----------|-------|
| BG | `#F7F4EE` at 96% opacity |
| Optional | faint topographic lines @ 4% opacity |
| Illustration | single fern/leaf line, `#5B8A72` @ 20%, top-right of card |

### 8.3 Celebration card

| Property | Value |
|----------|-------|
| Width | 342px |
| Padding | 28px 24px |
| BG | `#FFFFFF` |
| Border | 1px `#E5DDD2` |
| Radius | 20px |
| Shadow | Shadow/Celebration |

### 8.4 Copy hierarchy

| Layer | Style | Example |
|-------|-------|---------|
| Eyebrow | `Label/Caps` `#8A8378` | `TERRITORY RUN` or `Отличная пробежка!` |
| Headline | `Display/H1` `#2C2825` | `+7 клеток захвачено` |
| Subline | `Body/Large` `#5C564E` | `2 у соперников · +14 влияния` |
| Area line | `Body/Small` `#8A8378` | `~0.9 км² территории` |

### 8.5 Stat chips (3-up)

| Property | Value |
|----------|-------|
| Layout | Horizontal, gap 8px, equal width |
| Chip H | 72px |
| Chip BG | `#F7F4EE` |
| Chip border | 1px `#E5DDD2` |
| Value | `Data/Large` `#5B8A72` |
| Label | `Label/Caps` `#8A8378` |

| Chip | Value | Label |
|------|-------|-------|
| 1 | `7` | `захват` |
| 2 | `2` | `PvP` |
| 3 | `+14` | `влияние` |

### 8.6 Actions

| Button | Spec |
|--------|------|
| Primary | Full width, «На карту →», sage CTA |
| Secondary | Full width, «Поделиться», secondary style, optional |

### 8.7 Motion (Figma prototype notes)

1. Overlay fade in 200ms ease-out
2. Card scale 0.92→1, 280ms spring (damping 0.82)
3. Stat chips stagger +50ms each
4. Hex confetti: 6 small sage hexagons, fade 600ms (optional Lottie)

### 8.8 Figma component props

```
cellsCaptured: number
pvpCaptures: number
influenceAdded: number
cellsOwned: number
showShare: boolean
headlineVariant: positive | neutral | failed
```

---

## 9. Map tokens (reference for hex layer)

Not UI components, but Figma map styles should match:

| State | Fill | Stroke | Stroke W |
|-------|------|--------|----------|
| Own | rgba(91,138,114,0.28) | #5B8A72 | 1.5px |
| Rival | rgba(107,127,163,0.24) | #6B7FA3 | 1.5px |
| Neutral | transparent | #D4C9BA | 1px |
| Contest | rgba(196,163,90,0.30) | #C4A35A | 2px |
| Defend target | rgba(196,163,90,0.35) | #C4A35A dashed | 2px |
| Decay risk | rgba(184,92,92,0.20) | #B85C5C | 1.5px |

**Map base:** desaturated OSM, opacity 85%, slight sepia `#F7F4EE` overlay multiply.

---

## 10. Figma page structure (recommended)

```
📁 Paper Atlas
 ├── 🎨 Cover (brand, do/don't)
 ├── 🧱 Foundations
 │    ├── Colors
 │    ├── Typography
 │    ├── Icons (hex, run, map pin)
 │    └── Effects
 ├── 🧩 Primitives
 │    ├── HexBadge
 │    ├── PaperCard
 │    ├── Button/*
 │    ├── ProgressBar
 │    └── FeedBadge
 ├── 📱 Components
 │    ├── ActivityCard
 │    ├── CellPopup
 │    ├── FeedItem
 │    └── Celebration
 └── 🖼 Screens
      ├── Map + CellPopup
      ├── Activities list
      ├── Feed
      └── Post-run Celebration
```

---

## 11. Dev handoff mapping

| Figma component | React file | CSS class (target) |
|-----------------|------------|-------------------|
| ActivityCard | `ActivityCard.tsx` | `.run-row` → `.atlas-activity-card` |
| CellPopup | `CellPopup.tsx` | `.cell-popup` → `.atlas-cell-sheet` |
| FeedItem | `FeedPage.tsx` | `.feed-row` → `.atlas-feed-item` |
| Celebration | `RunCelebrationOverlay.tsx` | `.celebration-*` → `.atlas-celebration` |

Implementation tokens file (future): `apps/web/src/styles/paper-atlas.css`

---

## 12. Accessibility

| Check | Target |
|-------|--------|
| Body text contrast | ≥ 4.5:1 on `#F7F4EE` / `#FFFFFF` |
| Sage CTA on white | `#466B58` text alternative for small text |
| Touch targets | ≥ 44px |
| Color meaning | Always duplicate with text (не только цвет hex) |
| Celebration | `role="dialog"`, focus trap, Esc dismiss |

---

_Concept reference: `assets/territory-run-concept-b-paper-atlas.png`_
