---
name: game-playtest
description: "Play TRASH autonomously via Playwright, take screenshots, analyze game feel, and write a design feedback report with actionable TODOs."
allowed-tools: Bash, Read, Grep, Glob, Write, Edit
argument-hint: [--rounds N] [--strategy center|sweep|random|swing|glass|all] [--focus "specific thing to test"]
---

# Game Playtest — AI Plays TRASH

Launches the game in a headless browser, plays multiple rounds with different strategies, takes screenshots, and produces a design feedback report.

## Usage

```
/game-playtest
/game-playtest --rounds 15 --strategy glass --focus "test if glass T-blocks shatter correctly"
```

## Process

### Step 1: Start the Dev Server (if needed)

```bash
cd ~/src/tetris-physics-game
# Check if dev server is running
curl -s http://localhost:5173 > /dev/null 2>&1 || npm run dev &
sleep 3
```

### Step 2: Run the Playtest

```bash
cd ~/src/tetris-physics-game
ROUNDS=${rounds:-8} STRATEGY=${strategy:-all} npm run playtest
```

This produces:
- `playtest-results/report.json` — structured data about every drop
- `playtest-results/round-*.png` — screenshot after each drop
- `playtest-results/final-board.png` — final board state

### Step 3: Analyze the Report

Read `playtest-results/report.json` and analyze:

**Quantitative checks:**
- Settle times: are any drops taking too long? (>4s = physics issue)
- Piece count: is it growing too fast? (>40 = need lasers soon)
- Shard count: are glass pieces shattering as expected?
- Height profile: is the board filling evenly or lopsided?

**Visual analysis:**
- Read the screenshots with the Read tool (they're images, Claude can see them)
- Look for: overlapping pieces, pieces outside walls, visual glitches
- Evaluate: does the board look satisfying? Is there good variety?
- Check: are material colors distinguishable? Is glass translucent?

### Step 4: Write the Report

Output a structured report with sections:

```
## Playtest Report — [date]

### Summary
- Rounds played: N
- Strategies tested: [list]
- Game over: yes/no at round N

### Physics Feel
- [observations about drop feel, swing, settling]

### Glass Behavior
- [observations about shattering, shard count, cascade prevention]

### Visual Assessment
- [observations from screenshots — colors, contrast, readability]

### Issues Found
- [list of bugs or problems]

### Design Recommendations
- [subjective suggestions for improving the game]
```

### Step 5: Create TODOs (if applicable)

For any bugs or strong design recommendations, create a TODO:

```bash
curl -s -X POST http://localhost:3141/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "<issue>", "description": "<details from playtest>", "tags": ["trash-game", "playtest"]}'
```

## Strategy Reference

| Strategy | What it tests |
|----------|--------------|
| `center` | Basic stacking — do pieces pile up correctly? |
| `sweep` | Coverage — do pieces distribute across the board? |
| `random` | General chaos — does anything break? |
| `swing` | Pendulum physics — does momentum feel right? |
| `glass` | Shatter mechanics — does glass break and settle? |
| `all` | Cycles through all strategies |

## Focus Mode

When `--focus` is provided, adapt the playtest:
- Force specific piece types or materials relevant to the focus
- Take extra screenshots at key moments
- Write a more detailed analysis of the focused area
- E.g., `--focus "glass T-block"` → force glass + T-Block, analyze shatter pattern
