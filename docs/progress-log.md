# Progress Log

Newest first. One entry per work session.

## 2026-11-01: Advanced power coverage and plant maintenance
- Power plants now expose type-specific coverage radii in the Build preview and picker.
- Generation is condition-aware: sustained high consumption wears plants down, derates output, and can trigger a repair period.
- Plant condition and repair state appear in the inspection panel, can be repaired for a type-specific cost, and persist in saves.
- The Energy Mix panel reports plants awaiting repair. Existing road-island delivery and battery behavior remain intact.
- Selecting an existing clinic, school, fire station or police station now shows its colour-coded coverage radius; placement previews continue to show the same reach.
- Added substations with blue coverage previews. Once a substation exists, plants and
  buildings must share its road island and reach to participate in the power network;
  cities without substations retain legacy delivery.

## 2026-11-01: Parks and shopping landmarks
- Added four placeable civic landmarks to the Parks & Places picker: Central Park, Botanical Garden, Shopping Complex and Riverside Market.
- Each landmark has deterministic procedural isometric art with distinct paths, water, planting, glasshouses, market stalls, storefronts and plaza details. Existing park, town hall, service and utility behavior is unchanged.
- Shopping landmarks remain civic buildings so they do not alter commercial zoning demand; their capacity still contributes jobs through the existing population model.
- Verified: 154 tests and lint pass. Typecheck was attempted but the environment permission prompt blocked that command.


