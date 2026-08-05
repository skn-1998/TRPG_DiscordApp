# Source Ledger

Use this ledger to ground `design-core`. Prefer primary or official sources. Treat MinoDriven material as the primary source for the purpose-centered design intent and established specifications or original works as controlling sources for formal terminology.

## Purpose-Centered Design Sources

- MinoDriven, "目的で駆動する、AI時代のアーキテクチャ設計"
  https://speakerdeck.com/minodriven/purpose-driven-architecture
  Use for: purpose-goal-means framing, purpose-driven boundaries, and modifiability as a design concern.

- MinoDriven, "AI時代に必須！状況言語化スキル"
  https://speakerdeck.com/minodriven/ai-context-verbalization
  Use for: purpose and context verbalization as conditions for reliable AI-assisted work.

- MinoDriven, "ソフトウェア品質特性、意識してますか？AIの真の力を引き出す活用事例"
  https://speakerdeck.com/minodriven/ai-and-software-quality
  Use for: selecting quality characteristics before asking AI to design or implement.

- MinoDriven, "MCPサーバー『モディフィウス』で変更容易性の向上をスケールする"
  https://speakerdeck.com/minodriven/modifius
  Use for: a core prompt combined with feature, design, framework, and language modules; selecting multiple prompts by situation; scaling design knowledge. Do not use the linked Qiita event page or any Qiita-derived slide content as evidence.

- MinoDriven, "AI時代のドメイン駆動設計-DDD実践におけるAI活用のあり方"
  https://speakerdeck.com/minodriven/ddd-in-ai-era
  Use for: handing domain-specific work to a dedicated domain-design workflow.

## Formal And Supporting Design Sources

- Eiffel Software, "Design by Contract"
  https://www.eiffel.com/values/design-by-contract/
  Use for: preconditions, postconditions, invariants, and explicit obligations. This controls Design by Contract terminology.

- ISO/IEC 25010:2023, product quality model
  https://www.iso.org/standard/78176.html
  Use for: software product quality characteristics and quality evaluation. This controls the quality taxonomy.

- IREB, CPRE Online Glossary and Foundation Level Handbook
  https://cpre.ireb.org/en/downloads-and-resources/glossary
  https://cpre.ireb.org/en/downloads-and-resources/downloads#cpre-foundation-level-handbook
  Use for: context and system context, system boundary, context boundary, scope, stakeholder roles, terminology, shared understanding, assumptions, conflicts, and validation. These sources refine the context child mechanics without replacing MinoDriven's primary intent.

- Eric Evans, "Domain-Driven Design Reference"
  https://www.domainlanguage.com/ddd/reference/
  Use for: domain model, bounded context, ubiquitous language, and strategic/tactical DDD terminology.

- Martin Fowler, "Bounded Context"
  https://martinfowler.com/bliki/BoundedContext.html
  Use for: context-specific model boundaries.

## Skill Architecture Sources

- `my-take-dev/inspired-mino-design-skills`, commit `afd50e2ca18bb22e336a05df1c8481dbcd652b5c`
  https://github.com/my-take-dev/inspired-mino-design-skills/tree/afd50e2ca18bb22e336a05df1c8481dbcd652b5c
  Use for: comparing the logical Core grouping and narrower purpose, quality, and context Functions. It is an unofficial derivative and does not control the design methods. Preserve directly callable children and a routing-only parent; do not adopt mandatory Core traversal, exhaustive output schemas, admission gates, or release machinery.

- OpenAI, `openai/skills`, Skill Creator
  https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.system/skill-creator/SKILL.md
  Use for: modular Skill folders, concise `SKILL.md`, progressive disclosure, references, initialization, and structural validation.

- Agent Skills specification
  https://agentskills.io/specification
  Use for: Skill structure, metadata, on-demand resources, one-level references, and validation.

- Agent Skills, "Best practices for skill creators"
  https://agentskills.io/skill-creation/best-practices
  Use for: coherent units that compose, real-execution refinement, moderate detail, and explicit validation loops.

- Anthropic, Agent Skills overview and API composition
  https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
  https://platform.claude.com/docs/en/build-with-claude/skills-guide
  Use for: on-demand loading and composition of multiple Skills for complex work.

## Source Policy

Do not use Qiita or Zenn as evidence. If an accepted source quotes or links either site, exclude that quoted or linked material. Mark unsupported rules as local governance or inference in `source-to-rule-map.md`; do not present them as externally established theory.

Source audit updated: 2026-07-14.
