# Source Ledger

No prohibited community source is used. MinoDriven's Data Destroy Driven presentation is the primary method source; complementary sources supply contract vocabulary and Skill construction only.

## MinoDriven Primary Sources

### M1. Data Destroy Driven

- URL: https://speakerdeck.com/minodriven/data-destroy-driven
- Adopted: for update operations, ask how model data could be corrupted, contradictory, or harmful to users; derive integrity constraints; exercise invalid boundaries. Examples include negative or missing values, cross-owner identifiers, duplicates, required cardinality, and invalid deletion.
- Limit: the presentation is an informal method with worked examples, not a validated exhaustive taxonomy. It teaches that integrity protection belongs with the data-owning model, but owner placement is a downstream design concern rather than an output of this analysis Skill. It excludes reads and does not define concurrency, retries, atomicity, all-writer enumeration, security testing, or production-data procedures.

### M2. AI Refactoring Approach

- URL: https://speakerdeck.com/minodriven/ai-refactoring-approach
- Adopted: detached validation can be omitted or duplicated; valid construction and domain constraints should be encapsulated; preconditions, postconditions, and invariants can be verification targets.
- Limit: this corroborates encapsulation and contract-oriented verification, not the destruction-probe method or a larger catalog.

### M3. DDD in the AI Era

- URL: https://speakerdeck.com/minodriven/ddd-in-ai-era
- Adopted: domain tests may organize around preconditions, postconditions, and invariants.
- Limit: it does not define probe selection or completeness.

## Complementary Sources

### D1. Eiffel, Design by Contract and Assertions

- URL: https://www.eiffel.org/doc/solutions/Design_by_Contract_and_Assertions
- Adopted: stable meanings of precondition, postcondition, and class invariant for downstream classification.
- Limit: it supplies vocabulary only; the contract schema is not attributed to Data Destroy Driven.

### A1. Agent Skills Best Practices and Specification

- URLs: https://agentskills.io/skill-creation/best-practices and https://agentskills.io/specification
- Adopted: precise trigger, one coherent work unit, explicit output, and progressive disclosure.
- Limit: Skill packaging only.

## Unofficial Comparator

### C1. inspired-mino-design-skills

- URL: https://github.com/my-take-dev/inspired-mino-design-skills/blob/afd50e2ca18bb22e336a05df1c8481dbcd652b5c/mino-doc/09-data-destruction-driven-analysis.md
- Role: coverage and anti-overengineering comparator only.
- Limit: its six-part catalog, all-writer inventory, propagation ledger, defense layers, rejection guarantees, YAML schema, and completion checklist are local reconstruction, not MinoDriven claims.

## Local Operational Decisions

- Select a small purpose-relevant probe set instead of exhausting categories.
- Separate observed, reasoned, supplied, and unknown outcomes.
- Keep probe execution outside this Skill and never infer production mutation permission.
- Return candidate constraints to `invariant-modeling` only when current Skills metadata shows it is available; otherwise return the unavailable capability to `domain-design`.
- Complete a proportionate report without claiming model completeness.