## 2026-11-01: Transport T2, wide roads, ramps, pedestrian streets, paving
- **Wide roads:** Boulevard (6 lanes) and Expressway (8 lanes) are two parallel one-way carriageways laid by one straight drag (`World.lane` holds each tile's direction). `roadMask` follows the rules in one place: carriageways join end to end, open into each other at crossings and at their ends (turnarounds), and never sideways otherwise; expressways join only expressways, highways and **ramps**. `stepAllowed` keeps the commute model and visible cars from going against the flow; the trip home is routed fresh on one-way roads.
- **Pedestrian streets:** paved, car-free, walkable; cars never route through them.
- **Paving:** concrete, brick, granite setts, promenade, per tile (`World.pave`), picked in the road tool; each road type has a default.
- **UI:** one Roads button opens a Road picker with cross-section icons, lanes, price and hotkeys (K R V U J H X) and paving chips.
- **Art (D-066):** one file per road type in `render/atlas/roads/` (+ `paving.ts`, `oneway.ts`, furniture modules). The avenue trees were redesigned after user feedback ("they don't look good"): the city's own clustered-canopy trees at half size, one per tile in grates, alternating with clipped hedges and lamps.
- Saves gain optional `lane` and `pave` layers.
- Mid-session the dev build briefly rendered nothing (the road list gained types before their art existed); fixed, and the Fast Refresh warnings were cleared by moving `useCities` and `uniqueCityName` out of component files.
- Verified: 5 new rule tests (one-way rows, crossings, turnarounds, expressway access, pedestrian routing, saves); a road scene built with the real sim and art modules in Chrome; the Road picker in the game UI. 152 tests; typecheck and lint clean.

## 2026-11-01: Workers vs jobs fix (Demand v2), transport spec, T1 avenues
- **"Jobs but people asking for jobs" (user report):** the blue bubbles were factories saying "We can't find workers" (804 workers for 1,515 jobs), and the red bags were homes with nowhere to shop. Industry demand ignored jobs that shops, offices and civic buildings already filled. **Demand v2 (D-070):** four bars (Homes, Shops, Offices, Industry); offices and industry share `open jobs = workforce × 1.05 − all jobs`; shops follow residents. /demo after a year: +1,059 people, +725 workers, power and water shortages 78/121 → 0, commercial no longer stuck at −100%.
- **Transport spec** (specs/transport.md, D-069): one road-type table; Street, Avenue, Boulevard (6 lanes, 2 tiles), Highway, Expressway (8 lanes, 2 tiles), pedestrian street; pavement styles; flyovers, interchanges, cable-stayed and suspension bridges, tunnels; buses, trams, metro, rail, ferries with mode choice; parks and leisure variety. Steps T1–T7.
- **T1:** `sim/roadTypes.ts` holds every road's lanes, capacity, speed, footpath, costs, upkeep, noise and rank; commands (upgrade in place, paying the difference), commute, traffic (lanes, speeds, pedestrians), budget and needs read it, so no system checks a specific type. New **Avenue** (hotkey V): 4 lanes, planted median with shrubs, brick-paved footpaths, plane trees and double-headed median lamps as standing sprites. Road art is now `render/atlas/roads/` (kit, street, highway, avenue, avenueFurniture), with street and highway moved unchanged.
- Fixed a Fast Refresh warning (`uniqueCityName` moved out of the component file).
- Verified: tests for the road table (bigger roads carry more, faster), an avenue corridor jams under 60% of a street's congestion and commutes faster, and upgrade pricing; a road scene composed from the real art modules in Chrome. 147 tests; typecheck and lint clean.

## 2026-11-01: Spinning wind turbines; "why don't my offices grow?"
- **Turbine blades spin.** They were baked into the static texture. Now `render/atlas/energy/rotor.ts` is the one blade drawing, used by a new fx layer (`render/fx/Rotors.ts`) that spins them at the day's wind × game speed (still when paused) and by picker thumbnails as a still (`paintBuilding(..., { stillParts: true })`). Art declares hub points (`CivicArt.rotors`), like smoke sources. Verified in Chrome: frames half a second apart differ.
- **Offices never growing (user report):** diagnosed on the user's real save (River Valley, 1,166 people): 18 empty office lots and 16 shop lots, all next to roads, but commercial demand −10%, while residential (+0.33) and industry (+0.69) had no empty land left. Growth only fills a zone when its bar is above zero, and nothing told the player.
  - Demand bar tooltips now explain each bar in a sentence (`explainDemand`).
  - A notice after 10 days of lots waiting on demand, at most once a month per zone kind.
  - The zone tool's preview says "no demand yet" while painting a zone with no demand.
  - Test: offices waiting on negative commercial demand are counted and explained.
- **Found a balance flaw:** shops and offices share one commercial bar, and office towers add so many jobs that the /demo city sits at −100% commercial forever. The fix is Demand v2's split into Shops and Offices bars (master plan §6.4), pending the user's go-ahead because it changes /demo.
- 145 tests; typecheck and lint clean.

## 2026-11-01: Feature track A, Energy v2 (D-067, D-068)
- User direction: focus on the master plan's features (public transport, hospitals, universities, research, proper traffic, drainage, sewage, more advanced water and power). Set the order A–F (D-067) and added drainage (§12.2b) and research (§12.4) to the master plan.
- **Deterministic clock (D-068):** `City.ticks` and `Simulation.tick()` replace frame-time clock advance. Hours and days come from fixed ticks, so every machine plays a city the same way. The game, the harness (`runDays`) and the tests all use it.
- **Energy:** Coal (renamed), new Gas Power Plant, Wind Turbine, Solar Farm and Battery Bank. Hourly per-island balance in `sim/systems/energy.ts`: wind and sun are pure functions of seed, day and hour; demand follows an evening-peak curve; batteries charge on surplus and cover shortfalls (charge saved per building, an optional 11th save field). Edits and days re-balance at the current hour without moving charge.
- **UI:** Energy Mix in the budget panel (a stacked meter by source, demand marker, battery %); a brownout notice once per clock day that explains the fix; refreshed after every edit (it used to wait for the next day: a bug found in the browser test).
- **Art (D-066 applied):** each new building has its own painter file in `render/atlas/energy/` (`gasPlant`, `windTurbine`, `solarFarm`, `batteryBank`), sharing colour tokens in `energy/tones.ts`; the shared lot helpers moved out of `civicArt.ts` into `lot.ts`.
- Gas counts as a lighter polluter (0.4 vs coal 0.8) in the clean-air need.
- Verified: 4 new energy tests (solar browns out at night, batteries carry the evening, steady plants cover every hour, wind varies by day); the determinism test now runs through ticks with solar, wind and batteries; /demo hashes unchanged on three seeds; in Chrome all five plants place and draw, and the panel shows the live mix. 144 tests; typecheck, lint and build are clean.

## 2026-11-01: Phase 11.1 harness, timings and exact save continuation
- Started the master plan (05-master-plan.md). Phase 11 is split into six measured steps (specs/engine.md, D-065).
- **Timings:** every sim hook is timed (`SystemTimings`); F3 shows the five slowest against their budgets.
- **Harness:** `pnpm sim:run` runs the real sim on Node with no rendering or build step, writing monthly CSV plus a timing table; `pnpm bench` adds the budget report. For this, the sim's 14 constructor parameter properties became plain fields, and ESLint now keeps sim, shared, scripts and server to erasable syntax.
- **Baseline:** a /demo day costs ~92 ms in a single tick (5–6 dropped frames per in-game day). `commute.day` is 72.5 ms (79%) and `needs.day` 12 ms; everything else is under 0.5 ms. 11.3 and 11.5 target exactly these.
- **Determinism:** saves now carry the random stream states, commute volume and commute minutes; `loadSimulation` restores them, so a reloaded city plays out exactly as the running one. The test fails without the new block (checked).
- `tsx` was tried and dropped: it needs esbuild's native build script, which pnpm's guard blocks. The failed install left `tsx`/`esbuild` in the lockfile (committed in 85dcb70) and broke the user's running dev server (missing `refresh-runtime.js`). Restored the clean lockfile from d0d0993 and reinstalled.
- The F3 overlay moved below the top bar (they overlapped).
- User direction recorded (D-066): split tile art into clean single-purpose components with a modern, 3D, themeable look; added to the roadmap as an Art Track.
- 140 tests pass; typecheck (client, server, scripts), lint and build are clean.

## 2026-11-01: Roads continue past rock (D-064)
- User report: on the Island map, a highway dragged across a grey rock outcrop failed for everything after the rock. `planRoad` now judges each tile on its own. Rock, buildings and the map edge block only their own tiles. A water crossing is checked as a whole (straight, within span, buildable land at both ends, not crossing a bridge sideways), so bridges never dangle.
- `/demo` keeps the old rule through `leadingRun`. Its roads, bridges and buildings hash the same as before on three seeds.
- Tests: 2 new (rock gap, building gap, bridge onto rock) and 4 updated to the new rule; 138 pass.

## 2026-11-01: Saving fix: "my island progress wasn't shown after logging in again"
- Nothing was lost: both of the user's Island saves were in Postgres with their roads. But after logging in, the start screen led with "Found a new city", preselected with the same seed, so starting Island again gave an empty copy that looked like lost progress. The small, picture-less city card didn't help.
- Fix: a **Continue** card for the last-played city with a live map preview, previews on every city card (lazy, queued, cached), *Found a new city* folded away when you have cities, unique default names, and the camera centred on roads and buildings when a city loads.
- Verified in Chrome: play Island → log out → log in → Continue → the road is there.

## 2026-11-01: Master plan for the simulation
- Wrote [05-master-plan.md](05-master-plan.md): how the city should evolve after Phase 10. It covers resident groups, land value and building lifecycle, economy and goods, roads/bridges/outside connections, transit with mode choice, travel-time services with dispatch, utilities v2, government, performance and save v2. It also lays out Phases 11–22.
- Roadmap "Later Phases" now follows it. No code changed.
- The user answered §16 (D-063): resident groups, a regional highway on every map, ramps, stages, road wear as an option, Worker first, and realistic terrain-based disasters (added as §11.5).
- **Next:** finish Phase 10 (saving), then write the Phase 11 spec.
## 2026-11-01: Phase 10 saving & accounts
- **Save format** (`sim/save.ts`): the terrain settings (preset, seed, size and every slider the player changed), city state, RLE+base64 road/bridge/zone/cleared layers, and buildings as 10-number tuples. A grown demo city round-trips exactly. Parsing validates untrusted JSON and drops unknown buildings rather than failing. Growth and fire random streams now mix in the day, so a reloaded city doesn't replay day 0.
- **Server**: the user switched storage to **Postgres in Docker** and asked for a cleanly structured backend (D-062). Express 5, modules (`auth`, `saves`) split into routes → service → repository, one `HttpError` handler, zod validation, scrypt passwords, hashed session tokens in httpOnly cookies, rate-limited login, owner-scoped saves with a 30-city cap. Tests run on PGlite, so no Docker is needed for `pnpm test`.
- **Client**: IndexedDB store for guests and an HTTP store for accounts behind one `SaveStore` interface; `CitySaver` autosaves every 45 s (also when the tab is hidden and when leaving); `Ctrl/⌘ S`; save status in the top bar; log in / sign up dialog; account menu; "Your cities" on the start screen (continue, delete, move to account); `?city=` reopens a city on reload.
- New cities aren't saved until the player builds something, so rerolling maps (N) doesn't fill the list.
- Verified in Chrome (Playwright): sign up → build a road → save → list → reopen → reload, and guest save → sign up → the city moves into the account. No errors besides the missing favicon (it was never there). 136 tests pass; typecheck and lint are clean.
- **Open:** a favicon; centring the camera on roads when a city has no buildings yet.

## 2026-11-01: Phase 9 — Citizen needs (step 3 of the plan)
- User decision: abandonment included.
- **New `systems/needs.ts`:** ten needs, weighted happiness, complaints, city happiness, and abandonment streaks (abandoned and recovered buildings go into the day outcome).
- **Happiness feeds the sim:** it replaces the service occupancy bonus (55–100%), and level 2 needs 0.5 happiness, level 3 needs 0.7.
- **The demo** now covers its industrial corner with a service block.
- **UI:**
  - Bubble icons (`atlas/bubbleArt.ts`) and a rotating bubble overlay (`overlays/Bubbles.ts`).
  - "Citizens say…" panel with Show me, and a happiness % that toggles the happiness view (`Y`).
  - The data overlay is now generic: traffic or happiness, one at a time.
  - Info panel happiness and needs; a dark tint for abandoned buildings.
- **Checked:** the demo at 87–88% happiness, the panel, bubbles, the happiness view and Show me in the browser; no errors. Tests: 121.

## 2026-11-01: City art pass (buildings, streets, people, smoke)
- User request: make buildings, parks, utilities, roads and highways look far better, with real variety, footpaths and overhead bridges. Later: animated smoke from factories and power plants. Spec: `docs/specs/city-art.md`, decision D-060.
- **Buildings (`buildingRecipes.ts` + `buildingArt.ts`):**
  - 6 variants per zoned building that change form: podiums, setbacks, pyramid tops, heights; brick, siding, ribbon, grid and finned glass facades; helipads, spires, antennas, roof gardens, pools and solar panels; garages, trees and planters.
  - Named shops (Bakery, Books, Deli, Florist, Pharmacy), cafés (Diner, Pizza, Noodles, Bar, Gelato), hotels (Inn, Grand, Suites, Plaza, Resort) and markets.
  - Industry gets silos, tanks and twin stacks.
  - Shared iso helpers moved to `isoPaint.ts`.
- **Civic (`civicArt.ts`):**
  - cooling-tower, gas and twin-tower power plants; globe, classic and reservoir water towers;
  - 6 parks (fountain, playground, pond, court, gazebo garden, picnic grove);
  - patrol cars, fire doors and a hose tower, red crosses, a school playing field;
  - a domed town hall.
- **Streets (`roadArt.ts`, new `streetArt.ts`):** paved footpaths with kerbs, zebra crossings on the footpath line, and stop lines. Street trees and lamps go in the objects layer. Highways get barriers, two lanes each way, lamps, sign gantries, and foot overbridges every 8 tiles.
- **Agents:** pedestrians follow a mitred footpath route (they cross at zebras) and never walk on highways. Cars use lane 0.13, and highways have inner and outer lanes.
- **Smoke (`render/fx/Smoke.ts`):** pooled plumes from stack tops taken from the art; steam from cooling towers.
- Worked alongside the Phase 8 traffic session in the same tree: kept its live traffic lights and dropped my static ones.
- Checked in headless Chrome: the demo at several zooms and after rotation, plus variant sheets. Typecheck and lint clean, 118 tests.

## 2026-11-01: Phase 8 — Traffic overhaul (step 2 of the plan)
- Reproduced the user's gridlock headlessly (`tests/support/jamTown.ts`): 318 cars, 48% stuck.
- **New `systems/commute.ts`:**
  - Dijkstra from each group of homes, with congestion-aware tile times and distance-decayed job attraction.
  - Flow is pushed down the shortest-path tree, then smoothed.
  - Outputs volume and congestion per road tile, commute minutes per home, and weighted trips.
- **Traffic:**
  - Cars drive commute trips.
  - Capped at 0.35 per road tile, spawning only with room.
  - The congestion speed factor slows cars down.
  - Traffic lights (5 s phases, offset per junction, don't-block-the-junction) replace the junction boxes.
- **Visuals:**
  - Traffic-light poles (red/green).
  - `T` overlay of roads coloured by congestion, with buildings faded, plus a legend (commuters, average commute, jammed tiles).
  - Commute time in the info panel.
- Fixed: duplicate toast ids when dev mode mounts the game twice.
- Result: 0–3% stopped and 37 cars on the same town; the connector shows as congested and a highway relieves it. Tests: 115.
- Shared the working tree with the city-art session (simcity-web-5e). Their lane offsets and pedestrian paths in `traffic.ts` were kept alongside this work.

## 2026-11-01: Systems foundation (step 1 of the plan, D-057)
- Decisions: order is foundation → traffic → needs → backend (D-057); no free starter utilities (D-056); "systems as services" means in-game modules (D-058); the product name is still open (D-001).
- Split `population.ts` and `services.ts` into `systems/` modules (access, utilities, coverage, fire, population, budget); moved growth and traffic there.
- New `SimSystem` interface and `Simulation` core that runs the systems in order. `Game` no longer orchestrates the sim itself.
- No behaviour change: /demo builds the same city (about 26,000 residents, about 1.9 s), and the full play loop passes in the browser.
- Tests: 111 (3 new core tests: the edit pipeline, the day outcome and month-end budget, determinism).

## 2026-11-01: Phase 7 — Core city
- **Time:** days last 6 s, speeds are true 1×/2×/3×, and the clock opens a day/night menu (cycle / always day / always night, with `L` stepping through).
- **Density (D-054):** zone tools 1–5 for Homes, Apartments, Shops, Offices and Industry, with darker tints for high density. Growth is density-aware.
- **Utilities (D-052):** power plant (4,000) and water tower (2,500) pooled per road island, ⚡/💧 badges, one-time hints, utility supply in the budget panel.
- **Services (D-053):**
  - Police, fire, clinic and school, with coverage circles previewed while placing.
  - Occupancy is 70% + 7.5% per covering service; level-ups require services.
  - Fires break out outside fire coverage.
- **Budget:** tax slider (0–20%) that moves demand, a forecast with a cost breakdown, and per-building upkeep.
- **UI:** the Civic panel has Services / Utilities / Parks & Civic tabs; the info panel shows power, water, services and upkeep.
- Fixed while testing: the day/night menu opened under the budget panel, and it now closes on an outside click.
- `/demo` (D-055): a seeded planned city of about 26,000 residents, ready in about 1.9 s (`sim/demo.ts`, spec `docs/specs/demo.md`). Fixed while building it: road islands cut off by the river need their own utilities.
- Tests: 108. Verified in the browser: a full loop (road → services → utilities → four zone types → 476 residents at 3×), the budget panel, day/night menu and info panel. No errors.

## 2026-10-31: Simplify: flat maps, no terrain tools, no Dezone
- User decision (D-051): removed the hills (generator, presets, slider, URL param), the Raise/Lower/Level tools and `sim/terraform.ts`. The borderlands ring is flat.
- Dezone removed: Clear now also removes zones (and a bulldozed grown building doesn't regrow).
- Kept: the sloped-mesh renderer, which draws a flat world at no extra cost; the zoning-UX hints; the zoom limit; development funds of $700M (D-049).
- Tests: 105 (terraform and hills tests dropped; new tests for flat presets and Clear removing zones). Checked in the browser: flat Forested map, the trimmed toolbar, Clear over zoned tiles, no errors.

## 2026-10-31: Phase 6 — Elevation, terraforming & borderlands
- **Decisions this session:** borderlands with hills for the map edge; Phase 6 next; the Build tool now places civic buildings only (D-042); nothing committed yet.
- **Heights** (D-043): `World.elevation` with the one-level-per-tile rule, plus `surfaceHeight`, `cornerHeight`, `isFlat` and `smoothElevation` (`sim/terrain/elevation.ts`). The generator has a Hills slider and per-preset hills; River Valley's terrain stays byte-identical.
- **Rendering** (D-044):
  - Ground, roads, zone lots, the grid, hover and previews are sloped meshes from `render/ground/TileMesh.ts`, with a custom shader for hill light and fog. Water still animates.
  - Objects, agents, badges and effects are lifted onto the terrain (`render/view/lift.ts`).
  - Picking uses fixed-point iteration.
  - The minimap is hill-shaded.
- **Terraforming:** Raise, Lower and Level (`5`/`6`/`7`) at $15 per tile-level. Neighbours ripple to keep the rule, and water, roads and buildings are locked. Ripple tiles show fainter in the preview.
- **Building rules:** buildings and 2×2 merges need flat footprints.
- **Borderlands** (D-045): an extended render-only world with rivers and sea carried on, hills rising to rocky mountains, fog, a fogged underlay (no lattice when zoomed out) and a dashed border line. The soil slab is gone.
- Tests: 109 total (7 new: elevation, terraform, borderlands).
- Verified in headless Chromium: hills on every preset; terraform preview cost, a road over a raised hill, a lowered dip; borderlands on Forested and Coastal; a town growing on hills; rotation. No console errors.
- Follow-up (user feedback): the mountain ring looked smudgy, so it's simplified to low land fading into fog (D-046).
- Follow-up (user feedback): hill shading removed, since it showed as dark patches; the furthest zoom-out now keeps the screen inside the map (0.4× for 128×128 on a 1440×900 view) (D-047).
- Follow-up (user feedback): homes UX (D-048). Build is renamed Civic with zone shortcuts; zone tiles out of road reach are amber in the preview and grey once zoned; cost-label note and toast.
- Gotcha: the module-level shader cache must be released per atlas, not globally. React's dev double-mount destroys the first game while the second is already running, and a global release broke the second game's meshes ("Mesh shader has no glProgram").

## 2026-10-31: Finishing the open items (Phases 5, 4c extras, 2b)
- **Phase 5:**
  - The toolbar is grouped.
  - New minimap (`render/minimap.ts` and `hud/Minimap.tsx`): view-rotation aware, repaints at most 4 times a second, live viewport quad, click or drag to glide there.
  - Time-of-day clock in the top bar (D-039), with a day/night multiply tint that `L` toggles.
  - Procedural ambience: wind by zoom, city hum by cars on screen, birds by day.
- **Phase 4c extras:**
  - Rush-hour trip curve, with morning trips outbound and evening trips home.
  - Lane-gap queuing plus junction boxes, with patience so nothing deadlocks (D-040).
  - Automatic bus stops with glass shelters; buses run stop to stop and dwell (D-041).
- **Phase 2b:**
  - `generate.ts` (was `riverValley.ts`) is now preset and slider driven, and River Valley stays byte-identical (hash test).
  - Five new presets that use dry grass, dirt and rock.
  - New Game screen with live preview and URL options (D-038), and New city in the top bar.
- Tests: 102 total (8 new: traffic 4, presets 4).
- Verified in headless Chromium:
  - New Game → Coastal "Bayport" → reload keeps the city → New city returns.
  - Minimap jump, a night tint at 01:50, bus stops by the shops, all six preset previews.
  - No console errors.
- Still open: the 60 FPS check on real hardware (Phases 1, 2a, 3). Headless Chrome renders in software, so it can't measure this.

## 2026-10-31: Zoning & growth (Phase 4b)
- Agreed the save/backend plan before starting, to build later: Express + SQLite, email/password accounts, saves hold the seed plus what changed (D-034).
- **Zoning:** `sim/zones.ts`; `planZone`/`applyZone` (rezoning or dezoning removes grown buildings; roads and placed buildings clear the zone). Four tools on `1`–`4`, with zone-coloured previews and a "Residential $150 · 30 tiles" cost label.
- **Growth** (`sim/growth.ts`, daily, seeded RNG):
  - R/C/I demand from built capacity: homes need jobs, jobs follow homes.
  - New level-1 lots on empty zoned tiles with road access.
  - A 4-day construction stage.
  - Level-ups in place or as 2×2 merges, gated by occupancy, days and city size.
  - `chooseBuilding()` picks from the catalog.
- **Road access** now reaches 3 tiles (`findEntrance`: nearest ring first, then fewest straight steps, front first), so 3-deep zones develop.
- **Rendering:** zoned-lot layer per chunk (soft, full strength in zone view); procedural foundation and scaffold sites with a tower crane on 2×2 (`constructionArt.ts`); multi-rect `refreshWorld` so a day's changes rebuild each chunk once.
- **UI:** zone buttons in their colours, R/C/I demand meter, info panel shows construction days left and grown vs placed.
- **Tuning:** first try grew about 100 buildings in the first minute. Halved lot and upgrade rates and raised the level gates to 150 and 1,000 residents.
- Verified in headless Chromium: zoned both sides of two roads on seed 42; sites, then houses, then walk-ups and merged warehouses; 584 residents by June Y1 at 3×; rotation fine; no console errors.

## 2026-10-31: View rotation
- The user asked to see the other side of the map. Built 4-way rotation (D-032, D-033), replacing deferral D-003.
- `ViewTransform` (world ↔ view math) and `ViewWorld` (rotated copy of the tile layers, re-synced after edits). The existing chunk, road, bridge and terrain renderers work on it unchanged.
- The building painter is now rotation-aware: recipes in local space, rotated layout, camera-facing walls only, front details only when the front faces you, view-depth ordering for ground props. All 17 buildings were checked on a 4-rotation contact sheet.
- Overlays, effects, agents, previews (rotated road masks, swapped bridge axes, rotated ghosts) and picking all convert through `viewRef`.
- Controls: `,` / `.` plus top-bar rotate buttons with a compass. The camera keeps its centre and the view fades in.
- `AtlasBuilder` now emits pages of up to 4096 px. Boot is atlas ≈ 286 ms, map ≈ 18 ms.
- Tests: 15 new for transforms and view sync (85 total).
- Verified in the browser: built a town, rotated through all 4 sides with traffic running, and placed a building in a rotated view (it landed under the cursor).
- Gotcha: the first scripted test failed because the input started before a cold dev-server load finished. It was not a game bug.

## 2026-10-31: Simulation, cars and people (Phase 4c)
- **Dynamics:** calendar (1 day = 2 s), speed controls, road access per building, population that grows toward a job-dependent target, jobs filling from the workforce, and a monthly budget (taxes vs upkeep) with a toast.
- **Traffic:** cached, bridge-aware BFS routing. Cars, taxis, buses and trucks drive on the right with smooth lane changes through turns and run faster on highways. Pedestrians stroll the pavements with a walk cycle. Density follows population (caps: 320 cars, 180 people).
- **Rendering:** pooled, screen-culled, depth-sorted agent layer with zoom LOD. Procedural vehicle art (4 kinds × 6 colours × 4 headings, head and tail lights) and people (8 variants × 2 frames).
- **UI:** top bar (date, population, workers/jobs, funds, speed, mute); click-to-inspect info panel with occupancy bar, road status and Demolish; orange "no road" badges; debug overlay hidden by default with boot timings and agent counts.
- **Optimisation:** measured boot (atlas ≈ 200 ms, map ≈ 20 ms) and found no hotspot worth restructuring. Agents are capped, culled and LOD'd; routes are cached; the daily sim is O(buildings).
- Verified in the browser: built a street, ran at 3× for a month (population 419, 247/524 jobs, January budget +$1,689), saw cars, buses and pedestrians, inspected buildings, and saw the no-road badge. 70 tests.
- Fixed: city name wrapping in the top bar.

## 2026-10-31: Phase 4a building catalog and art
- Plan agreed: 4a catalog and art → 4b zoning and growth → 4c moving cars.
- **17 buildings**:
  - Homes: Cottage, Family House, Townhouses, Walk-up, Apartment Block, Condo Tower
  - Shops & Offices: Corner Shop, Café, Small Office, Supermarket, Hotel, Office Tower
  - Industry: Workshop, Warehouse, Factory
  - Civic: Park, Town Hall
- Procedural painter: lit and shaded walls; gable, hip, flat and sawtooth roofs; punched, band, curtain-wall, shopfront, townhouse and industrial facades; awnings, signs (sheared text), balconies, water tank, AC units, canopy, lit crown, loading docks, smokestack, parking lot with cars. 3 colour variants each.
- `World.building` and `World.buildings`. `planPlace`/`applyPlace` with footprint checks and auto-clearing. Clear removes whole buildings, and roads can't pass through buildings. 9 new tests (59 total).
- Build tool (`E`) with a picker (category tabs, live thumbnails painted by the same code, cost and size), a ghost preview, a cost or "can't build here" label, plus pop, dust and sound.
- Added `?funds=` URL option for testing. Gave parks a hedge and paved edge (they blended into the grass).
- Verified in the browser: placed all 17 types, no console errors.

## 2026-10-31: Bridges, build effects and sound (Phase 3 complete)
- **Bridges:** a new `World.bridge` layer. Paths crossing water become straight, land-to-land bridges (max 12 tiles) at $60 or $160 per tile. They connect only at their ends, and clearing removes them. 8 new tests (50 total).
- Bridge art: deck markings, rails and posts, a dark side face, pillars, and a shadow on the water. The first version looked too much like road, so it was made more distinct.
- **Effects:** a rippling additive pop flash and pooled particles (dust, splash, leaves and chips, rock grit) with a 1,500 cap and capped ripple time.
- **Sound:** procedural Web Audio (build thunk and ticks, bridge ping, clear crunch, error buzz, tool click). `M` and a speaker button mute it; the setting persists.
- Verified in the browser: bridge preview and pricing, build pop and dust, leaf burst on clear, no console errors. (Sound can't be checked headless.)
- The user asked for more realistic bridges. Rebuilt them in taller frames with piers and ripples, a girder, parapet walls, lamp posts and a soft shadow. Toned down the first pass's shadow (it read as a slab on the sand) and the ripples (they looked like white squares).

## 2026-10-31: Phase 3 roads, highways and clearing
- Seed 42 (the approved River Valley) is now the default map.
- Sim: `RoadType` (road/highway), `roadMask`, L-path (`Shift` = straight), rectangle selection, `City` funds, and pure `planRoad`/`applyRoad`/`planClear`/`applyClear`. 14 new tests, 42 total.
- Art: 16 auto-tiled pieces each for street (sidewalks, dashed centre line, zebra crossings at junctions) and highway (guard rails, lanes, median).
- Game: tool system (`Q` select, `B` clear, `R` road, `H` highway, `Esc`/right-click cancel). Left-drag uses the tool, right-drag pans. Live ghost preview and cost label. Chunk refresh rebuilds only roads and objects.
- UI: toolbar with icons, tooltips and hotkeys; top bar with funds (flashes on spend); cost label that flips near screen edges; error toasts.
- Verified in the browser: build road, highway and L-paths; clear a forest (preview plus cost); funds update; no console errors.
- **Open:** placement juice and bridges (Phase 3 leftovers), 60 FPS check on real hardware, product name.

## 2026-10-31: Phase 2a River Valley terrain
- Narrowed Phase 2 to **one terrain done perfectly** (River Valley), as the user asked. Presets and the New Game screen moved to 2b.
- Generator: own simplex noise, winding river plus tributary, lakes, cleanup, sand rims, forest clumps, decorations. 28 tests pass.
- The user shared a reference image (pixel-art map). We matched its style: bright palette, narrow winding river with a surf edge, chunky outlined pines, rocks and flowers. Dropped the dirt and rock ground patches for this terrain.
- Rendering switched to a **dual grid**, because the first overlay approach left staircase edges. Fixed hairline seams with two-pass drawing (bases, then overlays).
- Added a soil slab along the map edge, the `N` key for a new seed (kept in the URL), and the seed in the debug overlay.
- The user approved **seed 42** ("looks perfect"). It's now the reference map.
- Added rocks where natural (rocky meadows, forest edges, riverbanks) plus a mossy boulder pile. Decor uses its own random stream, so seed 42's layout is unchanged.
- **Open:** 60 FPS check on real hardware. Product name (D-001). Whether to switch to a top-down camera like the reference (currently isometric).

## 2026-10-31: Phase 1 engine foundation
- Scaffolded Vite + TS + React 18 + PixiJS 8 + Jotai 3, with ESLint (rule: `src/sim` can't import render/UI/game), Prettier, Vitest. Switched to **pnpm**.
- Built the `World` (typed-array layers), iso math plus tests, the procedural atlas (`AtlasBuilder`, drawn at 2× with mipmaps), the chunked ground renderer (16×16 render groups plus culling), the eased camera (cursor-anchored zoom, 1:1 drag, WASD, edge scroll, trackpad pinch/pan), the hover highlight, the fixed-timestep loop, the F3 debug overlay and the G grid toggle.
- Verified in headless Chrome: renders, hover, zoom, grid, drag, culling (draw calls ≈ visible chunks), no console errors.
- Fixes found while testing: grass variants differed too much (checkerboard look), so base colours were evened out. Zoomed far out, a diamond seam pattern showed through, so a map-shaped grass layer now sits under the tiles.
- Gotcha: adding `packageManager` to package.json made pnpm 12 try to download a native binary and fail, so it is not pinned.
- **Open:** confirm 60 FPS at `?size=256` on real hardware. Product name (D-001).
- **Next:** Phase 2, terrain generator and New Game screen.

## 2026-10-31 — Phase 0: Planning
- Created docs: vision, architecture, roadmap, UI/UX, specs (terrain, roads, buildings), decision log.
- Open decisions D-001 (name), D-002 (iso vs top-down) and D-003 (rotation) need sign-off.
- **Next:** Phase 1, engine foundation (scaffold, iso grid, camera, picking, debug overlay).
