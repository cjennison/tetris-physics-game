---
name: game-teach
description: "Explain a game development concept in the context of TRASH's codebase. Points to actual code, not abstract theory."
allowed-tools: Bash, Read, Grep, Glob
argument-hint: <concept>
---

# Game Teach

Explains a game development concept using TRASH's actual code as examples.

## Usage

```
/game-teach "What is a physics constraint?"
/game-teach "How does the state machine work?"
/game-teach "Why scenes instead of ECS?"
```

## Process

1. Identify the concept being asked about
2. Find the relevant code in the TRASH codebase that implements it
3. Explain the concept in plain language, referencing specific files and line numbers
4. Compare to how other games/engines do it (if helpful)
5. Suggest what to read next to deepen understanding

## Guidelines

- Start with the simplest explanation, then go deeper
- Always reference actual TRASH code — never explain in abstract
- Use analogies to non-game-dev concepts when helpful
- If the concept hasn't been implemented yet, explain what it WILL look like when we build it and reference DEVELOPMENT_PLAN.md
- End with "Try this:" — a concrete thing to try or observe in the running game
