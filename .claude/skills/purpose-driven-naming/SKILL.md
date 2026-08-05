---
name: purpose-driven-naming
description: Evaluate or select the semantic name of one bounded code symbol or tightly related symbol set from supplied purpose, responsibility or effect, context, terminology, usages, and compatibility constraints. Use directly when those meanings are supplied sufficiently to assess whether to keep or recommend a code name; if inspection exposes disputed terminology or a multi-purpose boundary, return a blocker without interpreting or redesigning it. Do not use to discover canonical domain language, interpret an ambiguous term, redesign responsibilities or abstractions, perform a mechanical spelling or casing cleanup, apply a rename, edit code, or create tests.
---

# Purpose Driven Naming

Produce one evidence-linked naming decision. Do not apply the rename.

## Input Contract

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
Target symbol or tightly related symbol set:
Current name, kind, members, and material usages:
Sourced responsibility or effect and terminology:
Compatibility and public-surface constraints:
Requested recipient and decision:
```

- Preserve supplied wording, provenance, conflicting meanings, and unknowns. Mark absent fields `unknown`.
- Require sourced purpose, responsibility or effect, context, and terminology. Do not infer them from the current name or code shape.
- Treat repository spelling, casing, abbreviation, and framework conventions as constraints, not semantic authority.
- Ask only when an unknown prevents identifying the target or requested naming decision. Return a bounded blocker instead of inventing purpose or vocabulary.

## Boundary

Evaluate the current name, generate evidence-linked candidates when useful, check purpose and responsibility fit, inspect material usages, and report compatibility impact.

Do not establish Ubiquitous Language, resolve disputed word meaning, discover a Bounded Context, split a multi-purpose unit, redesign ownership or abstraction, ban generic suffixes universally, require multiple candidates, update callers, edit code, create tests, or plan migration.

## Workflow

Read `references/naming-contract.md`, then:

1. Bound the target, symbol kind, supplied purpose, responsibility or effect, terminology, usages, recipient, and decision.
2. Check evidence sufficiency. Return immediately with `terminology-blocked` when material meaning is ambiguous or disputed, or with `boundary-blocked` when one name cannot honestly describe the supplied responsibilities. These are terminal naming decisions: report the evidence, mismatch, compatibility facts already supplied, and narrow handoff, but do not generate candidate names, replacement terms, split-unit names, or a conditional keep/rename decision.
3. Describe the mismatch, if any, between the current name and supplied purpose, effect, scope, or terminology.
4. When candidates are useful, generate them from the evidence frame before using the current name as an anchor. Do not require a candidate count.
5. Evaluate each candidate for intention-revealing effect or purpose, context fit, responsibility/member fit, mechanism leakage, and appropriately narrow scope.
6. Check material definitions, callers, public APIs, schemas, serialization, logs, or documentation only when supplied or discoverable within the bounded target.
7. Decide `keep`, `rename-recommended`, `boundary-blocked`, `terminology-blocked`, or `insufficient-evidence`.
8. Report compatibility effects and the narrow handoff without applying changes.

## Output Contract

Return:

- normalized input and evidence limits;
- target and current-name assessment;
- purpose, responsibility/effect, context, and terminology frame;
- candidate names when useful, with evidence-linked fit and rejection reasons;
- material usage and member-fit findings;
- naming decision and rationale;
- compatibility surface and unknowns;
- narrow handoffs;
- status: `naming-supported` or `naming-incomplete`.

Use `references/naming-contract.md` proportionately. Do not require YAML, scoring, generic forbidden-word lists, multiple candidates, exhaustive repository scans, implementation steps, tests, migration, or release gates.

## Completion

Return `naming-supported` when every semantic claim traces to evidence; a recommended or retained name expresses the relevant purpose or effect without misleading mechanism detail and fits the bounded responsibilities and material usages; or a supported boundary or terminology blocker prevents an honest name. Make compatibility impact usable for the named decision or, when none is named, the supplied Purpose.

Return `naming-incomplete` with `insufficient-evidence` when missing target, purpose, responsibility/effect, terminology, or usage evidence prevents any supported decision. Completion does not authorize or apply a rename.

## Handoffs

- Hand off one ambiguous expression to `context-interpretation`.
- Hand off shared context-specific vocabulary work to `ubiquitous-language` when available.
- Hand off a responsibility or state-ownership mismatch to `purpose-centered-encapsulation` when available.
- Hand off an abstraction-boundary mismatch to `purpose-driven-abstraction` when available.
- Hand off accepted rename execution and verification to `ai-assisted-refactoring` when behavior-preserving refactoring is requested.

Keep recipients opaque and pass only the naming evidence, decision, and compatibility surface they require.

## References

- `references/naming-contract.md`: evidence, fit, and decision rules. Read for every run.
- `references/source-ledger.md`: source claims and limits.
- `references/source-to-rule-map.md`: production-rule traceability.
