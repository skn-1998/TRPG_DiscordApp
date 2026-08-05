# Bounded Context Discovery Method

Use this reference after `bounded-context-discovery` triggers. It operationalizes source concepts without replacing domain evidence.

## 1. Normalize Evidence

For each material item, record the claim or observation, provenance, scope, version, stated authority, and one evidence state:

- `supplied`: claim content is present in the request or attachment
- `directly-evidenced`: an inspected, user-linked artifact contains the claim for the stated scope
- `asserted-but-unreproduced`: an artifact or decision is named but its material content is unavailable
- `contradicted`: allowed evidence conflicts for the same relevant scope
- `unknown`: no allowed evidence establishes the item

Use only the literal content that is available. A statement that a document defines purposes or invariants does not supply the omitted purposes or invariants. Preserve contradictions instead of choosing the newest or most convenient item without an evidenced authority rule.

A class, table, schema, repository, service, team, or deployment proves a representation or ownership fact, not a domain boundary by itself. An occurrence proves use, not meaning.

## 2. Map Current Terrain

Map what is already in play before proposing change:

1. Identify explicitly supplied current models or distinct rule-bearing expressions.
2. Record where each model is used and where applicability is unknown.
3. Record organizational, application, code, schema, service, and deployment manifestations as observations.
4. Record evidenced contacts among distinct current models.
5. Keep multiple uses of one shared model on that model's applicability record unless evidence establishes distinct model expressions.

Do not relabel a monolith as several existing Bounded Contexts merely because candidate partitions are imaginable.

## 3. Choose Comparison Units

Compare concerns at the narrowest evidence-supported level: actor job, workflow, decision, responsibility, rule set, model expression, term occurrence, or use area. A broad noun such as `Order` or `Customer` is not meaningful enough without the purpose and use that qualify it.

Two documents, teams, or systems are not automatically two models. Conversely, one shared name does not prove one coherent model.

## 4. Classify Boundary Signals

MinoDriven supplies four central perspectives:

- large-grained purpose
- closed process cycle
- strongly related concept cluster
- invariant

Also inspect context-qualified meaning and explicit model applicability, which follow formal DDD mechanics.

Organization, application area, codebase, schema, repository, service, deployment, cadence, and change authority are corroborating signals. They can support, constrain, or contradict a candidate, but they cannot create a supported domain boundary alone.

The categories in this reference are local operational aids. Do not attribute their ranking or thresholds to MinoDriven or Evans.

## 5. Test Material Divergence

A difference is material when choosing the wrong model scope can change at least one of:

- the actor or use community served
- the stakeholder purpose or job
- the process cycle or responsibility closure
- the concepts and relationships needed to reason about the job
- a context-qualified meaning
- an invariant or valid-state rule
- where the model is valid or invalid

Technology or organization alone is non-determinative unless evidence connects it to one of these model effects.

## 6. Classify Candidates And Hypotheses

Use these states:

- `supported-candidate`: evidence establishes purpose, applicability, inclusions, exclusions or neighbors, material divergence, traceable placements, an alternative comparison, and no unresolved material contradiction
- `hypothesis`: the analyst or evidence suggests a useful possibility, but required support is incomplete; state what would confirm or reject it
- `insufficient-evidence`: a supplied proposal cannot meet the supported-candidate conditions
- `conflicted`: material evidence or authorized decisions are incompatible
- `rejected-by-evidence`: current evidence directly contradicts the proposal for the stated scope

Do not promote an operation, workflow step, model label, team, or topology into stakeholder Purpose. Do not invent a polished candidate name when evidence supplies none.

Hypotheses are permitted because discovery often begins before all evidence is available. Keep them visibly separate from supported candidates and authoritative decisions. Do not create placeholder candidates merely to hold unknowns.

## 7. Compare Alternatives

For each supported split or material split hypothesis:

1. state the split
2. state the keep-together alternative
3. include any user-supplied alternative partition
4. compare all alternatives against the same evidence and model effects
5. record whether evidence supports, conflicts with, contradicts, or is insufficient for each alternative

Do not invent migration cost, coupling, team velocity, transaction boundaries, or feasibility. Boundary support and transformation feasibility are separate conclusions.

## 8. Interpret Physical And Organizational Evidence

Evans identifies organization, application use, codebases, and schemas as possible manifestations of a Bounded Context. Apply that evidence with purpose-first restraint:

- record it as current terrain or corroboration
- ask which model and purpose it realizes
- do not assume one technical or organizational unit equals one Bounded Context
- do not assume separate units require separate Bounded Contexts
- allow an evidenced purpose-specific model boundary to be realized as a system boundary
- route target topology and code design outside this Skill

## 9. Record Model Contacts

Record a current contact only when evidence identifies an exchange or dependency between two distinct current models. Capture direction when known, the concept/data/behavior exchanged, translation or sharing facts, and evidence scope.

Keep possible candidate interactions separate from observed current contacts. Record a candidate interaction only when supplied or directly evidenced; do not infer it merely from process adjacency or domain convention. Report an existing Context Map pattern when evidenced, but do not select a new relationship pattern.

## 10. Handle Authority, Questions, And Handoffs

Keep these roles distinct:

- Actor or beneficiary
- domain evidence source
- evidence owner
- boundary decision authority
- report author
- independent reviewer

Do not infer one role from another. A domain expert statement is evidence in its stated scope; it is not automatically an authorized boundary decision.

For each material unknown that can change placement, ask a neutral question and name the expected evidence. Do not embed a preferred split in the question.

Create a handoff only for work outside this Skill. Identify the recipient and owner only when evidenced or declared by the Skill hierarchy. Otherwise preserve them as unknown. Include required input, expected output, completion condition, exclusions, and return condition.

## 11. Semantic Self-Review

Verify that:

- every material claim is traced or explicitly uncertain
- current terrain is not rewritten as a target state
- one shared current model is not inflated into per-use models
- every reported candidate has exactly one state
- every supported candidate satisfies the stated evidence standard
- hypotheses remain visibly non-authoritative
- alternatives and contradictions are represented
- topology is never sole boundary proof
- same name or similar logic is never sole merge proof
- current contacts and candidate interactions are not conflated
- no new relationship pattern, topology, detailed model, approval, persistence, or implementation was produced
