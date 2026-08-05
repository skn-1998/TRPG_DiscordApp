# Source Ledger

Sources explain design claims; they do not justify fixed gates or release-like process in a routing parent.

## Primary MinoDriven Sources

### M1. Purpose-centered encapsulation

- URL: https://speakerdeck.com/minodriven/encapsulation2
- Supports: purpose as the axis for separation; keeping purpose-specific data and rules together; one purpose per means or class; avoiding arbitrary external mutation.
- Limits: does not prescribe this Skill hierarchy, step schema, reviewer record, or universal test gate. Exclude the deck's linked Qiita material.

### M2. Interface design and branch reduction

- URL: https://speakerdeck.com/minodriven/interface-design-idea
- Verified: 2026-07-16; Speaker Deck identifies MinoDriven, the 2023-03-03 presentation, purpose-based abstraction, and separation of creation from use in its public transcript.
- Supports: interface and implementation separation; purpose-based common operations; moving variant selection away from callers.
- Limits: does not imply that every branch needs an interface or that interface work may redefine an unestablished abstraction purpose. Requiring concrete change evidence before selecting the method is this Skill family's adoption constraint.

### M3. Purpose and abstraction

- URL: https://speakerdeck.com/minodriven/purpose-abstraction-design
- Supports: abstraction around purpose rather than superficial shape; selecting purpose-relevant characteristics and discarding unrelated ones.
- Limits: does not provide a universal abstraction score or justify speculative reuse.

### M4. Purpose-driven architecture

- URL: https://speakerdeck.com/minodriven/purpose-driven-architecture
- Supports: purpose-centered boundaries and modifiability.
- Limits: architecture-level examples do not determine a specific code boundary without request evidence.

### M5. Good and bad code in the AI era

- URL: https://speakerdeck.com/minodriven/ai-good-code-bad-code
- Supports: evaluating AI-produced code with design knowledge and purpose.
- Limits: does not establish a complete standalone naming workflow.

## Foundational Sources

### F1. D. L. Parnas, module decomposition

- URL: https://doi.org/10.1145/361598.361623
- Supports: decomposing around changeable design decisions and hiding them behind interfaces.
- Limits: does not prescribe the MinoDriven purpose taxonomy or this routing workflow.

### F2. Eiffel Software, Design by Contract

- URL: https://www.eiffel.com/values/design-by-contract/
- Supports: explicit obligations, guarantees, and invariants at public boundaries.
- Limits: does not require a contract document or test suite for every routing request.

### F3. Eric Evans, Domain-Driven Design Reference

- URL: https://www.domainlanguage.com/ddd/reference/
- Supports: context-specific domain language when names or abstractions represent domain concepts.
- Limits: domain discovery belongs to `domain-design`, not this parent.

## Skill Architecture

### O1. OpenAI Skill Creator

- Local source: `C:\Users\IH-000098\.codex\skills\.system\skill-creator\SKILL.md`
- Supports: concise runtime instructions, progressive disclosure, trigger-rich frontmatter, and realistic forward tests.

### C1. inspired-mino-design-skills

- Repository: https://github.com/my-take-dev/inspired-mino-design-skills/tree/afd50e2ca18bb22e336a05df1c8481dbcd652b5c
- Relevant files: `mino-doc/10-purpose-centered-encapsulation.md`, `11-interface-driven-branch-reduction.md`, `12-purpose-driven-naming.md`, `13-purpose-driven-abstraction.md`, and `19-skill-modularization-and-scaling.md`.
- Role: pinned, unofficial comparator supplied by the user.
- Adopt: the logical taxonomy, direct narrow methods, and detailed knowledge outside the parent.
- Do not adopt: fixed YAML outputs, mandatory tests, exhaustive checklists, Core traversal, review gates, or release machinery as universal runtime rules.
- Limits: it is not evidence for claims attributed directly to MinoDriven.

## Local Architecture Decisions

- the parent selects, orders, contracts, and reports gaps only;
- every child accepts Actor, Purpose, Context, Constraints, and Evidence directly;
- missing recipients encountered in a broad, ambiguous, coordinated, or explicitly audited route are reported rather than simulated; absence alone does not trigger the parent for a narrow ordinary request;
- abstraction purpose precedes branch mechanics when both are selected;
- naming method evidence and operational rules live in the installed standalone child; the parent does not invent or duplicate them.

## Source Policy

Qiita and Zenn are excluded, including quotations or links embedded in otherwise accepted sources. Preserve conflicts and uncertainty instead of combining sources into unsupported certainty.
