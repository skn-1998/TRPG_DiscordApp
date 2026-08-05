---
name: design-knowledge-scaling
description: Use directly to decide whether a claimed software-design practice or slogan should be shared, standardized, scaled, published, or packaged across teams or tools, even when unsourced. Missing support yields a usable `no-dissemination-yet` with `scaling-decision-supported`; use incomplete only when the fit cannot be bounded. Do not invent the practice, author or roll out a channel, assign owners, or add gates, tests, or KPIs.
---

# Design Knowledge Scaling

Produce one evidence-linked scaling-fit decision. This Skill owns the reuse decision even when qualification fails: a usable `no-dissemination-yet` is `scaling-decision-supported`, while `scaling-decision-incomplete` means the fit itself cannot be bounded. Do not author, publish, or roll out the selected channel.

## Input Contract

```text
Actor: stakeholder whose outcome the scaling decision serves
Purpose: recurring outcome or problem the practice should address
Context: source context and intended target contexts
Constraints: authority, sensitivity, compatibility, tool, reach, and maintenance limits
Evidence: practice sources, observed uses, failures, misunderstandings, and source changes
Practice definition and provenance:
Target knowledge users, recurring tasks, and contexts:
Candidate channels, when supplied:
Source-of-truth, update, and feedback constraints:
Requested scaling decision:
```

- Preserve supplied wording, provenance, context, contradictions, and unknowns. Mark absent fields `unknown`.
- Do not infer adoption, authority, a maintenance owner, or cross-context applicability from publication or one successful use.
- Ask only when an unknown prevents qualifying the practice, bounding the reusable unit, or making the requested channel-fit decision.
- Do not hand off merely because the claimed practice is unsourced. Hand off source research or practice definition only when that work is separately requested.

## Boundary

Qualify evidence for the practice, define a channel-neutral knowledge contract only for a potentially disseminated fit, compare fits, and identify maintenance evidence and reconsideration conditions.

Do not invent or materially revise the design practice, run a workshop, mandate MinoDriven's Modifius taxonomy, require a Core or adapter structure, choose MCP or Skills by default, author the final artifact, appoint an owner, define organization policy, create a pilot or rollout, measure adoption, or add versions, approval gates, tests, KPIs, release phases, or fixed review cadence.

## Workflow

Read `references/knowledge-contract.md`, then:

1. Bound the intended knowledge users, recurring problem, source and target contexts, practice evidence, and scaling decision.
2. Qualify the practice. Separate source claims, observed use, inferred applicability, local proposals, contradictions, and unknowns. A justified `no-dissemination-yet` is a valid result.
3. For a potentially disseminated fit, define the smallest reusable channel-neutral contract: intended audience and recurring problem; source and target contexts; constraints; practice and rationale; inputs and preconditions; expected output; completion condition; applicability and exclusions; failure or misuse modes; stable meaning; permitted contextual variation; provenance and authority; and consequential unknowns. For `no-dissemination-yet`, omit the reusable unit and name the material blocker and reconsideration evidence instead.
4. Separate stable meaning from contextual translation only where evidence supports that boundary. Do not copy a fixed module taxonomy or create adapters merely for packaging symmetry.
5. Compare `reference-or-template`, `skill-candidate`, `human-exchange`, `hybrid`, and `no-dissemination-yet` using codifiability, ambiguity, contextual variation, recurrence, recipient capability, reach, tool coupling, update cost, authority, and sensitivity.
6. Select the narrowest fit that preserves meaning and provenance. Packaging convenience is not evidence of adoption or suitability.
7. Identify the current maintenance locus or unresolved responsibility, evidence that should return from actual use, and events that would reopen the fit decision. Do not invent a person, cadence, or KPI.
8. Record consequential unknowns and hand off authoring, learning, governance, or practice redesign without performing them.

## Output Contract

Return one scaling-fit decision containing:

- normalized input and evidence limits;
- practice qualification and provenance;
- bounded channel-neutral knowledge contract, or a not-ready finding;
- channel comparison and selected fit;
- stable meaning and permitted contextual variation;
- current maintenance locus or unresolved responsibility;
- use evidence to return and reconsideration conditions;
- exclusions, consequential unknowns, and narrow handoffs;
- status: `scaling-decision-supported` or `scaling-decision-incomplete`.

Use `references/knowledge-contract.md` proportionately. Do not require a fixed taxonomy, YAML, owner, benchmark, pilot, log, metric, test suite, versioning scheme, approval workflow, rollout, or release gate.

## Completion

Return `scaling-decision-supported` when every material practice claim is sourced or labeled local; applicability and non-applicability are explicit; channel fit and reconsideration conditions are stated; and no authority, maintenance responsibility, governance, or adoption success is invented. A disseminated fit additionally requires a reusable unit with inspectable input, output, boundary, and completion. A `no-dissemination-yet` fit instead requires a usable blocker and evidence needed to reconsider; it does not require a reusable unit.

Return `scaling-decision-incomplete` when missing practice evidence, context, authority, source-of-truth, sensitivity, or recipient capability prevents a fit decision. Name the smallest blocker. Completion does not mean that an artifact was authored, published, adopted, maintained, or effective.

Missing support alone is not incomplete when it establishes a usable `no-dissemination-yet` fit with a blocker and reconsideration evidence.

## Handoffs

- Hand off an actual workshop design to `design-learning-workshop` when available.
- Re-enter `organization` when workshop and scaling work must be ordered or practice definition needs category routing.
- Hand off actual Skill creation or revision to `skill-creator` only after a `skill-candidate` decision.
- Hand off organization policy, ownership appointment, rollout, or KPI requests as external governance work; do not simulate them.

Keep handoff targets opaque and pass only the qualified practice, knowledge contract, fit decision, evidence, and limits they require.

## References

- `references/knowledge-contract.md`: qualification, knowledge-unit, fit, and completion rules. Read for every run.
- `references/source-ledger.md`: source claims and adoption limits.
- `references/source-to-rule-map.md`: production-rule traceability.
