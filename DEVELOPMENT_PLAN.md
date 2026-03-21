# TRASH — Development Plan

## How This Plan Works

Each phase has:
- **Goal**: What we're building
- **Acceptance Criteria**: How we know it's done
- **Key Concepts**: Game dev concepts you'll learn
- **Status**: `[ ]` not started, `[~]` in progress, `[x]` complete

Phases are sequential — each builds on the previous. Within a phase, tasks can be done in any order unless noted.

---

## Phase 1: Skeleton `[x]`

**Goal**: Vite + Phaser + Matter.js boilerplate. Walls, gravity, a visible game board.

**Key Concepts**: Game loop, scenes, physics world setup, viewport

**Acceptance Criteria**:
- [x] `npm run dev` starts Vite dev server
- [x] Phaser canvas renders with dark background
- [x] Three walls (left, right, floor) visible
- [x] Crane rail line visible at top
- [x] Laser line indicators visible (faint red)
- [x] TypeScript compiles with zero errors
- [x] Deploys to Vercel successfully

---

## Phase 2: Crane System `[x]`

**Goal**: Moveable crane with rope constraint. Attach a simple square piece. Get the pendulum swing feeling right.

**Key Concepts**: Kinematic bodies, constraints, pendulum physics, lerp smoothing, input mapping

**Tasks**:
- [x] Create `CraneSystem` — trolley (static body) moves on rail
- [x] Create `Rope` — Matter.Constraint between trolley and piece
- [x] Create `InputSystem` — arrow keys / touch → `GameActions`
- [x] Wire input to crane movement with lerp smoothing
- [x] Spawn a test square piece attached to crane rope
- [x] Space bar detaches constraint (piece falls with swing velocity)
- [x] Tune: rope length, stiffness, damping until swing feels good
- [x] Mobile: touch left/right halves to move, tap center to drop

