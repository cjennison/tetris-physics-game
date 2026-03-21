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

## Phase 4: Settling Detection `[~]`

**Goal**: Detect when a dropped piece has stopped moving. Transition state machine correctly.

**Key Concepts**: Velocity thresholds, frame counting, state machines in games

**Tasks**:
- [x] Track velocity of active piece after drop
- [x] Implement settling check: velocity < threshold for N consecutive frames
- [x] State machine transitions: DROPPING → SETTLING → (next state)
- [ ] Visual indicator when piece is "settling" (brief flash or opacity change)
- [ ] Handle edge case: piece bounces off and never settles (timeout → force settle)

**Acceptance Criteria**:
- [ ] Piece is detected as settled within 1-2 seconds of stopping
- [ ] State machine transitions correctly through all states
- [ ] No infinite loops in state machine
- [ ] Stacked pieces settle correctly even when wobbling

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

## Phase 7: Scoring & HUD `[ ]`

**Goal**: Points for clears, score display, level progression, next piece, game stats.

**Key Concepts**: UI in Phaser, score systems, difficulty curves

**Tasks**:
- [ ] Create `ScoringSystem` — points per laser clear, combo multiplier
- [ ] Create `HUD` — score, level, lines cleared, next piece
- [ ] Implement combo: clearing multiple lasers within 3 seconds multiplies score
- [ ] Level progression: every 10 lines, gravity increases slightly
- [ ] Style HUD to match TRASH aesthetic

**Acceptance Criteria**:
- [ ] Score increases on laser clears
- [ ] Combo multiplier works for rapid clears
- [ ] Level and gravity increase over time
- [ ] HUD is readable and doesn't obstruct gameplay

---

## Phase 8: Game Over & Polish `[ ]`

**Goal**: Game over detection, restart, visual/audio polish.

**Key Concepts**: Game state management, particle systems, screen shake, juice

**Tasks**:
- [ ] Detect game over: any piece body overlaps crane rail Y
- [ ] Game over screen with final score
- [ ] Restart button
- [ ] Screen shake on laser fire
- [ ] Piece drop sound, laser sound, game over sound (Web Audio API)
- [ ] Piece shadow/ghost showing where it will land
- [ ] Background grid pattern
- [ ] Smooth color transitions for piece fragments

**Acceptance Criteria**:
- [ ] Game over triggers correctly when pieces reach the top
- [ ] Can restart without page reload
- [ ] At least 3 sound effects
- [ ] Visual polish makes the game feel satisfying

---

## Phase 9: Mobile & Touch Polish `[ ]`

**Goal**: First-class mobile experience. Touch controls, responsive layout, PWA.

**Key Concepts**: Touch events, responsive design, PWA manifest, Capacitor basics

**Tasks**:
- [ ] Touch controls: drag left/right to move crane, tap to drop
- [ ] Responsive canvas sizing for different phone screens
- [ ] PWA manifest + service worker (installable on home screen)
- [ ] Prevent accidental zoom/scroll on mobile
- [ ] Test on iOS Safari and Android Chrome
- [ ] Add Capacitor config for future native build

**Acceptance Criteria**:
- [ ] Playable on phone via touch with no keyboard
- [ ] No accidental browser gestures during gameplay
- [ ] Installable as PWA
- [ ] Looks good on both phone and desktop

---

## Phase 10: Multi-Board Foundation `[ ]`

**Goal**: Run 2+ game boards simultaneously. Zoom in/out between boards.

**Key Concepts**: Multiple Phaser scenes, camera transitions, viewport management

**Tasks**:
- [ ] Extend `GameManager` to support N boards with viewport layout
- [ ] Implement zoom-in animation: tapping a board smoothly zooms camera to fill screen
- [ ] Implement zoom-out: leaving a board smoothly zooms back to overview
- [ ] In overview mode, all boards run and render simultaneously
- [ ] In focused mode, only the focused board receives input
- [ ] Minimap or board selector UI

**Acceptance Criteria**:
- [ ] 2+ boards visible simultaneously in overview
- [ ] Smooth animated zoom transition (no snap)
- [ ] Each board has independent physics and state
- [ ] Can play one board while others continue running

---

## Phase 11: AI Players `[ ]`

**Goal**: Basic AI that can play TRASH on its own board. Multiple strategies.

**Key Concepts**: Game AI, heuristic evaluation, action interfaces

**Tasks**:
- [ ] Create `AIController` interface matching `GameActions`
- [ ] Implement `BasicAI` — drops pieces to minimize height variance
- [ ] Implement `AggressiveAI` — prioritizes laser clears
- [ ] Implement `DefensiveAI` — builds flat, stable towers
- [ ] AI decision rate: evaluate every 500ms (not every frame)
- [ ] Visual indicator showing which boards are AI-controlled

**Acceptance Criteria**:
- [ ] AI plays complete games without errors
- [ ] Different strategies produce visibly different play styles
- [ ] AI boards run alongside human board
- [ ] Can watch AI play in zoom-in view

---

## Phase 12: Platform Distribution `[ ]`

**Goal**: Package for Steam (Electron) and mobile app stores (Capacitor).

**Key Concepts**: Electron packaging, Capacitor builds, app store requirements

**Tasks**:
- [ ] Electron wrapper with Steam API hooks
- [ ] Capacitor iOS build
- [ ] Capacitor Android build
- [ ] Platform-specific input handling (gamepad for Steam)
- [ ] Steam achievements integration
- [ ] App store assets (icons, screenshots, descriptions)

**Acceptance Criteria**:
- [ ] Runs as standalone desktop app via Electron
- [ ] Builds for iOS and Android via Capacitor
- [ ] Gamepad input works on Steam version
- [ ] All platform builds pass basic smoke test

---

## Development Velocity Notes

- **Phases 1-4**: Foundation — must be solid before moving forward
- **Phases 5-6**: Core mechanic — the laser slicing is the hardest part, budget extra time
- **Phases 7-8**: Polish — makes it feel like a real game
- **Phase 9**: Mobile — critical for phone testing workflow
- **Phases 10-12**: Grand vision — each is independent and can be reordered
