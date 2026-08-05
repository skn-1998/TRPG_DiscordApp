---
name: codex-spark-consensus
description: >
  Use when one user request should be handled by several independent
  subagents, compared, and refined into the strongest final result. This should
  trigger for prompts asking to run multiple agents,
  create multiple drafts, compare candidates, pick/adopt the best answer,
  improve or "tighten" the selected result, or get consensus. Spawn 3
  independent candidates by default,
  judge them, then run at least one refinement pass unless speed is more
  important than quality.
---

# codex-spark-consensus

The folder keeps its legacy name for compatibility. This project uses the
subagent models exposed by the current runtime; Spark availability is not assumed.

Use this skill to turn one instruction into a small consensus process:

1. Generate several independent candidate answers with the available subagent model.
2. Judge the candidates against the original request.
3. Adopt the strongest candidate.
4. Refine the adopted answer with one or more tightening passes.
5. Return the final selected answer plus enough traceability to inspect the run.

This skill is useful when output quality depends on search, taste, risk spotting,
or finding a better framing: design docs, implementation plans, review summaries,
migration strategies, incident writeups, user-facing messages, and other tasks
where independent attempts may catch different details.

## When to use

Use this skill when the user asks for any of the following:

- multiple agents, subagents, parallel agents, or background agents
- several drafts or several versions
- compare candidates and choose the best
- consensus, judge pass, tournament, or best-of-N selection
- adopt the best result and improve/tighten/polish it
- explicit use of multiple independent model runs

Skip this skill for tiny mechanical changes, quick factual lookups, or when the
user explicitly says one pass is enough.

## Safety boundary for code edits

Do not let multiple candidate agents edit the same working tree. For coding
tasks, candidates should produce proposals, patch snippets, file lists, or risk
analyses. The parent agent applies the selected final change after judging.

If the task can be split into truly disjoint file ownership, use normal
multi-agent worker delegation instead of this best-of-N skill.

## Preferred workflow with native subagents

When the `collaboration.spawn_agent` tool is available, prefer it over the
PowerShell fallback script.

### Candidate generation

Respect the runtime concurrency limit. In the current Codex runtime, the parent
plus three children use all four available slots.

- Use 3 candidates by default.
- Use 5-7 candidates only when the user explicitly asks for a larger sample;
  run them in batches when the concurrency limit requires it.
- Inherit the parent model unless the user explicitly requests an available
  model override.
- Give every candidate the same original task and constraints.
- Tell candidates to work independently and avoid reading each other's output.
- For code tasks, tell candidates not to edit files and to return a concrete
  patch proposal or implementation plan.

Candidate prompt shape:

```text
You are candidate-N in a best-of-N consensus run.
Solve the user's request independently.

Do not edit workspace files. If the task requires code changes, return the exact
patch proposal, commands, affected files, and verification plan.

Original request:
<user request>

Return:
- final answer or proposal
- key assumptions
- risks or edge cases
```

### Judge pass

After candidates finish, judge them against the original task. The judge can be
the parent agent for small tasks, or a separate subagent for stronger
independence.

Use this judge output format:

```text
WINNER: candidate-XX
REASONS:
- ...
MISSING_OR_WEAK:
- ...
FINAL_SELECTION:
...
```

Judge on:

- correctness and factual accuracy
- completeness against the user's constraints
- executable next steps
- risk and edge-case coverage
- clarity, brevity, and fit to the user's tone

### Refinement pass

Run at least one refinement pass unless the user asked for speed.

Spawn 2-3 refinement candidates. Give them:

- the original request
- the current selected answer
- the judge reasons
- short excerpts from losing candidates if they contain useful ideas

Ask each refiner to preserve correct material, remove weak material, incorporate
only clearly better ideas, and return a send-ready final answer. Judge the
refined outputs with the same exact `WINNER` / `FINAL_SELECTION` structure.

Stop refining when:

- one pass already produces a clean final answer
- another pass would mostly rephrase instead of improve
- the user requested a fixed budget or fast answer

## PowerShell fallback workflow

If native subagent tools are unavailable, use the bundled orchestrator script.

Skill root:

```text
C:\workspace\dokcer-trpg-remix-app\.codex\skills\codex-spark-consensus
```

Standard run:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass `
  -File "C:\workspace\dokcer-trpg-remix-app\.codex\skills\codex-spark-consensus\scripts\run_consensus.ps1" `
  -Prompt "Create a concise implementation plan. Include risks and verification steps."
```

Useful flags:

```powershell
-Copies 3                    # parallel first-pass candidates, default 3
-Model "gpt-5.6-terra"       # current fallback solver default
-JudgeModel "gpt-5.6-terra"  # defaults to solver model
-RefineRounds 1              # tightening rounds after first winner, default 1
-RefineCopies 3              # parallel refiners per round, default 3
-Workspace "C:\workspace\dokcer-trpg-remix-app"
-TimeoutSec 1800
-OutRoot "C:\workspace\dokcer-trpg-remix-app\.codex\skills\codex-spark-consensus\runs"
```

Use `-PromptFile` instead of `-Prompt` for long or structured instructions.

The fallback script is deliberately candidate-output oriented: workers are told
not to edit workspace files, and Codex runs with a read-only sandbox. For code
changes, apply the selected patch yourself after reading the final selection.

## Return format

When using this skill, return:

1. Whether the consensus run succeeded.
2. Initial winner id and final winner id, if refinement changed it.
3. Why the selected result won.
4. The final selected answer.
5. The run directory or subagent ids so the user can inspect all candidates.
6. Any failed, timed out, or ignored candidates.

Keep the final answer concise. Do not paste every candidate unless the user asks.

## Run directory layout for the script

```text
<run_dir>/
  candidate-01/
    prompt.txt
    output.txt
    status.json
    stderr.txt
    stdout.txt
  candidate-02/
  ...
  judge/
    prompt.txt
    output.txt
    status.json
  refine-round-01/
    refiner-01/
      prompt.txt
      output.txt
      status.json
    judge/
      prompt.txt
      output.txt
      status.json
  final_selection.txt
  summary.json
```

## Notes

- Keep candidate prompts explicit about acceptance criteria and output format.
- Use fewer candidates for routine work and more candidates for judgment-heavy
  work.
- Prefer one strong refinement pass over many low-value rewording passes.
