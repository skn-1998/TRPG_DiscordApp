# Refactoring Child Map

This file declares narrow child contracts. Current Skills metadata is the authority for runtime availability. After a child is installed, that child's `SKILL.md` is the authoritative execution contract. A `planned` child is not callable, and the parent must not simulate it.

All children accept the same standalone input:

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
```

Missing fields remain `unknown`. No child requires `refactoring` or another Core Skill to run.

## debt-prioritization

Status: `installed`

Use when several debt items compete for a bounded investment decision.

Input (missing items stay `unknown`):

- decision recipient and intended outcome;
- candidate set and relevant time horizon;
- binding constraints;
- available evidence about change cost, incident or defect exposure, recurrence, coupling, business consequence, and remediation effort.

Expected output:

- an evidence-linked priority recommendation or grouping;
- rationale tied to the stated Purpose and Constraints;
- material uncertainty, sensitivity, and missing evidence;
- the selected next target, when evidence permits one.

Completion condition:

- comparison criteria and their provenance are explicit;
- unsupported precision is absent;
- code-smell counts alone are not presented as business priority;
- an unresolved decision is reported rather than fabricated.

Excludes target redesign, purpose-boundary analysis, code changes, and verification execution.

## legacy-purpose-split

Status: `installed`

Use when supplied evidence suggests that a legacy unit combines responsibilities serving different purposes and the request needs purpose or boundary analysis.

Input (missing items stay `unknown`):

- bounded legacy target;
- known actors, outcomes, public behavior, callers, and constraints;
- code, documentation, tests, runtime observations, or change history that can support or challenge a purpose hypothesis.

Expected output:

- evidence-linked purpose and boundary hypotheses;
- observable behavior classified for preservation and unresolved behavior questions;
- split or sequencing considerations at the level requested;
- uncertainties that require domain or stakeholder evidence.

Completion condition:

- no purpose is treated as fact solely because it was inferred from code shape;
- same-looking logic is not merged or separated without considering purpose;
- behavior-changing ideas are distinguished from preserving ones;
- the requested analysis artifact is usable by its named recipient.

Excludes portfolio-wide debt ranking, open-ended architecture design, code edits, and test execution.

## ai-assisted-refactoring

Status: `installed`

Use when the request directs AI or Claude to plan, execute, or review a bounded behavior-preserving transformation, including an ordinary imperative to refactor supplied code. Do not select it merely because an AI answers a request whose actual method is debt prioritization or purpose analysis.

Input (missing items stay `unknown`):

- bounded target and requested AI role;
- observable-behavior contract and available verification evidence appropriate to that role;
- tool, repository, permission, and change constraints;
- relevant code and supporting evidence.

Expected output:

- the requested bounded plan, change evidence, or review result;
- small checkpoints and the evidence used at each applicable checkpoint;
- deviations, failed checks, and unresolved uncertainty without concealment.

Completion condition:

- the requested AI role and boundary are satisfied;
- behavior preservation is supported by evidence or remains explicitly unverified;
- behavior-changing work is excluded or separately routed;
- AI output is not treated as its own approval authority.

Excludes unbounded modernization, feature work disguised as refactoring, and guarantees unsupported by verification.

## Parent Use

Use `refactoring` only to select, order, and contract these children. Keep a viewpoint in references rather than creating a child until repeated direct requests show an independent trigger, reusable artifact, and standalone completion condition.

## Peer Handoffs

Use at most the peer whose output is required now; never expand that peer's internal route.

- `purpose-goal-means`: a Purpose or Goal artifact is requested or must be independently delegated; ask a focused question instead when one answer can select the recipient.
- `context-interpretation`: material terminology ambiguity prevents routing.
- `bounded-context-discovery`: one domain-boundary artifact is requested.
- `domain-design`: several domain methods must be coordinated.
- `code-design`: a target responsibility or interface artifact is requested now.
- `review-changeability`: a supplied artifact needs scenario-specific modifiability review.
- `route-design-work`: behavior-changing or cross-category work must exit this parent.
