# Foundational Child Map

This file declares production ownership and the parent-visible contract. Current Skills metadata is the runtime authority for installation. A child remains directly callable and reconstructs Actor, Purpose, Context, Constraints, and Evidence itself.

## purpose-goal-means

Status: `installed`

Use when the requested method is to distinguish stakeholder Purpose, observable Goal conditions, binding Constraints, and proposed or decided Means; diagnose missing links; or expose a premature implementation choice.

Required input:

- five-field common contract
- supplied stakeholder statements, requirements, constraints, decisions, artifacts, and provenance

Expected output:

- evidence-linked Purpose, Goal, Constraint, and Means records
- missing links, contradictions, unsupported decisions, and material unknowns
- bounded handoffs for quality, context, domain, code, or external evidence work it does not perform

Completion:

- every material supplied statement is classified or explicitly unresolved
- Goal conditions are distinguishable from Purpose and Means
- Means status and authority are not invented
- readiness and required handoffs are explicit

Excludes quality-scenario construction, context resolution, domain modeling, code design, refactoring, and implementation.

## quality-attributes

Status: `installed`

Use when the requested method is to discover or refine quality concerns, observable quality scenarios and measures, priority provenance, or pre-design interactions between quality requirements.

Required input:

- five-field common contract
- supplied stakeholder or business-goal evidence when available
- supplied quality statements, SLOs, risks, observations, decisions, authority, scope, and provenance

Expected output:

- evidence-linked quality concerns
- scenarios with source, stimulus, environment, artifact, response, and response measure where evidence supports them
- priority evidence, interactions, contradictions, unknowns, and bounded handoffs

Completion:

- every material quality input is represented or explicitly unresolved
- invented thresholds, priorities, workloads, tactics, and technologies are absent
- analysis readiness and required handoffs are explicit

Excludes architecture or tactic selection, implementation, instrumentation, persistence, and claims that a quality baseline is approved.

## context-interpretation

Status: `installed`

Use when material ambiguity or missing evidence affects terms, roles, purpose cues, translations, abbreviations, symbols, assumptions, scope, or system and environment boundaries.

Required input:

- five-field common contract
- exact expressions or statements in question
- supplied definitions, occurrences, examples, authority, scope, language, version, and provenance

Expected output:

- preserved expressions and evidence-linked interpretation alternatives
- separated context dimensions and boundary or scope observations
- resolution state, materiality, contradictions, neutral evidence questions, and bounded handoffs

Completion:

- every material subject is represented or explicitly unresolved
- supported meanings remain tied to scope and authority
- ambiguity, evidence conflict, and missing evidence are not conflated
- analysis readiness and required handoffs are explicit

Excludes DDD Bounded Context or Ubiquitous Language modeling, stakeholder-consensus claims, architecture selection, glossary persistence, and implementation.

## Parent Use

The parent uses these contracts only to select, order, name the child artifact type, and record the returned output reference and child's explicit completion declaration. It does not reproduce or reassess the child method. If current child metadata materially differs from this map, preserve the conflict and block consequential routing until the contract is reconciled.
