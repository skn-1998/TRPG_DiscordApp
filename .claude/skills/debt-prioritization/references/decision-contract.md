# Decision Contract

## Evidence Model

Classify material statements as:

- `supplied`: stated by the user or an identified source;
- `observed`: directly inspected or executed in the current context;
- `inference`: a conclusion linked to its supporting evidence and counterevidence;
- `unknown`: not established.

Record the source, scope, unit, and time window when they affect comparability. A measurement from one subsystem or period does not silently stand for another.

## Candidate Record

For each candidate record only what the decision needs:

```text
Candidate:
Observed condition:
Desired modifiability outcome or obligation:
Structural-cause hypothesis:
Expected consequence within the horizon:
Relevant evidence and counterevidence:
Remediation estimate and basis:
Material unknowns:
```

A static warning or smell can establish an observed condition. It does not by itself establish stakeholder Purpose, structural cause, future interest, business consequence, or the value of remediation.

## Comparison Lenses

Use a lens only when it matters to the declared decision and evidence exists or its absence is consequential:

- `purpose consequence`: effect on a supplied user, business, operational, compliance, or delivery outcome;
- `expected change`: credible roadmap demand or other evidence that the area will be touched within the horizon;
- `current interest`: observed extra effort, delays, defects, incidents, coordination, or repeated work attributable to the candidate;
- `structural exposure`: evidenced coupling, responsibility or invariant dispersion, change propagation, or a changeability gap;
- `remediation burden`: estimated effort, prerequisites, disruption, and capacity fit.

Core-domain status can strengthen purpose consequence only when supplied or supported by an identified domain decision. Past change frequency is evidence about historical activity, not proof of a future roadmap.

## Comparison Method

- Prefer an ordinal recommendation with a written tradeoff over a synthetic total.
- If labels such as high, medium, and low are useful, define them for this decision and retain `unknown` as a valid value.
- If the user supplies a numeric model, preserve its weights and assumptions, show inputs, and report sensitivity; do not present calculated precision as measured certainty.
- A hotspot combines change activity with structural difficulty and helps focus investigation. It is not automatically the highest-value debt item.
- Do not force a total order. Use equal groups when evidence does not distinguish candidates.
- Include a defer or leave-alone result when expected interest within the horizon is smaller than remediation cost or when another candidate has materially stronger consequence. This is contextual, not a permanent declaration that the code is healthy.

## Decision Artifact

```text
Decision status: [recommendation-supported / decision-incomplete]
Decision context: [Actor, Purpose, Context, Constraints, horizon, capacity]
Decision requested:
Criteria ledger: [criterion, rationale, provenance]
Candidate comparisons: [candidate record, relative tradeoff, uncertainty]
Recommendation: [next target, tied group, or none]
Deferred alternatives: [reason and reconsideration trigger]
Sensitivity: [assumption or evidence that could change the result]
Handoffs or evidence requests:
Exclusions:
```

## Edge Cases

- One candidate only: do not invent competitors. Compare it only with an explicit supplied alternative such as deferral; otherwise request a comparison set or route to diagnosis/design.
- Empty or unbounded candidate set: return `decision-incomplete` or an opaque discovery gap; do not scan the whole repository by default.
- All evidence is tool scores: report an investigation order at most, not a business investment priority.
- Conflicting evidence: preserve the conflict and show sensitivity rather than averaging it away.
- No remediation estimate: a provisional consequence order may still be useful, but an investment recommendation is incomplete when capacity fit could reverse it.

## Completion

`recommendation-supported` means the requested bounded comparison is decision-usable. It does not mean the debt is proven globally, the target design is approved, implementation is safe, or a refactor has been verified.
