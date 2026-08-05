# Source Ledger

Use this ledger to ground `purpose-goal-means`. MinoDriven material controls the Purpose-Goal-Means design intent. Supporting sources refine requirements evidence, observability, traceability, alternatives, conflicts, and Skill packaging without replacing that intent.

## Primary Design Intent

- MinoDriven, "Purpose-driven architecture design in the AI era"
  https://speakerdeck.com/minodriven/purpose-driven-architecture
  - Slides 24-31 define Purpose as the intended state or aim, Goal as concrete conditions for judging achievement, and Means as the method or tool used to achieve it. In software, customer requirements map to Purpose, requirements/specifications/constraints to Goal, and source code to Means.
  - Slide 31 therefore does not establish Constraint as a fourth peer semantic type. This Skill normalizes binding condition content into Goal and retains authority, scope, and rationale in a separate local provenance register.
  - Slides 34-37 connect one Purpose and its Goal to consolidated Means and support bypass, duplication, and synchronized-change concerns when the Means remain scattered. They do not explicitly establish diffuse ownership; that phrase is a local inference when ownership evidence supports it.
  - Slides 40-45 show that reusing one Means across different Purposes causes change interference and connect purpose-based structure to modifiability.
  - Slide 49 relates preconditions, postconditions, and invariants to Goal conditions; use Eiffel for the formal terminology.
  - Slide 58 states that specifications correspond to Goals and that specifications alone do not reveal Purpose.

- MinoDriven, "Purpose and abstraction design"
  https://speakerdeck.com/minodriven/purpose-abstraction-design
  - Slides 28-35 present systems and models as purpose-achievement Means and state that different Purposes expose different problems and solution Means.
  - Slide 55 places Purpose identification before abstraction/modeling.
  - Slides 59-60 show that broad Purpose may decompose into distinct sub-purposes rather than one universal model.
  - Slide 86 summarizes modeling as Purpose identification, problem extraction, and solution-Means design. This Skill stops before the latter two become detailed design.

## Requirements And Goal Support

- NASA, "Appendix C: How to Write a Good Requirement"
  https://www.nasa.gov/reference/appendix-c-how-to-write-a-good-requirement/
  Use for: separating what is needed from how it is provided, recording rationale and assumptions, bidirectional traceability to needs/goals/objectives, and verifiable success criteria. Do not import NASA's `shall`/`will`/`should` terminology or treat it as a replacement for MinoDriven's three definitions.

- NASA, "6.2 Requirements Management"
  https://www.nasa.gov/reference/6-2-requirements-management/
  Use for: source/owner tracking, bidirectional traceability, consistency across requirements/design/tests, and independent trace review where possible.

- Axel van Lamsweerde, "Goal-Oriented Requirements Engineering: A Guided Tour," RE'01
  https://webperso.info.ucl.ac.be/~avl/files/RE01.pdf
  Use for: intended properties, rationale and vertical traceability, alternative refinements, conflict detection, responsibility, relative stability of higher-level goals, and WHY/HOW elicitation. GORE uses `goal` across abstraction levels and distinguishes hard and soft goals; do not equate its full terminology with MinoDriven's narrower Goal definition. This Skill does not implement KAOS or another formal GORE notation.

- CMU Software Engineering Institute, "Goal-Driven Software Measurement: A Guidebook"
  https://www.sei.cmu.edu/library/goal-driven-software-measurement-a-guidebook/
  Use for: keeping measurements traceable to business goals. It supports measures only where useful; it does not require every Goal to be numeric. Indicators and measures are observation mechanisms, not automatically MinoDriven Means such as a system, model, or source code.

- Eiffel Software, "Design by Contract"
  https://www.eiffel.com/values/design-by-contract/
  Use for: controlling precondition, postcondition, and invariant terminology when supplied evidence expresses Goal conditions in contract form. Detailed contract or invariant design belongs elsewhere.

## Skill Packaging

Sources in this section govern packaging and evaluation only. They cannot alter MinoDriven's Purpose-Goal-Means semantics.

- OpenAI, `openai/skills`, Skill Creator
  https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.system/skill-creator/SKILL.md
  Use for: concise procedural `SKILL.md`, focused references, initialization, and structural validation. Do not attribute the local runtime's subagent forward-testing procedure to this public file.

- Agent Skills specification and best practices
  https://agentskills.io/specification
  https://agentskills.io/skill-creation/best-practices
  Use for: progressive disclosure, coherent Skill boundaries, source-grounded procedures, and output contracts.

- `obra/superpowers`, `brainstorming` Skill
  https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/brainstorming/SKILL.md
  Comparator only: it gathers purpose, constraints, and success criteria before implementation and uses an approval gate. Do not copy its universal trigger, mandatory design-document workflow, or implementation sequence into this narrower Skill.

## Mino-Inspired Implementation Comparator

- `my-take-dev/inspired-mino-design-skills`, commit `afd50e2ca18bb22e336a05df1c8481dbcd652b5c`
  https://github.com/my-take-dev/inspired-mino-design-skills/tree/afd50e2ca18bb22e336a05df1c8481dbcd652b5c
  - `mino-doc/01-purpose-goal-means.md` independently operationalizes Purpose, observable Goal, candidate Means, bidirectional concrete/abstract navigation, evidence states, and a stopping reason.
  - `mino-doc/19-skill-modularization-and-scaling.md` separates Core principles, task Functions, viewpoints, adapters, presentation, and Evaluation; it recommends one primary artifact per Function and runtime `SKILL.md` focused on outcome, routing, workflow, and consequential gates.
  - `README.md` distinguishes source-derived principles, suite operationalization, and repository policy; routes one requested artifact to one Function and multiple artifacts to an integration router; and keeps Skill-maintenance themes out of ordinary application work.
  - `.agents/skills/mino-problem-framing/SKILL.md` is a useful runtime-size comparator for candidate-Means handling, evidence-bounded framing, stopping before downstream design, and scoped handoff.
  - This repository is an unofficial derivative project, not a MinoDriven primary source. Its schemas, hard gates, `mino-core` dependency, release process, validators, and evaluation counts are repository choices and are not imported as MinoDriven claims.
  - At the pinned commit, runtime `SKILL.md` files are roughly 6-9 KB, while `mino-core` also contains a much larger validator/evaluation bundle and reports zero counted behavioral runs for version 0.9.0. Use the former as a concision and Function-boundary comparator; do not copy the latter into ordinary classification behavior.

## Source Policy

Do not use Qiita or Zenn directly or indirectly. A source entry proves only the claims stated above. Rules that go beyond them must be labeled local governance or inference in `source-to-rule-map.md`.
