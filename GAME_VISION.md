# TRASH — Game Vision Document

## One-Line Pitch

A physics-based garbage processing game where you drive crane vehicles across a landscape, grab trash from a hopper, and drop it into processing columns where lasers break it down — while managing an ever-growing flood of incoming waste.

## The Core Fantasy

You're running a **garbage processing plant**. Trucks dump trash into a hopper on the left side of the landscape. Your job: grab pieces with crane vehicles, carry them to processing columns (boards), and drop them in strategically so the laser incinerators can break them down efficiently. The trash never stops coming. If you can't keep up, the hopper overflows, columns overflow, and the landscape becomes a disaster zone.

Eventually, you hire AI operators to run most of the cranes autonomously. You become the **manager** — zooming between columns, optimizing AI strategies, handling emergencies, and expanding your operation.

## The Landscape

```
                                    Board 1    Board 2    Board 3
  TRUCKS →  [  HOPPER  ]  ←crane→  [column]   [column]   [column]  → ...
            (fills up)     drives    lasers     lasers     lasers
                          on ground  process    process    process
```

### Layout
- **Left side**: The hopper — a large container where trucks dump incoming trash
- **Ground level**: A flat landscape the crane vehicles drive across
- **Columns (boards)**: Vertical processing shafts sunk into the ground
  - Board 1 is closest to the hopper (shortest drive)
  - Board 2 is further (longer drive, but less congested)
  - More boards unlocked as you progress
- **Everything is one continuous plane** — no separate screens

### The Hopper
- Trucks arrive on a schedule, dumping composite trash items into the hopper
- The hopper has a capacity bar — if it fills up, trash starts spilling onto the landscape
- Spilled trash blocks crane paths and creates emergencies
- The hopper is the primary source of pressure — it NEVER stops filling
- Pull rate must exceed fill rate to survive

### Crane Vehicles
- Each crane is a **driveable vehicle** on the ground plane
- Drive left/right across the landscape
- Has a **magnet crane arm** that extends upward to grab items from the hopper
- Carry the grabbed item across the landscape to a column
- Position over the column, then the crane arm lowers the piece into the column
- The piece then behaves like current gameplay — pendulum swing, drop, physics
- **Cranes cannot fall into columns** — they drive over them on a bridge/rail
- **BUT** pieces CAN fall out of columns and land on the landscape, blocking crane paths
- Multiple cranes can operate simultaneously (one per player/AI)

### Processing Columns (Boards)
- Each column is what we've already built — a vertical shaft with:
  - Crane hook at the top (receives pieces from the vehicle crane)
  - Pendulum physics for positioning
  - Laser incinerators at various heights
  - Charge-up times (bottom slow, top fast)
  - Physics-based stacking and slicing
- Columns have a max height — if trash reaches the top, the column is "full"
  - A full column can't accept new pieces
  - Overflow pieces fall out and land on the landscape
  - Adjacent columns might catch spillover

## Trash Types

### Standard Tetrominoes (Current)
The 7 classic shapes (I, O, T, S, Z, L, J) in various materials.

### Composite Shapes (New)
Real-world objects defined as complex polygons with mixed materials:

| Category | Examples | Properties |
|----------|----------|-----------|
| **Household** | Chair, Table, TV, Lamp, Bed frame | Awkward shapes, mixed wood/metal/glass |
| **Vehicles** | Car, Bicycle, Shopping cart, Motorcycle | Large, heavy steel frame + glass windows + rubber tires |
| **Construction** | Brick stack, Pipe bundle, I-beam, Concrete slab | Heavy, geometric, stack well |
| **Electronics** | Phone, Monitor, Keyboard, Server rack | Small, fragile glass screens |
| **Appliances** | Fridge, Washing machine, Microwave | Boxy, heavy, metal |
| **Fantasy/Fun** | Crystal ball, Anvil, Treasure chest, Giant sword | Special properties, rare |
| **Nature** | Tree stump, Boulder, Ice block | Organic shapes |

### Multi-Material Composites
A single trash item can have regions of different materials:
- **Car**: Steel body, glass windows, rubber bumpers
- **TV**: Plastic frame, glass screen
- When a laser slices through a car, the glass windows shatter while the steel frame becomes clean fragments
- This creates emergent gameplay from material interactions

## Pressure & Progression

### The Escalation
1. **Early game**: One column, slow hopper, simple tetrominoes
2. **Mid game**: 2-3 columns, faster hopper, composite shapes appear
3. **Late game**: 5+ columns, frantic hopper, massive composite shapes (cars, furniture)
4. **Endgame**: AI operators managing most columns, player oversees and handles emergencies

### Scoring = Throughput
- **Tons processed per minute** — primary metric
- **Hopper efficiency** — bonus for keeping hopper below 50%
- **Clean landscape** — bonus for no spilled trash on the ground
- **Combo chains** — multiple lasers firing across multiple columns in quick succession
- **Speed bonus** — processing a piece within N seconds of grabbing it

### Progression Unlocks
- More processing columns (boards)
- More crane vehicles
- AI operators (basic → advanced strategies)
- Faster lasers (upgrades)
- Bigger hopper capacity
- New trash categories (harder but higher value)

## AI Operators

### The Grand Vision
Each crane vehicle can be assigned an AI operator with a strategy:

| Strategy | Behavior |
|----------|----------|
| **Efficient** | Picks pieces that best fill current laser lines |
| **Speed** | Grabs and drops as fast as possible, less precise |
| **Heavy-first** | Prioritizes heavy items (lead, steel) for stable bases |
| **Fragile-handler** | Carefully places glass/concrete to avoid shattering |
| **Emergency** | Focuses on clearing hopper overflow and landscape debris |

### Player as Manager
- Zoom out to see all columns and the landscape
- Tap a column to zoom in and take direct control
- Assign/reassign AI operators to vehicles
- Upgrade AI strategies with earned currency
- Handle emergencies: overflow, landscape blockage, column full

## Key Design Principles

1. **The trash never stops** — constant pressure, like Overcooked
2. **Physics makes it funny** — things go wrong in entertaining ways
3. **AI management is the endgame** — playing one crane is the tutorial, managing 10 is the game
4. **Materials matter** — choosing how to handle glass vs lead vs rubber IS the strategy
5. **Landscape is shared** — spilled trash affects ALL operations, not just one column
6. **Composite shapes are the puzzle** — fitting a car into a column is the challenge

## Platform Targets
- **Mobile** (primary) — touch to drive crane, tap to grab/drop
- **Steam** — keyboard/mouse/gamepad, multi-monitor potential
- **Web** (dev/testing) — current Vercel deployment

## Art Direction (Future)
- Industrial/junkyard aesthetic
- Dark backgrounds, bright lasers, colorful trash
- Satisfying particle effects on laser fires
- Camera shake on heavy drops
- Eventually: pixel art or stylized 3D
