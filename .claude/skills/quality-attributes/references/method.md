# Quality Attribute Method

This reference expands the runtime method. It is not a mandatory report schema.

## 1. Source And Method Boundaries

MinoDriven supplies the primary intent: name the quality being improved so people and AI do not optimize an unspecified notion of "good." Purpose remains upstream of quality choices.

ISO/IEC 25010:2023 supplies a current product-quality reference model. Its public abstract does not justify inventing unavailable definitions, claiming conformance, or silently mapping labels from another source or version.

SEI Quality Attribute Workshop material supplies business-goal trace, stakeholder scenario generation and refinement, prioritization provenance, and six scenario components. An LLM applying this Skill has not run a QAW unless actual workshop evidence is supplied.

SEI ATAM evaluates architecture approaches against quality goals and identifies risks, sensitivity points, and tradeoff points. This Skill stops before architecture evaluation and must not use those result labels.

## 2. Evidence And Quality Labels

For a material concern preserve:

- original wording
- stakeholder or authority when supplied
- Purpose, business goal, or Goal trace
- source artifact and version
- applicable system, environment, population, and time scope
- contradictions and decision status

A current-request statement about a named artifact is supplied evidence of that statement, not independent verification. A bare artifact label supplies no omitted content.

Handle taxonomy cautiously:

| Situation | Treatment |
| --- | --- |
| Source and version establish a mapping | preserve the mapping and citation |
| User asks for possible mapping | label it analyst proposal |
| Label has no model or version | preserve it as unversioned wording |
| Scenario is concrete and taxonomy is immaterial | let the scenario carry the meaning |

MinoDriven's quality material and ISO/IEC 25010:2023 may use related language, but do not claim an exact cross-version mapping without evidence.

## 3. Six-Part Scenario

SEI's six components are:

1. Source of stimulus: entity that generates the event or condition.
2. Stimulus: event or condition affecting the system.
3. Environment: operating condition in which it occurs.
4. Artifact stimulated: affected system or element.
5. Response: system activity following the stimulus.
6. Response measure: rule used to judge the response.

Keep these separate from:

- Actor or stakeholder whose interest matters
- Purpose or business goal motivating the scenario
- evidence source documenting the scenario
- technology or tactic proposed to achieve it

One person may be both stakeholder and stimulus source, but only evidence establishes both roles.

An incomplete scenario remains useful. Preserve supplied components and describe missing material components. Do not force one scenario per adjective or create placeholder IDs for absent content.

A scenario whose six components are supplied can be called refined for classification purposes. Missing acceptance authority, reproduction detail, or broader scope may still be a separate gap when the requested use depends on it.

## 4. Response Measures

Ask which dimensions can change the pass/fail judgment:

- measured response or property
- unit
- threshold or comparison rule
- workload, event, or operating environment
- aggregation, percentile, sampling, or observation window
- observation method or evidence artifact
- scope, version, and authority for acceptance

This is a precision checklist, not an extra standard schema. Not every scenario needs every dimension. State why a dimension is immaterial when that fact is evidenced; otherwise keep a material absence unknown.

Do not convert:

- "fast" into a latency threshold
- a numeric target into an observation method
- a test name into a passing result
- a production observation into a universal requirement
- a sample metric or industry norm into stakeholder evidence

When the user requests measurement alternatives, propose dimensions or candidate measures as analyst proposals outside the scenario facts. Acceptance requires evidenced authority and applicable scope.

## 5. Priority Provenance

Priority may come from:

- an authorized decision
- an actual stakeholder vote or workshop result
- a supplied rank or score and method
- an accepted program or mission priority
- an evidenced risk ranking

Preserve covered concerns or scenarios, participants or authority, method, scope, source/version, and date when supplied.

Do not infer priority from prose order, words such as critical, taxonomy category, the analyst's risk intuition, or the current filesystem date. Do not simulate QAW voting or consensus.

## 6. Interaction Typing

Use an observed requirement conflict only when evidence shows that requirements or scenario outcomes cannot both hold in the stated scope. Preserve the experiment, observation, constraint, or decision that demonstrates the relationship.

Use an interaction hypothesis when:

- current evidence supplies a shared variable or mechanism, or
- the user explicitly asks how two concerns might interact

Phrase it as a question for later design or evaluation. It is not an established conflict.

When only two quality labels are named, state that no interaction is evidenced if the relationship matters to the request. This is absence of evidence, not evidence of absence.

An externally recorded decision remains attributed to its authority and scope. It does not become this Skill's recommendation.

Never call a requirement interaction an ATAM risk, sensitivity point, or tradeoff point without actual architecture evaluation evidence.

## 7. Candidate Design And Technology

Named architectures, tactics, products, and technologies may be relevant request context, but they do not supply quality facts by name alone.

For a later comparison:

1. preserve the candidate names and supplied evidence outside scenario facts
2. complete the quality criteria that the comparison must use
3. expose missing scope, evidence, and decision authority
4. hand selection or evaluation to the applicable design workflow

Do not infer that Redis improves latency, a queue improves reliability, encryption reduces usability, or modularity improves changeability without case evidence. General knowledge may explain a concept only when requested; it cannot become evidence about the current candidates.

## 8. Bounded Handoffs

- missing Purpose or Goal trace that blocks the requested quality decision: `purpose-goal-means`
- material term, Actor, environment, boundary, or scope ambiguity: `context-interpretation`
- scenario-specific changeability review of code or design: `review-changeability`
- architecture/tactic selection, implementation, approval, or cross-category work: `route-design-work`

Finish the quality record before handing off. Avoid cycles: unresolved meaning belongs to context interpretation; quality framing resumes after the meaning is resolved or context-qualified. Use only installed recipients and report missing capability explicitly.

## 9. Compact Examples

### Vague Concern

"Make it fast" supplies a performance-shaped concern but no Actor, Purpose, stimulus, environment, response, or measure. Preserve the phrase and ask what response must be judged, under which condition, and by whose criterion. Do not offer latency percentiles unless requested.

### Complete Scenario

During an evidenced peak-load environment, customer requests stimulate the support API, which returns a response measured by a supplied p95 latency rule. Keep the customer as stimulus source and preserve the separately evidenced stakeholder Actor. Do not demand a seventh scenario component.

### Two Labels

"Security and usability are both important" supplies two concerns, not a conflict. Without a shared mechanism, observation, or explicit interaction request, report no evidenced interaction.

### Technology Comparison

A request to compare Redis and Caffeine belongs to later design. Frame the supplied quality criteria first and do not place assumed cache behavior into the scenario.
