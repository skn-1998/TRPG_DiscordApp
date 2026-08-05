# Source-To-Rule Map

This map audits production rules. `local architecture` identifies an explicit Skill-family decision rather than an externally attributed design claim.

| Rule ID | Production rule | Basis | Derivation |
|---|---|---|---|
| RF-01 | Keep the parent at selection, ordering, contract, and gap reporting. | local architecture; O1; C1 | Parent minimalism is a local requirement, reinforced by concise and modular Skill guidance. |
| RF-02 | Carry Actor, Purpose, Context, Constraints, and Evidence into every standalone child request. | local architecture | This is the family's common input contract, not a published universal schema. |
| RF-03 | Prefer one clear installed child directly; use the parent only for composition, ambiguity, unavailability, or returned-result coordination. | local architecture; O1; C1 | Direct use avoids a mandatory Core hop and unnecessary context. |
| RF-04 | Separate behavior-preserving work from behavior change using supplied evidence. | F1; M1 | Observable-behavior preservation defines refactoring; uncertain evidence must remain uncertain. |
| RF-05 | Do not treat a purpose inferred from code shape as established fact. | M1; local architecture | M1 says known context and documentation improve code-based purpose analysis; retaining hypothesis status until evidence supports it is a conservative local derivation. |
| RF-06 | Route mixed-purpose legacy analysis to a purpose-split method without performing that analysis in the parent. | M1; M2; local architecture | Purpose-centered design supplies the concern; the parent/child boundary controls where the method runs. |
| RF-07 | Route competing debt items to evidence-based prioritization and reject smell count as sufficient business priority. | F2; C1; local architecture | F2 frames paydown around interest and future touch; C1 doc 04 adds purpose-linked comparison. A smell count alone does not answer that decision. |
| RF-08 | Select AI assistance when a request directs AI or Claude to plan, execute, or review a bounded refactor, but not merely because AI answers another method's request. | M1; F1; local architecture | AI does not remove the behavior-preservation obligation; the trigger follows the requested work rather than the identity of the answering system. |
| RF-09 | Order only dependencies that control a later result. | local architecture; M1 | Purpose and behavior evidence precede a change only when they are prerequisites; generic ceremony is not added. |
| RF-10 | Report any unavailable recipient as `missing-capability`; do not imitate it. | local architecture | Honest capability reporting prevents the parent from growing into a hidden monolith. |
| RF-11 | Give each step an objective, recipient, inputs, artifact-type output, recipient completion declaration, and exactly one deterministic state; do not reassess child semantics. | local architecture | This is the minimum handoff contract needed to compose children, expose the single next step, and resume work. |
| RF-12 | Keep theory and adoption limits in references, and keep runtime instructions concise. | O1 | Progressive disclosure protects context and makes source provenance inspectable when needed. |
| RF-13 | Keep missing inputs as gaps and keep a peer recipient's internal route opaque. | local architecture | Expanding gaps or destination internals creates speculative process and duplicates another Skill's responsibility. |

## Audit Notes

- Source presence does not prove that a production rule follows from it; read the stated derivation and limits.
- No source here supports universal acceptance gates, fixed reviewer identities, mandatory rollback records, or mandatory test commands for every routing request.
- Changes to a rule require updating this map and the relevant source limits, but they do not require a release or approval workflow inside the runtime Skill.
