---
name: codex-delegate-e2e
description: >-
  コーディング・修正・レビューを Codex CLI（codex exec）へ安定的に移譲するためのローカル正本
  （.claude/skills/codex-delegate/ は本スキルへの redirect stub）。
  「Codex に実装させて」「コーディングは Codex に移譲」「Codex にレビューさせて」「修正ラウンドを回して」
  が手がかり。実行契約のコード化（scripts/codex_run.sh: stdin 渡し・timeout・リトライ・
  --output-last-message・--output-schema）・サンドボックス選択（.codex/config.toml の
  danger-full-access / read-only emit 転記 fallback）・バックグラウンド実行と終了コードによる完了判定・
  adversarial レビューループ（review-results への証跡保存・needs-fix → 処方的修正プロンプト →
  再レビュー収束・停止条件）・Claude 側の独立検収（受入再実行・フレーク監査・差分範囲確認）までを
  一気通貫で定める。Codex 委譲が「固まる/エラーになる/不安定」という不具合の切り分け
  （scripts/codex_doctor.sh）にも使う。単発の質問や会話内で完結する調査には使わない。
---

# codex-delegate-e2e — Codex への実装・レビュー移譲のローカル正本

実証セッション: 元プロジェクト（Playwright E2E スイート）の net-impair P1〜P2（2026-07-18。
P2 レビューは round1〜6 needs-fix → round7 で pass 収束）。
このスキルは「Claude が設計・指示・検収、Codex がコーディング・レビュー実行」という分業の運用契約。
**正本は本ファイルのみ**。`.claude/skills/codex-delegate/` は内容を持たない redirect stub とし、
手順や例外を重複させない。

## 30 秒メンタルモデル

1. **Claude が委譲プロンプトを組む**（拘束条件・受入コマンド・コミット可否を全部入りで）
2. **codex exec をバックグラウンド起動**し、証跡を `review-results/<topic>/` に落とす
3. **完了はプロセス終了＋終了コードで判定**（ログ内のマーカー文字列は進捗ヒントに過ぎない）
4. **rc=0 のときだけ Claude が独立検収**（受入再実行・差分範囲確認・フレーク疑い時は反復実行）
5. レビューは **adversarial レビュー → needs-fix → 処方的修正 → 再レビュー**で収束させる（停止条件つき）

## 実行方法（原則: ラッパー scripts/codex_run.sh 経由）

契約を毎回手組みすると、フラグ漏れ（stdin ハング・タイムアウト無し・リトライ無し）や
クォート事故が再発する。**原則ラッパーを使う**:

```bash
topic=discord-refactor-e3   # 値を差し替えてそのまま実行できる形を保つ
case "$topic" in *[!a-z0-9-]*|'') echo "invalid topic: $topic" >&2; exit 2;; esac  # [a-z0-9-] のみ許可
mkdir -p "review-results/$topic"
bash .claude/skills/codex-delegate-e2e/scripts/codex_run.sh \
  --mode review --cd /c/workspace/dokcer-trpg-remix-app \
  --prompt-file "review-results/$topic/prompt-round1.txt" \
  --out-dir "review-results/$topic/run-round1"
```

PowerShell から実行する場合、この端末の `bash` は利用不能な WSL launcher を指すため、
Git Bash を明示する。

```powershell
$gitBash = 'C:\Program Files\Git\bin\bash.exe'
& $gitBash .claude/skills/codex-delegate-e2e/scripts/codex_run.sh `
  --mode review --cd /c/workspace/dokcer-trpg-remix-app `
  --prompt-file review-results/discord-refactor-e3/prompt-round1.txt `
  --out-dir review-results/discord-refactor-e3/run-round1
