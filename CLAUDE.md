# TRASH — Physics-Based Tetris

## What Is This Game?

TRASH is a physics-based Tetris-like game where a crane drops tetromino-shaped pieces onto a playing field. Unlike classic Tetris with its grid-based snapping, pieces here obey real physics — they swing on the crane, tumble when dropped, and pile up organically. Horizontal laser lines scan for 90%+ coverage and destroy the portions of pieces within their band, causing everything above to collapse.

The grand vision: many AI players run boards simultaneously, and the human manages them — zooming into any board to take direct control, then zooming out to oversee the fleet.

## Engine & Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Game engine | **Phaser 3.90** | Mature 2D engine, huge community, exports everywhere |
| Physics | **Matter.js** (built into Phaser) | Rigid body physics, constraints (crane rope), polygon bodies |
| Language | **TypeScript** (strict) | Type safety, IDE support, learnable |
| Bundler | **Vite** | Fast dev server, instant HMR, simple config |
| Polygon math | **PolyK** (added in Phase 6) | Polygon slicing for laser destruction |
| Deploy (dev) | **Vercel** | Auto-deploy on push, instant phone testing |
| Mobile (prod) | **Capacitor** (Phase 8+) | Wraps web app as native iOS/Android |
| Steam (prod) | **Electron** (Phase 8+) | Wraps web app as desktop executable |

## Architecture

### Scene-Per-Board Isolation

Each game board is a **Phaser Scene** with its own Matter.js physics world, camera, input, and display list. This means:
- Bodies in Board A never collide with Board B
- Each board has independent state machines
- Adding/removing boards is just adding/removing scenes
- `GameManager` orchestrates scene lifecycle

### System Composition

Each `GameInstance` (scene) owns these systems:

| System | Responsibility |
|--------|---------------|
| `CraneSystem` | Trolley movement, rope constraint, pendulum physics |
| `PieceSystem` | Piece spawning, lifecycle, settling detection |
| `LaserSystem` | Coverage checking, cooldown, slice execution |
| `ScoringSystem` | Points, combos, level progression |
| `InputSystem` | Keyboard/touch → abstract `GameActions` |

Systems communicate via `EventBus` (loose coupling), not direct imports.

### State Machine

```
SPAWNING → SWINGING → DROPPING → SETTLING → LASER_CHECK → SPAWNING
                                                  ↓
                                              GAME_OVER
```

## Project Structure

```
src/
├── main.ts              # Entry point — creates Phaser.Game + GameManager
├── config.ts            # All tunable constants in one place
├── types.ts             # Shared TypeScript interfaces
├── core/
│   ├── GameManager.ts   # Creates/destroys game board scenes
│   ├── GameInstance.ts  # A single board (Phaser Scene + systems)
│   └── EventBus.ts      # Phaser EventEmitter for cross-system events
├── systems/             # One file per system (Phase 2+)
├── entities/            # Piece, Crane, Rope, LaserLine, Wall (Phase 2+)
├── pieces/
│   ├── PieceDefinitions.ts  # Vertex data for all shapes
│   ├── PieceFactory.ts      # Creates Matter bodies from definitions (Phase 3)
│   └── PieceSlicer.ts       # Polygon slicing for lasers (Phase 6)
├── ai/                  # AI controllers (Phase 10+)
├── ui/                  # HUD, menus, overlays (Phase 7+)
└── utils/               # Math helpers, debug tools
```

## Development Workflow

### Hands-Off Development via claude-system

This game is developed primarily through the claude-system task pipeline:

1. **Capture ideas** from phone via mobile-capture → creates TODOs
2. **TODOs auto-refine** with context about TRASH architecture
3. **game-implement skill** executes TODOs by:
   - Reading DEVELOPMENT_PLAN.md for current phase
   - Checking out a feature branch
   - Implementing the change with educational comments
   - Running typecheck + build
   - Committing and pushing
   - Vercel auto-deploys for phone testing
4. **game-builder loop** monitors build status

### Continuous Deployment

Every push to `main` auto-deploys to Vercel. Test on your phone at the Vercel URL.

Feature branches get preview deployments automatically.

### Educational Comments

Every file includes `LEARN:` comments explaining game dev concepts for someone new to game development. These are part of the codebase, not separate docs.

## Coding Standards

### Must Follow

- **TypeScript strict mode** — no `any`, no implicit returns
- **One system per file** — systems are self-contained
- **Config in config.ts** — no magic numbers in logic files
- **Events for cross-system communication** — never import one system into another
- **LEARN comments** — explain the "why" for game dev patterns
- **Modular for multiplication** — every system must work when N instances exist

### Git Workflow

- `main` = always deployable
- Feature branches for each phase/feature
- Commit messages: `phase-N: description` (e.g., `phase-2: add crane system with pendulum physics`)
- Only `git add` specific files — never `git add .` or `git add -A`

### Testing on Phone

After any change:
1. Push to main (or feature branch)
2. Vercel builds automatically
3. Open Vercel URL on phone
4. Game runs in mobile browser with touch input

## Key Design Decisions

### Why Not Godot/Unity?

- Claude CLI can directly edit TypeScript files (can't easily edit .tscn or .unity scenes)
- Web-first means instant deploy + phone testing via URL
- All game-creator skills are Phaser-based
- TypeScript is more transferable than GDScript
- Capacitor + Electron cover mobile + Steam distribution

### Why Matter.js Over Box2D?

- Built into Phaser (no extra dependency)
- Constraint system perfect for crane rope
- fromVertices() makes custom polygon shapes easy
- Good enough performance for 2D tetromino physics

### Why PolyK for Slicing?

- Proven polygon slicing algorithm
- Works with Matter.js vertex format
- Small library, no heavy dependencies
- Used in production Phaser physics games

## Phase Reference

See DEVELOPMENT_PLAN.md for the full phased roadmap. Current phase progress is tracked in that file.
