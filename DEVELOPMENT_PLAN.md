# TRASH — Development Plan

## How This Plan Works

Each phase has:
- **Goal**: What we're building
- **Status**: `[ ]` not started, `[~]` in progress, `[x]` complete

See `GAME_VISION.md` for the full game design document.

---

## Phase 1: Skeleton `[x]`

Vite + Phaser 3 + Matter.js boilerplate. Basic game canvas.

---

## Phase 2: Column Crane System `[x]`

Pendulum crane with rope constraint inside a single column. Trolley→rope→hook→piece architecture. Keyboard and touch input.

*Note: Column crane was later removed in Phase 8. Pieces now dropped directly from the vehicle.*

---

## Phase 3: Piece System `[x]`

All 7 tetromino shapes (I, O, T, S, Z, L, J) with distinct concave geometry via poly-decomp. Bag randomization. PieceFactory with forced shape/material support.

---

## Phase 4: Materials & Special Behaviors `[x]`

6 materials (aluminum, steel, lead, rubber, concrete, glass) with tunable physics in tuning.json. Material system with:
- Per-material density, friction, restitution, frictionAir, ropeStiffness
- Material colors for visual identification
- SpecialMaterialSystem with collision handlers:
  - **Glass**: Shatters into fragments on hard impact (radial fracture)
  - **Concrete**: Cracks in half on impact (single cut at contact point)
- Size-scaled shatter thresholds (smaller = harder to break)
- 500ms immunity frames for new pieces/fragments
- Weighted random material selection

---

## Phase 5–6: Lasers & Slicing `[x]`

Horizontal laser lines that scan for 90%+ coverage and slice pieces:
- Coverage detection via scanline AABB checks at 2px resolution
- Per-laser charge times (bottom 30s → top 3s gradient)
- Charge bar visual that sweeps left→right before firing
- Polygon slicing at band boundaries (keeps above/below, destroys middle)
- Per-sub-part slicing for compound bodies
- 2-second cooldown after firing

---

## Phase 7: Landscape & Hopper `[x]`

Refactored from single column to full landscape:
- **LandscapeScene**: Single Phaser scene with shared Matter.js world
- **ProcessingColumn**: Refactored from GameInstance (plain class, not a scene)
- **Hopper/Chute**: Pipe from upper-left wall, pieces spawn off-screen and slide down angled ramp into a pile on the ground
- **Hilly terrain**: Defined as terrain points, physics via staircase of flat rectangles every 10px
- **Boundary walls**: Left wall with gap for chute, right wall
- **Column gap**: Processing column sunk below ground at hilltop
- **Invisible bridge**: Vehicle drives over column opening, pieces fall through
- **Zoom**: Mouse wheel / pinch zoom (0.4x–2.0x)

---

## Phase 8: Crane Vehicle `[x]`

Driveable physics crane vehicle:
- **Real wheels**: Two circle bodies connected to chassis via axle constraints, motor-driven via angular velocity
- **Rotating boom arm**: Pivots from chassis top, ↑↓ controls angle (-1.3 to 1.3 rad)
- **Adjustable rope**: SHIFT+↑↓ reels in/out (10–140px), hook dangles from boom tip
- **Grab/release**: SPACE grabs nearest piece to hook, SPACE again releases (drops into column if over column zone)
- **Physics interactions**: Vehicle pushes pieces, pieces block vehicle, heavy loads cause tipping
- **Hook physics**: Collides with terrain but passes through pieces (can lower into pile)
- **Mobile touch controls**: Virtual buttons for drive, boom, rope, and grab
- **Column delivery**: Vehicle drives over bridge, drops piece through into column

**Controls**:
- `← →` : Drive (spins wheels)
- `↑ ↓` : Rotate boom arm
- `SHIFT+↑↓` : Reel rope in/out
- `SPACE` : Grab / release piece
- Mobile: on-screen virtual buttons

---

## Phase 9: Composite Shapes `[ ]`

**Goal**: Complex real-world trash shapes beyond tetrominoes.

**Tasks**:
- [ ] Expand PieceDefinitions with composite shapes (chair, car, TV, etc.)
- [ ] Multi-material support — different regions have different materials
- [ ] Composite shape categories with spawn weights per difficulty
- [ ] Visual distinction — recognizable objects, not abstract shapes
- [ ] At least 10 composite shapes across household, vehicle, electronics

