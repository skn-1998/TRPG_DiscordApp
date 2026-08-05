# Domain Child Map

This parent-owned index declares the domain-design children. Runtime availability comes from current Skills metadata. A planned child is never simulated.

| Child | Use when | Parent-owned contract | Current declaration |
| --- | --- | --- | --- |
| `bounded-context-discovery` | Model scope or applicability is unclear, or one model may mix materially different purposes, cycles, concepts, meanings, or invariants | `bounded-context-discovery-contract.md` | installed |
| `ubiquitous-language` | Context-specific terms are inconsistent, overloaded, implementation-led, or missing | none | installed |
| `invisible-driven-modeling` | Visible physical nouns hide purpose, problems, ownership, rights, responsibilities, or other non-physical concepts | none | installed |
| `invariant-modeling` | Valid states, transitions, consistency rules, or bounded pre/postcondition statements for named domain operations must become explicit; a full contract package is unsupported | none | installed |
| `data-destruction-analysis` | Controlled invalid-data or mutation challenges are needed to reveal integrity constraints | none | installed |

Every child must be independently invocable and reconstruct Actor, Purpose, Context, Constraints, and Evidence. A child invoked with a broader request performs only its owned method and hands the remainder to this parent.
