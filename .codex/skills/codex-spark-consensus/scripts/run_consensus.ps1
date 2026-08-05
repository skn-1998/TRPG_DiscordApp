param(
    [Parameter(ParameterSetName = "Prompt", Mandatory = $true)]
    [string]$Prompt,

    [Parameter(ParameterSetName = "PromptFile", Mandatory = $true)]
    [string]$PromptFile,

    [ValidateRange(2, 7)]
    [int]$Copies = 3,

    [string]$Model = "gpt-5.6-terra",
    [string]$JudgeModel = "",
    [string]$Workspace = "",
    [string]$OutRoot = "",
    [int]$TimeoutSec = 1800,
    [int]$PollMs = 300,

    [ValidateRange(0, 10)]
    [int]$RefineRounds = 1,

    [ValidateRange(1, 10)]
    [int]$RefineCopies = 3
)

$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text
    )
    [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function Resolve-FullPath {
    param([Parameter(Mandatory = $true)][string]$PathValue)
    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return [System.IO.Path]::GetFullPath($PathValue)
    }
    return [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $PathValue))
}

function Write-Json {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Object
    )
    Write-Utf8NoBom -Path $Path -Text (($Object | ConvertTo-Json -Depth 12) + "`n")
}

function Limit-Text {
    param([string]$Text, [int]$MaxLength = 12000)
    if (-not $Text) {
        return ""
    }
    if ($Text.Length -le $MaxLength) {
        return $Text
    }
    return $Text.Substring(0, $MaxLength) + "`n...[truncated " + ($Text.Length - $MaxLength) + " chars]"
}

function Get-FinalSelection {
    param([string]$Text)
    if (-not $Text) {
        return ""
    }
    if ($Text -match "(?s)FINAL_SELECTION:\s*(.*)$") {
        return $matches[1].Trim()
    }
    return $Text.Trim()
}

function Get-WinnerId {
    param([string]$Text, [string]$PrefixPattern)
    if (-not $Text) {
        return ""
    }
    $pattern = "WINNER:\s*($PrefixPattern-\d{2})"
    if ($Text -match $pattern) {
        return $matches[1]
    }
    return ""
}

