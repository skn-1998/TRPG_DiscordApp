# Source Ledger

No Qiita, Zenn, or quotation inherited from either is used. MinoDriven sources control purpose-driven naming; Evans and Fowler provide complementary interface and compatibility boundaries.

## MinoDriven Primary Sources

### M1. Business-Purpose System Design

- URL: https://speakerdeck.com/minodriven/buisiness-purpose-system-design
- Verified: 2026-07-16; relevant slides 53 and 57-65.
- Adopted: naming is a design activity beyond readability; names should express business purpose, be purpose-specific, concrete, and narrow; existence-based names can admit multiple purposes; current names can anchor structural judgment.
- Limit: this is the author's proposed method, not a controlled study. It does not define a Skill schema, objective score, or rename workflow.

### M2. Purpose and Abstraction Design

- URL: https://speakerdeck.com/minodriven/purpose-abstraction-design
- Verified: 2026-07-16; relevant slides 74-78.
- Adopted: classes and operations should communicate effect and purpose at their abstraction level; purpose-specific names distinguish contexts.
- Limit: the source assumes purpose and context evidence and does not resolve disputed terminology.

### M3. Effective Learning of Good Code

- URL: https://speakerdeck.com/minodriven/effective-learning-of-good-code
- Verified: 2026-07-16; relevant slides 16-17, 28, and 30.
- Adopted: purpose-driven naming is taught as a distinct foundational design topic and has been repeated across teams in the author's reported training practice.
- Limit: author-reported training evidence supports repeatability, not independent effectiveness or this Skill's contract.

### M4. Author Scope Note

- URL: https://note.com/minodriven/n/n08ca6d41f65b
- Adopted: purpose-driven naming focuses on class or method scope design and does not deeply own concrete word selection.
- Limit: therefore this Skill consumes terminology and does not establish canonical domain language.

## Official Publisher Sources

### P1. Revised Good Code/Bad Code Book Contents and Author Article

- URLs: https://gihyo.jp/dp/ebook/2024/978-4-297-14623-8 and https://gihyo.jp/book/pickup/2024/0021
- Adopted: the published method treats narrow purpose-specific names, business-purpose analysis, alternatives, concern separation, and anchoring resistance as repeatable activities.
- Limit: public publisher material establishes method shape, not an agent output schema or completion status.

## Complementary Sources

### D1. Eric Evans, Domain-Driven Design Reference

- URL: https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf
- Relevant section: Intention-Revealing Interfaces, p.26.
- Adopted: class and operation names should reveal effect and purpose without implementation mechanism and conform to Ubiquitous Language.
- Limit: applies within a model and Bounded Context and does not define a standalone naming workflow.

### F1. Martin Fowler, Is Changing Interfaces Refactoring?

- URL: https://martinfowler.com/bliki/IsChangingInterfacesRefactoring.html
- Adopted only as a boundary: applying a rename updates callers, and published interfaces are compatibility surfaces.
- Limit: implementation mechanics belong to downstream refactoring, not this naming decision.

### O1. OpenAI Skill Creator

- Local source: C:\Users\IH-000098\.codex\skills\.system\skill-creator\SKILL.md
- Adopted: clear trigger metadata, concise instructions, progressive disclosure, and realistic forward evaluation.
- Limit: Skill packaging only.

## Unofficial Comparator

### C1. inspired-mino-design-skills

- URL: https://github.com/my-take-dev/inspired-mino-design-skills/blob/afd50e2ca18bb22e336a05df1c8481dbcd652b5c/mino-doc/12-purpose-driven-naming.md
- Role: coverage and forward-evaluation comparator only.
- Limit: fixed YAML, required multiple candidates, conditional naming-smell checks, rename execution, and test or evaluation machinery are local reconstruction and are not adopted here.

## Local Operational Decisions

- Hide the current name during optional candidate generation to reduce anchoring.
- Use keep, rename-recommended, boundary-blocked, terminology-blocked, and insufficient-evidence as local decisions.
- Check only material usages and compatibility surfaces in the bounded target.
- Treat a supported blocker as a complete naming decision without performing the neighboring method.
