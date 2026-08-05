# Source Ledger

No prohibited community source is used. MinoDriven presentations provide the primary design intent; formal DDD sources bound interpretation.

## MinoDriven Primary Sources

### M1. Invisible-Driven Design

- URL: https://speakerdeck.com/minodriven/invisible-driven-design
- Verified: 2026-07-16; relevant slides 12-35 and 47-51.
- Adopted: physical-object units attract unrelated attributes and rules; models can be small systems for achieving purposes; actors, use cases, expert discussion, abnormal cases, events, and relationships can reveal invisible concepts; one physical product can mean ownership, cargo, or inventory asset under different purposes.
- Limit: the signals are discovery heuristics, not an exhaustive checklist or deterministic split algorithm.

### M2. Purpose and Abstraction Design

- URL: https://speakerdeck.com/minodriven/purpose-abstraction-design
- Verified: 2026-07-16; relevant slides 28-38, 50-55, 60-68, and 82-84.
- Adopted: purpose determines problems and required solution elements; a domain model needs the information and behavior needed for its purpose; universal models obscure purpose-specific meaning, behavior, and invariants; similar-looking logic should not be unified across different purposes.
- Limit: purpose differences do not automatically require separate classes, contexts, services, or deployments.

### M3. Encapsulation 2

- URL: https://speakerdeck.com/minodriven/encapsulation2
- Verified: 2026-07-16; relevant slides 40-42 and 60-62.
- Adopted: a class serving multiple purposes mixes unrelated data and rules; purpose-specific classes can improve encapsulation.
- Limit: only the author's own relevant slides are used. The deck does not make class extraction part of this analysis Skill.

## Supporting And Formal Sources

### S1. Levtech LAB Interview with MinoDriven

- URL: https://levtech.jp/media/article/interview/detail_369/
- Accessed: 2026-07-16.
- Adopted: buyer, delivery, and inventory actors can interpret one Product differently and force unrelated logic into a universal model.
- Limit: supporting interview evidence, not a formal method specification.

### D1. Eric Evans, Domain-Driven Design Reference

- URL: https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf
- Accessed: 2026-07-16.
- Adopted: a model selects domain aspects for a purpose; Bounded Context governs model applicability; Entity, Value Object, Domain Event, and Service have distinct meanings.
- Limit: Evans does not define invisible-driven modeling, and this Skill does not perform tactical classification.

### O1. OpenAI Skill Creator

- URL: https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.system/skill-creator/SKILL.md
- Accessed: 2026-07-16.
- Adopted: precise direct trigger, concise workflow, progressive disclosure, and realistic forward evaluation.
- Limit: Skill packaging only.

## Unofficial Comparator

### C1. inspired-mino-design-skills

- URL: https://github.com/my-take-dev/inspired-mino-design-skills/blob/afd50e2ca18bb22e336a05df1c8481dbcd652b5c/mino-doc/07-invisible-driven-modeling.md
- Role: coverage and operationalization comparator only.
- Limit: candidate states, mandatory split comparisons, exhaustive element maps, output schemas, and completion gates are its reconstruction, not MinoDriven claims.

## Local Operational Decisions

- Return candidates rather than approved domain models.
- Use `supported-candidate`, `hypothesis`, and `no-supported-candidate` as local evidence-reporting states, not MinoDriven terminology or approval states.
- Make keep-together versus separate analysis proportionate and non-authoritative.
- Permit a complete report to find no supported hidden concept.
- Keep boundary selection, invariant design, tactical classification, code design, and refactoring outside this Skill.