**Acceptance Criteria**:
- [x] Crane trolley moves smoothly left/right
- [x] Piece swings like a pendulum when crane moves
- [x] Dropping preserves swing momentum
- [x] Piece collides with walls and floor
- [x] Works with keyboard AND touch input
- [x] No physics glitches (piece doesn't fly through walls)

---

## Phase 3: Piece System `[~]`

**Goal**: All 7 piece shapes, random spawning, piece queue with next-piece preview.

**Key Concepts**: Polygon bodies, fromVertices(), convex decomposition, piece bag randomization

**Tasks**:
- [x] Create `PieceFactory` — generates Matter bodies from `PieceDefinitions`
- [x] Create `Piece` entity — wraps Matter body + Phaser graphics (via PieceRenderer)
- [x] Render pieces with correct colors from vertex data
- [x] Implement piece bag randomizer (Tetris-style: shuffle bag of 7, deal one at a time)
- [x] Auto-spawn next piece on crane after drop
- [ ] Show "next piece" preview in corner of board
- [ ] Add `poly-decomp` for concave shape support

**Acceptance Criteria**:
- [ ] All 7 piece shapes spawn correctly as physics bodies
- [ ] Pieces have distinct colors matching their definitions
- [ ] Pieces collide with each other and walls realistically
- [ ] New piece auto-appears on crane after previous piece is dropped
- [ ] Next piece preview visible

---

## Phase 4: Settling Detection `[x]`

**Goal**: Detect when a dropped piece has stopped moving. Transition state machine correctly.

**Key Concepts**: Velocity thresholds, frame counting, state machines in games

**Tasks**:
- [x] Track velocity of active piece after drop
- [x] Implement settling check: replaced with 1-second drop timer for snappy feel
- [x] State machine transitions: DROPPING → (1s timer) → LASER_CHECK → SPAWNING
- [x] Handle edge case: glass/concrete shatter detected via body destruction check
- [x] Handle edge case: spawn blocked by debris → WAITING state until hook area clear

**Acceptance Criteria**:
- [x] Next piece spawns ~1 second after drop
- [x] State machine transitions correctly through all states
- [x] No infinite loops in state machine
- [x] Destroyed pieces (glass/concrete) properly transition to next spawn

### Physics Tuning Backlog (revisit after lasers)
- [ ] Angular damping — pieces still rotate too freely after landing
- [ ] Rubber momentum transfer — rubber bouncing still pushes heavy pieces ~8px
- [ ] Settle visual indicator (brief flash or opacity change)
- [ ] Consider per-material drop timers (rubber could have longer timer since bouncing IS its identity)

---

## Phase 5: Lasers — Visual Only `[ ]`

**Goal**: Draw animated laser lines. Compute and display coverage percentage. No slicing yet.

**Key Concepts**: Sensors (non-colliding bodies), polygon intersection, area calculation

**Tasks**:
- [ ] Create `LaserSystem` with configurable laser positions
- [ ] Create `LaserLine` entity — visual line + sensor zone
- [ ] Compute coverage: what % of each laser band is filled by pieces
- [ ] Display coverage % text next to each laser line
- [ ] Animate laser glow when coverage ≥ 90%
- [ ] Implement 2-second cooldown timer per laser (visual countdown)
- [ ] Add coverage debug overlay (toggle with D key)

**Acceptance Criteria**:
- [ ] Laser lines visible at correct positions
- [ ] Coverage percentage updates in real-time as pieces land
- [ ] Lasers glow/pulse when 90%+ coverage detected
- [ ] Cooldown timer visible per laser
- [ ] Debug mode shows exact coverage rectangles

---

## Phase 6: Laser Slicing `[ ]`

**Goal**: Lasers actually destroy piece portions. This is the hardest phase — the core mechanic.

**Key Concepts**: Polygon slicing, body decomposition, fragment creation, physics body replacement

**Tasks**:
- [ ] Add `polyk` dependency
- [ ] Create `PieceSlicer` utility — slices polygon with horizontal band
- [ ] Implement: get piece vertices in world space
- [ ] Implement: slice polygon at bandTop and bandBottom Y coordinates
- [ ] Classify fragments: inside band (destroy) vs outside (keep)
- [ ] Create new Matter bodies from surviving fragments
- [ ] Transfer velocity/angular velocity from original to fragments
- [ ] Remove original body, add fragment bodies
- [ ] Implement minimum fragment area filter (discard tiny shards)
- [ ] Add particle effects on laser fire
- [ ] Handle edge case: piece entirely within band (destroy completely)
- [ ] Handle edge case: piece only partially overlaps band
- [ ] Handle compound bodies (pieces already sliced once)

**Acceptance Criteria**:
- [ ] Laser fires and visibly destroys piece material in its band
- [ ] Pieces above the destroyed band fall down naturally
- [ ] Fragments maintain correct physics (velocity, rotation)
- [ ] No physics explosions or glitches from fragment creation
- [ ] Multiple lasers can fire independently
- [ ] Sliced pieces can be sliced again by other lasers
- [ ] Particle effects play on laser fire

---

## Phase 7: The Landscape & Hopper `[ ]`

**Goal**: Expand from a single column to a full landscape with a hopper that feeds incoming trash. This is the foundation for the "garbage processing plant" experience.

**Key Concepts**: Scene management, scrolling camera, entity spawning, queue systems

**See**: `GAME_VISION.md` for the full design rationale.

**Tasks**:
- [ ] Create `LandscapeScene` — a wide scrolling scene containing the ground, hopper, and columns
- [ ] Create `Hopper` entity — a container on the left side that accumulates incoming trash
- [ ] Implement hopper fill rate — trash items appear in the hopper on a timer
- [ ] Hopper capacity bar — visual indicator of how full the hopper is
- [ ] Refactor current `GameInstance` board into a `ProcessingColumn` that lives within the landscape
- [ ] Ground plane — flat surface between the hopper and columns
- [ ] Camera system — scroll/pan across the landscape

**Acceptance Criteria**:
- [ ] Hopper visible on the left, filling up over time
- [ ] At least one processing column visible to the right
- [ ] Ground plane connects hopper to columns
- [ ] Camera can pan to see the full landscape

---

## Phase 8: Crane Vehicle `[ ]`

**Goal**: Replace the static per-column crane with a driveable crane vehicle that moves across the landscape, picks up trash from the hopper, and delivers it to columns.

**Key Concepts**: Vehicle physics, grab/release mechanics, state machines for vehicles

**Tasks**:
- [ ] Create `CraneVehicle` entity — drives left/right on the ground plane
- [ ] Vehicle input: arrow keys / touch drag to drive
- [ ] Magnet crane arm — extends upward to grab items from the hopper
- [ ] Grab mechanic: position over hopper, activate magnet, item attaches to crane arm
- [ ] Carry mechanic: drive with item attached, item swings on crane arm
- [ ] Deliver mechanic: position over column, lower item into column
- [ ] Column receives item → existing pendulum/drop mechanics take over
- [ ] Vehicle cannot fall into columns (drives over them on bridge/rail)
- [ ] Touch controls: tap hopper to grab, tap column to deliver, drag to drive

**Acceptance Criteria**:
- [ ] Can drive crane vehicle left/right across landscape
- [ ] Can grab a piece from the hopper
- [ ] Piece swings on crane arm while driving
- [ ] Can position over a column and deliver the piece
- [ ] Piece enters column and behaves like current drop mechanics
- [ ] Vehicle stays on ground, never falls into columns

---

## Phase 9: Composite Shapes `[ ]`

**Goal**: Add complex real-world trash shapes beyond tetrominoes. Multi-material objects that create interesting gameplay when sliced.

**Key Concepts**: Complex polygon definitions, multi-material bodies, weighted spawning

**Tasks**:
- [ ] Expand `PieceDefinitions` with composite shapes (chair, car, TV, etc.)
- [ ] Multi-material support — different regions of a shape have different materials
- [ ] When a laser slices a composite, each region behaves per its material (glass parts shatter, steel survives)
- [ ] Composite shape categories with spawn weights per difficulty level
- [ ] Visual distinction — composites look like recognizable objects, not abstract shapes
- [ ] Add at least 10 composite shapes across household, vehicle, electronics categories

**Acceptance Criteria**:
- [ ] Composite shapes spawn from the hopper
- [ ] Shapes are visually recognizable as real objects
- [ ] Multi-material composites interact correctly with lasers
- [ ] Different categories appear at different difficulty levels

---

## Phase 10: Overflow & Pressure `[ ]`

**Goal**: Create the pressure loop — hopper overflow spills onto landscape, column overflow creates debris, the player must manage throughput to survive.

**Key Concepts**: Overflow mechanics, difficulty curves, pressure systems

**Tasks**:
- [ ] Hopper overflow: when full, trash spills onto the landscape as physics bodies
- [ ] Spilled trash blocks crane vehicle paths (must drive around or clear)
- [ ] Column overflow: when a column is full, new pieces bounce out and land on landscape
- [ ] Throughput scoring — tons processed per minute, hopper efficiency bonus
- [ ] Escalation curve — hopper fill rate increases over time
- [ ] HUD: hopper capacity, throughput meter, score, column status indicators

**Acceptance Criteria**:
- [ ] Hopper visibly overflows when full
- [ ] Spilled trash physically blocks the landscape
- [ ] Column overflow creates landscape debris
- [ ] Score tracks throughput
- [ ] Difficulty clearly escalates over time

---

## Phase 11: Multi-Column & Camera `[ ]`

**Goal**: Multiple processing columns operating simultaneously, with smooth camera transitions between overview and focused column view.

**Key Concepts**: Multiple physics worlds, camera transitions, viewport management

**Tasks**:
- [ ] Support 2-5 processing columns in the landscape
- [ ] Each column has independent lasers and physics
- [ ] Overview camera — see all columns + hopper + landscape at once
- [ ] Zoom-in — tap a column to smoothly zoom camera into column view
- [ ] Zoom-out — pinch or button to return to overview
- [ ] Column status indicators visible in overview (fill level, laser activity)
- [ ] Earn new columns through progression (score/throughput milestones)

**Acceptance Criteria**:
- [ ] 2+ columns visible and operational simultaneously
- [ ] Smooth animated zoom transitions (no snapping)
- [ ] Each column has independent physics and lasers
- [ ] Can deliver trash to any column via crane vehicle

---

## Phase 12: AI Operators `[ ]`

**Goal**: AI-controlled crane vehicles that operate autonomously. Player becomes a manager overseeing multiple AI operators.

**Key Concepts**: Game AI, heuristic evaluation, strategy patterns, autonomous agents

**Tasks**:
- [ ] Create `AIOperator` interface — drives vehicle, grabs from hopper, delivers to columns
- [ ] Implement `BasicAI` — grabs next item, delivers to least-full column
- [ ] Implement `EfficientAI` — picks items that best fill current laser lines
- [ ] Implement `SpeedAI` — prioritizes throughput over precision
- [ ] Implement `EmergencyAI` — clears landscape debris and handles overflow
- [ ] Assign/reassign AI operators to vehicles via UI
- [ ] Visual indicators showing AI-controlled vehicles vs human
- [ ] AI decision rate: evaluate every 500ms (not every frame)

**Acceptance Criteria**:
- [ ] AI vehicles drive, grab, and deliver autonomously
- [ ] Different strategies produce visibly different behaviors
- [ ] Player can switch between manual control and AI for any vehicle
- [ ] Multiple AI vehicles operate simultaneously without conflicts

---

## Phase 13: Polish & Juice `[ ]`

**Goal**: Make the game feel satisfying. Sound, particles, screen effects, UI polish.

**Tasks**:
- [ ] Particle effects: laser fire, glass shatter, concrete crack, piece drop impact
- [ ] Screen shake on laser fire and heavy drops
- [ ] Sound effects: grab, drop, laser charge, laser fire, shatter, engine hum
- [ ] Background music — industrial/ambient
- [ ] UI polish: smooth transitions, button feedback, loading states
- [ ] Piece preview — show what's coming next in the hopper
- [ ] Tutorial/onboarding for new players

---

## Phase 14: Mobile & Touch Polish `[ ]`

**Goal**: First-class mobile experience optimized for the landscape/driving gameplay.

**Tasks**:
- [ ] Touch controls: drag to drive, tap hopper to grab, tap column to deliver
- [ ] Responsive layout for phone screens (landscape orientation)
- [ ] PWA manifest + service worker
- [ ] Prevent accidental browser gestures
- [ ] Test on iOS Safari and Android Chrome
- [ ] Capacitor config for native builds

---

## Phase 15: Platform Distribution `[ ]`

**Goal**: Package for Steam and mobile app stores.

**Tasks**:
- [ ] Electron wrapper with Steam API
- [ ] Capacitor iOS/Android builds
- [ ] Gamepad support for Steam
- [ ] App store assets and descriptions

---

## Future: Special Materials Backlog

These use the `SpecialMaterialSystem` + handler pattern (see `systems/handlers/GlassHandler.ts` as reference). Each is a new handler file + one `registerHandler()` call.

| Material | Behavior | Handler Approach |
|----------|----------|-----------------|
| **Glass** | Shatters on impact into fragments | `[x]` Implemented — radial fracture from collision point |
| **Concrete** | Cracks in half on hard impact | `[x]` Implemented — single radial cut at contact point |
| **Explosive** | On impact, pushes all nearby bodies outward in a blast radius | `applyForce()` to bodies within radius. Remove explosive body, spawn shockwave |
| **Nail** | Penetrates softer materials on impact | Compare density, polygon-split the other piece. Nail embeds or passes through |
| **Transmuter** | Changes the material of any piece it touches | Swap `gameData.material` of the OTHER body. Transmuter consumed |
| **Magnet** | Attracts nearby metal pieces | Per-frame force to nearby metal bodies |
| **Ice** | Low friction, melts over time (shrinks) | Per-frame area reduction, remove when too small |
| **Radioactive** | Slowly damages adjacent pieces, breaking them down | Per-frame area reduction on touching bodies |

---

## Development Velocity Notes

- **Phases 1-6**: Column mechanics — DONE ✓ (foundation, crane, pieces, materials, lasers, slicing)
- **Phases 7-8**: The big pivot — landscape + driving transforms the game from Tetris-clone to unique experience
- **Phase 9**: Composite shapes — adds visual identity and strategic depth
- **Phase 10**: Pressure systems — this is where "fun" comes from
- **Phases 11-12**: The grand vision — multi-column management + AI operators
- **Phases 13-15**: Polish and distribution — only after gameplay is solid
