# Source Ledger

No Qiita, Zenn, or quotation inherited from either is used. MinoDriven sources control the purpose-based interface intent; complementary sources bound information hiding, semantic contracts, and scenario-based modifiability.

## MinoDriven Primary Sources

### M1. Interface Design and Branch Reduction

- URL: https://speakerdeck.com/minodriven/interface-design-idea
- Adopted: interfaces abstract implementations that serve the same purpose; separate creation or selection from use; callers should not know the chosen implementation; a factory or dependency injection can be an implementation option.
- Limit: the source explicitly does not require every conditional to become an interface. It does not define this Skill's taxonomy, evidence threshold, output schema, or implementation gate.

### M2. Switch Statement Explanation

- URL: https://speakerdeck.com/minodriven/kusokododong-hua-switchwen-jie-shuo
- URL and title verified: 2026-07-16.
- Adopted: duplicated variant switches spread change; one selection point plus purpose-level implementations can localize a variant change; Strategy and State address different concerns in the example.
- Limit: one example does not make Strategy, State, or polymorphism the answer to every branch.

### M3. Purpose and Abstraction Design

- URL: https://speakerdeck.com/minodriven/purpose-abstraction-design
- Relevant slides: 37-48.
- Adopted: abstraction selects characteristics relevant to purpose; solution-domain interfaces can represent alternative means for one purpose.
- Limit: this supports the accepted upstream abstraction, not branch mechanics or contract discovery here.

## Complementary Sources

### F1. D. L. Parnas, Module Decomposition

- URL: https://doi.org/10.1145/361598.361623
- Adopted: hide change-prone design decisions and reveal little implementation knowledge through interfaces.
- Limit: no purpose taxonomy, polymorphism mandate, or branch workflow.

### F2. Eiffel, Design by Contract Introduction

- URL: https://www.eiffel.com/values/design-by-contract/introduction/
- URL and title verified: 2026-07-16.
- Adopted: semantic contracts express client and supplier obligations.
- Limit: does not decide where variant selection belongs or whether an interface is warranted.

### F3. SEI, Modifiability Tactics

- URL: https://www.sei.cmu.edu/library/modifiability-tactics/
- URL and title verified: 2026-07-16.
- Adopted: modifiability tactics are evaluated against concrete change scenarios and tradeoffs.
- Limit: does not prescribe interface branch reduction or prove a proposal improves a specific system.

### O1. OpenAI Skill Creator

- Local source: C:\Users\IH-000098\.codex\skills\.system\skill-creator\SKILL.md
- Adopted: precise trigger, narrow coherent workflow, progressive disclosure, and realistic evaluation.
- Limit: Skill packaging only.

## Unofficial Comparator

### C1. inspired-mino-design-skills

- URL: https://github.com/my-take-dev/inspired-mino-design-skills/blob/afd50e2ca18bb22e336a05df1c8481dbcd652b5c/mino-doc/11-interface-driven-branch-reduction.md
- Role: coverage and anti-overengineering comparator only.
- Limit: fixed taxonomy, Strategy or State selection, YAML, implementation steps, tests, and gates are local reconstruction and are not attributed to MinoDriven or required here.

## Local Operational Decisions

- Trigger only after an abstraction purpose and semantic contract are accepted.
- Require a supplied change scenario rather than branch count or speculative variants.
- Classify branch purpose without prescribing a pattern.
- Permit an explicit keep-branch result.
- Report expected localization separately from measured changeability or implementation proof.
