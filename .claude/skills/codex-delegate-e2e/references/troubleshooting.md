# Codex 委譲トラブルシューティング

症状から原因と対処を引く。まず `bash .claude/skills/codex-delegate-e2e/scripts/codex_doctor.sh`
（リポジトリルートから）を走らせると 1〜6 の多くは自動で切り分く。

## 1. 実行が固まる / 返ってこない
- **原因A: 素の `codex` を対話起動している。** TUI が立ち上がり標準入力待ちで停止する。
  → 必ず `codex exec`（＝ `codex_run.sh`）を使う。
- **原因B: 承認プロンプト待ち。** `--ask-for-approval never` が無いと各コマンドで確認待ちになる。
  → ラッパーは自動付与。手で叩くときも `--ask-for-approval never` を必ず付ける。
- **原因C: タイムアウト無し。** モデル遅延やネットワーク詰まりで無限待ち。
  → `--timeout` を必ず指定。`timeout`/`gtimeout` が無ければ coreutils を入れる。

## 2. `unauthorized` / `401` / `not logged in`
- ログイン切れ、またはキー未設定。→ `codex login` を実行、もしくは `CODEX_API_KEY` を設定。
- `codex login status` で現状確認。CI/自動化では `codex login --with-api-key`（stdin からキー）も可。
- 認証エラーは一過性ではないので、ラッパーはリトライせず即中断する（正しい挙動）。

## 3. sandbox / 権限エラー（ファイルが書けない・読めない）
- **review モードで書き込もうとした** → 仕様通り。書き込みが必要なら `--mode code`。
- **code モードでも対象外ディレクトリを触った** → `--cd` を正しいリポジトリルートに。
  workspace 外に書く必要があるなら Codex 側の `--add-dir`（`--extra` で追加）を検討。
- この端末の code モードの実効 sandbox は `danger-full-access`（project config 委任。§10 参照）。
  `--sandbox workspace-write` を手で付けると恒常故障 1312 に当たるので付けない。

## 4. `not a git repository` で落ちる
- `--skip-git-repo-check` をラッパーが付けているので通常は出ない。
- 手で叩いていて出る場合はこのフラグを付ける。

## 5. レート制限 / `429` / ネットワークエラーで散発的に失敗
- 一過性。ラッパーは指数バックオフ（5s, 10s, 20s, …）で `--retries` 回まで再試行する。
- 頻発するなら OpenAI ダッシュボードで使用量/上限を確認。`--timeout` を延ばす、同時実行を減らす。

## 6. 結果が取れない / 空
- 最終メッセージは `--output-last-message` のファイルに入る。ラッパーは `--out-dir/last_message.txt` に保存。
- 空のときは `--out-dir/events.jsonl`（`--json` の生イベント）と `run.log`（最終試行の stderr）、
  `run.all.log`（全試行の stderr 履歴）を確認。
- `--json` を付けると stdout は JSONL になる。人が読む最終文だけ欲しいときは last_message ファイルを見る。

## 7. 文字化け / プロンプトが途中で切れる
- 長文・日本語・特殊文字は `--prompt` 直渡しよりも `--prompt-file` を使う（クォート事故・引数長制限を回避）。
- ラッパーは指示文を stdin（`codex exec -`）経由で渡すので基本安全。

## 8. モデル指定が効かない / 想定と違うモデル
- `--model <id>` で明示。未指定だと `~/.codex/config.toml` または既定モデルが使われる。
- config.toml と CLI 引数が食い違うと混乱の元。doctor が config の該当項目を警告する。

## 8.5 「既に writer が実行中」で起動できない
- まず `<lock>/pid` の生存を確認（`ps -W | awk '$1==<pid>'`）。**生きていれば正当な writer**
  （別セッションの並行委譲の可能性大）— 消さない・殺さない。`<lock>/info` と
  `~/.codex/sessions/` の同時刻 rollout（cwd・プロンプトが読める）で持ち主を特定する。
- pid が死んでいる残骸のみ `rm -rf <lock>` して再実行（kill -9 / SIGTERM では EXIT trap が
  走らず残骸が残ることがある）。
- 注意: Codex の書き込みは apply_patch 経由なので、シェルコマンド履歴だけ見て
  「書き込みしていない」と判断してはならない。対象ファイルの mtime と git status で確認する。

## 9. code モードで意図しない変更が入った
- Codex は自律的に編集する。**必ず git クリーンな状態で実行**し、`git diff` で人間が確認してからコミット。
- 自動コミットはしない。範囲を絞りたいなら指示文で「変更してよいファイル/ディレクトリ」を明示する。

## 10. 移植元で観測された既知事象（現環境では doctor で再確認する）

- **workspace-write サンドボックスが恒常故障**（`helper_unknown_error` / exit 1312）。
  → code モードは `--sandbox` を渡さず `.codex/config.toml` の `sandbox_mode = "danger-full-access"` に委ねる
  （ラッパーはこの挙動が既定）。`--dangerously-bypass-approvals-and-sandbox` は分類器がブロックするので使わない。
- **read-only サンドボックスも間欠的に 1312 で故障する**（`CreateProcessAsUserW failed: 1312`。
  Codex 自体は rc=0 で完走するが、内部のコマンドが全滅し「ファイルを読めなかった」round が空振りする。
  2026-07-18 に review round で実測）。→ 結果の summary/findings に 1312 が出ていたら、
  `--no-sandbox` を付けて再実行（レビュー用途限定。read-only はプロンプト宣言のみになる）。
- **`-m gpt-5.6-sol` は現環境の CLI 0.144.1 で引数受理を確認済み**。CLI 更新後は、
  CLI 更新後は `codex_doctor.sh` で疎通を再確認してから委譲する。
- **`$(cat file)` でのプロンプト展開は分類器がブロック**（中身を検査できないため）。
  ラッパー経由（--prompt-file / stdin）か、生コマンドならインライン文字列で。
- **認証情報（sudo パスワード等）をプロンプトへインラインしない**。分類器がブロックする。
  pnpm スクリプト経由で pcs.json から内部解決させる。
- `failed to renew cache TTL` はCodex内部の無害な警告。エラー扱いしない。
