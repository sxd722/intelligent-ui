# Project preferences

- Updates are local-only by default. Do not synchronize, build, or publish the GPT Site unless the user explicitly requests it again.
- Keep the local application on port 8787. Preserve the legacy DIL option when changing CardSpec.
- On stalled or failed iterative debugging, retain the best usable candidate supported by actual validation evidence, rather than replacing it with the latest or an inert partial draft. Clearly distinguish verified behavior, unverified functions, and known failures. Never present a retained partial candidate as fully passed; unvalidated previews remain previews.

## Reusable card workflow

- For new interactive-card baselines or feedback-driven iterations, use `.trae/skills/interactive-card-baseline/SKILL.md`. It distinguishes host-connected H5 from the legacy offline Trae HTML track and provides planning, tool, validation, and RSI evidence guidance.
