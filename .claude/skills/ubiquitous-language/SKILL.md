---
name: ubiquitous-language
description: Draft or reconcile evidence-backed, context-specific domain terminology for one identified or sufficiently scoped Bounded Context, or compare already-identified contexts when an evidenced interaction requires it. Use directly when material domain terms are overloaded, inconsistent, missing, implementation-led, or misaligned across domain conversation, models, documentation, and code. Do not use for one isolated ambiguous phrase, ordinary code-symbol naming, translation alone, Bounded Context discovery, model implementation, or mechanical renaming.
---

# Ubiquitous Language

Produce a context-qualified language report for the material terms in scope. Do not create an enterprise glossary or declare domain approval.

## Input Contract

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
Terms or language surface:
Requested recipient and decision:
```

- Preserve supplied wording, provenance, disagreement, and missing information. Mark absent fields `unknown`.
- Treat Actor, Purpose, Context, and relevant rules as interpretation dimensions, not mandatory database columns for every trivial term.
- Require a sufficiently scoped model context for evidence-supported reconciliation. If model applicability is materially undecided, retain provisional observations and hand off the boundary question.
- Ask only when an unknown prevents identifying the language surface or intended artifact.

## Boundary

Analyze material terminology in domain speech, examples, documents, models, and code. Record context-specific meanings, rules, usage, overload, synonymy, contradiction, and alignment gaps.

Do not discover a Bounded Context, choose aggregates or services, design invariants, approve canonical language, rename code or schemas, or force one vocabulary across distinct contexts. A language difference is boundary evidence, not proof of a new context.

## Workflow

Read `references/language-contract.md`, then:

1. Bound the context, language surface, recipient, and decision.
2. Select only terms material to the supplied purpose, rules, disagreement, or requested decision.
3. For each material expression, record scoped meaning, actor and purpose relevance, rules, examples or counterexamples when useful, and evidence.
4. Compare materially confusable occurrences. Identify overload, synonym or inconsistency candidates, contradictions, and missing expressions for distinctions already evidenced in scope, without exhaustive pairwise comparison.
5. Compare domain conversation, documentation, model, and code only where supplied evidence exposes an alignment question.
6. Propose candidate shared expressions only inside each scoped context; do not create a cross-context canonical term. When an evidenced interaction needs correspondence, record it as a comparison. Distinguish evidence-supported language from provisional or unresolved language.
7. Record boundary, naming, invariant, or implementation handoffs without performing them.

## Output Contract

Return:

- normalized input, scoped context, and evidence limits;
- material term records;
- overload, synonym, inconsistency, contradiction, distinct-and-intentional, and missing-term findings;
- language/model/code alignment gaps that are evidenced in scope;
- candidate shared expressions and their evidence status;
- unresolved terms, disagreements, and the narrowest useful handoff;
- status: `language-supported` or `language-incomplete`.

Use `references/language-contract.md` for the proportionate record schema. Do not require stable IDs, YAML, every-term examples, or an approval workflow.

## Completion

Return `language-supported` when every requested material term is context-qualified or explicitly unresolved, material comparisons trace to evidence, consequential language gaps are visible, and the artifact can support the named next decision or, when none is named, the supplied Purpose without treating a candidate as approved language.

Return `language-incomplete` when missing context, contradictory authority, or absent evidence prevents that use. Name the smallest blocking question. Completion does not freeze the language or authorize downstream changes.

## Handoffs

- Hand off one ambiguous expression to `context-interpretation` when shared-language reconciliation is not requested.
- Hand off material model-applicability uncertainty to `bounded-context-discovery`.
- Hand off purpose-specific hidden-concept discovery to `invisible-driven-modeling` when available.
- Hand off code-symbol naming or rename design to `purpose-driven-naming` when available.
- Re-enter `domain-design` when several domain methods must be ordered.

Keep recipients opaque and pass only the evidence and language artifact they require.

## References

- `references/language-contract.md`: term, comparison, and status rules. Read for every run.
- `references/source-ledger.md`: source claims and adoption limits.
- `references/source-to-rule-map.md`: production-rule traceability.
