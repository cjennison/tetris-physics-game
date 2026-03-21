---
name: game-status
description: "Report the current development status of TRASH — what phase, what's done, what's next, and any blockers."
allowed-tools: Bash, Read, Grep, Glob
argument-hint: ""
---

# Game Status

Reports the current state of TRASH game development.

## Usage

```
/game-status
```

## Process

1. Read `DEVELOPMENT_PLAN.md` and parse checkbox status for each phase
2. Run `npx tsc --noEmit` to check if the project compiles
3. Check `git log --oneline -10` for recent changes
4. Check if Vercel deployment is live (if configured)

## Output Format

```
## TRASH Game Status

**Current Phase**: Phase N — <name>
**Phase Progress**: X/Y tasks complete

**Recently Completed**:
- <task 1>
- <task 2>

**Next Up**:
- <next task>
- <next task>

**Build Status**: ✓ Compiles / ✗ Type errors
**Last Deploy**: <date from git log>
```
