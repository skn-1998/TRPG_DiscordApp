# Encapsulation Design Contract

Use only fields material to the requested decision. Empty fields do not create purpose or domain authority.

## Evidence Labels

- `supplied`: stated by the request or an identified authority;
- `observed`: directly present in code, callers, tests, or runtime artifacts;
- `inferred`: a design interpretation derived from evidence;
- `unknown`: not established.

## Responsibility Leak

```text
State, rule, decision, or mutation path:
Current locations and callers:
Purpose and obligation affected:
Leak type: [scattered-rule / arbitrary-mutation / mutable-representation / bypass / unresolved]
Evidence:
Consequence for the supplied change or behavior scenario:
```

An exposed field is not automatically a material leak. Tie the finding to a supplied obligation, change scenario, or invalidation path.

If no material leak is evidenced, stop with `not-applicable`. Do not manufacture a responsibility redesign merely because a class is large or has known state.

## Responsible Unit

```text
Proposed unit or responsibility boundary:
Evidenced purpose:
Owned state:
Owned decisions, calculations, and transitions:
Supplied obligations protected:
Dependencies and observations required:
Excluded concerns:
Evidence and alternatives:
Unresolved ownership:
```

Do not require a class, Value Object, Aggregate, service, or layer unless that form is separately justified. The owned result here is responsibility and API design.

## Public Operation

```text
Purpose-meaningful operation:
Kind: [command / query / immutable-observation]
Intent and supplied obligation:
Inputs and observable result:
State it may observe or change:
Representation exposure prevented:
Public-contract or compatibility effect:
Evidence and unknowns:
```

Avoid arbitrary setters and mutable references. A necessary query is legitimate when it exposes purpose-relevant information without surrendering mutation authority.

## Alternative Test

Compare at least the proposed boundary with keeping the current boundary. Add another alternative only when evidence makes it plausible. Reject an option for a stated purpose, contract, compatibility, or changeability reason rather than a pattern preference.

## Status Test

Use `encapsulation-supported` when an applicable design assigns or explicitly leaves unresolved every material state-changing responsibility and provides a usable public-operation boundary. Use `encapsulation-incomplete` when missing purpose, obligation authority, caller behavior, or compatibility evidence prevents that decision. Use `not-applicable` when trigger inspection finds no material ownership, mutation, representation, or bypass concern.
