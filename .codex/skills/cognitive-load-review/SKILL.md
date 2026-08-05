---
name: cognitive-load-review
description: >-
  Review code, diffs, designs, and refactor proposals for evidence-based cognitive load:
  working-memory demand, concepts, indirection hops, non-local dependencies, and hidden
  assumptions. Use whenever Codex reviews readability, complexity, over-engineering,
  abstractions, or refactor necessity, and alongside review-changeability when overall
  maintainability is judged. Also use as mandatory pre-implementation and post-implementation
  gates for every code, configuration, schema, or script change.
---

# Cognitive Load Review for Codex

Use the repository's existing Claude skill as the canonical review procedure. Do not maintain a
second copy of its measurement model, evidence rules, load-source catalog, or output format here.

## Mandatory workflow

1. Read `../../../.claude/skills/cognitive-load-review/SKILL.md` completely.
2. Read every reference that the selected review mode requires. For both pre-implementation and
   post-implementation review, always read
   `../../../.claude/skills/cognitive-load-review/references/load-sources.md`.
3. Before changing code, configuration, schemas, or scripts, review the intended change surface and
   implementation design with the canonical evidence rules. Use Mode B when the change introduces
   an abstraction, contract, pattern, or refactor; otherwise apply Mode A's reader simulation to the
   proposed diff and entry points. Resolve High and Medium extraneous-load findings before coding.
4. After the implementation, execute Mode A against the complete implementation diff before
   accepting it or reporting it as complete. The pre-implementation review and passing tests do not
   replace this post-implementation review.
5. For a refactor or design proposal, also execute Mode B and read
   `../../../.claude/skills/cognitive-load-review/references/necessity-audit.md`.
6. Follow the canonical skill's evidence rules and output template exactly. Do not emit an
   impression-only finding: count working-memory items, concepts, hops, non-local dependencies, or
   hidden assumptions, and measure relevant call sites and git change frequency.
7. If a High or Medium extraneous-load finding remains, do not start or accept the implementation.
   Fix it and rerun the review, or report the unresolved finding explicitly when the user requested
   review only.

The Claude skill and its references are the single source of truth. Update that source when the
review method changes; keep this adapter limited to Codex triggering and the mandatory acceptance
gate.
