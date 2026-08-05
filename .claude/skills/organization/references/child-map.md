# Organization Child Map

Current Skills metadata is the authority for runtime availability. A `planned` child is not callable, and the parent must not simulate it. After a child is installed, that child's `SKILL.md` is the authority for its production contract; this map remains a routing summary and must be reconciled when they differ.

All children accept:

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
```

Missing fields remain `unknown`. No child requires `organization` or another routing Skill to run.

## design-learning-workshop

Status: `installed`

Use when identified practitioners need to develop a named software-design capability through realistic practice, explanation, and feedback. Missing method sources are input gaps, not a reason for the parent to invent a preliminary design step.

Input (missing items stay `unknown`):

- supplied capability purpose, source, and observable problem;
- participant context and current practice evidence;
- realistic or safely representative work artifacts;
- confidentiality, production-write, accessibility, time, and authority constraints.

Expected output:

- bounded workshop design tied to one declared capability outcome;
- participant practice and explanation activities grounded in supplied work;
- feedback and observation method;
- safety boundaries, unresolved gaps, and transfer unknowns.

Completion condition:

- the capability and problem it addresses are source-traceable;
- participants perform and explain the relevant design work rather than only attend or read;
- observations distinguish activity from evidence of changed practice;
- the output does not claim production adoption or organization-wide scaling.

Excludes generic lectures, performance or promotion assessment, invention of the design method, production code rollout, and knowledge distribution across teams.

## design-knowledge-scaling

Status: `installed`

Use when a claimed software-design practice or slogan is being considered for reuse across several teams, repositories, or tools, including a decision that it is not ready for dissemination.

Input (missing items stay `unknown`):

- practice definition, sources, boundaries, and supplied usage evidence;
- target knowledge users, contexts, recurring tasks, and failure evidence;
- candidate channels or tool constraints, when supplied;
- source-of-truth, stewardship, compatibility, and feedback constraints.
- requested scaling decision.

Expected output:

- evidence-linked practice qualification and a bounded channel-neutral knowledge contract, or a not-ready finding;
- channel comparison and selected fit;
- stable meaning, permitted variation, provenance, and the current maintenance locus or unresolved responsibility;
- use evidence to return, supplied adoption or outcome observations, reconsideration conditions, and consequential unknowns.

Completion condition:

- for `reference-or-template`, `skill-candidate`, `human-exchange`, or `hybrid`, the reusable unit has an intended audience and recurring problem, input and preconditions, output, boundary, and completion condition;
- for `no-dissemination-yet`, the not-ready finding names the material blocker and evidence needed to reconsider it; a reusable unit is not required;
- for either branch, material practice claims are sourced or labeled local, applicability and non-applicability are explicit, channel fit and reconsideration conditions are stated, and no authority or maintenance responsibility is invented.

Excludes inventing an ungrounded practice, mandating MCP/CI/Skill packaging, authoring the final Skill, and organization policy enactment.

## Parent Use

Use `organization` only to select, order, and contract these children. A workshop is not universally required before scaling; order it first only when the scaling decision consumes its evidence.

## Peer Handoffs

Use only the peer whose output is required now; never expand that peer's internal route. Confirm each peer from current Skills metadata and report an unavailable selected peer as `missing-capability`.

- `design-core`, `domain-design`, `code-design`, or `refactoring`: defining or revising the software-design practice is explicitly requested as a separate outcome, or an actual returned child result requires that owned artifact.
- `skill-creator`: creation or revision of an actual Skill is explicitly requested.
- `route-design-work`: several design categories must be coordinated.
