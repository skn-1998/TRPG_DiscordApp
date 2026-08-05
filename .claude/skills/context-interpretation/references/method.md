# Context Interpretation Method

This reference expands the runtime method. It is not a mandatory output schema.

## 1. Primary Design Intent

MinoDriven's context-verbalization material supplies the central intent:

- words do not determine meaning in isolation
- Purpose and situation change interpretation
- unclear Purpose lets people and AI answer different questions
- broad labels such as "good code" are not actionable until the relevant quality concern is known
- a stated activity or Means should not silently replace the higher Purpose

Operational consequence: reconstruct Actor, Purpose, Context, Constraints, and Evidence, but keep missing values unknown. A higher-Purpose hypothesis is a question or explicitly labeled proposal until attributable evidence confirms it.

## 2. Evidence And Subject Selection

For each material claim ask:

1. What exact wording or boundary statement is being interpreted?
2. Where does it occur?
3. Does the evidence define a meaning, demonstrate a use, report a decision, state an assumption, or merely mention the expression?
4. Which source or authority, scope, language, and version apply?
5. Does another allowed source contradict it in the same applicable context?
6. Does the claimed authority control this subject and scope?

A current-request statement such as "TERM-12 v3 defines X as Y for billing" is supplied evidence of that claim and provenance. It is not independently reproduced evidence. A bare "see TERM-12" pointer supplies no definition and cannot settle X.

Choose subjects proportionally. Preserve an exact expression when another interpretation could change a requested decision. Do not atomize every noun in a supplied definition, Purpose statement, artifact title, or example. A contained expression becomes a separate subject only when it is independently disputed, has competing evidenced meanings, or must be selected for the current decision.

Material effects include:

- Actor, beneficiary, representative, or authority
- Purpose, Goal, success condition, or priority
- system membership, relevant environment, work scope, or interface
- requirement, constraint, invariant, quality measure, or acceptance
- ownership, handoff, observable behavior, or data meaning
- permissibility of the intended downstream use

When the consequence cannot be assessed, state that materiality is unknown. Do not manufacture a consequence merely to justify more analysis.

## 3. Context Dimensions

Use only dimensions that distinguish candidates:

| Dimension | Evidence question |
| --- | --- |
| Purpose or Goal | For which evidenced outcome is the expression used? |
| Actor or role | Who uses, experiences, owns, represents, or decides it, and in which role? |
| Workflow or event | During which activity, event, state, or trigger? |
| System or environment | Which system and relevant environmental element? |
| Time or version | Which period, release, effective date, or source version? |
| Organization or rule source | Which organization, jurisdiction, contract, or policy? |
| Interface or data | At which interaction, message, field, record, or lifecycle point? |

An absent dimension is unknown when it matters. It need not become a placeholder row when it cannot affect the interpretation.

IREB distinguishes system context, system boundary, context boundary, and scope. A person may also hold several stakeholder roles. Therefore do not collapse:

- person, role, system actor, beneficiary, stakeholder, and decision authority
- the system itself and the relevant environment
- relevant environment and irrelevant surroundings
- what exists inside the system and what the current work may change

## 4. Boundary And Scope

For a disputed element, ask separately:

| Axis | Question |
| --- | --- |
| System membership | Is the element part of the system under consideration? |
| Context relevance | Is it part of the environment relevant to understanding the system or requirement? |
| Work scope | May the current development or decision shape it? |
| External interface | Does interaction cross the system boundary, and where? |

These answers may differ. A reused component may be inside the system but outside development scope. An external actor may be outside the system, relevant to context, and connected through an external interface.

Do not infer a DDD Bounded Context from these axes. Evans defines a Bounded Context as the boundary within which a model is defined and applicable. Hand one requested boundary analysis to installed `bounded-context-discovery`; hand model, language, Context Map, or multi-method work to `domain-design`.

## 5. Interpretation Relationships

