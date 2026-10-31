# 04 — UI / UX

## Look & Feel

- **Style:** modern "glass" HUD floating over the world. Panels are translucent dark with backdrop blur, soft shadows and rounded corners (12px). The world stays the hero, and the UI never covers it with big opaque bars.
- **World art:** clean, bright, slightly stylised isometric pixel-art look, generated in code. Saturated greens and blues, with crisp tile edges at zoom 1.
- **Motion:** every interaction gives feedback within 1 frame. Panels animate in over 150–200 ms (ease-out). Placed objects "pop" (scale 0.85 → 1.05 → 1 with a dust puff).
- **Typography:** Inter (UI) plus a tabular-number font feature for money and population.

## Design Tokens (initial)

```css
--bg-panel: rgba(18, 22, 30, 0.72);
--bg-panel-hover: rgba(30, 36, 48, 0.85);
--border-panel: rgba(255, 255, 255, 0.08);
--text: #E8EDF5;   --text-dim: #9AA6B8;
--accent: #4FD1C5;  /* teal: primary actions, selection */
--zone-r: #4ADE80;  --zone-c: #60A5FA;  --zone-i: #FACC15;
--danger: #F87171;  --money: #A3E635;
--radius: 12px;     --blur: 14px;
```

## Screen Layout (in-game)

```
┌──────────────────────────────────────────────────────────────┐
│ [City name]  📅 Jan 2026   💰 $20,000   👥 0   ⏸ ▶ ▶▶ ▶▶▶  ⚙ │ ← top bar (floating)
│                                                              │
│                                                ┌──────────┐  │
│                    (world)                     │ minimap  │  │
│                                                └──────────┘  │
│                                                              │
│                ┌─────────────────────────────┐               │
│                │ 🛣  🟩R 🟦C 🟨I  🏭  🌳  🚜  🔍 │               │ ← toolbar (bottom-center)
│                └─────────────────────────────┘               │
└──────────────────────────────────────────────────────────────┘
```

- **Info panel** slides in from the right when you inspect a tile or building.
- **Tool options** (e.g. zone density, road type) pop up above the active toolbar button.

## New Game Screen

Full-screen backdrop with a slowly panning generated map. A centered card holds:
1. City name input
2. Terrain preset cards (thumbnail plus name)
3. Map size: Small 64 / Medium 128 / Large 256
4. Seed input with a 🎲 randomize button
5. "Advanced" sliders: Water level, Tree density, River count, Coast sides
6. Live minimap preview (updates as you change settings, debounced)
7. **Start Building** button

## Controls

| Action | Mouse / Trackpad | Keyboard |
|---|---|---|
| Pan | Right/middle drag, two-finger drag, screen edge | WASD / arrows |
| Zoom | Wheel / pinch (anchored at cursor) | `+` / `-` |
| Use tool | Left click / drag | — |
| Cancel tool / drag | Right click | `Esc` |
| Road / Zone R/C/I / Bulldoze | — | `R` / `1` `2` `3` / `B` |
| Inspect | — | `Q` |
| Pause / speed | — | `Space` / `[` `]` |
| Debug overlay | — | `F3` |

## Feedback Rules

- **Ghost preview** for every placement tool, tinted teal when valid and red when invalid.
- **Cost label** follows the cursor while dragging and turns red if it's unaffordable.
- **Hover highlight** is always visible over the tile under the cursor.
- **Never block the world:** errors show as short toasts or as cursor labels, never modals.