function Start-CodexJob {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$PromptText,
        [Parameter(Mandatory = $true)][string]$JobDir,
        [Parameter(Mandatory = $true)][string]$ModelName,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$CodexPath
    )

    New-Item -ItemType Directory -Force -Path $JobDir | Out-Null
    $promptPath = Join-Path $JobDir "prompt.txt"
    $outputPath = Join-Path $JobDir "output.txt"
    $statusPath = Join-Path $JobDir "status.json"
    $stdoutPath = Join-Path $JobDir "stdout.txt"
    $stderrPath = Join-Path $JobDir "stderr.txt"

    Write-Utf8NoBom -Path $promptPath -Text $PromptText

    $args = @(
        "exec",
        "--sandbox", "read-only",
        "--output-last-message", $outputPath,
        "--model", $ModelName,
        "-"
    )

    $status = [ordered]@{
        name = $Name
        status = "starting"
        model = $ModelName
        pid = $null
        started_at = (Get-Date).ToUniversalTime().ToString("o")
        completed_at = $null
        exit_code = $null
        cwd = $WorkingDirectory
        prompt_file = $promptPath
        output_file = $outputPath
        stdout_file = $stdoutPath
        stderr_file = $stderrPath
        status_file = $statusPath
    }
    Write-Json -Path $statusPath -Object $status

    $proc = Start-Process -FilePath $CodexPath `
        -ArgumentList $args `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardInput $promptPath `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath

    $status.pid = $proc.Id
    $status.status = "running"
    Write-Json -Path $statusPath -Object $status

    return [pscustomobject]@{
        name = $Name
        process = $proc
        prompt_file = $promptPath
        output_file = $outputPath
        status_file = $statusPath
        stdout_file = $stdoutPath
        stderr_file = $stderrPath
        status = $status
        done = $false
    }
}

function Wait-CodexJobs {
    param(
        [Parameter(Mandatory = $true)]$Jobs,
        [int]$TimeoutSec = 0,
        [int]$PollMs = 300
    )

    $deadline = if ($TimeoutSec -gt 0) { (Get-Date).ToUniversalTime().AddSeconds($TimeoutSec) } else { $null }

    while ($true) {
        $allDone = $true
        foreach ($job in $Jobs) {
            if ($job.done) {
                continue
            }
            $allDone = $false
            if ($job.process.HasExited) {
                $job.process.WaitForExit()
                $job.status.exit_code = $job.process.ExitCode
                $job.status.completed_at = (Get-Date).ToUniversalTime().ToString("o")
                $job.status.status = if ($job.process.ExitCode -eq 0) { "completed" } else { "failed" }
                $job.done = $true
                Write-Json -Path $job.status_file -Object $job.status
                continue
            }
            if ($deadline -and (Get-Date).ToUniversalTime() -gt $deadline) {
                try {
                    $job.process.Kill($true)
                    $job.process.WaitForExit()
                } catch {
                    # Process may have exited between the check and kill.
                }
                $job.status.status = "timeout"
                $job.status.exit_code = 124
                $job.status.completed_at = (Get-Date).ToUniversalTime().ToString("o")
                $job.done = $true
                Write-Json -Path $job.status_file -Object $job.status
            }
        }
        if ($allDone) {
            break
        }
        Start-Sleep -Milliseconds $PollMs
    }
}

function Read-JobOutput {
    param([Parameter(Mandatory = $true)]$Job)
    if (Test-Path -LiteralPath $Job.output_file) {
        return [System.IO.File]::ReadAllText($Job.output_file, [System.Text.Encoding]::UTF8)
    }
    if (Test-Path -LiteralPath $Job.stdout_file) {
        return [System.IO.File]::ReadAllText($Job.stdout_file, [System.Text.Encoding]::UTF8)
    }
    return ""
}

function Convert-JobsToSummaries {
    param([Parameter(Mandatory = $true)]$Jobs)
    $summaries = @()
    foreach ($job in $Jobs) {
        $summaries += [ordered]@{
            name = $job.name
            status = $job.status.status
            exit_code = $job.status.exit_code
            output_file = $job.output_file
            prompt_file = $job.prompt_file
            status_file = $job.status_file
        }
    }
    return $summaries
}

$CodexCmd = Get-Command codex.cmd -CommandType Application -ErrorAction SilentlyContinue
if (-not $CodexCmd) {
    $CodexCmd = Get-Command codex -CommandType Application -ErrorAction Stop
}
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillRoot = Split-Path -Parent $ScriptRoot
if (-not $OutRoot) {
    $OutRoot = Join-Path $SkillRoot "runs"
}
if (-not $Workspace) {
    $Workspace = (Get-Location).Path
}

$ResolvedWorkspace = Resolve-FullPath $Workspace
$ResolvedOutRoot = Resolve-FullPath $OutRoot
New-Item -ItemType Directory -Force -Path $ResolvedOutRoot | Out-Null

if ($PSCmdlet.ParameterSetName -eq "PromptFile") {
    $ResolvedPromptFile = Resolve-FullPath $PromptFile
    $Prompt = [System.IO.File]::ReadAllText($ResolvedPromptFile, [System.Text.Encoding]::UTF8)
}

$ResolvedJudgeModel = if ([string]::IsNullOrWhiteSpace($JudgeModel)) { $Model } else { $JudgeModel }

$RunId = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$RunDir = Join-Path $ResolvedOutRoot ("{0}-codex-spark-consensus" -f $RunId)
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null

$startAt = (Get-Date).ToUniversalTime()
$candidateJobs = @()

for ($i = 1; $i -le $Copies; $i++) {
    $name = "candidate-{0:d2}" -f $i
    $agentDir = Join-Path $RunDir $name
    $workerPrompt = @"
You are $name in a consensus run. Solve the user request independently.

Important workspace rule:
- Treat this as a candidate-generation pass.
- Do not edit files in the working directory.
- If the user request would normally require code or file changes, return the exact proposed patch, commands, or implementation plan instead.

Task:
$Prompt
"@
    $candidateJobs += Start-CodexJob `
        -Name $name `
        -PromptText $workerPrompt `
        -JobDir $agentDir `
        -ModelName $Model `
        -WorkingDirectory $ResolvedWorkspace `
        -CodexPath $CodexCmd.Source
}

Wait-CodexJobs -Jobs $candidateJobs -TimeoutSec $TimeoutSec -PollMs $PollMs

$completedCandidates = @()
foreach ($job in $candidateJobs) {
    if ($job.status.status -eq "completed") {
        $completedCandidates += [pscustomobject]@{
            name = $job.name
            text = (Read-JobOutput -Job $job)
            output_file = $job.output_file
            status = $job.status.status
            exit_code = $job.status.exit_code
        }
    }
}

$judgeText = ""
$winner = ""
$currentSelection = ""
$judgeJob = $null

if ($completedCandidates.Count -gt 0) {
    $judgeDir = Join-Path $RunDir "judge"
    $judgePrompt = @"
Task:
$Prompt

Select the single best candidate and return your decision in this exact format:
WINNER: candidate-XX
REASONS:
- ...
FINAL_SELECTION:
...

Selection criteria:
- Correctness and factual accuracy
- Completeness against task constraints
- Practicality and next-step clarity
- Risk awareness and edge-case coverage
- Ability to become the final answer with minimal further work

Candidates:
"@

    foreach ($candidate in $completedCandidates) {
        $judgePrompt += "`n`n## " + $candidate.name + "`n"
        $judgePrompt += "Status: " + $candidate.status + "`n"
        $judgePrompt += "Exit code: " + $candidate.exit_code + "`n"
        $judgePrompt += "Candidate output:`n"
        $judgePrompt += (Limit-Text -Text $candidate.text -MaxLength 6000) + "`n"
    }

    $judgeJob = Start-CodexJob `
        -Name "judge" `
        -PromptText $judgePrompt `
        -JobDir $judgeDir `
        -ModelName $ResolvedJudgeModel `
        -WorkingDirectory $ResolvedWorkspace `
        -CodexPath $CodexCmd.Source
    Wait-CodexJobs -Jobs @($judgeJob) -TimeoutSec $TimeoutSec -PollMs $PollMs

    $judgeText = Read-JobOutput -Job $judgeJob
    $winner = Get-WinnerId -Text $judgeText -PrefixPattern "candidate"
    $currentSelection = Get-FinalSelection -Text $judgeText
}

