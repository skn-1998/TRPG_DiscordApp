# Source-To-Rule Map

`local architecture` denotes a Skill-family decision, not an externally attributed universal rule.

| Rule ID | Production rule | Basis | Derivation |
|---|---|---|---|
| CD-01 | Keep the parent at selection, ordering, contracts, and gap reporting. | local architecture; O1; C1 | Parent minimalism and progressive disclosure prevent a hidden monolith. |
| CD-02 | Carry Actor, Purpose, Context, Constraints, and Evidence into each standalone child. | local architecture | This is the family's common input contract. |
| CD-03 | Prefer one clear installed child directly; do not trigger the parent solely because a narrow request's child is absent. | local architecture; O1; C1 | A parent hop is unnecessary for one owned method, and unavailable staged capabilities must not turn ordinary requests into routing dead ends. |
| CD-04 | Preserve unknowns and do not infer purpose or ownership from code shape, patterns, metrics, or names. | M1; M3; local architecture | The sources make purpose controlling; evidence policy keeps unsupported interpretations provisional. |
| CD-05 | Route purpose-specific state and rule ownership to encapsulation. | M1; F2 | Purpose-centered cohesion and explicit obligations define the concern, not the parent's answer. |
| CD-06 | Route common-purpose and semantic-boundary decisions to abstraction. | M2; M3; F1 | Abstraction must hide detail for a consumer purpose rather than collect similar shapes. |
| CD-07 | Route caller branch mechanics only after an abstraction contract exists. | M2; local architecture | Branch reduction consumes the semantic boundary instead of redefining it. |
| CD-08 | Route a bounded naming decision to the installed standalone child when its established-purpose and terminology trigger is met; never invent naming analysis in the parent. | M5; F3; local architecture | The child owns its researched operational method while the parent retains only routing knowledge. |
| CD-09 | Add peer handoffs only for requested or controlling artifacts and keep peer internals opaque. | local architecture | Speculative downstream work duplicates another Skill's responsibility. |
| CD-10 | Report unavailable recipients as `missing-capability`; do not imitate them. | local architecture | Honest capability reporting protects the parent boundary. |
| CD-11 | Give every step all five common input fields, recipient-specific deltas, the recipient's artifact type and explicit completion declaration, and exactly one deterministic state; do not reassess child semantics. | local architecture | A child remains directly executable without recovering input from the parent artifact, while the route exposes one next step without gate machinery. |
| CD-12 | Keep theory and detailed method knowledge in references or children. | O1; C1 | Progressive disclosure keeps runtime instructions concise. |
| CD-13 | Establish purpose or context evidence before a dependent code-design decision. | M1; M3; local architecture | Evidence is ordered first only when it controls the later boundary. |
| CD-14 | Order responsibility, abstraction, branch, and naming work by actual semantic dependency rather than a universal phase list. | M1; M2; M3; F3; local architecture | Purpose-based ownership and abstraction can control later mechanics or terminology, but independent results need no artificial dependency. |
| CD-15 | Put a requested design result before a behavior-preserving implementation handoff when that implementation consumes the design. | local architecture | The downstream refactor cannot preserve and implement a design contract that does not yet exist. |

## Audit Notes

- Source presence does not prove derivation; read the stated limits.
- No source here supports universal reviewer identities, gate records, rollback fields, test commands, or iteration counters for every route.
- Updating this map does not require release or approval machinery inside the runtime Skill.
