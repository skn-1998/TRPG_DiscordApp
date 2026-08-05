# Source Ledger

No Qiita, Zenn, or quotation inherited from either is used. MinoDriven sources control purpose-based abstraction; original complementary sources bound information hiding, semantic contracts, and refactoring.

## MinoDriven Primary Sources

### M1. Purpose and Abstraction Design

- URL: https://speakerdeck.com/minodriven/purpose-abstraction-design
- Verified: 2026-07-16; relevant slides 28-48, 50-55, 60-68, and 81-84.
- Adopted: models and interfaces are purpose-achieving means; purpose determines relevant problems and characteristics; distinguish problem-domain from solution-domain abstraction; similar-looking logic serving different purposes should remain separate.
- Limit: the deck presents a general abstraction definition before operationalizing it for software design. This ledger does not independently attribute that definition to a person. The deck does not define this Skill, consumer record, decision actions, mandatory tests, or minimum case count.

### M2. Interface Design and Branch Reduction

- URL: https://speakerdeck.com/minodriven/interface-design-idea
- Verified: 2026-07-16; relevant slides 26, 40-43, and 54-57.
- Adopted: same-purpose implementations can share a purpose-based interface; creation or selection can be separate from use.
- Limit: branch mechanics belong to `interface-branch-reduction`, and not every conditional warrants an interface.

### M3. Encapsulation Mk-II

- URL: https://speakerdeck.com/minodriven/encapsulation2
- Verified: 2026-07-16; relevant slides 7, 32-34, 40-42, and 60-61.
- Adopted only as a boundary: group state and rules by purpose and prevent arbitrary mutation.
- Limit: ownership and invariant protection do not decide whether variants share one abstraction. Embedded prohibited community material is excluded.

### M4. AI Refactoring Approach

- URL: https://speakerdeck.com/minodriven/ai-refactoring-approach
- Verified: 2026-07-16; relevant slide 43.
- Adopted: commonize only code serving the same purpose.
- Limit: copy/delete, extraction, tests, and transformation are downstream refactoring guidance, not this design decision.

## Complementary Sources

### F1. D. L. Parnas, Module Decomposition

- URL: https://doi.org/10.1145/361598.361623
- Adopted: hide changeable design decisions behind module interfaces to improve comprehensibility and flexibility.
- Limit: does not supply the purpose taxonomy or concrete semantic comparison.

### F2. Eiffel, Design by Contract

- URL: https://www.eiffel.com/values/design-by-contract/
- Adopted: obligations, guarantees, and invariants distinguish semantic contracts from method shape.
- Limit: does not require a contract document or test suite for every analysis.

### F3. Martin Fowler, Definition of Refactoring

- URL: https://martinfowler.com/bliki/DefinitionOfRefactoring.html
- Adopted only as a boundary: refactoring changes internal structure while preserving observable behavior.
- Limit: design selection here precedes and does not perform transformation.

### O1. OpenAI Skill Creator

- Local source: C:\Users\IH-000098\.codex\skills\.system\skill-creator\SKILL.md
- Adopted: clear trigger metadata, progressive disclosure, and realistic forward evaluation.
- Limit: Skill packaging only.

## Unofficial Comparator

### C1. inspired-mino-design-skills

- URL: https://github.com/my-take-dev/inspired-mino-design-skills/blob/afd50e2ca18bb22e336a05df1c8481dbcd652b5c/mino-doc/13-purpose-driven-abstraction.md
- Role: coverage and anti-overengineering comparator only.
- Limit: fixed YAML, contract matrices, interface creation, migration, rollback, and mandatory contract tests are local reconstruction and are not required here.

## Local Operational Decisions

- Make the consumer explicit and compare purpose before shape.
- Compare semantic obligations across included cases.
- Use introduce, retain, narrow, remove, avoid, and insufficient-evidence as local decision actions.
- Require realistic change evidence before claiming a hidden implementation decision.
- Keep branch placement, pattern choice, implementation, and tests outside this Skill.
