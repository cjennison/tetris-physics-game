---
name: game-implement
description: "Implement a feature or fix for TRASH game from a TODO description. Reads the development plan, writes code with educational comments, builds, and commits."
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
argument-hint: <description-of-change>
---

# Game Implement

Implements a feature, fix, or improvement for the TRASH game. This skill is the primary way changes get made to the codebase.

## Usage

```
/game-implement Add crane pendulum physics with rope constraint
```

Or called by claude-system when dispatching a TODO tagged with `trash-game`.

## Process

### Step 1: Understand the Current State

1. Read `DEVELOPMENT_PLAN.md` to understand what phase we're in and what's already done
2. Read `CLAUDE.md` for architecture rules and coding standards
3. Identify which phase/task the requested work falls under

### Step 2: Plan the Implementation

1. Identify which files need to be created or modified
2. Check if prerequisite systems exist (e.g., don't build lasers before pieces)
3. If the work requires a new system, follow the architecture in CLAUDE.md:
   - One file per system in `src/systems/`
   - Entity wrappers in `src/entities/`
   - Types in `src/types.ts`
   - Config values in `src/config.ts`

### Step 3: Implement

1. Write code following the project's coding standards:
   - TypeScript strict mode (no `any`)
   - Add `LEARN:` comments explaining game dev concepts
   - Use EventBus for cross-system communication
   - All magic numbers go in `config.ts`
2. Run `npx tsc --noEmit` to check for type errors
3. Run `npm run build` to verify the build succeeds

### Step 4: Update the Plan

1. Update `DEVELOPMENT_PLAN.md` — check off completed tasks
2. If you completed all tasks in a phase, mark the phase as `[x]`

### Step 5: Commit and Push

1. `git add` only the specific files you changed
2. Commit with message format: `phase-N: description`
3. Push to trigger Vercel deployment

### Educational Mandate

Every new file or significant function MUST include a `LEARN:` comment block explaining:
- What game dev concept this implements
- Why this approach was chosen
- How it connects to the broader architecture

This is a learning project. The code IS the tutorial.
