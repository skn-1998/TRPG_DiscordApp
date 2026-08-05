# Source Ledger

Use author-owned, official, or standards-body sources for design claims. MinoDriven controls the primary design intent. Formal sources refine taxonomy, scenario, measurement, prioritization, and method boundaries without supplying facts about the user's project.

## Primary MinoDriven Intent

### MinoDriven, "Software hinshitsu tokusei, ishiki shitemasuka? AI no shin no chikara wo hikidasu katsuyo jirei"

https://speakerdeck.com/minodriven/ai-and-software-quality

Use for:

- quality characteristics as explicit evaluation criteria
- ambiguity of an unspecified request for "good" code or design
- making the intended quality visible in AI-assisted development
- changeability or modifiability as a deliberate quality concern

Limit:

- use its taxonomy as author intent and historical context
- do not silently present its labels as an exact ISO/IEC 25010:2023 mapping

### MinoDriven, "Mokuteki de kudo suru, AI jidai no architecture sekkei"

https://speakerdeck.com/minodriven/purpose-driven-architecture

Use for:

- tracing quality and design boundaries to Purpose
- avoiding solution-first quality claims

Limit:

- it does not supply stakeholder priority, scenario measures, or current-system evidence

### MinoDriven, "MCP server Modifius de henko yoi-sei no kojo wo scale suru"

https://speakerdeck.com/minodriven/modifius

Use for:

- modular design knowledge and selecting focused methods by situation

Limit:

- it is not the source of the six-part scenario, formal measurement, QAW prioritization, or ATAM findings

## Formal Quality And Scenario Sources

### ISO/IEC 25010:2023, Product Quality Model

https://www.iso.org/standard/78176.html

Use for:

- current official product-quality reference model with nine characteristics and subcharacteristics
- use of a quality model in specification, measurement, evaluation, design objectives, testing objectives, and acceptance criteria

Limit:

- the public abstract does not provide all definitions needed for an exact mapping
- do not claim ISO conformance or invent an unavailable subcharacteristic definition

### Software Engineering Institute, "Quality Attribute Workshops (QAWs), Third Edition"

https://www.sei.cmu.edu/library/quality-attribute-workshops-qaws-third-edition/

https://doi.org/10.1184/R1/6582656.v1

Use for:

- business and mission goal trace
- stakeholder scenario generation, prioritization, and refinement before architecture exists
- six quality-scenario components
- concrete response measures

Limit:

- QAW is a facilitated stakeholder method
- this Skill must not claim that a workshop, vote, or consensus occurred without actual evidence

### Software Engineering Institute, Quality Attribute Workshop Collection

https://www.sei.cmu.edu/library/quality-attribute-workshop-collection/

Use for:

- stakeholder participation and workshop-process boundaries
- prioritized refined scenarios as an actual QAW result

Limit:

- do not simulate its voting method or participants

### Software Engineering Institute, Architecture Tradeoff Analysis Method Collection

https://www.sei.cmu.edu/library/architecture-tradeoff-analysis-method-collection/

Use for:

- later architecture evaluation against quality goals
- reserving architecture risks, sensitivity points, and tradeoff points for work that evaluates an architecture

Limit:

- this Skill does not run or claim ATAM and does not select architecture tactics

## Skill Architecture Sources

### Agent Skills specification and best practices

https://agentskills.io/specification

https://agentskills.io/skill-creation/best-practices

Use for coherent Skill units, metadata-based triggering, progressive disclosure, references, and validation.

### OpenAI Skill Creator, pinned public source

https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.system/skill-creator/SKILL.md

Use for concise runtime structure, references, metadata, structural validation, and forward testing.

Limit: evaluation evidence belongs to Skill maintenance and does not become ordinary quality-analysis output.

## Derivative Comparator

### my-take-dev/inspired-mino-design-skills

https://github.com/my-take-dev/inspired-mino-design-skills

Pinned local comparison commit: `afd50e2ca18bb22e336a05df1c8481dbcd652b5c`

Use for:

- comparing logical design taxonomy with runtime Function boundaries
- the principle that one primary artifact should select one narrow Function
- its explicit separation between public MinoDriven claims and local operational reconstruction

Limit:

- this repository is unofficial and does not speak for MinoDriven
- do not copy its Core dependency, owner schemas, validators, release gates, evaluator protocol, or exhaustive status machinery

## Local Operational Choices

The following are local adaptations supported but not prescribed by the sources:

- the five-field common input contract
- raw or refined scenario descriptions
- the response-measure precision checklist
- observed conflict, interaction hypothesis, and no-evidence distinctions
- handoff and completion fields

They are not ISO certification terms, QAW results, or ATAM findings.

## Excluded Sources

Do not use Qiita or Zenn, including content indirectly linked from an accepted source. They supply no rule to this Skill.
