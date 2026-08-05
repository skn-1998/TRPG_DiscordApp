# Code-Design Child Map

Current Skills metadata is the authority for runtime availability. A `planned` or `evidence-needed` child is not callable, and the parent must not simulate it. After a child is installed, that child's `SKILL.md` is the authority for its production contract; this map remains a routing summary and must be reconciled when they differ.

All children accept:

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
```

Missing fields remain `unknown`. No child requires `code-design` or another routing Skill to run.

## purpose-centered-encapsulation

Status: `installed`

Use when supplied evidence identifies purpose-specific state or rules that lack one responsible unit, are scattered, or can be invalidated through exposed operations.

Input (missing items stay `unknown`):

- bounded code target, callers, and public behavior;
- supplied purpose and change scenarios;
- state, rules, invariants, mutation paths, and compatibility constraints.

Expected output:

- evidence-linked responsibility and ownership proposal;
- purpose-specific state, rules, commands, queries, and invariants;
- public-contract and compatibility effects;
- rejected alternatives and consequential unknowns.

Completion condition:

- each proposed unit has one supplied or evidence-backed purpose;
- state-changing rules have an explicit responsible unit or explicitly unresolved ownership;
- public operations express obligations without exposing arbitrary mutation;
- no implementation or migration is claimed.

Excludes domain discovery, legacy split execution, and code changes.

## purpose-driven-abstraction

Status: `installed`

Use when one or more concrete cases or an existing abstraction require a decision about whether one common purpose and semantic contract justify introducing, retaining, narrowing, removing, or avoiding an abstraction.

Input (missing items stay `unknown`):

- consumer, purpose, concrete cases, and realistic variation evidence;
- inputs, outputs, failures, side effects, invariants, and change scenarios;
- existing abstraction and compatibility constraints.

Expected output:

- common-purpose hypothesis and consumer;
- included and excluded variants with evidence;
- semantic contract and hidden implementation decisions;
- decision to introduce, retain, narrow, remove, avoid, or stop for insufficient evidence, with result status.

Completion condition:

- shape or duplication alone is not treated as common purpose;
- every included variant satisfies the same semantic contract;
- exclusions and tradeoffs are explicit;
- speculative future reuse is not presented as evidence.

Excludes branch mechanics, implementation, and generic pattern selection.

## interface-branch-reduction

Status: `installed`

Use when an accepted purpose-based abstraction exists and caller-side variant or construction branches spread change.

Input (missing items stay `unknown`):

- accepted abstraction purpose and semantic contract;
- callers, implementations, branch locations, and variant-change evidence;
- creation, selection, compatibility, and public-behavior constraints.

Expected output:

- classified branch inventory;
- use boundary and, when justified, a creation or selection boundary;
- apply-interface, retain-interface, keep-branch, or insufficient-evidence decision;
- expected change-localization effect and consequential unknowns.

Completion condition:

- the child does not redefine the accepted abstraction purpose;
- branch movement is justified by a supplied change scenario;
- a new specified variant is expected to avoid unrelated caller edits, or the branch is explicitly retained;
- implementation is not claimed.

Excludes abstraction-purpose discovery and code changes.

## purpose-driven-naming

Status: `installed`

Use when sourced purpose, responsibility or observable effect, context, and terminology are established and one bounded code symbol or tightly related symbol set needs a keep or rename recommendation.

Input (missing items stay `unknown`):

- target symbol, current name, kind, members, and material usages;
- sourced purpose, responsibility or effect, context, and terminology;
- compatibility and public-surface constraints.

Expected output:

- current-name assessment and evidence frame;
- candidate names when useful, with fit and rejection reasons;
- keep, rename-recommended, boundary-blocked, terminology-blocked, or insufficient-evidence decision;
- compatibility surface, unknowns, and narrow handoffs.

Completion condition:

- semantic claims trace to evidence rather than current code shape;
- a retained or recommended name expresses the bounded purpose or effect, or a supported blocker is explicit;
- material usages and compatibility effects are represented;
- no rename, responsibility redesign, or terminology approval is claimed.

Excludes terminology discovery, ambiguous-expression interpretation, responsibility or abstraction redesign, mechanical cleanup, code edits, tests, and migration.

## Parent Use

Use `code-design` only to select, order, and contract these children. Keep detailed method instructions in each child or its references.

## Peer Handoffs

Use only the peer whose output is required now; never expand that peer's internal route. Confirm each peer from current Skills metadata and report an unavailable selected peer as `missing-capability`.

- `purpose-goal-means`: a Purpose or Goal artifact is requested or must be independently delegated.
- `context-interpretation`: material terminology ambiguity prevents routing.
- `domain-design`: domain rules, language, or boundaries must be discovered.
- `refactoring`: a behavior-preserving code transformation is requested now.
- `review-changeability`: a supplied design or code artifact needs scenario-specific modifiability review.
- `route-design-work`: several design categories must be coordinated.
