---
name: context-interpretation
description: Turn ambiguous terms, actor or role labels, purpose cues, translations, abbreviations, symbols, status codes, boundary statements, and scope statements into evidence-backed interpretations before downstream design. Use directly when an expression may mean different things by purpose, actor, workflow, organization, interface, time, or system context; when system boundary, context boundary, and work scope may be conflated; or when conflicting wording can alter a decision. This Skill diagnoses meaning and uncertainty only; it does not establish a DDD Bounded Context or Ubiquitous Language, approve a glossary, infer stakeholder intent, select a design, or implement a change.
---

# Context Interpretation

Determine what supplied expressions can mean in their applicable context. Keep unresolved meaning visible instead of silently choosing the most familiar interpretation.

## Input Contract

Reconstruct the smallest useful frame:

```text
Actor: stakeholder, beneficiary, domain owner, or responsible party whose perspective matters
Purpose: intended stakeholder state, action aim, or target
Context: subject, situation, and boundary in which the expression is used
Constraints: supplied binding rules, limits, and their provenance
Evidence: supplied or directly referenced wording, artifacts, observations, and decisions
```

Unknown fields do not prevent diagnosis. Preserve them as `unknown` when they affect interpretation. Do not infer Actor from the requester, operator, author, mentioned role, or decision authority. Do not turn a request to interpret, analyze, discover, route, review, approve, save, or implement into the stakeholder Purpose or designed-system Context.

Use current-request evidence and explicitly designated artifacts. Preserve exact wording, occurrence, source, authority, scope, language, version, and contradictions when material. A statement that a named artifact defines or decides something is supplied evidence of that statement, not independent verification. A bare pointer whose content is unavailable is asserted but unreproduced and cannot establish meaning.

## Source Authority

MinoDriven supplies the primary design intent: words gain meaning from situation and Purpose, and vague Purpose lets people and AI choose different interpretations. IREB supplies requirements-context, terminology, stakeholder-role, boundary, scope, assumption, conflict, and validation mechanics. Eric Evans's DDD Reference limits this Skill: contextual meaning may be diagnosed here, but Bounded Context and Ubiquitous Language design belong to domain design.

Read `references/method.md` when several meanings, sources, or boundary axes must be compared. Read `references/source-ledger.md` and `references/source-to-rule-map.md` only when checking or revising a normative rule.

## Responsibility Boundary

This Skill may:

- identify the material expression or boundary statement
- preserve evidence and applicable context
- compare evidence-backed interpretations or claims
- distinguish uncertainty, ambiguity, conflict, and context-qualified meanings
- separate system membership, context relevance, work scope, and external interfaces
- ask neutral evidence questions and return bounded handoffs

It must not invent project meaning, stakeholder intent, Purpose, authority, scope, or source precedence. It must not simulate stakeholder agreement or validation, create a canonical glossary, establish a DDD Bounded Context or Context Map, select a Means, design code, persist an artifact, or authorize implementation.

## Workflow

1. Normalize Actor, Purpose, Context, Constraints, and Evidence without filling gaps from general knowledge.
2. Isolate only the requested or materially decision-changing subject. Preserve its exact wording and occurrence. Do not recursively interpret every noun inside an evidenced definition or supplied Purpose unless that contained expression is itself disputed or must be chosen for the current decision.
3. Record the evidence that supports, contradicts, or merely mentions each possible meaning. Keep source, authority, scope, language, version, and reproduction status visible when they can change applicability.
4. Describe only the context dimensions needed to distinguish meanings:
   - Purpose or Goal
   - person, Actor, role, beneficiary, or authority
   - workflow, event, or state
   - system or environment
   - time or version
   - organization, policy, contract, or jurisdiction
   - interface, message, field, record, or data lifecycle
5. For a boundary or scope question, keep these independent:
   - whether an element belongs to the system
   - whether it is relevant context
   - whether it is inside the work or development scope
   - whether and how it crosses an external interface

   Do not equate any of them with an organizational, repository, deployment, or DDD Bounded Context boundary.
