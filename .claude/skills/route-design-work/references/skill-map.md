# Design Skill Map

This map declares ownership and intended placement. Current Skills metadata is the runtime authority for whether a recipient is installed.

Status values in this file are `installed`, `planned`, and `evidence-needed`.

```text
route-design-work                         installed
|- design-core                            installed
|  |- purpose-goal-means                  installed
|  |- quality-attributes                  installed
|  `- context-interpretation              installed
|- domain-design                          installed
|  |- bounded-context-discovery           installed
|  |- ubiquitous-language                 installed
|  |- invisible-driven-modeling           installed
|  |- invariant-modeling                  installed
|  `- data-destruction-analysis           installed
|- code-design                            installed
|  |- purpose-centered-encapsulation      installed
|  |- interface-branch-reduction          installed
|  |- purpose-driven-naming               installed
|  `- purpose-driven-abstraction          installed
|- refactoring                            installed
|  |- debt-prioritization                 installed
|  |- legacy-purpose-split                installed
|  `- ai-assisted-refactoring             installed
`- organization                           installed
   |- design-learning-workshop            installed
   `- design-knowledge-scaling             installed
```

Cross-cutting installed review capability:

- `review-changeability`: scenario-specific change-propagation and modifiability review

The map is intentionally conservative. A planned or evidence-needed child is unavailable and must not be simulated. An installed parent may report the gap but does not become a substitute for the missing child method.

## Parent Ownership

Each parent owns only:

- common-input normalization
- concern classification
- child selection and semantic dependency order
- Step input, output, completion, state, exclusions, and re-entry
- missing evidence and capability reporting

Detailed analysis and implementation belong to children or another specialized Skill.

When this global parent sends a Step to a category parent, that Step expects a child route or missing/unsupported-capability report. Installation of the category parent does not imply installation of any planned child, and the global route must not describe the parent as producing that child's detailed artifact.

## Direct Invocation

Use an exact child directly when one method owns the request. Use a category parent when multiple methods in that category must be ordered, the child is unclear, or a returned result controls another child. Use `route-design-work` only for multiple categories or unclear category ownership.

Count work the user asks to perform now. A gap discovered by a child and preserved in a handoff does not retroactively turn the original request into a multi-method route.

## Skill Authoring Boundary

`skill-creator` owns creation and revision decisions. This map may supply the existing capability route and declared gaps, but `route-design-work` does not define a new Skill, its threshold, files, or authoring workflow.
