# Source Ledger

This ledger separates production sources from local orchestration choices. Sources explain design claims; they do not justify adding process machinery unrelated to the requested result.

## Primary Design Sources

### M1. MinoDriven, AI-driven development technical-debt remediation approach

- URL: https://speakerdeck.com/minodriven/ai-refactoring-approach
- Role: primary MinoDriven source.
- Published title: `AI駆動開発を妨げる技術的負債の解消アプローチ`.
- Supports: modifiability as a refactoring concern; Purpose, Goal, and Means as a design frame; purpose-focused units; small changes with verification; code-based purpose analysis gains accuracy when known context and documentation are supplied.
- Limits: does not prescribe this Skill's input schema, step states, routing hierarchy, reviewer format, or universal gates.

### M2. MinoDriven, Ghosts of Technical Debt

- URL: https://speakerdeck.com/minodriven/ghosts-of-technical-debt
- Role: primary MinoDriven source.
- Supports: technical debt raises future change cost; refactoring should improve modifiability; similar-looking logic can serve different purposes; a means or class should be organized around purpose.
- Limits: does not define a universal debt score, fixed split algorithm, or mandatory workflow record.

### F1. Martin Fowler, Refactoring

- URL: https://refactoring.com/
- Role: primary maintainer/author source for the refactoring definition.
- Supports: refactoring changes internal structure without changing observable behavior; small transformations and frequent checks reduce risk.
- Limits: does not require a particular test framework, report schema, or review gate.

### F2. Martin Fowler, Technical Debt Quadrant

- URL: https://martinfowler.com/bliki/TechnicalDebtQuadrant.html
- Role: primary author source for the debt metaphor and decision framing.
- Supports: debt is useful for reasoning about consequences and paydown choices, including whether future interest and expected touch frequency justify paydown.
- Limits: the quadrant is not a universal ranking formula.

## Skill-Architecture Sources

### O1. OpenAI Skill Creator

- Local source: `C:\Users\IH-000098\.codex\skills\.system\skill-creator\SKILL.md`
- Role: official local operational guidance.
- Supports: concise Skill bodies, progressive disclosure, trigger-rich frontmatter, focused resources, validation, and realistic forward tests.
- Limits: does not define the refactoring domain method.

### C1. inspired-mino-design-skills

- Repository: https://github.com/my-take-dev/inspired-mino-design-skills/tree/afd50e2ca18bb22e336a05df1c8481dbcd652b5c
- Relevant files: `mino-doc/04-technical-debt-goal-and-prioritization.md`, `14-legacy-refactoring-by-purpose.md`, `15-ai-assisted-refactoring.md`, and `19-skill-modularization-and-scaling.md`.
- Role: pinned, unofficial comparator supplied by the user.
- Adopt: the logical taxonomy, narrow reusable artifacts, direct child use, and separation of detailed knowledge from routing.
- Do not adopt: mandatory Core traversal, exhaustive fixed schemas, universal gates, release manifests, or maintenance machinery in production Skill instructions.
- Limits: this repository is inspired by MinoDriven; it is not evidence for a claim attributed directly to MinoDriven.

## Local Architecture Decisions

These are explicit requirements for this Skill family, not claims sourced from the publications above:

- the parent selects and orders only;
- every child accepts Actor, Purpose, Context, Constraints, and Evidence directly;
- missing children are reported, not simulated;
- broad requests compose children while narrow requests use one child directly;
- child candidates remain `planned` until their trigger, output, completion condition, and natural behavior are independently validated.

## Source Policy

Qiita and Zenn are excluded. Prefer official documentation, original authors, standards, and pinned repositories. Preserve conflicts and uncertainty instead of combining sources into unsupported certainty.
