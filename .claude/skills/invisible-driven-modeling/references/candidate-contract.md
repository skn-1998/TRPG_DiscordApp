# Invisible Concept Candidate Contract

Use this contract proportionately. Empty template fields do not create evidence.

## Evidence Labels

- `supplied`: stated in the request or an identified domain artifact;
- `observed`: directly visible in examples, behavior, model, code, or history;
- `inferred`: a candidate explanation derived from evidence;
- `unknown`: not established.

## Actor-Purpose-Problem Case

```text
Actor:
Desired outcome:
Problem blocking the outcome:
Visible-noun interpretation:
Required information, behavior, or rules:
Evidence and provenance:
Unknowns or alternatives:
```

A role label is not enough. Preserve uncertainty when the actor's outcome or problem is not evidenced.

## Hidden-Concept Candidate

```text
Candidate expression: [provisional]
Actor and purpose served:
Problem represented or solved:
Relevant information, behavior, and rules:
Discovery signal: [only applicable signals]
Supporting evidence:
Counterevidence or alternative interpretation:
Consequential unknowns:
Finding: [supported-candidate / hypothesis]
```

Use `supported-candidate` only when supplied or observed evidence establishes the relevant actor-purpose-problem case and traces the candidate's needed meaning, behavior, or rules. Use `hypothesis` when the explanation remains inferred or lacks that trace. When no candidate meets the supported threshold, record `no-supported-candidate` once at report level; listed hypotheses may remain.

Do not classify a candidate as Entity, Value Object, Service, Policy, or Event. If tactical classification is the requested artifact, it is outside this Skill; hand off the candidate and evidence.

## Keep-Together Comparison

Compare only candidates that materially affect the requested decision:

```text
Candidates compared:
Meaning and purpose overlap:
Rules and required behavior:
Lifecycle or identity evidence:
Expected reasons for change:
Cross-candidate relationship:
Consideration: [keep-together / separate / unresolved]
Evidence and limits:
```

`keep-together` and `separate` are modeling considerations, not Bounded Context, class, service, or deployment decisions.

## Current-Element Observation

When code or an existing model is supplied, record only material observations:

```text
Element:
Candidate or purpose it appears to serve:
Evidence:
Alternative or unknown:
```

Do not require every field, branch, or method to be assigned. Unclassified elements may be technical, obsolete, cross-cutting, or simply under-evidenced.

## Status Test

Use `discovery-supported` when the report tests the assumption honestly and supports the named next decision, including a supported finding that no hidden concept can yet be established. Use `discovery-incomplete` only when the target, context, or evidence boundary is too unclear for that use.
