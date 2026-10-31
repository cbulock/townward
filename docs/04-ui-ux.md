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
- **Minimap** sits bottom-right (see below). The controls hint is bottom-left and the toolbar bottom-centre.
- **Toolbar groups**, separated by thin dividers: *Select · Clear · Build* | *Homes · Shops · Industry · Dezone* | *Raise · Lower · Level* | *Road · Highway*. Build offers civic buildings only (D-042).
- **Tool options** (e.g. zone density, road type) pop up above the active toolbar button.

## Minimap (Phase 5)

- A small diamond-shaped map of the whole city, matching the current view rotation. It's painted from the world layers, one pixel per tile:
  - terrain colours, darker where there's forest;
  - zones tinted;
  - buildings in their category colour (orange while under construction);
  - roads dark.
- It repaints when the world changes (at most 4 times a second) and on rotation.
- A white quad shows the part of the map on screen and follows the camera every frame.
- **Click or drag** on the minimap to move the camera there (smooth pan).
- The same painter (`render/minimap.ts`) draws the New Game preview (Phase 2b).

## Time of Day & Day/Night (Phase 5)

- A **clock** separate from the calendar: one clock day is 90 sim seconds (it pauses and speeds up with the game). It's shown as `hh:mm` next to the date. The calendar keeps its fast 2-second days for the economy.
- **Day/night tint:** a multiply-blended layer over the world, under the HUD and the tool overlays. It goes clear by day, warm at dawn and dusk, and deep blue at night.
- `L` toggles the cycle (it stays clear daylight when off). The setting persists.
- The clock also drives rush hours (docs/specs/simulation.md).

## Ambient Audio (Phase 5)

- Procedural, like the effects, and quiet:
  - **wind:** low-passed brown noise, louder when zoomed out;
  - **city hum:** band-passed noise that scales with the cars on screen and fades when paused;
  - **birds:** occasional chirps by day when the view is mostly nature.
- Everything goes through the master gain, so `M` mutes it too.

## New Game Screen

Full-screen backdrop with a slowly panning generated map. A centered card holds:
1. City name input
2. Terrain preset cards (thumbnail plus name)
3. Map size: Small 64 / Medium 128 / Large 256
4. Seed input with a 🎲 randomize button
5. "Advanced" sliders: Water level, Hills, Tree density, River count, Coast sides
6. Live minimap preview (updates as you change settings, debounced)
7. **Start Building** button

## Controls

| Action | Mouse / Trackpad | Keyboard |
|---|---|---|
| Pan | Right/middle drag, two-finger drag, screen edge | WASD / arrows |
| Zoom | Wheel / pinch (anchored at cursor); zoom-out stops once the screen fills with map | `+` / `-` |
| Use tool | Left click / drag | — |
| Cancel tool / drag | Right click | `Esc` |
| Road / Zone R/C/I / Dezone / Bulldoze | — | `R` / `1` `2` `3` / `4` / `B` |
| Raise / Lower / Level land | Drag | `5` / `6` / `7` |
| Inspect | — | `Q` |
| Pause / speed | Top-bar buttons | `Space` / `[` `]` |
| Inspect building | Click (Select tool) | `Esc` closes |
| Build | — | `E` |
| Mute | Speaker button | `M` |
| Day/night cycle on/off | — | `L` |
| Jump to a place | Click/drag the minimap | — |
| Rotate view | Top-bar ⟲ ⟳ (compass shows north) | `,` / `.` |
| Debug overlay | — | `F3` |

## Feedback Rules

- **Ghost preview** for every placement tool, tinted teal when valid and red when invalid.
- **Cost label** follows the cursor while dragging and turns red if it's unaffordable.
- **Hover highlight** is always visible over the tile under the cursor.
- **Never block the world:** errors show as short toasts or as cursor labels, never modals.
