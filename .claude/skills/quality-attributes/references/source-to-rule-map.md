# Source To Rule Map

This map traces production semantics. It is a maintenance reference, not a runtime gate list.

| Rule | Production semantics | Basis | Classification |
| --- | --- | --- | --- |
| QA-01 Source authority | MinoDriven controls primary design intent; ISO, QAW, and ATAM refine bounded mechanics | MinoDriven quality and Purpose decks; ISO/IEC 25010:2023; SEI QAW and ATAM | external sources plus explicit precedence |
| QA-02 Common input | Reconstruct Actor, Purpose, Context, Constraints, and Evidence without inventing missing values | MinoDriven Purpose/quality intent; QAW stakeholder and business-goal trace | external intent plus local input schema |
| QA-03 Evidence and taxonomy | Preserve wording, authority, scope, and version; map a taxonomy only with evidence or as a labeled proposal | ISO model/version boundary; QAW traceability | external mechanics plus local evidence safeguard |
| QA-04 Purpose trace | Link a quality concern to evidenced stakeholder and Purpose, business goal, or Goal; missing trace remains a gap | MinoDriven Purpose-driven design; SEI QAW business/mission goals | external design rule |
| QA-05 Six-part scenario | Keep source, stimulus, environment, artifact, response, and response measure distinct from Actor and Purpose | SEI QAW | external method |
| QA-06 Incomplete scenario | Preserve supplied components and unknowns without filling them from adjectives, examples, or defaults | QAW scenario refinement plus anti-invention boundary | external method plus local evidence safeguard |
| QA-07 Response measure | Check only material measure dimensions; never invent thresholds, metrics, observation, scope, or authority | QAW concrete response measures; ISO specification/measurement uses | external mechanics plus local precision checklist |
| QA-08 Priority provenance | Preserve only evidenced decisions, rankings, actual votes, workshops, or program priorities | SEI QAW prioritization | external method plus local provenance rule |
| QA-09 Interaction typing | Separate observed requirement conflict, interaction hypothesis, and no evidenced interaction; do not claim ATAM findings | SEI QAW scenario evidence; SEI ATAM method boundary | local evidence typing supported by external boundaries |
| QA-10 Candidate boundary | Keep candidate architecture, tactic, product, and technology outside scenario facts; hand selection or evaluation downstream | MinoDriven solution-first warning; SEI ATAM boundary | external intent plus local responsibility rule |
| QA-11 Handoffs | Complete quality framing before using the smallest installed recipient; do not simulate capability | Agent Skills coherent units; neighboring Skill boundaries | local orchestration supported by Skill architecture |
| QA-12 Proportional output | Return concerns, scenarios, measure gaps, priority, interactions, and handoffs as relevant; omit empty sections and maintenance records | Agent Skills best practices; OpenAI Skill Creator; derivative repository only as comparator | Skill architecture plus local output rule |

## Maintenance Note

A row documents why a production rule exists; it does not prove that the rule was applied in a particular analysis. Natural executions, hashes, reviewer findings, and release decisions remain outside the installed Skill.
