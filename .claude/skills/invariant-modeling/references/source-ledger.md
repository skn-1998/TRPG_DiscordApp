# Source Ledger

No Qiita, Zenn, or quotation inherited from either is used. MinoDriven sources establish the purpose-centered constraint intent; Evans and Eiffel supply formal invariant semantics.

## MinoDriven Primary Sources

### M1. Purpose-Driven Architecture

- URL: https://speakerdeck.com/minodriven/purpose-driven-architecture
- Adopted: constraints are concrete conditions for a goal; separating values from validation permits omissions, duplication, and scattered change; preconditions, postconditions, and invariants are distinct contract conditions and useful verification targets.
- Limit: the presentation does not define a formal extraction algorithm, exhaustive schema, or universal owner rule.

### M2. Data Destroy Driven

- URL: https://speakerdeck.com/minodriven/data-destroy-driven
- Adopted: attempts to create corrupted, contradictory, or harmful states can expose integrity constraints; models should encapsulate their constraints from construction onward; invalid boundaries are useful verification evidence.
- Limit: destructive discovery is a separate method and is not performed by this Skill.

### M3. Purpose and Abstraction Design

- URL: https://speakerdeck.com/minodriven/purpose-abstraction-design
- Adopted: domain models combine data with domain decisions and calculations; different purposes may require different meanings and invariants, making a universal model ambiguous.
- Limit: this does not prove that every purpose needs a separate model or Aggregate.

### M4. AI Refactoring Approach

- URL: https://speakerdeck.com/minodriven/ai-refactoring-approach
- Adopted: tests can cover preconditions, postconditions, and invariants.
- Limit: this Skill defines an observable oracle but does not create tests or execute refactoring. The deck attributes its constraints-versus-data-only-container statement to an external speaker; that quotation is not treated here as MinoDriven primary evidence. M2 independently supports constraint encapsulation.

## Formal Sources

### D1. Eric Evans, Domain-Driven Design Reference

- URL: https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf
- Adopted: Aggregate-wide invariants are protected through the root or a designated mechanism; Assertions can state postconditions and invariants and be tested when not directly encoded.
- Limit: Aggregate guidance does not make every invariant aggregate-wide or establish a complete transaction-boundary algorithm.

### D2. Eiffel, Design by Contract Assertions and Exceptions

- URL: https://www.eiffel.org/doc/eiffel/ET-_Design_by_Contract_%28tm%29%2C_Assertions_and_Exceptions
- Adopted: a class invariant is established by creation and preserved by exported operations; invariant semantics concern stable observation points.
- Limit: formal vocabulary is complementary and is not attributed to MinoDriven.

### O1. OpenAI Skill Creator

- URL: https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.system/skill-creator/SKILL.md
- Adopted: narrow trigger, concise workflow, progressive disclosure, and realistic evaluation.
- Limit: Skill packaging only.

## Unofficial Comparator

### C1. inspired-mino-design-skills

- URL: https://github.com/my-take-dev/inspired-mino-design-skills/blob/afd50e2ca18bb22e336a05df1c8481dbcd652b5c/mino-doc/08-invariant-first-domain-modeling.md
- Role: coverage and operationalization comparator only.
- Limit: fixed schemas, evidence states, owner fields, verification matrices, and completion gates are local reconstruction, not MinoDriven claims. The repository's separate model-completeness method is not absorbed here.

## Local Operational Decisions

- Require a falsifier and business impact for each reported invariant so the statement is testable and purpose-linked.
- Use protection-locus candidates rather than inventing a unique model or organizational owner.
- Record an observable oracle without requiring test creation.
- Exclude model-completeness audits, full contracts, transaction architecture, implementation, and migration.
