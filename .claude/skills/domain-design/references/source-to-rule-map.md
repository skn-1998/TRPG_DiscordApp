# Source To Rule Map

This map covers production routing behavior only.

| ID | Production rule | Classification | Evidence and limits |
| --- | --- | --- | --- |
| `DD-PARENT-ONLY` | Classify, order, and contract domain work without performing child methods or fabricating child results | User-required local architecture plus Skill modularity guidance | `LOCAL-HIERARCHY-BRIEF`, `SRC-OPENAI-SKILL-CREATOR`; external guidance does not define this hierarchy |
| `DD-COMMON-CONTRACT` | Normalize Actor, Purpose, Context, Constraints, and Evidence once; Steps reference it and record justified deltas | MinoDriven purpose framing plus user-required local contract | `SRC-MINO-PURPOSE-ARCH`, `LOCAL-HIERARCHY-BRIEF`; the five-field schema is local |
| `DD-EVIDENCE` | Preserve provenance, scope, contradiction, and unknowns without importing unrelated evidence | DDD evidence needs plus local anti-invention policy | Evans/Fowler sources and `LOCAL-HIERARCHY-BRIEF`; they do not define filesystem commands |
| `DD-BOUNDARY-FIRST` | Resolve material model-scope ambiguity before context-specific language or detailed modeling | External domain-design dependency | Evans/Fowler Bounded Context and MinoDriven universal-model material |
| `DD-ORDER` | Order semantic prerequisites, authorize one eligible next Step, and return newly discovered integrity constraints to invariant work | External method relationships plus local workflow governance | MinoDriven purpose, invisible-design, and data-destruction sources; `LOCAL-HIERARCHY-BRIEF` supplies the local Step lifecycle |
| `DD-LANGUAGE` | Route inconsistent or overloaded context-specific terms to `ubiquitous-language` | External DDD design evidence | Evans/Fowler Ubiquitous Language and Bounded Context material |
| `DD-INVISIBLE` | Route physical-entity overload to purpose-specific concept discovery | External MinoDriven design evidence | `invisible-driven-design` deck |
| `DD-INVARIANT` | Route valid states, transitions, consistency rules, and behavioral contracts to invariant modeling | External terminology and contract evidence | Evans DDD and Eiffel Design by Contract |
| `DD-DESTRUCTION` | Route controlled invalid-data and mutation challenges to data-destruction analysis | External MinoDriven design evidence | `data-destroy-driven` deck |
| `DD-DIRECT` | Prefer one focused child for one method; use the parent for multiple methods or returned-result coordination | User-required hierarchy and Skill modularity | `LOCAL-HIERARCHY-BRIEF`, `SRC-OPENAI-SKILL-CREATOR` |
| `DD-INSTALLED-ONLY` | Use only declared capabilities visible in current Skills metadata; never simulate a missing or unsupported method | Local runtime rule | `LOCAL-HIERARCHY-BRIEF` |
| `DD-CANONICAL-CONTRACT` | Use the parent-owned child contract for Step input, output, completion, and exclusions without duplicating the child method | Local hierarchy rule plus progressive disclosure | `LOCAL-HIERARCHY-BRIEF`, `SRC-OPENAI-SKILL-CREATOR` |
| `DD-RETURN-COMPLETION` | Mark a Step complete only from an actual output reference and the child's explicit completion declaration; keep child-declared blockers visible without reassessing semantics | Local ordered-chain governance | `LOCAL-HIERARCHY-BRIEF`; external sources do not define this Step lifecycle |
| `DD-READINESS-AUTHORITY` | Separate route completion, Step readiness, and authority for consequential effects; include review only when supplied governance or the request requires it | User-required parent boundary plus local governance | `LOCAL-HIERARCHY-BRIEF`; no fixed reviewer or review gate is implied |
| `DD-OUTPUT-CONTRACT` | Return a concise route, shared request contract, ordered Steps, one next Step, blockers, and re-entry condition | User-required input/output/completion contract plus Skill authoring guidance | `SRC-OPENAI-SKILL-CREATOR`; it does not define fixed Markdown grammar |
