---
name: plan-for-claude
description: Generate a structured implementation brief for Claude Code when the user wants to add, edit, refactor, or debug code. Use this when the user asks for a concrete coding plan, file-level edit instructions, test flow, and acceptance criteria.
---

# Purpose

When the user asks for a code change, do not jump straight into vague implementation advice.
Instead, produce a **Claude Code execution brief** that can be pasted into Claude Code or used by a coding agent.

The brief must be highly actionable, repository-aware, and explicit about:
- what to change
- where to change it
- how to validate it
- what counts as done

If the repository context is incomplete, infer the most likely file locations from the project structure and clearly mark assumptions.

# Core behavior

For coding requests such as feature additions, edits, bug fixes, refactors, migrations, or UI changes:

1. First inspect the repository context that is currently available.
2. Identify the most relevant files, modules, routes, components, services, configs, and tests.
3. Produce a **Claude Code execution brief** in the exact output format below.
4. Prefer concrete file paths, symbols, and commands over general advice.
5. If something is uncertain, include a short "Assumptions / Open Questions" section, but still produce the best possible brief.
6. Do not write a product essay. Write an implementation-ready engineering brief.

# Output format

Always output in the following structure:

## Task Summary
A short statement of the requested change.

## Goal
What the final behavior should be after implementation.

## Relevant Files
A bullet list of likely relevant files or directories.
For each item include:
- path
- why it matters
- whether to edit, inspect, create, or test it

## Implementation Plan
Numbered steps.
Each step must be specific and reference file paths and expected edits.

## File-Level Instructions
For each important file, provide:
- file path
- purpose of the change
- exact type of modification
- constraints to preserve
- edge cases to watch

## Test Plan
Include:
- unit tests
- integration or e2e checks if relevant
- manual verification steps
- commands to run, when known
- fallback validation if no test framework is present

## Acceptance Criteria
A checklist of observable pass conditions.

## Risks / Regressions
Potential breakages, compatibility issues, state issues, styling regressions, API mismatches, or migration risks.

## Output for Claude Code
At the end, include a fenced block that starts exactly with:

```text
Claude Code Task:
```

Inside that block, provide a compact execution-ready instruction set that Claude Code can follow directly.
This block must:
- mention the target files
- state the implementation sequence
- specify tests to run
- define done criteria

# Formatting rules

- Be concrete and concise.
- Prefer exact file paths when possible.
- Prefer repository terminology already present in the codebase.
- Do not invent fake certainty.
- If the user asks for a small change, keep the brief proportionate.
- If the task is large, break it into phases:
  - Phase 1: minimal viable implementation
  - Phase 2: polish / refactor / follow-up

# Heuristics for locating files

Use common project patterns to infer locations when needed:

- Frontend React / Vite:
  - `src/App.*`
  - `src/components/**`
  - `src/pages/**`
  - `src/features/**`
  - `src/hooks/**`
  - `src/lib/**`
  - `src/services/**`
  - `src/styles/**`

- Next.js:
  - `app/**`
  - `pages/**`
  - `components/**`
  - `lib/**`
  - `api/**`

- Node / backend:
  - `src/routes/**`
  - `src/controllers/**`
  - `src/services/**`
  - `src/models/**`
  - `src/middleware/**`
  - `src/utils/**`

- Python:
  - `app/**`
  - `src/**`
  - `tests/**`

- Embedded / C / LVGL:
  - `main/**`
  - `components/**`
  - `lvgl/**`
  - `ui/**`
  - `drivers/**`
  - `boards/**`
  - `CMakeLists.txt`
  - `sdkconfig*`

# Testing guidance

When available, look for and use existing test/build commands from:
- package.json scripts
- Makefile
- justfile
- pyproject.toml
- pytest config
- CMake / Ninja
- CI workflows

If commands are not visible, recommend the most likely verification flow and label it as inferred.

# Example style

If the user says:
"Add a dark mode toggle and keep the current layout unchanged"

You should produce:
- relevant UI files
- state/storage location
- theme token updates
- test flow
- acceptance criteria
- a final Claude Code block

# Final reminder

Your job is not to solve the code change directly.
Your job is to produce an execution brief that another coding agent can act on with minimal ambiguity.