6. Form interpretation candidates only from supplied or directly referenced evidence. When the user explicitly asks for possible meanings, hypotheses may be offered as `analyst proposal`; they cannot resolve the subject.
7. Compare the candidates:
   - no supported applicable meaning, or insufficient authority or scope: unresolved
   - one controlling applicable meaning with no material contradiction: resolved by evidence
   - several meanings or claims whose evidenced contexts do not overlap: context-qualified
   - several denotations competing in the same applicable context: unresolved ambiguity
   - incompatible factual, obligation, boundary, or applicability claims in the same context: evidence conflict
   - supported candidates exist but the target occurrence's context is unknown: context applicability unknown

   These labels describe semantic outcomes; they do not require a fixed serializer or a full register for a narrow request.
8. State why the difference matters. Material effects include Actor or authority, Purpose or Goal, requirement or constraint, boundary or scope, ownership, observable behavior, data meaning, acceptance, and downstream design.
9. Resolve only when current evidence establishes a controlling authority for the subject and scope. Otherwise ask a neutral question naming the needed evidence, not a preferred answer.
10. Return the interpretation result and only the handoffs needed for the requested next decision.

## Interpretation Rules

- A person may hold several roles. A role label is not automatically a person, Actor, beneficiary, stakeholder Purpose, or decision authority.
- Do not infer a higher Purpose as fact. When it matters, ask for it or present an explicitly requested hypothesis as unverified.
- Do not rank law, contract, policy owner, product owner, domain expert, glossary, documentation, implementation, or recency universally. Use only evidenced decision rights for the subject and scope.
- Two sources are not two alternatives when they support the same meaning. Two compatible claims are not a conflict merely because they are separate.
- Preserve original-language wording. Treat a translation, abbreviation expansion, synonym, or homonym as equivalent only when evidence establishes that relationship and scope.
- Record an assumption as an assumption. Consistency with this analysis is not validation.
- A complete diagnosis may remain unresolved. Never hide missing authority or applicability behind an analyst proposal.

## Handoffs

Use the smallest installed recipient and do not simulate missing capability:

- `purpose-goal-means`: missing or ambiguous Purpose must be classified before meaning can be settled
- `quality-attributes`: a settled quality term needs a measurable scenario, response, or priority
- `bounded-context-discovery`: one Bounded Context candidate or boundary analysis
- `domain-design`: Ubiquitous Language, Context Map, domain model, invariant, canonical domain terminology, or multiple domain methods
- `route-design-work`: several design categories or implementation order must be coordinated

Complete the interpretation portion first. For a blocking handoff, state recipient, reason, required evidence, expected result, completion condition, exclusions, and re-entry condition. For an advisory next action, state recipient, reason, expected result, and exclusions. When no installed recipient owns the work, report the capability gap rather than fabricating a workflow.

## Output Contract

Return a concise report containing:

1. disposition and reconstructed input frame
2. material expression or boundary statement and exact evidence
3. evidence-backed interpretation, applicable context, uncertainty or conflict, and decision impact
4. boundary distinctions when relevant
5. neutral evidence questions and contradictions
6. required handoffs and one next action or `none`

Use a compact table or prose according to the request. Omit empty optional sections. A narrow term question may need only one interpretation record and one evidence question. Do not emit Skill-maintenance, admission, release, reviewer, persistence, hash, or evaluation records during ordinary use.

## Self-Review And Completion

The diagnosis is complete when every requested material expression is interpreted or explicitly unresolved; each reported meaning and applicability claim traces to evidence; material context, authority, contradiction, and boundary gaps are visible; and any required handoff can be executed without this Skill performing the recipient's work.

Before returning, verify that no Actor, Purpose, meaning, authority, boundary relation, source precedence, agreement, or validation was invented; context-qualified meanings do not overlap; ambiguity and evidence conflict were not conflated; and no DDD modeling, glossary approval, design selection, persistence, or implementation was claimed.

## References

- `references/method.md`: evidence, context, interpretation, and boundary mechanics
- `references/source-ledger.md`: source provenance and authority limits
- `references/source-to-rule-map.md`: production-rule traceability