$allCandidateContext = ""
foreach ($candidate in $completedCandidates) {
    $allCandidateContext += "`n`n## " + $candidate.name + "`n"
    $allCandidateContext += (Limit-Text -Text $candidate.text -MaxLength 3000)
}

$refineRoundSummaries = @()
$finalWinner = $winner
$finalJudgeText = $judgeText

for ($round = 1; $round -le $RefineRounds; $round++) {
    if ([string]::IsNullOrWhiteSpace($currentSelection)) {
        break
    }

    $roundName = "refine-round-{0:d2}" -f $round
    $roundDir = Join-Path $RunDir $roundName
    New-Item -ItemType Directory -Force -Path $roundDir | Out-Null

    $refinerJobs = @()
    for ($i = 1; $i -le $RefineCopies; $i++) {
        $name = "refiner-{0:d2}" -f $i
        $refinerDir = Join-Path $roundDir $name
        $refinePrompt = @"
You are $name in refinement round $roundName.

Original task:
$Prompt

Current selected answer:
$currentSelection

Previous judge decision:
$finalJudgeText

Other candidate material that may contain useful ideas:
$(Limit-Text -Text $allCandidateContext -MaxLength 12000)

Improve the selected answer. Preserve correct material, remove weak or speculative material,
incorporate any clearly better ideas from competing candidates, and make the answer ready to send.
Do not edit workspace files. Return only the improved final answer.
"@
        $refinerJobs += Start-CodexJob `
            -Name $name `
            -PromptText $refinePrompt `
            -JobDir $refinerDir `
            -ModelName $Model `
            -WorkingDirectory $ResolvedWorkspace `
            -CodexPath $CodexCmd.Source
    }

    Wait-CodexJobs -Jobs $refinerJobs -TimeoutSec $TimeoutSec -PollMs $PollMs

    $completedRefiners = @()
    foreach ($job in $refinerJobs) {
        if ($job.status.status -eq "completed") {
            $completedRefiners += [pscustomobject]@{
                name = $job.name
                text = (Read-JobOutput -Job $job)
                output_file = $job.output_file
                status = $job.status.status
                exit_code = $job.status.exit_code
            }
        }
    }

    $roundSummary = [ordered]@{
        round = $roundName
        candidates = (Convert-JobsToSummaries -Jobs $refinerJobs)
        completed_count = $completedRefiners.Count
        winner = ""
        judge_output_file = ""
    }

    if ($completedRefiners.Count -eq 0) {
        $refineRoundSummaries += $roundSummary
        break
    }

    $refineJudgeDir = Join-Path $roundDir "judge"
    $refineJudgePrompt = @"
Original task:
$Prompt

Previous selected answer:
$currentSelection

Select the best refined answer and return your decision in this exact format:
WINNER: refiner-XX
REASONS:
- ...
FINAL_SELECTION:
...

Selection criteria:
- Faithfulness to the original task
- Improvement over the previous selected answer
- Completeness, concision, and usability
- No unsupported invention

Refined answers:
"@

    foreach ($candidate in $completedRefiners) {
        $refineJudgePrompt += "`n`n## " + $candidate.name + "`n"
        $refineJudgePrompt += "Status: " + $candidate.status + "`n"
        $refineJudgePrompt += "Exit code: " + $candidate.exit_code + "`n"
        $refineJudgePrompt += "Refined output:`n"
        $refineJudgePrompt += (Limit-Text -Text $candidate.text -MaxLength 6000) + "`n"
    }

    $refineJudgeJob = Start-CodexJob `
        -Name "judge" `
        -PromptText $refineJudgePrompt `
        -JobDir $refineJudgeDir `
        -ModelName $ResolvedJudgeModel `
        -WorkingDirectory $ResolvedWorkspace `
        -CodexPath $CodexCmd.Source
    Wait-CodexJobs -Jobs @($refineJudgeJob) -TimeoutSec $TimeoutSec -PollMs $PollMs

    $refineJudgeText = Read-JobOutput -Job $refineJudgeJob
    $refineWinner = Get-WinnerId -Text $refineJudgeText -PrefixPattern "refiner"
    $refinedSelection = Get-FinalSelection -Text $refineJudgeText

    if (-not [string]::IsNullOrWhiteSpace($refinedSelection)) {
        $currentSelection = $refinedSelection
        $finalJudgeText = $refineJudgeText
        if ($refineWinner) {
            $finalWinner = "$roundName/$refineWinner"
        }
    }

    $roundSummary.winner = $refineWinner
    $roundSummary.judge_output_file = $refineJudgeJob.output_file
    $refineRoundSummaries += $roundSummary
}

