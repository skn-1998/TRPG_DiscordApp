---
name: bounded-context-discovery
description: Discover evidence-backed Bounded Context candidates by comparing purpose, process cycles, concept meaning, invariants, and model applicability. Use directly for one boundary analysis or boundary report, including requests that mention later approval or downstream use. When directly invoked for a broader multi-method request, complete only the boundary analysis and hand the remaining domain work to domain-design. Do not use for subdomain prioritization, Context Map relationship-pattern selection, detailed domain modeling, code topology, persistence, approval, or implementation.
---

# Bounded Context Discovery

Discover where purpose-specific domain models apply. Keep the analysis provisional and evidence-linked. Do not turn a plausible boundary into an approved organizational or technical boundary.

## Input Contract

Normalize these fields once for the request:

```text
Actor: who benefits from or uses the model
Purpose: the stakeholder outcome or job the model serves
Context: the business subject and scope under analysis
Constraints: binding business rules or limits
Evidence: supplied statements, examples, artifacts, observations, and decisions
```

Preserve missing fields as unknown. Do not infer Actor from the requester, Purpose from an analysis verb, or a business constraint from a workflow instruction. Approval, review, persistence, handoff, and implementation requests are workflow actions rather than domain Purpose or Evidence.

Use domain evidence from the current request, attachments, exact paths or URLs, and any repository or document scope the user explicitly designates. A named artifact with no content or usable locator is asserted but unreproduced; ask for the locator or report the gap. Do not search prior eval runs, unrelated workspaces, or conveniently named artifacts to fill missing domain evidence.

## Source Authority

MinoDriven supplies the primary intent: avoid a universal model, keep purpose central, and compare closed process cycles, large-grained purposes, strongly related concepts, and invariants. Eric Evans supplies formal Bounded Context mechanics: make model applicability explicit, keep meaning consistent within the boundary, and map current models and contacts before proposing change.

Read `references/method.md` when performing the analysis. Read `references/source-ledger.md` and `references/source-to-rule-map.md` when checking a normative claim or revising this Skill. General design sources never supply facts about the user's domain.

## Responsibility Boundary

This Skill may:

- map current models, their applicability, and evidenced contacts
- identify material differences in purpose, process cycle, concept cluster, meaning, invariant, or applicability
- propose evidence-linked candidate boundaries and clearly labelled hypotheses
- compare split, keep-together, and user-supplied alternatives
- expose contradictions, authority gaps, uncertainty, and evidence questions

This Skill must not:

- equate a Bounded Context with a subdomain, team, repository, schema, service, deployment, or existing system boundary
- select a Context Map relationship pattern
- create detailed language, concepts, invariants, aggregates, APIs, code, or topology
- approve, persist, or implement the result
- invent a recipient, owner, authority, domain fact, or polished canonical name

For a request that also asks to continue into another domain method, perform the bounded-context portion and return a handoff for the remaining work to `domain-design`. Do not simulate the downstream method. This makes direct invocation useful without turning the child into a multi-method workflow.

## Workflow

1. Reconstruct the five-field input contract and record material unknowns.
2. Normalize evidence, provenance, scope, version, authority, and contradiction state.
3. Map the current terrain before proposing change. Multiple uses of one evidenced model remain one current model unless evidence establishes distinct model expressions.
4. Compare the relevant concerns using purpose, process cycle, concept cluster, context-qualified meaning, invariant, and applicability. Treat organization and technology as corroboration only.
5. Test whether each difference is material to the model needed for an actor's purpose or to where that model is valid.
6. Classify proposals without hiding uncertainty:
   - `supported-candidate`: purpose, applicability, material placements, and exclusions are evidenced and no material contradiction remains
   - `hypothesis`: a useful possibility for investigation whose required evidence is incomplete
   - `insufficient-evidence`: a supplied proposal cannot meet the supported-candidate conditions
   - `conflicted`: material evidence or authorized decisions are incompatible
   - `rejected-by-evidence`: current evidence directly contradicts the proposal for the stated scope
7. Compare each supported split with the evidenced keep-together alternative and any supplied alternative. Do not invent cost, coupling, migration, or transaction claims.
8. Record current contacts only between distinct evidenced current models. Keep possible candidate interactions separate and do not choose a relationship pattern.
9. State readiness, authority limits, neutral evidence questions, and any handoffs.

## Candidate Standard

A `supported-candidate` needs all of the following:

- a separately evidenced stakeholder purpose or job
- an explicit model applicability scope
- evidenced inclusions and exclusions or neighboring concerns
- at least one material difference in purpose, process cycle, concept cluster, meaning, invariant, or applicability
- traceability for material placements
- comparison with keep-together or a supplied alternative
- no unresolved contradiction that changes the proposed scope

An operation name, workflow step, table, team, repository, schema, service, or deployment does not satisfy the purpose requirement. These facts can remain useful evidence without becoming boundary proof.

Allow labelled hypotheses during discovery, but never present them as supported decisions. Do not create placeholder candidates merely to hold unknowns.

## Output Contract

Produce a concise structured report containing:

1. disposition and analysis scope, including the five input fields
2. material evidence and current model terrain
3. supported candidates, hypotheses, supplied insufficient proposals, conflicts, and rejections as applicable
4. purpose, applicability, inclusions, exclusions, evidence, and decision state for every reported candidate
5. alternative comparison
6. contradictions, authority limits, uncertainty, and neutral evidence questions
7. report completion and downstream readiness as separate conclusions
8. required handoffs for work outside this Skill

Include current contacts or candidate interaction hypotheses only when evidence supports them. Omit empty optional sections. Use tables or prose according to the task; presentation is not part of the domain decision.

Every handoff identifies the recipient when known, required input, expected output, completion condition, exclusions, and return condition. Preserve unknown recipient or owner state instead of inventing a role. When the recipient is a routing parent, request a route and capability state rather than pretending that the parent produces the downstream method's result. Refer to the normalized request contract and record only per-handoff deltas rather than duplicating all five fields.

## Review And Authority

Before returning, self-review the semantic result:

- every material claim is evidence-linked or explicitly uncertain
- current terrain and proposed change are separated
- purpose and applicability support every supported candidate
- topology is not sole boundary proof
- same names or similar logic are not sole merge proof
- alternatives and contradictions are visible
- excluded work was not performed

The report is advisory design evidence. This Skill cannot approve a baseline or authorize implementation. Include review or decision-authority work only when supplied governance or the request requires it; otherwise do not invent a reviewer, approval gate, or authority.

## Completion

The analysis is complete when the five input fields are accounted for; all supplied material evidence is represented or identified as unreproduced; current terrain is distinct from candidates; every reported candidate has one clear state and evidence basis; alternatives, contradictions, unknowns, and authority limits are visible; outside work has a usable handoff; and no excluded design, approval, persistence, or implementation occurred.

Completion does not imply that a candidate is supported or that downstream work is ready. A complete report may conclude that evidence is insufficient or conflicted.

## References

- `references/method.md`: operational discovery method
- `references/source-ledger.md`: source provenance and limits
- `references/source-to-rule-map.md`: production rule traceability
- `../domain-design/references/bounded-context-discovery-contract.md`: parent-child contract
