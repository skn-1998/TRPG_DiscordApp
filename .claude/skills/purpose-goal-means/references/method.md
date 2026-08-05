# Purpose Goal Means Method

Use this reference after the Skill triggers. General sources define the method; only current-request evidence supplies case facts.

## Classification Tests

### Purpose

Apply the why test: identify an attributable stakeholder state, aim, or target. A rationale may help locate Purpose evidence but does not become Purpose by itself. Specifications, constraints, architecture, code, and requested work do not establish stakeholder intent.

When wording expresses a desired state but the Actor or attribution is unknown, retain the original as an unresolved Purpose candidate. Do not treat grammatical intent such as "want" as proof of whose Purpose it is. Quality words in the same statement remain incomplete Goal conditions and may cross-reference the candidate without making it evidenced Purpose.

Purpose composition is evidence-based. Record parent and child Purposes only when the source states that relationship; do not infer Boolean satisfaction, transitive Goals, or transitive Means.

### Goal

Apply the achievement test: ask what condition lets an observer judge Purpose achievement or valid behavior. Record applicable context, source, responsible party when supplied, and observation or verification. A named observation method can establish observability without proving that it ran or passed.

Preconditions, postconditions, and invariants are Goal-condition kinds only when supplied evidence expresses those semantics. Detailed contract design belongs elsewhere.

An evidenced Goal may cover only part of a Purpose. Unless completeness is asserted or requested, preserve partial trace and mark the remainder unknown rather than inventing more Goals.

### Means

Apply the alternative test: if another method could meet the same Goal, the item is likely Means. A supplied technology, model, system, design, or code element can be retained as a candidate even when its Goal link or fit is unknown.

Do not infer a technology's mechanism or expected quality from general knowledge. Analysis classification does not select or authorize the Means.

### Constraint Provenance

Apply the binding test: record what makes the condition mandatory, in what scope, and from what source or authority. The binding condition is represented as a Goal condition and the provenance remains in the Constraint view. A heading or noun such as `condition` or `requirement` is not binding evidence by itself. Without evidence of binding, keep the content in its other classification, often a Goal condition, and omit Constraint provenance.

### Generic Activities

Meeting, reviewing, approving, requesting, analyzing, organizing, and similar activities are not automatically Purpose, Means, or designed-system Context. Classify only when current evidence supplies the stakeholder aim, achievement condition, design subject or boundary, authority, or explicit method role. Otherwise preserve the activity as unresolved requested work and keep Context unknown.

## Evidence And Trace

For each material statement preserve:

- original content or a faithful reference
- source and scope
- version or time when material
- stated authority
- evidence state: supplied, directly evidenced, asserted but unreproduced, contradicted, or unknown

Walk Purpose -> Goal -> Means and back. A missing link is a finding, not permission to infer. Preserve user-supplied IDs and links. Do not create empty placeholder records.

Use `why` and `for example` as navigation questions, not content generators. Stop when a further level would not change the current classification or handoff, when the next decision belongs to another authority, or when current evidence is exhausted. Record the stop reason only when it matters to the request.

Role metadata remains separate. A decision authority, evidence owner, author, reviewer, requester, executing agent, and handoff recipient are not design Actors unless evidence separately identifies the stakeholder relationship.

Instructions about this analysis, tools, reads, output, or writes are execution evidence, not Constraints on the designed subject unless the request states that relationship.

## Goal Observability

Preserve a supplied observation method and distinguish it from an achievement Means. Tests, inspections, audits, demonstrations, analyses, and monitoring normally show whether a condition holds; they do not necessarily cause the condition to hold.

Do not convert a Goal's numeric threshold into evidence that a verification method exists. Do not convert a named test into a passing result or an unstated oracle. When observation is absent, record the gap and its downstream consequence.

Vague quality concerns remain evidence. Route scenario, environment, response, measure, priority, and interaction work to `quality-attributes`.

## Means Status

Use these evidence meanings without requiring exact labels in the report:

- candidate: supplied as a possible method, with selection still open
- accepted or rejected: an evidenced authority decision covers the Means, relevant Goal, and scope; preserve version or time when material
- deferred: an evidenced authority postpones the decision; preserve an owner and trigger or date when supplied, otherwise record those as follow-up gaps

Unknown fit, alternatives, risks, or affected Constraints do not prevent analysis classification, but they prevent selection or implementation authorization. Preserve an evidenced decision before recording missing version or time as an applicability gap. An artifact that does not clearly cover the current Means and Goal cannot supply a decision state.

## Cohesion Findings

MinoDriven links Purpose-specific structure with changeability. Apply this check only when relevant code, ownership, or structure evidence is supplied; otherwise omit it. Record only evidence-bounded findings:

- fragmented same-purpose Means: supplied ownership or code evidence shows related conditions or logic spread across paths
- mixed-purpose Means: one supplied Means traces to materially different evidenced Purposes
- possible bypass: structure permits a path that may avoid a condition

Do not claim an actual violation, failed outcome, change cost, or redesign need without evidence. Hand detailed responsibility design to `code-design`.

## Handoff Discipline

Handoffs preserve the normalized contract and add only justified deltas. Name an exact child when one method owns the work; use a category parent only for ambiguity or composition. An installed routing parent is asked for a route or capability-gap report, not the absent child's artifact.

A handoff that blocks requested continuation includes required input, expected output, completion, exclusions, state, and re-entry. An advisory next action needs only recipient, reason, expected result, and exclusions. Missing capability is explicit. Do not invent a human role or owner to make a handoff appear executable.

## Semantic Review

Check that:

- every statement is represented once or cross-referenced without changing its meaning
- Purpose, Goal, and Means follow evidence rather than grammar or headings
- binding conditions and Constraint provenance remain connected
- every trace is evidenced and missing links remain visible
- observation methods, results, and achievement Means are not conflated
- Means decisions and authority are not invented
- risk findings are not presented as observed failures
- downstream methods were handed off rather than performed
