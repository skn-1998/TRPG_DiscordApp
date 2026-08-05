# Source-To-Rule Map

| Rule | Operational rule | Basis |
|---|---|---|
| PA-01 | Trigger for a one-or-more-case or existing-abstraction semantic decision. | M1; local trigger |
| PA-02 | Preserve common input, evidence, conflicts, alternatives, and unknowns. | Source limits; local evidence discipline |
| PA-03 | Center the abstraction on one evidenced consumer purpose. | M1, M2 |
| PA-04 | Do not treat shape, signature, names, inheritance, or duplication as common-purpose evidence. | M1, M4 |
| PA-05 | Compare inputs, results, failures, side effects, invariants, and material timing. | F2; local semantic schema |
| PA-06 | Include only cases that honor the same semantic obligations. | M1, M2, F2 |
| PA-07 | Exclude incompatible purposes or semantics rather than weaken the contract with flags or optional operations. | M1, M2; local anti-overengineering rule |
| PA-08 | Treat future variants as evidence only through realistic supplied scenarios. | M1 limits; local evidence discipline |
| PA-09 | Identify only evidenced implementation decisions that may vary behind the contract. | F1; local scenario rule |
| PA-10 | Decide introduce, retain, narrow, remove, avoid, or insufficient-evidence; require supported benefit for introducing or retaining an abstraction and a benefit-backed coherent remainder for narrowing one. | Local decision schema |
| PA-11 | Record the keep-concrete alternative, compatibility, tradeoffs, and unknowns. | F1; local decision discipline |
| PA-12 | Exclude branch mechanics, patterns, naming, architecture, implementation, tests, and migration gates. | M2/M4/F3 boundaries; O1 narrow Skill design |
| PA-13 | Complete with a semantic design decision, not implementation proof. | Local completion rule |
| PA-14 | Keep detailed theory and provenance in references. | O1 progressive disclosure |
