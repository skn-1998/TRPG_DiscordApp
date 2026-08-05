# Source Ledger

No Qiita or Zenn source is used. MinoDriven sources control the purpose-centered interpretation; formal DDD sources provide established terminology.

## MinoDriven Primary Sources

### M1. Purpose and Abstraction Design

- URL: https://speakerdeck.com/minodriven/purpose-abstraction-design
- Adopted: Ubiquitous Language is valid within a context and communicates purpose; the same expression can carry different meanings under different purposes; purpose-specific terms expose distinctions hidden by a generic physical noun.
- Limit: examples do not determine the correct term or context in a new domain.

### M2. Doubting Premises

- URL: https://speakerdeck.com/minodriven/doubt-premise
- Verified: 2026-07-16; relevant slides 34 and 39-48.
- Adopted: meaning depends on use and context; check actor, purpose, context, and rules to avoid projecting one's own assumptions; concrete examples can test an interpretation.
- Limit: these are minimum interpretation checks, not a mandatory schema for every term.

### M3. Reading Good Code/Bad Code More Deeply

- URL: https://speakerdeck.com/minodriven/deepen-good-code-bad-code
- Verified: 2026-07-16; relevant slides 44-57.
- Adopted: a universal model obscures purpose-specific meaning, behavior, and invariants; purpose-specific model names can reveal contextual distinctions.
- Limit: a terminology difference does not by itself prove a new Bounded Context or code type.

### M4. Context Verbalization

- URL: https://speakerdeck.com/minodriven/ai-context-verbalization
- Adopted: unclear purpose permits multiple interpretations, including by AI; explicit purpose changes interpretation.
- Limit: this corroborates anti-assumption discipline and is not a complete Ubiquitous Language method.

## Formal And Complementary Sources

### D1. Eric Evans, Domain-Driven Design Reference

- URL: https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf
- Adopted: Ubiquitous Language is structured around the domain model, shared within a Bounded Context, and used in speech, writing, diagrams, and code; language and model evolve together.
- Limit: the source supplies no domain-specific terms or approval authority.

### D2. Martin Fowler, Bounded Context

- URL: https://martinfowler.com/bliki/BoundedContext.html
- Adopted: large systems legitimately use different models for terms such as Customer or Product; global unification is often inappropriate, and mappings matter where contexts interact.
- Limit: this Skill records boundary evidence but does not discover or select context boundaries.

### O1. OpenAI Skill Creator

- URL: https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.system/skill-creator/SKILL.md
- Adopted: precise trigger metadata, concise workflow, progressive disclosure, and realistic forward evaluation.
- Limit: Skill packaging only, not domain-language authority.

## Unofficial Comparator

### C1. inspired-mino-design-skills

- URL: https://github.com/my-take-dev/inspired-mino-design-skills/blob/afd50e2ca18bb22e336a05df1c8481dbcd652b5c/mino-doc/06-ubiquitous-language-and-context.md
- Role: coverage and anti-overengineering comparator only.
- Limit: it is not a MinoDriven publication. Its ledgers, states, schemas, reference integrity, and rename procedure are local reconstruction and are not attributed to MinoDriven.

## Local Operational Decisions

- Analyze only terms material to the requested decision; do not create an exhaustive glossary.
- Use evidence-status labels without treating them as approval states.
- Treat language differences as inputs to boundary discovery rather than deciding a boundary here.
- Keep code renaming and implementation outside this Skill.
