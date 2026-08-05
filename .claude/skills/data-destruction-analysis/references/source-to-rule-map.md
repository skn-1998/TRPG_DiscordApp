# Source-To-Rule Map

| Rule | Operational rule | Basis |
|---|---|---|
| DD-01 | Analyze one bounded state-changing use case and valid baseline. | M1; local scope operationalization |
| DD-02 | Preserve common input, baseline provenance, contradictions, and unknowns. | M1; local evidence discipline |
| DD-03 | Tie probes to plausible corruption, contradiction, or harm for the actor's purpose. | M1 |
| DD-04 | Select only applicable value, relationship, transition, cardinality, or deletion probes. | M1 value, relationship, cardinality, and deletion examples; transition prompt and proportionality are local |
| DD-05 | Do not treat probe prompts as an exhaustive taxonomy. | M1 claim limits; A1 |
| DD-06 | Distinguish supplied, observed, reasoned, and unknown outcomes. | Local evidence discipline required by M1's heuristic limits |
| DD-07 | Classify selected probes as prevented, invalid-state-exposed, or unknown. | Local operationalization of M1 findings |
| DD-08 | Derive candidate constraints without approving domain truth or implementation. | M1; D1 vocabulary limit |
| DD-09 | Exclude security, time, concurrency, retries, atomicity, caches, distributed failure, transaction architecture, and all-writer completeness. | Local hierarchy boundary |
| DD-10 | Design and analyze probes without executing destructive operations. | A1 narrow work unit; local safety boundary |
| DD-11 | Do not require tests, defenses, migration, production searches, or release gates. | Local analysis boundary; M1's demonstrated tests do not make execution part of this report contract |
| DD-12 | Complete a proportionate report without claiming model completeness. | M1 claim limits; A1 explicit output |
| DD-13 | Keep detailed theory and provenance in references. | A1 progressive disclosure |
