# Source Ledger

Use primary and official sources first. The hierarchy is a local implementation guided by the user's target taxonomy; no external source alone mandates these exact Skill names.

## Architecture Intent

- MinoDriven, "MCPサーバー『モディフィウス』で変更容易性の向上をスケールする"
  https://speakerdeck.com/minodriven/modifius
  Use for: selecting several prompts by situation; a core prompt supporting feature, design, framework, and language modules; modular extension of design knowledge. Exclude its linked Qiita event page and any Qiita-derived content.

- MinoDriven, "目的で駆動する、AI時代のアーキテクチャ設計"
  https://speakerdeck.com/minodriven/purpose-driven-architecture
  Use for: purpose-goal-means, purpose-centered boundaries, and modifiability.

- MinoDriven, "AI時代に必須！状況言語化スキル"
  https://speakerdeck.com/minodriven/ai-context-verbalization
  Use for: explicit purpose and context in AI-assisted work.

- MinoDriven, "AI駆動開発を妨げる技術的負債の解消アプローチ"
  https://speakerdeck.com/minodriven/ai-refactoring-approach
  Use for: routing refactoring work through purpose analysis, behavior contracts, and verification.

- MinoDriven, "AI時代のドメイン駆動設計-DDD実践におけるAI活用のあり方"
  https://speakerdeck.com/minodriven/ddd-in-ai-era
  Use for: separating domain-design work from generic code generation.

- X post by @my_take_dev
  https://x.com/my_take_dev/status/2075566040554328393
  Use only for taxonomy inspiration. It is not authority for the underlying methods.

## Skill Specifications And Official Implementations

- OpenAI, `openai/skills`, Skill Creator
  https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.system/skill-creator/SKILL.md
  Use for: modular Skill folders, progressive disclosure, references, initialization, and structural validation.

- OpenAI, `figma-generate-design` Skill
  https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/figma-generate-design/SKILL.md
  Use as an implementation example of one Skill reusing another Skill's workflow and references. It is illustrative, not a universal rule.

- Agent Skills specification
  https://agentskills.io/specification
  Use for: directory format, metadata, progressive disclosure, one-level references, and validation.

- Agent Skills, "Best practices for skill creators"
  https://agentskills.io/skill-creation/best-practices
  Use for: coherent composable units, real-execution refinement, moderate detail, and validation loops.

- Anthropic, Agent Skills overview and API guide
  https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
  https://platform.claude.com/docs/en/build-with-claude/skills-guide
  Use for: on-demand loading and composition of multiple Skills.

## Public GitHub Comparators

- `my-take-dev/inspired-mino-design-skills`, commit `afd50e2ca18bb22e336a05df1c8481dbcd652b5c`
  https://github.com/my-take-dev/inspired-mino-design-skills/tree/afd50e2ca18bb22e336a05df1c8481dbcd652b5c
  Use for: comparing a MinoDriven-inspired taxonomy, logical Core/Domain/Application/Organization grouping, and parent coordination of narrower Functions. It is an unofficial derivative, not evidence for the underlying design methods. Adopt coherent child boundaries and composability; do not copy mandatory Core traversal, exhaustive schemas, admission gates, release machinery, or other repository-specific governance.

- `obra/superpowers`
  https://github.com/obra/superpowers/tree/d884ae04edebef577e82ff7c4e143debd0bbec99
  Use as a public implementation example of composable process Skills, ordered execution, fresh-task review, and a final review. Do not treat its emphatic invocation policy as normative for this hierarchy.

- Anthropic, `anthropics/skills`
  https://github.com/anthropics/skills/tree/9d2f1ae187231d8199c64b5b762e1bdf2244733d
  Use as an official implementation example of focused Skill folders and progressive disclosure.

## Supporting Design Sources

- Eiffel Software, Design by Contract
  https://www.eiffel.com/values/design-by-contract/
  Use only as support for explicit software-component obligations and contract terminology. It does not define this hierarchy's Step input, output, completion, or re-entry schema; those are local workflow choices.

- ISO/IEC 25010:2023 product quality model
  https://www.iso.org/standard/78176.html

- Eric Evans, Domain-Driven Design Reference
  https://www.domainlanguage.com/ddd/reference/

- Martin Fowler, Refactoring
  https://refactoring.com/

- D. L. Parnas, "On the Criteria To Be Used in Decomposing Systems into Modules"
  https://doi.org/10.1145/361598.361623

- Etienne and Beverly Wenger-Trayner, "Introduction to communities of practice"
  https://www.wenger-trayner.com/introduction-to-communities-of-practice/

## Execution Context And Agent Loops

Sources for `loop-ledger-design` and for `RDW-EXECUTION-CONTEXT`. They establish why delegated work needs a persistent execution context and what a delegated task description must carry. None of them defines this hierarchy's ledger sections, placement, or cross-cutting status; those remain local governance.

- Anthropic, "Effective context engineering for AI agents", published 2025-09-29
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
  Use for: structured note-taking as memory persisting outside the context window, compaction and its fidelity limits, sub-agent context isolation returning distilled summaries, just-in-time retrieval through lightweight identifiers, and long-horizon task patterns.

- Anthropic, "Building effective agents"
  https://www.anthropic.com/engineering/building-effective-agents
  Use for: the workflow versus agent distinction, human checkpoints and explicit stopping conditions, environmental feedback as ground truth, agent-computer interface clarity, and the caution against adding complexity before a simpler solution has failed.

- Anthropic, "Best practices for Claude Code"
  https://code.claude.com/docs/en/best-practices
  Use for: giving the agent a check it can run and requiring evidence over asserted success, the deterministic-hook versus advisory-instruction contrast, pruning an over-specified instruction file, scoping investigation, and adversarial review together with its over-engineering caveat. The former `www.anthropic.com/engineering/claude-code-best-practices` URL redirects here.

- Anthropic, "How we built our multi-agent research system"
  https://www.anthropic.com/engineering/multi-agent-research-system
  Use for: the elements a subagent task description must carry (objective, output format, tool and source guidance, clear task boundaries), scaling effort to request complexity, observed coordination failures such as duplicated work and gaps, the limited parallelism of coding work, and resuming stateful agents from external memory.

## Source Policy

Do not use Qiita or Zenn. Do not inherit evidence from them through quotations or links inside an otherwise accepted source. Record unsupported architecture choices as local governance.

GitHub snapshots above were resolved and checked on 2026-07-12 or, for `inspired-mino-design-skills`, pinned and assessed on 2026-07-15. Re-check source claims before adopting behavior from a later revision.

Sources under "Execution Context And Agent Loops" were resolved and checked on 2026-08-09.
