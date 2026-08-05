# Interface Branch-Reduction Contract

Use this contract only for branches material to the supplied variant-change scenario.

## Branch Record

```text
Location and caller:
Branch decision:
Classification: [variant-use / construction-selection / domain-decision / state-transition / validation / compatibility / unresolved]
Concrete knowledge exposed:
Accepted contract involved:
Effect under the supplied change:
Evidence and unknowns:
```

Classification does not prescribe a pattern:

- `variant-use` may belong behind an accepted same-purpose contract;
- `construction-selection` may move to a creation boundary when it is duplicated or change-prone under the supplied scenario;
- `domain-decision`, `validation`, and `state-transition` remain where their purpose and state authority require unless another owned design changes them;
- `compatibility` branches may be intentionally retained;
- `unresolved` remains explicit.

## Boundary Proposal

```text
Accepted consumer purpose and semantic contract:
Included variants: [do not add variants]
Use boundary and callers:
Creation or selection boundary, if justified:
Selection knowledge hidden:
Branching intentionally retained:
Public-behavior and compatibility effects:
Expected change-localization trace:
Indirection or state-ownership concerns:
Evidence and uncertainty:
```

A creation boundary is a responsibility, not automatically a factory, registry, container, or new layer.

## Decision Rules

- `apply-interface`: callers currently branch on accepted variants and the supplied scenario becomes localized by depending on the same semantic contract.
- `retain-interface`: an existing interface is semantically sound but selection knowledge should move or remain localized.
- `keep-branch`: the branch is local, semantically direct, state-authoritative, compatibility-driven, or an interface adds no scenario-specific benefit.
- `insufficient-evidence`: the accepted contract, variants, or change scenario cannot support a decision.

Do not use a target branch count as the verdict. A single well-placed branch may be the correct creation boundary.

## Localization Trace

Name the artifacts expected to change for the supplied variant scenario before and under the proposal. This is design reasoning, not a measured modifiability result. Do not claim that callers are unaffected unless the accepted contract and compatibility evidence support that expectation.

## Status Test

Use `branch-design-supported` for a reasoned apply, retain, or keep decision with an intact accepted contract. Use `branch-design-incomplete` when missing acceptance or scenario evidence prevents that decision.
