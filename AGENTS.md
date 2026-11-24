# UI consistency

Render the shared `SettingsButton` as the rightmost control in the app header on the home screen, in freeplay, and in every learning module. Keep its component, icon, label, and styling visually identical across screens; vary only its action.

# Workflow

- Never push to `main`. Work on `feature/<name>`, `fix/<name>` or `chore/<name>`, one feature per branch, small commits (20 words or fewer, no em dashes).
- Keep each PR under 1,000 hand-written added lines; split larger features into sequential working PRs.
- Before every PR: `npm run check` passes, the `pr-audit` skill runs, and a second model family reviews the branch. Put the blast radius and review verdict in the PR description.
- No AI attribution in commits, PRs or docs.
- The curriculum follows `reports/Competitive Tetris learning progression.md`. Game rules follow `GAMEPLAY_SPEC.md`.

## Skills

| Skill | Where | Use it for |
| --- | --- | --- |
| pr-audit (ours) | `.claude/skills/pr-audit/SKILL.md` | Before every PR |
