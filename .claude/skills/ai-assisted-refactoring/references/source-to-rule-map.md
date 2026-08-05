# Source-To-Rule Map

`local architecture` denotes a Skill-family decision, not an externally attributed universal rule.

| Rule ID | Production rule | Basis | Derivation |
|---|---|---|---|
| AR-01 | Limit this Skill to observable-behavior-preserving restructuring. | F1 | This is the defining boundary of refactoring. |
| AR-02 | Accept the common five-field contract directly and preserve unknowns. | local architecture | The child must run without a routing parent or invented context. |
| AR-03 | Treat code-derived purpose as an evidence-linked hypothesis. | M1; local architecture | AI can infer code intent, while supplied context improves accuracy and stakeholder truth remains external. |
| AR-04 | Partition intentional behavior changes from the refactor. | F1; local architecture | A mixed request must not hide feature or bug-fix behavior inside a preservation claim. |
| AR-05 | Hand off debt choice, legacy purpose discovery, and missing design decisions to their owners. | local architecture | This child executes bounded transformations rather than absorbing specialized decision methods. |
| AR-06 | Use the smallest coherent transformation that advances the declared goal. | F1 | Small behavior-preserving changes reduce risk while allowing cumulative restructuring. |
| AR-07 | Prefer trusted symbol-aware mechanics for rename, move, and extract when available. | M1; F1 | Both sources distinguish useful automated mechanics from semantic judgment. |
| AR-08 | State weaker completeness when an AI or manual patch replaces symbol-aware tooling. | local architecture | Tool unavailability must not become a false reference-completeness claim. |
| AR-09 | Select verification proportionately from actual behavior evidence and risk. | M1 (tests as essential); F1; F2; local architecture | The sources support tests, contracts, working increments, and automated tools; choosing the narrow evidence boundary without a fixed suite is the local adaptation. |
| AR-10 | Do not add tests merely to satisfy the workflow. | local architecture; C1 adoption limit | Verification serves preservation rather than becoming the product or a gate record. |
| AR-11 | Stop or narrow scope when evidence cannot support the claimed preservation boundary. | F1; local architecture | An unverified broad claim is less honest than an incomplete bounded result. |
| AR-12 | Keep plan, execute, and review outputs distinct. | local architecture; O1 | Mode separation prevents a plan from claiming edits and a review from silently changing code. |
| AR-13 | Preserve unrelated user work and report actual failures and unrun checks honestly. | local architecture | Safe execution requires current-work awareness and evidence provenance. |
| AR-14 | Avoid universal reviewer, approval, rollback, branch, commit, and command machinery. | local architecture; C1 adoption limit | None is entailed by the bounded refactoring sources for every request. |
| AR-15 | Without relevant executable behavior evidence, do not claim broad runtime preservation. | M1; F1; local architecture | Avoiding mandatory test creation narrows the completion claim; it does not turn compilation or static checks into proof of runtime behavior. |

## Audit Notes

- Source presence does not prove derivation; read the stated limits.
- MinoDriven's exact test example is retained as source context, not converted into a mandatory style or test matrix.
- A final diff inspection inside execute mode is execution hygiene, not an independent review gate.
