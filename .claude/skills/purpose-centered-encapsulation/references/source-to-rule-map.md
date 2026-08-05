# Source-To-Rule Map

| Rule | Operational rule | Basis |
|---|---|---|
| PE-01 | Trigger only for bounded code with evidenced purpose and known state or rule ownership concerns. | M1, M3; local trigger |
| PE-02 | Preserve common input, authority, conflicts, and unknowns. | Source claim limits; local evidence discipline |
| PE-03 | Do not infer purpose or domain truth from shape, size, names, access, patterns, or smells. | M1, M3; local evidence discipline |
| PE-04 | Inventory material state, rules, mutations, observations, and responsibility leaks. | M1, M2; local schema |
| PE-05 | Propose the smallest units tied to one evidenced purpose. | M1, M2, M3 |
| PE-06 | Keep state-related decisions, calculations, and transitions with their responsible unit. | M1, M2, M3 |
| PE-07 | Expose purpose-meaningful commands and necessary non-mutable observations. | M1, M2, F1 |
| PE-08 | Allocate only supplied contract obligations and do not invent invariants. | F2; local domain boundary |
| PE-09 | Record public-contract and compatibility effects without implementing migration. | F1; local design boundary |
| PE-10 | Do not add interfaces, factories, policies, or tactical types without separate evidence. | M4 boundary; local anti-overengineering rule |
| PE-11 | Compare against keeping the current boundary and record consequential alternatives. | Local decision discipline |
| PE-12 | Exclude domain discovery, abstraction, branch mechanics, implementation, tests, and release gates. | O1 narrow Skill design; local hierarchy ownership |
| PE-13 | Return `not-applicable` when no material leak exists; otherwise complete with a usable design, not behavior-preservation or implementation claims. | O1; local applicability and completion rule |
| PE-14 | Keep detailed theory and provenance in references. | O1 progressive disclosure |
