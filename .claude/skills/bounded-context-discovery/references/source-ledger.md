# Source Ledger

## Source Precedence

1. Current-request domain evidence and authorized decisions control the actual boundary analysis.
2. MinoDriven controls this Skill's primary design intent.
3. Eric Evans's DDD Reference controls formal DDD vocabulary and strategic-design mechanics.
4. Official Agent Skills and OpenAI Skill Creator sources control Skill packaging and evaluation mechanics.
5. Local architecture policies may refine ownership, contracts, and review; they are not external DDD theory. Release admission and evaluation procedures remain outside the runtime method.

No source below supplies facts about the user's domain. Never use a general example as project evidence.

## Local Hierarchy Architecture Brief

### `LOCAL-HIERARCHY-BRIEF`

Hierarchy-owner requirements consolidated for this Skill initiative on 2026-07-15.

Normative use:

- a parent routes and orders work but does not perform a child method
- a focused child remains directly invocable and reconstructs Actor, Purpose, Context, Constraints, and Evidence
- broad requests compose children; narrow requests use the smallest child
- every Skill exposes input, output, completion, exclusions, and handoff behavior
- unavailable or unsupported capabilities are visible and are not simulated
- analysis completion, downstream readiness, review, authority, persistence, and implementation remain distinct

Limits:

- This is local governance supplied by the hierarchy owner, not an external design claim.
- It supplies no facts, roles, or authority assignments for a concrete domain request.

## MinoDriven Design Intent

### `SRC-MINO-BC-2022`

MinoDriven, "風刺動画『一枚岩モデル』で考える、DDDの境界付けられたコンテキスト", 2022-11-09.

https://speakerdeck.com/minodriven/huge-model-vs-bc

Accessed: 2026-07-14.

Normative use:

- Slides 16-20: a universal model becomes inconsistent when invariants and meanings differ; use purpose-specific models.
- Slides 21 and 28: define the applicability range of each purpose-specific model as a Bounded Context and relate it to a system boundary; slides 26-28 warn against merging by same name or similar logic when intent/purpose differs.
- Slides 30-32: inspect closed process cycles, large-grained purposes, strongly related concepts, and invariants as boundary-design perspectives.
- Slide 33: use multiple scales and keep model purpose central.

Limits:

- The deck does not define this Skill's candidate-state enum, minimum candidate test, gate matrix, or admission workflow.
- Its mention of EventStorming and RDRA supports their possible usefulness, not mandatory use or any procedure in this Skill.

### `SRC-MINO-PURPOSE-ARCH`

MinoDriven, "目的で駆動する、AI時代のアーキテクチャ設計", 2025-11-18.

https://speakerdeck.com/minodriven/purpose-driven-architecture

Accessed: 2026-07-14.

Normative use:

- Slides 40-45: separating structures by purpose reduces change impact; purpose and changeability are connected.
- Slides 46-47: purpose-based structuring restates DDD intent, and a Bounded Context can be understood as a large-grained purpose.
- Slides 24-26 define Purpose, Goal, and Means; slide 49 relates preconditions, postconditions, and invariants to Goal conditions.

Limits:

- The deck's purpose framing does not authorize inventing a stakeholder Purpose.
- It does not imply that every purpose becomes a separate service, repository, schema, or deployment.

### `SRC-MINO-DDD-AI-2025`

MinoDriven, "AI時代のドメイン駆動設計-DDD実践におけるAI活用のあり方", 2025-08-18.

https://speakerdeck.com/minodriven/ddd-in-ai-era

Accessed: 2026-07-14.

Normative use:

- Slides 11-18: DDD is a strategy and set of tactics for sustained business growth and strategic allocation of limited development resources.
- Slides 24-29: AI may support strategic exploration but should not replace high-uncertainty competitive judgment; AI-generated work needs explicit design-quality control.

Limits:

- This source supports the narrower rule that AI should assist rather than replace high-uncertainty competitive judgment and that AI work needs design-quality control. It does not define evidence statuses, decision rights, role separation, or Bounded Context discovery mechanics.

## Formal DDD Source

### `SRC-EVANS-DDD-REFERENCE`

Eric Evans, "Domain-Driven Design Reference", March 2015.

Landing page: https://www.domainlanguage.com/ddd/reference/

PDF: https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf

Accessed: 2026-07-14.

Normative use:

- Printed p.2 (physical PDF page 9): a Bounded Context delimits where one model is defined and applicable, and may be made explicit in team organization, application use, codebases, and database schemas.
- Printed pp.2-4 (physical PDF pages 9-11): keep model/language consistency inside the boundary and use continuous integration to preserve it.
- Printed p.29 (physical PDF page 36): identify models already in play, describe contacts, translations, sharing, isolation, and influence, and map existing terrain before transformations.

Limits:

- The requirement that physical and organizational manifestations not act as sole purpose evidence is a local conservative rule combining Evans's manifestations with MinoDriven's purpose-first intent.
- Routing detailed language work and Context Map relationship selection to other workflows is local hierarchy ownership, not an Evans claim.
- The contents place Bounded Context in Part I, Context Mapping in Part IV, and Distillation including Core/Generic Subdomains in Part V. Their separation supports treating them as distinct patterns; the hierarchy's non-equivalence rule and ownership split remain local governance, and this Skill defines no universal mapping between them.

## Skill Packaging And Evaluation

### `SRC-AGENT-SKILLS-SPEC`

Agent Skills, "Specification", accessed 2026-07-14.

https://agentskills.io/specification

Use for: valid Skill structure, triggering metadata, focused references, progressive disclosure, and validation.

### `SRC-AGENT-SKILLS-BEST-PRACTICES`

Agent Skills, "Best practices for skill creators", accessed 2026-07-14.

https://agentskills.io/skill-creation/best-practices

Use for: grounding Skills in real expertise, coherent units, concise procedures, output templates, and validation loops.

### `SRC-AGENT-SKILLS-EVAL`

Agent Skills, "Evaluating skill output quality", accessed 2026-07-14.

https://agentskills.io/skill-creation/evaluating-skills

Use for evaluation artifacts outside the Skill bundle: realistic varied prompts, outcome assertions, structured grading, and iteration.

### `SRC-OPENAI-SKILL-CREATOR`

OpenAI, `skills/.system/skill-creator/SKILL.md`, pinned revision `49f948faa9258a0c61caceaf225e179651397431`.

https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.system/skill-creator/SKILL.md

Accessed: 2026-07-14.

Use for: initialization, concise frontmatter, progressive disclosure, structural validation, and iteration on real tasks. Evaluation procedures and results are not runtime Skill content.

## Source Policy

Qiita and Zenn are excluded. Do not inherit an excluded source through another deck's bibliography. Record any inference as local governance or current-analysis inference, never as a source quotation.
