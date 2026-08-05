# Source Ledger

## Source Precedence

MinoDriven controls this hierarchy's primary design intent: purpose-centered boundaries, avoidance of universal models, changeability, invisible concepts, invariants, and destructive integrity questions. Evans, Fowler, and Eiffel refine formal DDD and contract vocabulary and mechanics without replacing that intent. Agent Skills and OpenAI sources govern Skill packaging and evaluation mechanics only. Local policies govern routing, contracts, and review; release admission and evaluation procedures remain outside runtime routing. Do not attribute local mechanisms to an external author.

No source supplies facts about the user's domain. Current-request evidence and authorized domain decisions control each actual analysis.

## Local Hierarchy Architecture Brief

### `LOCAL-HIERARCHY-BRIEF`

Hierarchy-owner requirements consolidated for this Skill initiative on 2026-07-15.

Normative use:

- a parent routes and orders work but does not perform a child method
- a focused child remains directly invocable and reconstructs Actor, Purpose, Context, Constraints, and Evidence
- broad requests compose children; narrow requests use the smallest child
- every routed Step has explicit input, output, and completion conditions
- unavailable or unsupported capabilities are visible and are not simulated
- a Step becomes complete only from the recipient's output reference and explicit completion declaration; recipient-declared blockers remain visible for successor readiness
- consequential use remains advisory unless supplied governance or the request identifies a required review or decision authority

Limits:

- This is local governance supplied by the hierarchy owner, not a claim made by MinoDriven, Evans, Fowler, Eiffel, Agent Skills, or OpenAI.
- It does not create a reviewer, approval step, gate, or decision authority for a concrete request.

## Formal Domain Design Sources

- Eric Evans, "Domain-Driven Design Reference"
  https://www.domainlanguage.com/ddd/reference/
  Accessed: 2026-07-14.
  Use for: model-driven design, ubiquitous language, bounded context, entities, value objects, aggregates, and DDD terminology.

- Martin Fowler, "Bounded Context"
  https://martinfowler.com/bliki/BoundedContext.html
  Accessed: 2026-07-14.
  Use for: multiple models, explicit context boundaries, and context-specific meaning.

- Martin Fowler, "Domain Driven Design"
  https://martinfowler.com/bliki/DomainDrivenDesign.html
  Accessed: 2026-07-14.
  Use for: domain model and ubiquitous language as the shared vocabulary of software and domain experts.

- Eiffel Software, "Design by Contract"
  https://www.eiffel.com/values/design-by-contract/
  Accessed: 2026-07-14.
  Use for: preconditions, postconditions, and invariants when domain validity becomes an explicit contract.

## MinoDriven Design Intent

- "AI時代のドメイン駆動設計-DDD実践におけるAI活用のあり方"
  https://speakerdeck.com/minodriven/ddd-in-ai-era
  Use for: controlling AI-generated domain code through strategic and tactical DDD and domain-layer modeling.

- "風刺動画『一枚岩モデル』で考える、DDDの境界付けられたコンテキスト"
  https://speakerdeck.com/minodriven/huge-model-vs-bc
  Use for: avoiding one model that mixes meanings across contexts.

- "見えないものに着目すると上手くいく、モデリングの勘所"
  https://speakerdeck.com/minodriven/invisible-driven-design
  Use for: modeling by purpose instead of visible physical units; surfacing purpose, problems, ownership, rights, responsibilities, and other non-physical concepts. `invisible-driven-modeling` is this hierarchy's normalized Skill name, not a standard DDD term.

- "破壊せよ！データ破壊駆動で考えるドメインモデリング"
  https://speakerdeck.com/minodriven/data-destroy-driven
  Use for: attempting to create invalid or contradictory data to discover integrity constraints, then placing validation with the model that owns the data. `data-destruction-analysis` is this hierarchy's normalized Skill name.

- `SRC-MINO-PURPOSE-ARCH`: "目的で駆動する、AI時代のアーキテクチャ設計"
  https://speakerdeck.com/minodriven/purpose-driven-architecture
  Use for: purpose as a boundary and selection criterion.

## Skill Architecture

- Agent Skills specification and best practices
  https://agentskills.io/specification
  https://agentskills.io/skill-creation/best-practices
  Use for: coherent child units, direct triggering, progressive disclosure, and explicit workflows.

- `SRC-OPENAI-SKILL-CREATOR`: OpenAI, `skills/.system/skill-creator/SKILL.md`, pinned revision `49f948faa9258a0c61caceaf225e179651397431`
  https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.system/skill-creator/SKILL.md
  Accessed: 2026-07-14.
  Use for: initialization, concise frontmatter, progressive disclosure, structural validation, and iteration on real tasks. Evaluation procedures and results are not runtime Skill content.

## Source Policy

Do not use Qiita or Zenn. Some MinoDriven decks cite outside articles; do not use any Qiita/Zenn quotation or link as inherited evidence. Formal DDD and contract terminology is controlled by the original/official sources above.
