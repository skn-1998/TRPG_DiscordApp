---
name: design-learning-workshop
description: Design or adapt a bounded practice workshop for identified software practitioners to develop one named, source-traceable design capability through realistic or safely representative work, explanation, task or process feedback, and revision. Use directly when the requested artifact is a workshop design for a specific capability or observed practice gap. Do not use for a generic lecture, curriculum, meeting facilitation, team building, employment assessment, invention of the design method, production rollout, cross-team knowledge scaling, Skill authoring, or mandatory training governance.
---

# Design Learning Workshop

Produce one evidence-grounded workshop design. Do not deliver the workshop or claim that participants mastered or adopted the capability.

## Input Contract

```text
Actor: practitioners expected to develop or use the capability
Purpose: capability outcome and problem it should help them address
Context: current practice, domain, experience, and artifact setting
Constraints: time, confidentiality, production writes, accessibility, authority, and participation limits
Evidence: capability sources, observed gap, usable artifacts, and available learning observations
Named design capability and problem:
Participant group and current practice:
Candidate work artifacts and safety limits:
Requested recipient and decision:
```

- Preserve supplied wording, source, authority, disagreement, and unknowns. Mark absent fields `unknown`.
- Do not infer Actor from the requester, or infer a capability method from a topic label.
- Ask only when an unknown prevents identifying the capability, its problem, the participant practice, or a safe workshop artifact.

## Boundary

Design a proportionate opportunity to perform relevant design work, explain the problem and design reasoning, receive task or process feedback, and revise when useful. Prefer realistic work, but allow safely representative code, models, ADRs, scenarios, or interfaces when real artifacts are unavailable or unsafe.

Do not invent or approve the design method, require production code, mandate MinoDriven's example schedule or participant count, assign fixed facilitators or approvers, score people, certify competence, edit production code, run training tests, enact adoption, scale knowledge across teams, author a Skill, or create release gates.

## Workflow

Read `references/workshop-contract.md`, then:

1. Bound the practitioners, capability outcome, problem, current practice, artifact setting, recipient, and decision.
2. Trace the capability and its problem to supplied sources. If the method is absent, or disagreement prevents a usable activity, preserve a bounded design shell and return the smallest source or authority blocker rather than inventing content. A disputed source may support a provisional design only when its authority and disagreement stay explicit.
3. Choose a realistic or safely representative artifact and record what it can and cannot evidence. Respect confidentiality, accessibility, and production-write constraints.
4. Design an attempt in which each intended learner performs the capability-relevant work. Do not force code implementation when the capability is exercised through a model, decision record, scenario, or explanation.
5. Prompt an explanation that connects the observed problem, actor purpose, design decision, alternatives, and expected effect.
6. Design feedback about the task, reasoning, or process, not praise, personality, promotion, or ranking. Include revision only when it helps the named capability outcome.
7. Define observable session evidence separately from later work-transfer evidence, then record consequential unknowns and the narrowest handoff. Activity, attendance, or a polished exercise is not proof of changed practice; do not add a rollout or governance program.

## Output Contract

Return:

- normalized input and evidence limits;
- source-traceable capability and problem;
- participant practice gap and consequential unknowns;
- artifact choice, authenticity limits, and safety constraints;
- proportionate attempt, explanation, feedback, and revision design;
- observable session evidence and separate transfer unknowns;
- exclusions and narrow handoffs;
- status: `workshop-design-supported` or `workshop-design-incomplete`.

Use `references/workshop-contract.md` proportionately. Do not require eight fixed steps, a duration, participant count, rubric, score, YAML, test suite, named facilitator, follow-up owner, approval gate, or release phase.

## Completion

Return `workshop-design-supported` when the capability and problem are source-traceable; the intended practitioners can perform and explain relevant design work using a safe artifact; feedback is tied to the task or reasoning; constraints are represented; and session observations are not mislabeled as mastery, transfer, or adoption.

Return `workshop-design-incomplete` when missing capability authority, problem definition, participant context, safe artifact, or accessibility constraint prevents a usable design. Name the smallest blocker. Completion approves only the workshop design, not participant competence or organizational rollout.

## Handoffs

- Re-enter `organization` when defining or revising the design practice is separately requested, several organization methods require ordering, or scaling is also requested.
- Hand off a clear cross-team distribution decision to `design-knowledge-scaling` when available.
- Hand off actual Skill creation or revision to `skill-creator`.
- Hand off production code change to the applicable design or refactoring capability only when separately requested.

Keep handoff targets opaque and pass only the capability, workshop design, evidence, and limits they require.

## References

- `references/workshop-contract.md`: capability, activity, evidence, and completion rules. Read for every run.
- `references/source-ledger.md`: source claims and adoption limits.
- `references/source-to-rule-map.md`: production-rule traceability.