Only supplied or directly referenced evidence can support a project interpretation. If the user requests possibilities, an analyst may offer hypotheses, but they remain unverified and cannot settle a material subject.

Classify the relationship rather than counting documents:

### Unresolved

No supported applicable meaning exists, or one candidate exists but its authority or scope cannot establish it for the target occurrence.

### Resolved By Evidence

One controlling meaning or claim applies to the target context and scope, with no unresolved material contradiction at that controlling level.

### Context-Qualified

Several supported meanings or claims apply in evidenced, non-overlapping contexts. Preserve each qualifier. Do not force a universal definition.

### Unresolved Ambiguity

Several material denotations compete for the same expression in the same applicable context, and no controlling evidence resolves the choice.

### Evidence Conflict

Non-denotational claims about facts, obligations, boundaries, versions, or applicability are incompatible in the same applicable context.

### Context Applicability Unknown

Supported candidates are known, but evidence does not place the target occurrence or claim into one context and does not establish that candidates overlap.

Two sources supporting the same normalized meaning are one candidate with several evidence links. Independent compatible claims are separate claims, not competing meanings. Do not use ambiguity as a synonym for missing information, and do not call known non-overlapping uses a conflict.

## 6. Terminology, Translation, And Symbols

IREB recommends controlled terminology for shared understanding and calls out context-specific terms, abbreviations, synonyms, and homonyms. Apply those points diagnostically:

- preserve original wording and language
- retain each occurrence needed to establish context
- treat an abbreviation and expansion as equivalent only within evidenced source and version
- treat translations as separate claims until evidence establishes equivalence
- distinguish a symbol or status code's denotation from a prose claim about it
- do not create or approve a project glossary

Evans's Ubiquitous Language is model-based and used within a Bounded Context. A contextual term diagnosis is evidence for possible later domain work, not the language design itself.

## 7. Authority, Assumptions, And Questions

Do not impose one universal source ranking. Law, contract, policy owner, product owner, domain expert, glossary, documentation, implementation, and recency may control different questions. Current evidence must establish decision rights and applicable scope.

Record a supplied assumption as an assumption. Validation requires relevant evidence and authority; internal consistency or an LLM judgment is not validation.

When sources conflict, preserve:

- each claim and provenance
- subject and applicable context
- scope and version
- controlling authority when evidenced
- consequence of leaving the conflict unresolved

Ask neutral questions. Prefer "Which supplied authority defines X for this billing occurrence and version?" over a question that embeds a favored meaning. Name an evidence owner only when supplied.

## 8. Bounded Handoffs

Finish the interpretation diagnosis before handing off:

- missing Purpose classification: `purpose-goal-means`
- quality scenario or measure after meaning is settled: `quality-attributes`
- one Bounded Context candidate or boundary analysis: `bounded-context-discovery`
- Ubiquitous Language, Context Map, domain model, invariant, canonical domain terminology, or multiple domain methods: `domain-design`
- several categories or implementation sequencing: `route-design-work`

Avoid cycles. When Purpose and terminology both depend on one missing external fact, ask the evidenced owner for that fact rather than bouncing between Skills. A recipient may be used only when installed and applicable.

## 9. Compact Examples

### One Phrase, No Definition

"The administrator stops the account" supplies neither the administrator type nor the meaning of "stops." Keep both unresolved if they can change permissions or observable behavior. Ask for the authority and workflow-specific definition; do not invent suspension or deletion.

### Same Word, Separate Contexts

Evidence defines "customer" as contract purchaser in billing and service recipient in support. When each occurrence is scoped, report context-qualified meanings rather than selecting a universal definition.

### Known Meanings, Unknown Target Context

Billing and support meanings are evidenced, but an export-screen occurrence has no context evidence. Report context applicability unknown; do not label the established billing and support uses themselves ambiguous.

### Boundary Versus Scope

A reused payment component is inside the system but contractually outside the current change scope. Preserve both facts. Out of scope does not mean outside the system.
