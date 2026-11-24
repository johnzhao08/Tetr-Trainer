---
name: pr-audit
description: Audit the current feature branch for organization, systems design, project-rule compliance and PR hygiene before opening any pull request, and teach the owner the reasoning behind every finding. Use before EVERY PR in this repo, when the owner says "audit", "review the branch", "is this ready for a PR", or "check the structure", and whenever a PR is about to be created.
---

# PR audit (organization and systems design)

You are a senior engineer reviewing a student's branch. Two jobs, equally important:
1. Make sure the branch is in excellent shape before it becomes a PR.
2. Teach. For every finding, explain the principle in plain words so the owner learns it.

Read `CLAUDE.local.md` first if it exists; otherwise use `AGENTS.md`. Those rules are the standard. Never edit code during the audit. Propose fixes; apply them only after the owner (or the orchestrator acting for them) says yes.

## Step 1: Collect facts
    git fetch origin
    git rev-parse --abbrev-ref HEAD
    git log --oneline origin/main..HEAD
    git diff --stat origin/main...HEAD
    git diff --numstat origin/main...HEAD
- Branch name is `feature/<name>`, `fix/<name>` or `chore/<name>` and matches the diff.
- Line count: sum added lines of hand-written files; exclude lockfiles and generated code but report them separately. Limit 1,000; if over, propose a split.
- Commits: 20 words or fewer, no em dashes, no AI attribution anywhere (check `git log --format=%B origin/main..HEAD` and grep the diff).

## Step 2: Check the hard project rules
Report each as pass, fail or not applicable with file:line evidence.
1. **Engine purity.** `src/core/` never imports React, DOM, `window`, `localStorage` or `performance`. Storage is passed in as a parameter (see `loadSettings(storage)`).
2. **Determinism.** Every random source in `src/core/` is seeded (bag, garbage, drills). No `Math.random` or `Date.now` in `src/core/`.
3. **Undo safety.** Any new per-game state lives in `GameState` (or is restored by `Game.undo`), so undo and retry-from-here restore it exactly.
4. **Season 2 rules.** Attack, B2B, Surge, all-clear and spin rules match `GAMEPLAY_SPEC.md`; no Season 1 values (all clear 10, logarithmic B2B chaining) reappear.
5. **Settings button.** `SettingsButton` is the rightmost header control on home, freeplay and every module (AGENTS.md).
6. **Catalog integrity.** Every catalog entry marked ready has a screen; `tests/catalog.test.ts` passes.
7. **Saved data.** Anything written to browser storage is versioned, validated on load and survives corrupt or missing data.

## Step 3: Organization review
Layout matches the documented structure (`src/core` engine and rules, `src/ui` screens); UI does not hold game rules; one job per file (flag files over ~300 lines, functions over ~50); clear names; single source of truth for constants; no dead code or stray logs; every touched file belongs to this feature.

## Step 4: Systems design review
Data shapes fit their use; state changes are atomic with respect to undo; per-frame work stays cheap (no search on every render); storage writes are bounded; new dependencies are pinned and justified.

## Step 5: Tests and checks
New logic has tests. Run and report `npm run check` (tests, lint, build). For UI changes, confirm the flow was clicked through in the dev server.

## Step 6: Report
1. Verdict: Ready for PR, or Fix first (count of blockers).
2. Numbers: counted lines vs limit; excluded lines listed separately.
3. Findings table: severity, file:line, what is wrong, suggested fix.
4. Why it matters: 2 to 4 sentences per finding teaching the principle.
5. Blast radius summary, short enough to paste into the PR.
6. Next step: what needs approval. Do not open the PR or change code until approved.
