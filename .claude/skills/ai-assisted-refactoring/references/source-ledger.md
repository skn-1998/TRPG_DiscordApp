# Source Ledger

Sources explain refactoring and AI-assistance claims; they do not justify a universal test suite, reviewer gate, or release workflow.

## Primary MinoDriven Source

### M1. AI-driven technical-debt resolution

- URL: https://speakerdeck.com/minodriven/ai-refactoring-approach
- Verified: 2026-07-16; the public transcript identifies MinoDriven and describes purpose-first debt analysis, supplying known documents to AI, purpose-oriented names, IDE rename and extract operations, test code as essential for safe refactoring, pure-function candidates, and purpose-based separation.
- Supports: treat purpose as central; use AI for evidence-linked code-understanding and candidate generation; give AI known context; prefer deterministic language or IDE operations for reference-sensitive mechanics; use tests as safety evidence; separate mixed purposes rather than polish a confused structure.
- Limits: AI purpose analysis remains an inference, not stakeholder truth. The deck's exact test style, examples, and split mechanics are not universal runtime requirements. It does not prescribe this Skill's three modes, mandatory independent review, fixed command lists, or gate records. Allowing a bounded claim without creating a new test is a documented local adaptation, not a MinoDriven claim.

## Foundational Sources

### F1. Martin Fowler, Refactoring

- URL: https://refactoring.com/
- Verified: 2026-07-16; the site defines refactoring as changing internal structure without changing observable behavior and emphasizes small behavior-preserving transformations, a working system, automated tools where available, and frequent testing otherwise.
- Supports: the behavior-preserving boundary, bounded transformations, proportionate verification, and use of automated refactoring tools.
- Limits: does not make every possible check, full-suite execution, a commit, or an independent reviewer mandatory for each bounded change.

### F2. Eiffel Software, Design by Contract

- URL: https://www.eiffel.com/values/design-by-contract/
- Verified: 2026-07-16; the page defines component behavior through preconditions, postconditions, and invariants.
- Supports: make relevant obligations and guarantees explicit when they define the preserved behavior boundary.
- Limits: native Eiffel contracts are not required, and a contract is not equivalent to creating a test for every internal detail.

## Skill Architecture

### O1. OpenAI Skill Creator

- URL: https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md
- Verified: 2026-07-16; the official repository describes concise runtime instructions, bundled references, validation, and iteration through real usage.
- Supports: keep the runtime Skill concise and move mode detail and theory to references.

### C1. inspired-mino-design-skills

- Repository: https://github.com/my-take-dev/inspired-mino-design-skills/tree/afd50e2ca18bb22e336a05df1c8481dbcd652b5c
- Relevant file: `mino-doc/15-ai-assisted-refactoring.md`.
- Role: pinned, unofficial comparator supplied by the user.
- Adopt: distinguish AI hypotheses from evidence, prefer language-aware mechanics, preserve behavior, and use bounded changes.
- Do not adopt: fixed YAML packets, universal characterization tests, confidence scores, mandatory human or independent-agent review, per-step rollback fields, test matrices, or release-like phases.
- Limits: it is not evidence for claims attributed directly to MinoDriven.

## Local Architecture Decisions

- one standalone child supports `plan`, `execute`, and `review` for the same bounded refactoring capability;
- every direct invocation accepts Actor, Purpose, Context, Constraints, and Evidence;
- missing design, debt-selection, or legacy-purpose-discovery decisions are opaque handoffs, while target-local evidence gathering remains this child's work;
- tests and tools are selected proportionately to the behavior boundary and risk;
- MinoDriven's test requirement is retained as the strong safety baseline: absent relevant executable behavior evidence, runtime preservation remains incomplete; the local adaptation avoids mandatory test creation by narrowing the claim rather than fabricating safety;
- no independent reviewer, full suite, rollback, branch, or commit is universally required;
- an AI or manual patch is permitted when a trusted symbol-aware operation is unavailable, but its weaker completeness claim must be explicit and verified with available evidence.

## Source Policy

Qiita and Zenn are excluded, including quotations or links embedded in otherwise accepted sources. Preserve source limits and uncertainty.
