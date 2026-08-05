# Source Ledger

No Qiita, Zenn, or quotation inherited from either is used. MinoDriven sources control the purpose-centered encapsulation intent; original complementary sources bound information hiding and contracts.

Source IDs are local to this Skill's references.

## MinoDriven Primary Sources

### M1. Encapsulation Mk-II

- URL: https://speakerdeck.com/minodriven/encapsulation2
- URL and title verified: 2026-07-16.
- Adopted: keep data with the logic strongly related to it; expose valid operations rather than arbitrary mutation; use purpose to select relevant data and rules; separate different purposes; treat one class or means as serving one purpose.
- Limit: the source does not define this Skill's evidence labels, output schema, compatibility record, alternatives, or completion. Embedded community-source material on slides 52-53 is excluded.

### M2. Ghosts of Technical Debt

- URL: https://speakerdeck.com/minodriven/ghosts-of-technical-debt
- URL, title, slide range, and adopted claims verified: 2026-07-16; relevant slides 14-17 and 24-28.
- Adopted: group data and strongly related logic, hide them behind correct operations, recognize giant classes as failed encapsulation boundaries, and avoid commonizing logic across different purposes.
- Limit: the source's broader refactoring and learning advice does not define this design-only workflow; its single-purpose interpretation is not the full original SRP definition.

### M3. Purpose and Abstraction Design

- URL: https://speakerdeck.com/minodriven/purpose-abstraction-design
- URL and title verified: 2026-07-16.
- Relevant slides: 28-38 and 50-55.
- Adopted: purpose determines problems and needed solution elements; purpose-specific models encapsulate data and decision or calculation logic needed to address those problems.
- Limit: domain discovery, terminology, context boundaries, and invariant discovery belong outside this Skill.

### M4. Interface Design and Branch Reduction

- URL: https://speakerdeck.com/minodriven/interface-design-idea
- URL and title verified: 2026-07-16.
- Adopted only as a boundary: interfaces represent alternative means for the same purpose and separate creation or selection from use.
- Limit: interface contracts, factories, DI, and branch relocation belong to neighboring Skills.

## Complementary Sources

### F1. D. L. Parnas, Module Decomposition

- URL: https://doi.org/10.1145/361598.361623
- Adopted: hide difficult or change-prone design decisions and reveal as little implementation knowledge as practical through module interfaces.
- Limit: does not supply purpose-specific state ownership or this workflow.

### F2. Eiffel, Design by Contract

- URL: https://www.eiffel.com/values/design-by-contract/
- Adopted: preconditions, postconditions, and invariants express legal public behavior.
- Limit: contract vocabulary does not discover domain truth or mandate a contract document or test suite.

### O1. OpenAI Skill Creator

- Local source: C:\Users\IH-000098\.codex\skills\.system\skill-creator\SKILL.md
- Adopted: precise triggers, concise workflow, progressive disclosure, and realistic evaluation.
- Limit: Skill packaging only.

## Unofficial Comparator

### C1. inspired-mino-design-skills

- URL: https://github.com/my-take-dev/inspired-mino-design-skills/blob/afd50e2ca18bb22e336a05df1c8481dbcd652b5c/mino-doc/10-purpose-centered-encapsulation.md
- Role: coverage and anti-overengineering comparator only.
- Limit: fixed YAML, mandatory scans, constructor or factory selection, tests, migration, caller conversion, old-API deletion, and implementation completion are local reconstruction and are not adopted here.

## Local Operational Decisions

- Require an evidenced purpose and known state or rule before this Skill triggers.
- Return responsibility and API design rather than tactical type selection or code changes.
- Record mutable-representation and bypass risks only when tied to supplied obligations or scenarios.
- Compare the proposed boundary with keeping the current boundary without requiring a pattern catalog.