---

## Phase 10: Overflow & Pressure `[ ]`

**Goal**: Create the pressure loop that makes the game fun/stressful.

**Tasks**:
- [ ] Hopper overflow: pile grows too big → spills across landscape
- [ ] Spilled trash blocks vehicle paths
- [ ] Column overflow: full column rejects pieces
- [ ] Throughput scoring — tons processed per minute
- [ ] Escalation — hopper spawn rate increases over time
- [ ] HUD: hopper count, throughput meter, score

---

## Phase 11: Multi-Column & Camera `[ ]`

**Goal**: Multiple processing columns, smooth zoom transitions.

**Tasks**:
- [ ] Support 2–5 columns in the landscape
- [ ] Each column has independent lasers and physics
- [ ] Earn new columns through progression
- [ ] Overview camera — see all columns + landscape
- [ ] Column status indicators visible in overview

---

## Phase 12: AI Operators `[ ]`

**Goal**: AI-controlled crane vehicles. Player becomes manager.

**Tasks**:
- [ ] AIOperator interface — drives vehicle, grabs, delivers
- [ ] BasicAI — grabs next item, delivers to least-full column
- [ ] EfficientAI — picks items that best fill laser lines
- [ ] SpeedAI — prioritizes throughput over precision
- [ ] Assign/reassign AI operators to vehicles via UI

---

## Phase 13: Polish & Juice `[ ]`

Particles, sound, screen shake, UI polish, tutorial.

---

## Phase 14: Mobile & Touch Polish `[ ]`

Responsive layout, PWA, Capacitor config.

---

## Phase 15: Platform Distribution `[ ]`

Electron (Steam), Capacitor (iOS/Android), gamepad support.

---

## Backlogs

### Physics Tuning
- [ ] Angular damping — pieces rotate too freely after landing
- [ ] Rubber momentum transfer — still pushes heavy pieces slightly
- [ ] Per-material drop timers

### Special Materials (Future)
| Material | Behavior | Status |
|----------|----------|--------|
| Glass | Shatters into fragments | ✅ Done |
| Concrete | Cracks in half | ✅ Done |
| Explosive | Blast radius pushes nearby bodies | Not started |
| Nail | Penetrates softer materials | Not started |
| Transmuter | Changes material of touched pieces | Not started |
| Magnet | Attracts nearby metal | Not started |
| Ice | Low friction, melts over time | Not started |
| Radioactive | Slowly damages adjacent pieces | Not started |

### Dev Infrastructure
- [x] Playwright test harness (10 tests)
- [x] AI playtest system (scripts/playtest.ts)
- [x] Material interaction matrix testing
- [ ] Rebuild dev console for landscape context
- [ ] Rebuild TestAPI for landscape context

---

## Architecture Notes

**Single scene, single physics world**: Everything (hopper, terrain, columns, vehicle, pieces) shares one Phaser Scene and one Matter.js world. This lets pieces physically travel from hopper to column without cross-world hacks.

**Collision categories**:
| Category | Hex | What |
|----------|-----|------|
| WALL/Terrain | 0x0001 | Ground, landscape walls |
| PIECE | 0x0002 | All trash pieces and fragments |
| CRANE | 0x0004 | (Legacy, unused) |
| COLUMN_WALL | 0x0008 | Column side walls and floor |
| VEHICLE | 0x0010 | Chassis, wheels, hook |
| BRIDGE | 0x0020 | Invisible bridge over column gap |

**Key files**:
- `src/core/LandscapeScene.ts` — Top-level scene
- `src/core/ProcessingColumn.ts` — Column with lasers
- `src/landscape/CraneVehicle.ts` — Driveable crane
- `src/landscape/Hopper.ts` — Pipe chute + pile tracking
- `src/landscape/Terrain.ts` — Hilly ground surface
- `src/systems/LaserSystem.ts` — Coverage + slicing
- `src/systems/SpecialMaterialSystem.ts` — Glass/concrete handlers
- `src/pieces/PieceFactory.ts` — Piece creation with materials
- `src/tuning.json` — All tunable game parameters