```

- `--mode review` … `--sandbox read-only` を付与（レビュー・監査・emit 転記）。
  さらに `--output-schema` を**既定で付与**（`references/review_schema.json` をスクリプト位置から
  解決。差し替えは `--schema <path>`、構造化をやめるときだけ `--schema none`。schema 使用時の
  検証には node が必須で、無ければ前提エラーで停止する）。
  この端末では read-only sandbox も**間欠的に 1312 故障**する（Codex は rc=0 で完走するのに
  内部コマンドが全滅し、レビューが「読めなかった」と空振りする）。ラッパーは rc=0 でも
  stderr に故障署名（CreateProcessAsUserW failed / helper_unknown_error）があれば **rc=66 で
  受理拒否**するので、その場合は `--no-sandbox` で再実行する（read-only がプロンプト宣言のみに
  なるためレビュー用途限定）
- `--mode code` … **--sandbox を渡さない**（この端末の workspace-write 恒常故障のため
  `.codex/config.toml` の `danger-full-access` に委ねる。下記 preflight を必ず通す）。
  同一 working tree への**多重 writer は排他 lock で起動拒否**（キーは git の working-tree root。
  サブディレクトリ違いの `--cd` でも同じ repo なら衝突と判定する。**git 管理外の `--cd` は
  code モードでは拒否**＝lock 単位を確定できないため。root 解決時はセッション注入型の
  Git 環境変数（GIT_DIR / GIT_WORK_TREE / GIT_COMMON_DIR / GIT_CONFIG_COUNT /
  GIT_CONFIG_PARAMETERS）を遮断する。global/system config は正当運用（safe.directory 等）に
  必要なため遮断しない。lock は TMPDIR 側なので作業ツリーを汚さない）。
  **lock 競合時の手順（厳守）**: まず `<lock>/pid` の生存を確認する。**pid が生きていれば
  別の正当な writer**（並行セッションの委譲かもしれない）— 消さない・殺さない。由来は
  `<lock>/info`（mode / cd / 開始時刻）と `~/.codex/sessions/` の同時刻 rollout（先頭に
  cwd とプロンプトが記録される）で特定できる。**pid 死亡の残骸のみ**削除して再実行する。
  実例: 2026-07-18 に「残骸」と誤診して生存中の並行 P3 委譲を kill する事故が起きた
  （lock は正しく警告していた）。
  **脅威モデル**: この lock は「うっかり二重起動」防止のアドバイザリ機構でありセキュリティ
  境界ではない — lock を直接消せる呼び出し元は常に回避できるため、敵対的呼び出し元による
  env 細工は脅威モデル外とする。
- 既定: `-m gpt-5.6-sol`・`model_reasoning_effort=xhigh`（`--model` / `--effort` で上書き。
  実装・レビュー = xhigh、軽い確認 = high 以下）
- タイムアウト既定 1800s・TERM→10s 後 KILL。**`timeout`/`gtimeout` が無い環境は前提エラーで停止**
  （黙ってタイムアウト無しに落ちない。無制限は `--timeout 0` の明示のみ）。
  一過性エラー（429/ネットワーク/タイムアウト）のみ指数バックオフ（5s, 10s, 20s, …）で再試行、
  認証・引数エラーは即中断。`events.jsonl` / `last_message.txt`（--output-last-message）/
  `run.log` を out-dir に回収
- プロンプトは `--prompt-file` か stdin で渡す。**二重引用符のインライン引数渡しは禁止**
  （`$(...)`・バッククォート・`$VAR` がローカルシェルで先に展開され、指示の変形や秘密値の
  混入事故になる）
- 長時間の実装ラウンドは、このラッパーごと `run_in_background: true` で起動してよい

### 生 codex exec を使う場合の契約

ラッパーが使えない・挙動を細かく制御したい場合のみ:

```bash
topic=discord-refactor-e3; role=review; n=1   # 値を差し替えてそのまま実行できる形を保つ
case "$topic" in *[!a-z0-9-]*|'') echo "invalid topic: $topic" >&2; exit 2;; esac  # [a-z0-9-] のみ許可
mkdir -p "review-results/$topic"
codex exec -m gpt-5.6-sol -c model_reasoning_effort=xhigh \
  --cd /c/workspace/dokcer-trpg-remix-app \
  --output-last-message "review-results/$topic/last-$role-$n.txt" \
  'プロンプト全文をここにシングルクォートで' \
  < /dev/null > "review-results/$topic/codex-$role-$n.log" 2>&1