$finalSelectionPath = Join-Path $RunDir "final_selection.txt"
Write-Utf8NoBom -Path $finalSelectionPath -Text (($currentSelection | Out-String).Trim() + "`n")

$candidateSummaries = Convert-JobsToSummaries -Jobs $candidateJobs
$summary = [ordered]@{
    run_id = $RunId
    created_at = $startAt.ToString("o")
    completed_at = (Get-Date).ToUniversalTime().ToString("o")
    model = $Model
    judge_model = $ResolvedJudgeModel
    copies = $Copies
    refine_rounds_requested = $RefineRounds
    refine_copies = $RefineCopies
    workspace = $ResolvedWorkspace
    run_dir = $RunDir
    winner = $winner
    final_winner = $finalWinner
    final_selection_file = $finalSelectionPath
    judge_output_file = if ($judgeJob) { $judgeJob.output_file } else { "" }
    candidate_count = $candidateSummaries.Count
    completed_count = $completedCandidates.Count
    candidates = $candidateSummaries
    refine_rounds = $refineRoundSummaries
}

if ($winner) {
    $winnerJob = $candidateJobs | Where-Object { $_.name -eq $winner } | Select-Object -First 1
    if ($winnerJob) {
        $summary.winner_file = $winnerJob.output_file
    }
}

$summaryPath = Join-Path $RunDir "summary.json"
Write-Json -Path $summaryPath -Object $summary

[pscustomobject]@{
    success = [bool]($completedCandidates.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($currentSelection))
    run_dir = $RunDir
    winner = $winner
    final_winner = $finalWinner
    judge_output_file = if ($judgeJob) { $judgeJob.output_file } else { "" }
    final_selection_file = $finalSelectionPath
    summary_file = $summaryPath
    final_selection = $currentSelection
} | ConvertTo-Json -Depth 12
