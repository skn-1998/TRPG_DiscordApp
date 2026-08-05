# Bounded Context Discovery Child Contract

This is the parent-owned contract for routing work to `bounded-context-discovery`. It describes the child boundary without duplicating the child's method.

## Trigger

Use the child when a request asks where a domain model applies, or when evidence suggests that one model mixes materially different purposes, process cycles, concept clusters, meanings, invariants, or applicability scopes.

Prefer the child directly for one boundary analysis or report. Use `domain-design` for a chain that needs multiple domain methods or for coordination of a returned boundary result with a successor.

If a broad request directly invokes the child, the child performs its own boundary analysis and hands the remaining methods to `domain-design`; it does not perform those downstream methods.

## Input

The child reconstructs the shared input contract even when called directly:

- Actor
- Purpose
- Context
- Constraints
- Evidence

Missing values remain unknown. Workflow actions such as analysis, approval, review, persistence, sequencing, or implementation do not become domain Purpose or Evidence.

Useful domain input includes supplied actors and jobs, workflows and events, concepts and meanings, rules and invariants, model applicability, current models and manifestations, contacts, authority, provenance, scope, and version.

## Output

The child returns:

- normalized scope and evidence state
- current model terrain and applicability
- evidence-linked supported candidates, hypotheses, supplied insufficient proposals, conflicts, and rejections as applicable
- split and keep-together comparison
- current contacts and candidate interactions only when evidenced
- uncertainty, authority limits, neutral questions, readiness, and handoffs

Presentation is flexible. The child owns semantic completion; parent routing records only the output reference and the child's explicit completion declaration.

## Completion

The child result is complete when all supplied material evidence is represented or identified as unreproduced; current terrain is separate from proposed change; every reported candidate has a clear state and evidence basis; supported candidates have purpose, applicability, inclusions, exclusions, and an alternative comparison; contradictions and unknowns are visible; and outside work has a usable handoff.

Completion does not imply that evidence supports a candidate, that a baseline is approved, or that downstream work is ready.

## Parent Return

The parent records:

- the returned result reference or native platform identity
- the child-declared disposition and readiness
- the child's explicit completion declaration
- material blocking findings and returned handoffs

The parent does not reproduce or reassess the child report. A persisted result should use an immutable locator; an ephemeral same-task result may use native platform result identity. A child-declared blocker may keep a successor not ready without changing the child's own completion declaration.

## Exclusions

The child does not perform subdomain prioritization, Context Map relationship-pattern selection, canonical terminology design, hidden-concept modeling, detailed invariant design, data-destruction analysis, code or topology design, approval, persistence, or implementation.