```

- **Git Bash から実行する**（PowerShell では `<` が parser error になりそもそも動かない）
- **山括弧プレースホルダ（`<topic>` 等）をコマンドに残さない**（bash はリダイレクトとして解釈する。
  例のように変数に値を入れてから実行する）
- **プロンプトはシングルクォートで囲む**。本文にシングルクォートが必要になったら
  インラインをやめて `--prompt-file`（ラッパー）に切り替える
- **`< /dev/null` 必須**（無いと stdin EOF 待ちでハング）
- **`--cd` はリポジトリルート**（`/c/workspace/dokcer-trpg-remix-app`。TRPG-SERVER など
  サブディレクトリを指定しても lock は同一 repo として衝突判定される）
- **`--dangerously-bypass-approvals-and-sandbox` は使わない**（分類器がブロック）
- **認証情報をインラインに含めない**（sudo パスワード付き ssh 等は分類器がブロック。
  pnpm スクリプト経由で pcs.json から内部解決させる）
- モデル: `gpt-5.6-sol` は CLI 0.144.1 で引数受理を確認済み。他バージョンでは、
  CLI 更新後は `codex_doctor.sh` で疎通を再確認してから委譲する

### preflight（project config が実際に効いているかの確認）

project 側 `.codex/config.toml` は **Codex がその project を trust している場合にのみ読まれる**。
新端末・新 clone では黙って読み飛ばされ、既定 workspace-write に落ちて既知の
`helper_unknown_error / 1312` が再発する。環境が変わったら委譲前に:

1. `target_dir=/c/workspace/dokcer-trpg-remix-app` のように対象を変数へ入れ、
   `bash .claude/skills/codex-delegate-e2e/scripts/codex_doctor.sh --cd "$target_dir"` を実行
   （リポジトリルートから）。診断 5 が code モードと同条件のプローブで
   **実効 sandbox を機械確認**し、`danger-full-access` でなければ ✘（非ゼロ終了）になる。
   ✘ のまま委譲しない。ユーザー config（`~/.codex/config.toml`）の該当 project に
   `trust_level = "trusted"` を設定してから再確認する
2. `codex_run.sh` 側の防御: code モードは trust エントリ未検出で警告し、実行ログに
   `helper_unknown_error / 1312` を検出すると trust 疑いのヒントを出す
   （パス表記差で機械照合が偽陰性になり得るため、確定判定は doctor のプローブに置く）
3. 生 exec（非 json）を使う場合は、ログ先頭の起動ヘッダー `sandbox: danger-full-access` を
   目視確認してから検収に進む

### 秘密情報とログの扱い

- config（shell_environment_policy 等）・環境変数・プロンプトに **credential を平文で置かない**
- raw log は stdout/stderr の全量保存になるため、**環境変数や秘密値を出力し得る診断コマンドを
  プロンプトで指示しない**。混入に気づいたら該当ログを即削除し、キーをローテーションする
- `review-results/` は .gitignore 済み＝ローカル限定・平文。raw log（`codex-*.log` / `run-*/`）は
  topic 収束後 30 日を目安に削除する。清書 `review-*.md` は監査証跡として残し、
  リポジトリに残すべき監査結論は docs/ 配下の設計 doc へ要約を転記する
- ログや清書を端末外へ共有する前に、キー・トークン様の文字列がないか grep で確認する

### fallback: read-only emit 転記方式

full-access が使えない環境では `--sandbox read-only` + stdout emit で全文出力させ、Claude が転記する。

- 区切り: `<<<FILE path bytes=N sha256=H>>>` 〜 `<<<ENDFILE>>>`、最後に `<<<SUMMARY>>>`。
  各ファイルに byte 数と SHA-256 を**宣言させる**
- Claude 側は**全ブロックを受信し検証してから一括転記**する。bytes / sha256 の不一致・
  `<<<ENDFILE>>>` 欠落・途中切断が 1 つでもあれば**一切転記しない**（部分適用禁止）
- 本文に区切り文字列を含むファイル・binary は emit 対象から除外させる。
  実行 bit 等の属性は SUMMARY に列挙させ、転記後に手で付与する
- **path の安全規則**: 転記先は委譲プロンプトで列挙した許可パス集合の中だけ。適用前に正規化し、
  絶対パス・`..`・symlink 経由で workspace 外へ出る宣言が
  1 つでもあれば**全体を拒否**する（部分適用禁止と同じ扱い）
- 実績: net-impair P1（codex-emit.log。当時は bytes/sha256 なしの旧契約）

## 委譲プロンプトに必ず入れる要素

1. **前提**: ブランチ名・HEAD・触ってはいけない範囲（委譲メモの範囲外・無関係な CRLF 差分）・
   自走指示（implement → acceptance → fix → report。commit は明示許可時のみ）
2. **先読みリスト**: 設計 doc・実装設計・規約・ミラーすべき既存パターンのパスを列挙
3. **拘束条件（do not deviate）**: 設計決定を番号付きで。逸脱余地を残さない
4. **受入コマンド**: TRPG-SERVER なら `pnpm run build` / 対象 unit の `pnpm run test` /
   `pnpm run check:circular`（循環依存ゼロが正常）。
   **既知の既存失敗があれば明示**（「直すな・新規失敗を足すな」）
5. **コミット規律**: 既定はコミット禁止。ユーザーが明示的に許可した場合だけ、自分が触ったファイルを
   明示 pathspec で stage し、作業ツリーの無関係な変更を含めない
6. **最終出力形式**: 変更ファイル一覧・受入カウント・コミット有無（許可時のみ hash）・deferred 項目
7. **scratchpad 統制（temp 複製を使わせる場合）**: 「実リポジトリの node_modules を再リンクする操作を
   禁止。複製側での install は実リポジトリから切り離す」を明記する。実害（2026-08-04 #63）:
   変異実測の temp 複製後、実リポジトリの `packages/sheet-engine/node_modules` の junction 4本全部が
   撤去済み temp を指して jest/tsc/build 全停止。Codex 申告は複製内計測の「緑」のまま。
   plain `pnpm install` は "Already up to date" で修復しない（`rm -rf <pkg>/node_modules` →
   `pnpm install --force` が必要）。検収は必ず実リポジトリで suite を再実行して検出する
8. **git 禁止の書き方**: 「git 操作禁止」ではなく「git **変更系**操作禁止（read-only の
   status/diff/log は可）」と書く。前者だと Codex が read-only git を逸脱として自己申告するノイズが出る

## バックグラウンド実行と監視

- `run_in_background: true` で起動する。**完了判定はプロセス終了＋終了コードのみ**
  （ラッパーの rc、生実行ならバックグラウンドタスクの exit code）。
  **rc≠0 なら検収に進まない**。run.log / ログ末尾で原因を特定してから再実行を判断する
- `tokens used` は**終了マーカーとして使わない**（この文字列の後に後続出力が最大 100 行続いた実績・
  1 ログに複数回出た実績がある）。進捗ヒントとしてのみ扱う
- 進捗のマイルストーン監視（任意）は Monitor で:

```bash
tail -f <LOG> | grep -E --line-buffered 'ℹ (pass|fail) [0-9]|no dependency violations|Committed successfully|execution error|stream error'
```

- プロンプトエコーがフィルタに引っかかる初回イベントはノイズ（無視）。完了後 Monitor は TaskStop で畳む
- ログ内の `failed to renew cache TTL` エラーは Codex 内部の無害な警告
- **並列実行の規律**: 同一 working tree に writer（--mode code）は**常に 1 つ**。
  read-only reviewer の同居は可。実装を並列化したい場合は git worktree で分離し、
  run ごとに `--out-dir` を分ける（ログ・last_message の衝突防止）

## レビューループ（adversarial・収束型）

1. **レビューも Codex に**（実装したインスタンスとは別の新規 exec。「You did not write this code」を明記）
2. レビュープロンプト: 契約 doc / 不変条件（INV 番号）を参照させ、**falsifier シナリオ必須**・
   read-only 宣言。**出力は構造化**: review モードなら `references/review_schema.json`
   （verdict + findings。severity=high が blocking 相当）が既定で付く。生 exec で渡すときは
   `--output-schema` に**実在するパス**（リポジトリルートからなら
   `.claude/skills/codex-delegate-e2e/references/review_schema.json`）を指定する
3. **verdict の受理条件: rc=0 かつ last_message.txt が schema 検証を通ったときのみ**。
   ラッパーは「severity=high があるのに verdict=pass」「last_message が空・非 JSON」を rc=65、
   sandbox helper 故障（1312）の疑いを rc=66 で受理拒否する
   （blocking の pass 化・空振り監査の受理をコードで防ぐ）。
   raw log からの `## Verdict` grep は禁止（プロンプトエコー・引用で複数出現し誤判定した実績がある）。
   清書は `review-results/<topic>/review-YYYYMMDD-<topic>-roundN.md` に保存（pass の回も同じ命名で
   保存し、本文に pass と書く。`-pass` 接尾辞などの変形をしない）
