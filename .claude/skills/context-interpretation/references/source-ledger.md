# Source Ledger

Use author-owned, official, or standards-body sources for design claims. MinoDriven controls the primary design intent. Supporting sources refine mechanics without supplying facts about the user's project.

## Primary MinoDriven Intent

### MinoDriven, "AI jidai ni hissu! Jokyo gengoka skill"

https://speakerdeck.com/minodriven/ai-context-verbalization

Use for:

- meaning changes with situation and Purpose
- unclear Purpose causes people and AI to choose different interpretations
- vague quality labels do not identify the intended design concern
- verbalizing situation and Purpose before delegated work reduces divergent interpretation

Limit:

- the suggestion to infer higher Purpose becomes a neutral question or explicitly labeled hypothesis under this Skill; it does not authorize invented stakeholder intent
- the deck does not define the exact runtime output format or project-specific meaning
- Actor, Constraints, and Evidence fields in the common input are local schema choices supported by IREB mechanics; they are not attributed to this deck

### MinoDriven, "Mokuteki de kudo suru, AI jidai no architecture sekkei"

https://speakerdeck.com/minodriven/purpose-driven-architecture

Use for:

- Purpose remains upstream of interpretation and boundary-dependent design
- implementation or technology should not silently become the Purpose

Limit:

- it does not establish a term, role, authority, or boundary for the current project without current evidence

## Official Requirements Sources

### IREB, CPRE Online Glossary

https://cpre.ireb.org/en/downloads-and-resources/glossary

Use for:

- context, system context, context boundary, system boundary, scope, role, ambiguity, validation, and terminology definitions
- retaining original English terms when a translation could alter meaning

Limit:

- glossary definitions do not resolve a project occurrence by themselves

### IREB, CPRE Foundation Level Handbook

https://cpre.ireb.org/en/downloads-and-resources/downloads#cpre-foundation-level-handbook

Official PDF observed during the 2026-07-14 source audit:

https://cockpit-v1.ireb.org/media/pages/downloads/cpre-foundation-level-handbook/871c0964fb-1776850257/cpre_foundationlevel_handbook_en_v1.3.0.pdf

Use for:

- systems and requirements must be understood in context
- stakeholder roles and viewpoints
- system/context/scope distinctions and context models
- terminology, abbreviations, synonyms, homonyms, assumptions, conflicts, and validation
- actual agreement and conflict resolution require relevant stakeholders and evidence

Limit:

- the handbook supports the method; it does not prescribe this Skill's context dimensions, result labels, or handoff format
- the served filename contains `v1.3.0`, while the downloaded document identified revision 1.3.1 dated 2026-04-22; preserve both when version provenance matters

### ISO/IEC/IEEE 29148:2018

https://www.iso.org/standard/72089.html

Use for:

- official confirmation of requirements-engineering processes and information items

Limit:

- the public abstract does not provide enough detail to claim conformance or settle a current interpretation

## Domain-Design Boundary

### Eric Evans, "Domain-Driven Design Reference: Definitions and Pattern Summaries," 2015

https://www.domainlanguage.com/ddd/reference/

https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf

Use for:

- context determines a word or statement's meaning
- a Bounded Context defines where a model applies
- Ubiquitous Language is model-based and used within a Bounded Context

Limit:

- diagnosing contextual meaning is not Bounded Context discovery, Context Mapping, Ubiquitous Language design, or domain modeling

## Skill Architecture Sources

### Agent Skills specification and best practices

https://agentskills.io/specification

https://agentskills.io/skill-creation/best-practices

Use for:

- coherent Skill units
- metadata-based triggering
- progressive disclosure into references
- structural validation

### OpenAI Skill Creator, pinned public source

https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.system/skill-creator/SKILL.md

Use for:

- concise `SKILL.md` structure
- metadata, references, and forward testing

Limit:

- evaluation practices belong to Skill maintenance and do not become ordinary interpretation output

## Derivative Comparator

### my-take-dev/inspired-mino-design-skills

https://github.com/my-take-dev/inspired-mino-design-skills

Pinned local comparison commit: `afd50e2ca18bb22e336a05df1c8481dbcd652b5c`

Use for:

- comparing logical knowledge taxonomy with runtime Function boundaries
- the idea that a narrow primary artifact should select a narrow Function, while integration is separate
- its explicit distinction between public MinoDriven claims and local operational reconstruction

Limit:

- this repository is an unofficial derivative, not authority for MinoDriven's intent
- do not copy its mandatory Core dependency, Context Packet schema, validators, release gates, evaluator protocol, or exhaustive runtime status machinery

## Excluded Sources

Do not use Qiita or Zenn, including content indirectly linked from an accepted source. They supply no rule to this Skill.
