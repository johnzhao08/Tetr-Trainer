# UI consistency

Render the shared `SettingsButton` as the rightmost control in the app header on the home screen, in freeplay, and in every learning module. Keep its component, icon, label, and styling visually identical across screens; vary only its action.

When adding or changing home-screen learning modules, match the existing module cards: shared card and preview styling, consistent dimensions and typography, a short title and description, and a small representative preview image or animation. Use a static preview when it explains the module clearly; use animation when motion helps explain the skill. Keep previews free of grid lines and respect reduced-motion preferences for animations.

# Git workflow

For each new feature request, automatically create and switch to a new descriptive branch before implementation, without asking for confirmation. Use the user's requested branch name when provided. Continue related fixes and follow-up work on that feature's branch.

Commit frequently at small, coherent checkpoints, such as a completed implementation step or verified fix. Use meaningful commit messages and run checks appropriate to each checkpoint. Keep uncommitted changes below 1,000 changed lines; treat this as a ceiling, not a target.