4. **修正プロンプトは処方的に**: レビュアが実証した値・手法（プローブ・falsification 手順）を
   そのまま要件化する。closed 項目は「触るな」と明記
5. ラウンドは狭めながら回す: round N+1 は「残存項目の falsification ＋ 直近 diff の新規欠陥スキャンのみ。
   closed 項目を蒸し返さない」
6. **停止条件**: 最大 8 round を上限とする。同一 blocker が 2 round 連続で再出現したら機械ループを
   止めて人間に escalation する（設計判断が割れている兆候）。対応しないと決めた指摘は deferred として
   清書に理由つきで記録して閉じる
7. テスト修正には「**revert したら実際に落ちることの証明**」を要求できる（実績あり）

## Claude 側の独立検収（Codex の自己申告を信じない）

- 受入コマンドを **Claude が再実行**（typecheck / unit / boundaries）
- `git diff --stat` で変更範囲を確認し、コミットが許可された場合だけ `git show --stat` でも
  無関係ファイルの混入を確認する
- Codex 報告と結果が食い違ったら**フレーク監査**: スイートを反復実行して再現率を測る。
  高負荷直後（codex 並列実行の直後）の単発失敗はタイミング依存を疑い、次ラウンドのレビューに
  「時間依存前提の静的洗い出し」を追加する
- 契約準拠のスポットチェック（責務配置・エラーコード・import 規約など）は grep で機械的に

## 関連

- redirect alias: `.claude/skills/codex-delegate/SKILL.md`
- リポジトリ全体の索引: `trpg-architecture` スキル
- 不安定時の診断: `.claude/skills/codex-delegate-e2e/scripts/codex_doctor.sh` →
  `references/troubleshooting.md`、フラグ早見表: `references/flags.md`、
  レビュー構造化出力: `references/review_schema.json`（references はスキルディレクトリ配下）
