# Source Ledger

Sources explain learning and scaling claims; they do not justify fixed release, review, or test machinery in a routing parent.

## Primary MinoDriven Sources

### M1. Practice-oriented design learning

- URL: https://speakerdeck.com/minodriven/effective-learning-of-good-code
- Verified: 2026-07-16; the public transcript identifies MinoDriven and describes workshop practice using regular development code, problem discovery and verbalization, redesign, explanation, feedback, and presentation.
- Supports: route practical design learning to a focused workshop method; treat design as a means for a recognized problem; observe participants doing and explaining the work.
- Limits: its session sequence, duration, participant count, and exercises are examples for the child, not universal parent steps or gates.

### M2. Scaling design support through modular knowledge

- URL: https://speakerdeck.com/minodriven/modifius
- Verified: 2026-07-16; the public transcript identifies MinoDriven and describes workshops, consultation, guidelines, cross-team support limits, and a modular core plus task, viewpoint, and language prompts.
- Supports: distinguish human learning from knowledge/tool distribution; preserve a stable design basis while selecting focused modules for different uses; avoid one giant prompt.
- Limits: the deck does not require Codex Skills, MCP, CI, a pilot, a fixed review gate, or one rollout channel for every organization.
- Exclusion: do not use the linked Qiita event page or Qiita-derived content.

## Organizational Learning Source

### F1. Wenger-Trayner and Wenger-Trayner, communities of practice

- URL: https://www.wenger-trayner.com/introduction-to-communities-of-practice/
- Verified: 2026-07-16; the authors' public page defines collective learning around domain, community, and practice, and discusses changed practice and performance evidence.
- Supports: collective learning in a shared domain; practitioner interaction; development of a shared repertoire from experiences, tools, and recurring problems; links between learning, changed practice, and performance.
- Limits: does not make a community of practice, formal pilot, fixed facilitator, or metric mandatory for every workshop or scaling request.

## Skill Architecture

### O1. OpenAI Skill Creator

- URL: https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md
- Verified: 2026-07-16; the official repository describes concise Skills, progressive disclosure, bundled references, validation, and iteration through real usage.
- Installed copy: `$CODEX_HOME/skills/.system/skill-creator/SKILL.md`
- Supports: concise runtime instructions, progressive disclosure, realistic forward tests, and handoff to the owning authoring workflow.

### C1. inspired-mino-design-skills

- Repository: https://github.com/my-take-dev/inspired-mino-design-skills/tree/afd50e2ca18bb22e336a05df1c8481dbcd652b5c
- Relevant files: `mino-doc/18-design-learning-workshop.md` and `mino-doc/19-skill-modularization-and-scaling.md`.
- Role: pinned, unofficial comparator supplied by the user.
- Adopt: separate learning from scaling, keep method detail outside the parent, use real work and explicit capability outcomes, and modularize by purpose.
- Do not adopt: fixed YAML, hard gates, mandatory benchmarks, universal pilots, release phases, or exhaustive checklists as parent runtime rules.
- Limits: it is not evidence for claims attributed directly to MinoDriven.

## Local Architecture Decisions

- the parent selects, orders, contracts, and reports gaps only;
- every child accepts Actor, Purpose, Context, Constraints, and Evidence directly;
- child absence alone does not trigger the parent for a narrow ordinary request;
- workshop-before-scaling is conditional on an actual evidence dependency, not a universal lifecycle;
- activity observations are not automatically treated as capability outcomes;
- actual Skill authoring belongs to `skill-creator`.

## Source Policy

Qiita and Zenn are excluded, including quotations or links embedded in otherwise accepted sources. Preserve uncertainty and source limits instead of combining examples into universal process.
