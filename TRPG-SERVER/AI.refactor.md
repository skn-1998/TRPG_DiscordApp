# TRPG-SERVER リファクタリング設計メモ

このドキュメントは TRPG-SERVER のリファクタリングに関する調査・方針・進捗を記録する正本。
全体方針の上位は `src/ARCHITECTURE.md`、依存・ドメインは `AI.architecture.md` / `AI.domain.md` を参照。

---

## 2026-07-26 レビュー起点の修正キャンペーン開始（S0/S1/S6 完了・未コミット）

full-review-2026-07-26.md の着手順に沿い、Fable 指揮・Codex 実装・Opus5＋Codex 両輪レビューの小粒度ループで修正を開始した。

- **S0（TI-1）**: `.gitignore` へ `.env.test` 追加＋`git rm --cached` で追跡解除（ローカル残存・ignore 確認済み）。**Atlas ローテーションはユーザー側未実施**
- **S1（DM-1）**: `GET /auth/:userId/User` にメソッド単位 JwtAuthGuard＋self-only（不一致は不在と同一 404・findOne 未呼び出し）＋`toUserOutput` 経由化。フロント利用ゼロを確認済み
- **S6 前倒し（DM-3/DM-4）**: 両例外フィルタに「その他の HttpException → getStatus() 尊重」分岐を追加（401/400 の 500 化解消）。`getHttpExceptionMessage` は `core/http/http-exception-message.ts` に一本化（number 対応込み）。spec の捏造 `getHandler` を production 同等（handler=null）へ是正。`@ApiErrorResponse` メタは本番到達不能である事実を JSDoc 明記（削除は WIP 着地後）
- 検証: 全スイート **210 suites / 2683 tests 全通過**（基準 209/2676 から新規 HTTP spec +1 suite）・循環ゼロ・build 成功。レビュー3ラウンド（round1 needs-fix → round2 両輪 pass → round3 磨き）の証跡は `review-results/dm1-auth-guard/review-20260726-*.md`
- 本スライスの変更ファイル（pathspec コミット用）: `.gitignore`（TRPG-SERVER）/ `.env.test` 追跡解除 / `src/domains/auth/auth.controller.ts`・同 spec・`auth.controller.http.spec.ts`（新規）/ `src/core/http/http-exception.filter.ts`・同 spec・`http-exception-message.ts`（新規）・`api-error-response.decorator.ts`（JSDoc）/ `src/domains/character/character-http.exception.ts`・同 spec
- deferred: `@ApiErrorResponse` 完全削除／~~`GET /auth/:userId/User` 削除検討~~（→ S8 で削除完了・c2a110c）／user.controller.spec の handler=null 是正伝播（WIP 着地時）
- 次: S2（SP-1 Docker 配線＋TI-2 dist 前提解消）→ S3（EV-3）→ 俯瞰レビュー#1

### S2 完了追記（同日）

- **S2（SP-1/TI-2）完了**: Dockerfile 全ステージへ sheet-projection 配線＋「manifest COPY=lockfile 全 importer / install・build・dist=消費側のみ」の規則を両 Dockerfile にコメント明文化（api-contract の manifest COPY 含む）。pnpm フィルタで同期点を削減（install は `--filter trpg-server...` に包含、`ensure:workspace-dist` は `--filter "trpg-server^..." run build` で列挙レス化）。build/test 系全入口に ensure チェーン配線。両パッケージ tsconfig を incremental 化＋テスト出力除外。prod compose への volume 追加はレビューで撤去（dev と実体名衝突＋そもそも不要）
- 検証: dist 削除→build チェーン成功／再削除→全スイート **210 suites・2695 tests 緑**（+12 は並行作業分）・dist に spec 混入ゼロ・循環ゼロ・compose config dev/prod 成功。証跡 `review-results/sp1-deploy-wiring/`
- 変更ファイル（pathspec 用）: `TRPG-SERVER/Dockerfile` / `trpg-remix-app/Dockerfile`（manifest COPY のみ）/ ルート `package.json`（build:projection 等）/ `TRPG-SERVER/package.json`（scripts）/ `packages/sheet-engine/tsconfig.json` / `packages/sheet-projection/tsconfig.json`（docker-compose.prod.yml は最終的に無変更）
- **コミット注意（俯瞰#1 で訂正）**: Dockerfile の api-contract 関連 COPY は、**未追跡の `packages/api-contract/` 一式＋lockfile と同一（または後）のコミット**でなければならない。lockfile だけ同時でも、パッケージ本体が未追跡のままだと COPY 先が存在せずクローン先でコンテナビルド不能（SP-1 再発）。手元の docker build では検出できない
- deferred: docker build 実測（Docker Desktop 起動不可のため保留中）。api-contract の dist spec 混入は並行キャンペーン側で解消済み（申し送り撤回）

### S3 完了追記（同日・俯瞰#1 台帳修正）

- **S3（EV-3）完了**: `event-handler.base.ts` のリトライタイマー内を三層構造（外側 try=execute / 内側 try=終端 logger→DLQ / 理由コメント付き最終ガード）で保護し、unhandled rejection によるプロセス死を封鎖。eslint-disable 理由文更新。spec はコールバック直接捕捉の注入テスト2本（DLQ reject・終端 logger throw）で resolve を明示検証
- レビュー: round1 = Opus pass / Codex needs-fix（catch 内後処理の throw 残存）→ round2 で完全封鎖し close。証跡 `review-results/ev3-retry-rejection/`
- 変更ファイル（pathspec 用）: `src/events/handlers/_shared/event-handler.base.ts`・同 `spec.ts`
- deferred: EV-4/EV-5/EV-16・CL-6 はイベント基盤設計スライスへ

### 俯瞰レビュー#1 完了（同日）

S0〜S3＋前倒し S6 の累積 changeset を Opus5/Codex の両輪で俯瞰検証（どちらも needs-fix → 反映ラウンドで close）。

- **S6b（Codex high 起因）**: フィルタ修正で露出した発生源の誤分類を修正。JWT 検証失敗
  （JsonWebTokenError/TokenExpiredError/NotBeforeError/ヘッダ不正）= 401、Discord OAuth code 交換の 4xx = 400、
  基盤障害のみ 500。`/auth/validate-token`・`/auth/login` の実 HTTP spec 追加。auth.controller の
  死んだ `@ApiErrorResponse` 5 件全撤去＋デコレータを @deprecated 化（user.controller 側は WIP 着地後）
- **磨き**: event-handler の終端 logger/DLQ を独立 try 化（logger 失敗でも DLQ 試行）・dev CMD を `^...` に統一・
  front Dockerfile の冗長 filter 除去・http-exception-message.ts に JSDoc
- 追加変更ファイル（pathspec 用）: `src/domains/auth/token/jwt-token.service.ts`・同 spec /
  `src/domains/auth/services/auth.service.ts`・同 spec（既出: auth.controller 3点・event-handler 2点・core/http 2点・両 Dockerfile）
- 検証: 全量 **210 suites / 2699 tests 緑**・循環ゼロ・compose config 成功（Codex 実測＋Fable 独立再実行）
- 俯瞰の成果: ①合成で露出した深部問題（発生源誤分類）②記録の罠（未追跡パッケージ COPY のコミット順）
  ③新イディオムの反例残置 — いずれも小レビュー単体では検出不能だった。詳細は `review-results/checkpoint-1/`（ローカル）
- 継続 deferred: docker build 実測 / user.controller.spec の handler=null 伝播（WIP 着地時）/
  character 401 封筒 2 形の統一・ErrorResponse 組み立て 12 行重複（低優先）

### S4 完了追記（同日）

- **S4（DM-2/DC-6）完了**: ダイス式の比較演算子黙殺を撤廃（`1d100<=30`→`1d10030` 化けの解消）。
  末尾比較 `A<=N`/`A>=N` を最小サポート（判定は BCDice text の評価済み最終値・legacy total の意味論は維持）、
  その他未対応記法は明示エラー（`UnsupportedDiceNotationError` export・roll-palette handler でもユーザーへ表示）。
  DC-6 は CoC7 正規判定へ（出目1=クリティカル/96-100・100=ファンブル/5分の1・2分の1段階。技能値<1 は最優先失敗）。
  目標値は小数受理＋文字列段階の BigInt 安全整数境界検査。バグ挙動を固定していた spec 群を是正
- レビュー: 3ラウンド（両輪 needs-fix → Opus pass＋Codex high 1 → micro 反映で close）。
  証跡 `review-results/dice-correctness/`（ローカル）
- 変更ファイル（pathspec 用）: `src/domains/dice-roll/services/dice-execution.service.ts`・同 spec /
  `src/discord/services/dice/dice-roll-logic.service.ts`・同 spec /
  `src/discord/features/characterSheet/handlers/roll-palette.handler.ts`・同 spec
- **コミット注意**: dice-roll-logic には PH-6b 由来の palette メソッド（executeCustomDiceRoll 等）が同居しており、
  これは**壊れた HEAD の修復**（HEAD の roll-palette.handler が未コミットメソッドを呼んでいる）。
  palette 系変更と同梱でコミットしないと HEAD 非型検査状態が続く
- deferred: BCDice ネイティブ比較への委譲は M4 bcdice adapter の領分 / performance-dashboard spec の
  高負荷時フレーク（チップ発行済み）

### S5 完了追記（同日）

- **S5（DC-1/DC-3）完了**: post-character のカテゴリ判定を供給実形式 `'GuildCategory'` へ修正（常時404解消・
  矛盾モック是正で「修正前実装なら fail」を保証）。`GUILD_CATEGORY_TYPE` 共有定数＋discord.js 実 enum との境界テストで
  再発防止。create-channel / post-character に ManageChannels 実検査（Administrator/オーナー暗黙包含は
  discord.js 実装で確認済み）。レビューで発覚した**スラッシュコマンド create-dice-channel の同型バイパス**も封鎖
  （default_member_permissions＋実行時 memberPermissions 検査＋falsifier spec）
- 変更ファイル（pathspec 用）: `src/discord/discord.controller.ts`・同 spec / `src/discord/discord-facade.service.ts`・
  同 spec / `src/discord/services/discord-guild-manager.service.ts`・同 spec /
  `src/discord/commands/commands-components/select-game-system.service.ts`・同 spec /
  `src/discord/features/gameSystem/services/select-game-system.orchestrator.ts`・同 spec /
  `src/discord/interfaces/guild-channel-type.constant.ts`（新規）
  ※controller/facade は Controller層完全化 WIP と同居（hunk 分離要）
- **挙動変更の周知**: post-character / create-channel / create-dice-channel は ManageChannels 保持者専用になった
  （従来は 404 or 無認可）。一般プレイヤーへ開くかはプロダクト判断待ち
- deferred → S7 候補（タスク登録済み）: DC-5 permissionOverwrites 検査・parent カテゴリ overwrite 考慮・
  verify 系命名整理・DC-15 拒否理由の観測性
- 証跡: `review-results/discord-authz/`（ローカル）

### 俯瞰レビュー#2 完了（同日・第2群前半の締め）

S4/S5 累積を両輪で俯瞰（Opus pass / Codex needs-fix→反映で close）。実測: 全 210 suites / 2757 tests 緑・循環ゼロ。

- **反映済み**: スラッシュコマンド認可を GuildMember **基底権限**へ（`interaction.memberPermissions` は
  チャンネル overwrite 適用後のため、チャンネル限定付与でギルド全体作成が通る穴があった）。
  verifyGuildManagePermission の DC-15 前倒し（権限不足=403 / 基盤例外=500 の分離）。
  DESIGN.md・AI.discord.md へ ManageChannels 要件と facade 責務を追従
- **新規タスク**: S7-a=M1 post-character 開通先の契約未検証（リスナー競合・Embed 不投稿・応答文言の虚偽）/
  M2 ダイス記法3方言（dice-calculation.service.ts:165 に黙殺＋return 1 の値捏造が残存）＋M3 判定粒度統一＋
  フレーク予防（B-1/B-4）
- **コミット計画の正本**: `review-results/checkpoint-2/review-20260726-checkpoint-2.md`（ローカル）の C-1〜C-10。
  要点: S4 は palette メソッド同梱必須（HEAD 型検査不能の修復）・S5 は WIP REST 契約と hunk 混在のため
  WIP 先行コミor同梱・lockfile を含むコミットは packages/api-contract 一式同梱必須・
  **docs/reviews/full-review-2026-07-26.md（未追跡）を必ず追跡に含める**
- 台帳補正: S5 の select-game-system.service.spec.ts は**新規ファイル**（既存記録の明記漏れを訂正）
- **最優先の提言（Opus）**: 次スライスより先にコミット確定を。HEAD 型検査不能のまま8スライス分が未コミット＝
  最大のリスク集中点

### コミット確定（2026-07-27 未明・キャンペーン分＋WIP チェックポイント）

分離表 C-1〜C-9 に沿って 12 コミットを確定（3a4e47f〜e9f046c）。**HEAD 単体をクリーン worktree で検証し
211 suites / 2765 tests 全緑・build 成功**＝「クローン即動作する HEAD」が成立（従来は spec 先行コミットにより
HEAD 単体は型検査不能／2 suite 失敗の状態だった。aecde34 での再現確認済み）。

- 実行中の教訓: (1) pre-commit hook（prettier 再ステージ）はステージ済みパスのワークツリー版を採用するため、
  部分内容コミットは「一時スワップ→コミット→復元」方式が必要（d92c78a で是正）
  (2) pathspec コミットはワークツリー状態を用いるため staged 削除が消える（f1d1113 で是正）
  (3) api-response.dto.ts は並行 api-contract 作業の変更で C-8c に誤同梱 → e9f046c で前版へ復元
- コミット済みファイルの一部に prettier 整形差がワークツリー側に残る（内容はコミット版が正・無害）
- **未コミットで残置（意図的）**: 並行 api-contract 一式（packages/api-contract・pnpm-lock・zod 移設・
  api-response.dto の型ソース移行・Dockerfile/package.json の api-contract 行・root の contract スクリプト・front）／
  ツール類（scripts/・.agents・.codex・portable-skills・root .gitignore）／ドキュメント WIP
  （AI.development/domain/test・CLAUDE_HANDOFF・README・roadmap 文書ほか）
- 残 deferred: Atlas ローテーション（ユーザー）／docker build 実測（Docker Desktop 起動後）

### S8 / S7-a / S7 完了追記（2026-07-27）

ユーザー決定（post-character=ManageChannels 維持・getUser=削除承認）を受けた続行分。各スライス両輪レビュー＋独立検収済み。

- **S8（c2a110c/66969d0）**: GET /auth/:userId/User を削除（GET /users と完全重複・消費者ゼロ）。
  self-only イディオムと 404 メッセージが各1種に収束。guard の実 HTTP テストは GET /users へ再ホーム
- **S7-a（86e1f15）**: post-character の契約実態化。Embed 実投稿＋実 messageId＋虚偽応答廃止。
  リスナー競合は**決定的 suppression**（作成直後マーク→emit 直前照合・TTL60s・マイクロタスク順序保証）で封鎖
  — Codex の決定打「channelCreate は create() 解決前に同期 emit」により audit log 方式を棄却した経緯を清書に記録
- **S7（1bd75e0）**: DC-5 解消＋認可モデル確定。overwrite は型付き検証（allow 6種・deny は Administrator 以外）＋
  **caller-holds**（overwrite 指定時は ManageRoles＋各指定権限の保持を要求＝Discord ネイティブ準拠。
  confused deputy を allow/deny 両方向で封鎖）。**DC-2 を前倒し解消**（DiscordController にクラスレベル
  ValidationPipe。EmbedDto へ標準フィールド宣言し whitelist の無言 strip も解消）。DC-15 観測性同梱
- 検証: 全量 **212 suites / 2889 tests 緑**・循環ゼロ。証跡 `review-results/{auth-getuser-removal,post-character-contract,discord-perms}/`
- deferred: discordChannelId unique index / 孤児チャンネルのロールバック / カテゴリ定義2ルール /
  create-character-thread の無認可（意図的・リソース種別が別）/ M2/M3（タスク #13）
- 残: 第2群 CE-3→SP-3→SP-2→CE-1 → 俯瞰#3

### CE-3 完了追記（2026-07-27・4c582e9）

characterEdit 編集エラーの到達不能回復パス（handleServiceError=必ず throw の後に書かれた通知が dead code）を
2ラウンドで解消。round1 は 3 サービスの「通知先行→handleServiceError 後置」再構成＋spec 実挙動化（Opus/Codex 両輪 pass）、
round2（CE-3b）は両レビューの Should/medium 反映＝通知規則の一本化。

- **通知規則の正本**: `src/discord/utils/interaction-error-response.util.ts` の `respondEphemeralError` —
  replied→followUp(ephemeral) / deferred→editReply（既定。deferUpdate 由来で公開 embed を守る場合のみ
  `deferredStrategy: 'followUp'`）/ 未応答→reply(ephemeral)。util は no-catch・no-log（失敗処理は呼び出し元の責務）
- ErrorHandler.handleDiscordError も同 util へ統一（旧 deferred→followUp は placeholder 未解消の劣った規則のため置換）。
  message-updater の channel.send は「interaction 応答でなく共有 embed の復旧」という**意図的例外**として明文化＋二重送信なしを spec 固定
- 同型バグ2件を同時解消: refresh 経路の最終無応答（最後の砦 followUp）・character-thread.orchestrator の dead 通知
- modal-handler の private 複製を CharacterEditMessageUpdaterService の DI 利用へ置換（provider は HEAD 既登録を検証済み）
- 検証: 全量 **214 suites / 2912 tests 緑**・循環ゼロ（独立再実行）。証跡 `review-results/characteredit-error-paths/`
- 俯瞰#3 への持ち越し観点: handleDiscordError が core/http にあり core→discord/utils import が発生
  （循環はないが層方向が逆。discord 層への移設を俯瞰で判断）

### 俯瞰レビュー#3（2026-07-27・e9f046c..4c582e9 の累積5コミット）

Opus **needs-fix**（high 1）/ Codex **pass**（medium 4）。大域診断は「宣言した規則が支配領域の一部にしか
適用されていない」未完形の反復（通知規則・DTO 検証・認可の3層）。清書: `review-results/overview-3/review-20260727-overview-3.md`

- **確定 high（両輪一致・Fable 裏取り済み）**: `handleDiscordCommandError` が通知一本化から取り残され、
  コンテキストメニューコマンドのエラーが完全無通知（live 経路あり）。→ OV3 スライスで討議済み処方
  （discord 層への移設＝core→discord 層逆転の同時解消・respondEphemeralError 化・同型劣化 catch 2件も置換）
- Codex 新所見: guild-manager の **ManageRoles 二重ゲート**（基底 AND 実効）が設計記述と乖離 →
  裁定「意図的過剰制限として明文化＋欠落テスト」（挙動不変。緩和は一方向に安全なため将来判断）
- Fable 実施済み（文書正本）: AI.discord.md へ suppression 契約・通知規則・認可非対称の3節 /
  DESIGN.md の caller-holds 判定粒度を正確化 / full-review-2026-07-26.md へ解消済み Must 追記 /
  本書の陳腐化 deferred 消し込み
- **Docker build 実測（保留分消化）**: server 像は**クリーン HEAD で成功**。remix 像は Docker VM の
  **OOM（vite build が SIGKILL）で失敗** — ネイティブ 13s 緑のため HEAD 内容は健全・環境問題と確定。
  対処候補: ユーザーの Docker Desktop メモリ増枠 or Dockerfile へ NODE_OPTIONS（別スライス判断）
- コミット分離棚卸し: キャンペーン由来の未コミット実差分ゼロ（M 表示は CRLF phantom のみ）
- 台帳送り: F4 create-dice-channel 認可統一（中期）/ F5 components・fields any[] 無検証 /
  characterThread handlers の raw error.message 露出方針 / character-ui.service 死蔵削除（第5群）/
  F9 挙動ドリフト記録 / F11 spec 実装詳細結合3種 / F12 ChannelDetectionService 責務肥大＋マーク残留 /
  suppression の構造的保証・channelId 冪等ガード

### OV3 反映完了（2026-07-27・5308bfc）

俯瞰#3 の所見を2ラウンドで反映。**両輪レビューとも独立に同じ high 2件へ収束**し、round2（OV3-b）で解消。

- **OV3 round1**: `ErrorHandler.handleDiscord*` を discord 層（`utils/discord-error-reporter.ts`）へ移設し
  **core/http → discord の import をゼロ化**（層逆転の解消）。`handleDiscordCommandError` の
  `isChatInputCommand()` ガード撤去でコンテキストメニューコマンドの**完全無通知**を解消。
  commands.service / command-manager の劣化規則も統一。suppression 順序不変条件・TTL 根拠・
  開示ゲート意図・ManageRoles 二重ゲート理由をコメント化＋欠落テスト追加
- **OV3-b（両輪 high 2件）**:
  (1) `@Headers()` DTO にクラスレベル whitelist が効き、Nest が小文字化した実ヘッダを strip → **validate-token が
  全リクエスト 400** になる退行。pipe を `@Post('login')` 限定へ。実 HTTP spec 2 ケースで 401 を固定
  （従来 validate-token の実 HTTP spec が無く、退行が suite に映らなかった）
  (2) interactions の最後の砦が `editReply` 既定のため、**deferUpdate 由来の公開 embed をエラー文言で破壊**
  （OV3 前の「沈黙」を「破壊」に変えていた）。`deferredStrategy: 'followUp'` に固定
  ＋ Opus medium: 追加 auth spec が空振り（手動ガードでも 400／`app.init()` 後の spy は非束縛）→ ボディ判別へ是正
- 検証: 全量 **215 suites / 2921 tests 緑**・循環ゼロ・`core/http → discord` import **0件**（独立再実行）
- **コミット分離**: auth.controller.ts / spec は並行 api-contract 変更（`LoginDataWire` import 等）が同居していたため
  **swap-restore 方式**で OV3 分のみを合成コミット（HEAD に api-contract 依存ゼロを git grep で確認済み）
- 証跡: `review-results/overview-3/`

### SP-3 完了追記（2026-07-27・d53a16d）

未紐付けキャラ（from-template 由来・`discordChannelId: ''`）の hub 無音劣化を4ラウンドで封鎖。
**述語は1箇所・適用点は3層**という構造に収束。清書: `review-results/sp3-hub-channel-binding/review-20260727-sp3-rounds.md`

- 述語の正本: `characterThread/services/character-channel-binding.util.ts` の
  `isMaterializedWithoutChannel`（＋拒否文言定数）。適用点は
  **L1** ユーザー可視ゲート（`handleThreadCreationSelection` の権限確認後・進捗表示と emit の前）/
  **L2** 副作用直前（`ThreadOrchestrator` の `threadManager.createCharacterThread` 直前・warn）/
  **L3** 別 customId 経路（`ThreadCreationService`）
- postHub は CAS を publishing へ進める**前**に拒否。projection warnings を `code@path` で dedup し
  先頭10件＋残数・総数/ユニーク数を併記して可視化
- **round1 の high（両輪が割れ、Opus が正）**: ガードを `ThreadCreationService` に置いたが、
  実運用の `/character-thread` はそこを通らず素通り。観測結果を「劣化 hub」から
  「空スレッド＋無通知」へ**悪化**させていた。round2 で3層へ再設計し両輪 pass
- **プロセス是正**: 到達可能性が絡むレビューでは**両レビュアに同一の探索指示**を与える
  （round1 は Codex に「対象4ファイル」と範囲を限定したため見落とし、Opus のみ検出した）
- **Codex 委譲の定型指示に追加**: 「他モデルへの内部委譲を行わず Codex が直接実装」
  （実行環境が内部で Claude Fable へ再委譲し、その利用上限で中断する事象が2度発生）
- 検証: build 成功・全量 **217 suites / 2939 tests 緑**・循環ゼロ（独立再実行）
- deferred: `HubThreadEventListener` の30秒 poll と誤解を招く ERROR（L2 発火時のみ顕在化・現状到達不能）/
  `hub-refresh.worker` の warnings 未消費（高頻度のため抑制設計が必要）/
  `hub-publication` の判定は空文字のみ（非空の不正 snowflake は warnings 可視化に委ねる旨コメント済み）/
  `CreateThreadResult.error` がユーザー向け日本語と英語診断文字列を混載 /
  `postHub` のログ整形17行の抽出

### M2/M3 完了追記（2026-07-28・6ラウンド）

ダイスの**値の捏造**と**成功判定規則の分裂**を解消。証跡: `review-results/m2m3-dice-unification/`

#### 除去した捏造は5層あった

| 層  | 内容                                                                                               | 検出                              |
| --- | -------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | `evaluateFormula` の `return 1`                                                                    | 当初の所見（S4 の方針の適用漏れ） |
| 2   | `parseInt('10+5')` → **10** の切り詰め                                                             | Opus                              |
| 3   | 割合規則が**恒真**（呼び出し側が合計を渡すため常に ✨）                                            | Opus                              |
| 4   | サニタイズが**文字削除**（`2d6`→`26` / `STR×2-1`(15)→**151**）                                     | Codex                             |
| 5   | 不正 `targetValue`（`1/0`・`0.5` 倍・`0`・負数）が `success:true` ／ キャラ値未解決時の **0 捏造** | 両輪一致                          |

いずれも「入力と無関係な値を正当な結果として返す」同一クラスで、**1つ剥がすと次が露出**する構造だった。

#### 判定規則は「経路」ではなく「データ」で決める形へ

`custom-dice-modal.service.ts` が `isParameterBased`（customId の綴り）で
2つの矛盾する成功規則を切り替えていた（成功個数の割合 vs `result < 5` / `> 95`）。
**割合規則は撤去**（`targetValue` はダイス個数であり成功閾値ではなく、この入口に有効な閾値が存在しないため）。
判定は BCDice のフラグのみとし、フラグが無ければ 🎲。
`dice-roll-logic.service.ts` の CoC7 判定は**統合せず境界を明示**（双方向の JSDoc 相互参照）。

- **撤去に実害なし**（両輪一致で確認）: 撤去前の表示は「常に✨」（恒真）か、
  CoC 閾値を任意記法に適用する三重の誤り。`CC` 系判定は `/roll-dice` が別途表示する

#### 副次的に解消したバグ

キャラ値参照が `parameter['STR']` 固定だったため、**materialized データ（`parameter.str` 小文字）と
`status.hp`/`status.mp` が常に 0** になっていた。
`parameter → status → skill` のセクション横断＋キー正規化（NFKC・小文字化・記号除去）＋
`AttributeValue.name` 照合で解決し、**未解決は拒否**（0 にしない）。

#### 本スライスが作った問題を同スライスで回収（round6）

- `dodge` の機能後退（round4 が `'回避'` キー照合のみにしたため `skill.dodge` 形式が解決不能に）
- `values` を持たない属性（dice型/text型）が 0 で確定し後続セクションを遮蔽
- `9**9` → **3.8億個**のダイスが BCDice へ渡る経路（round2 で切り詰めを外した結果、
  べき乗が正しく評価されるようになり新たに到達可能に）→ `MAX_DICE_COUNT = 100` を両入口で共有
- `parseNumberInput` の `parseFloat` 切り詰め（`'2abc'`→2）＝ round2 と同型が乗数側に残存
- 未使用の multiplier/modifier フィールドが custom modal に残り `0.5` を案内していた → フィールドごと削除

- 検証: build 成功・全量 **224 suites / 3091 tests 緑**・循環ゼロ（独立再実行）
- 台帳送り: 正規化衝突（`S-TR` と `STR` が同じ `str` に潰れ**挿入順で先勝ち**）/
  `dice-calculation.service.ts` の**責務過多**（254行に式評価・キャラ値解決・BCDice 実行・
  絵文字表現・Discord 送信の5責務。捏造が5層堆積した背景）→ 第4群で分割を検討 /
  README への受理契約追記 / セクション重複時の優先順位 spec

### 第3群-a: APP_PIPE 一本化（2026-07-28・round1〜round5b）

バリデーション適用が controller ごとに **4 パターンへ分裂**していた状態を APP_PIPE 1 パターンへ畳んだ。
証跡: `review-results/g3-global-pipe-filter/` ／ **コミット: `7b9f3d9`（24ファイル）**

**コミット単体の隔離実測**（作業ツリーには並行 api-contract セッションの差分が同居しているため、
`git worktree` で `7b9f3d9` を単独チェックアウトして測定）:
build 成功・**226 suites / 3105 tests 緑**・madge 循環ゼロ。
作業ツリーの 3110 との差5件は、並行セッションが `character.controller.http.spec.ts` に追加した
コミット対象外のテスト。**コミット対象外ファイルへの依存が無いことを論証ではなく実測で確認した**。

**コミットから意図的に外したもの**: `character.controller.http.spec.ts` と `character.integration.spec.ts` の
`APP_VALIDATION_PIPE_PROVIDER` 追加（各2行）。並行セッションの変更が同居しており hunk 抽出が競合するため。
両ファイルの HEAD 版は pipe 依存ゼロ（400 assert も `ValidationPipe` 参照も無し）で、
`character.integration.spec.ts` は `jest.config.js` の `testPathIgnorePatterns` で通常 run から除外されている。
→ **この2行は並行セッションのコミットと一緒に入る見込み。入ったら忠実性が揃う**

#### round1 の失敗と撤回

user だけ `forbidNonWhitelisted: true`（未知 body 項目を 400）を持っていたため、
これを保つべく **guard をバリデータに転用**する回避策を採った。
Codex は「動作としては正しい」と pass 判定（body-parser は routing 前の middleware なので
guard 時点で `request.body` は解析済み、guard は class→method 順で `JwtAuthGuard` の後、例外も同じ filter に届く）。
**動作の正しさは争点ではなかった**。Opus の指摘を採用して round2 で全撤回:

- スライスの目的（4→1）に対し **5つ目のより特殊なパターン**（guard をバリデータに転用）を新設していた
- 区別要素の `forbidNonWhitelisted` が**永久に発火しない死んだ設定**になり、
  読者が「strict はこの class pipe が担保」と誤読 →「guard は冗長」と消して 400 契約が黙って消える事故に直結
- `new ForbidUnknownUserBodyFieldsGuard(CreateUserProfileDto)` は `@Body() profile: CreateUserProfileDto` と
  **型の対応がコンパイラに保証されない二重宣言**
- POST /users で class-validator が **3回**走る

#### 採用した代替: 挙動変更を受け入れる

user の `forbidNonWhitelisted` を**諦め**、未知フィールドは他 controller と同じく **strip**（400 → strip）。
根拠はフロントが `/users` を **GET しか呼んでいない**こと（`root.tsx` / `utils/auth-guards.ts` /
`features/auth/api/auth.service.ts` / `features/discord/api/discord.service.ts`）で、
POST/PUT の実消費者はフロントにも e2e にも存在しない。
mass assignment は controller の**明示再構成**が塞ぐ（POST は `discordUserId` を JWT から、
PUT は `name`/`avatarHash` のみ選択構築）。
再厳格化が必要になったら `@StrictBody()` メタデータ＋APP_PIPE の `useClass` 方式で pipe の責務として実装する旨を
`user.controller.ts` にコメントで残した。**`AI.domain.md` の 400 契約記述も同時に更新**（更新漏れは round3 の high として検出された）。

#### validate-token の header DTO 撤去と OV3-b の非再発根拠

第3群-a の production 変更には `@UsePipes` 撤去と user の `forbidNonWhitelisted` 廃止だけでなく、
`auth.controller.ts` の `@Headers() headers: ValidateTokenHeaderDto` を
`@Headers('authorization') authorization?: string` へ変更したこと、および
`dto/discord-login.dto.ts` から `ValidateTokenHeaderDto` class を撤去したことも含む。

OV3-b で high とした validate-token の全リクエスト 400 は、現在の構成では次の三重の根拠で再発を防いでいる:

- 現行 Nest v11 の `RouterExecutionContext.isPipeable`
  （`node_modules/@nestjs/core/router/router-execution-context.js:127-135`）が pipe 対象にするのは
  BODY / RAW_BODY / QUERY / PARAM / FILE / FILES / string で、HEADERS は含まれない
- 現在の `validateToken` は header DTO を持たず、`@Headers('authorization')` の string 引数なので
  検証対象の metatype 自体がない
- `auth.controller.http.spec.ts` の validate-token 2ケースが、APP_PIPE 登録下でも
  整形式 Bearer の無効 JWT と Authorization 欠落をどちらも 400 ではなく 401 に固定している

なお、OV3-b に記録した「クラスレベル whitelist が `@Headers()` DTO の実ヘッダを strip した」という機構は、
現行 Nest v11 の `isPipeable` 実装とは整合しない。
当時の分析が誤っていた可能性がある。
当時利用していた Nest 版を再検証したわけではないため過去時点までは断定しないが、少なくとも現行実装では
HEADERS は pipe を通らない。

#### 「spec が検証した設定 ≠ 実際に適用される設定」が3箇所で再発していた

本スライスが撲滅対象にした欠陥そのものが、スライス内で繰り返し発生した:

| 箇所                                           | 内容                                                                                                   | 検出                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------- |
| `DISCORD_VALIDATION_PIPE_OPTIONS`              | 適用元が app.module へ移った後も同じ値を独立に再定義。app.module だけ変えても DTO spec は旧設定で緑    | Codex                        |
| `user-profile.dto.spec.ts`                     | 本番に**存在しない** `forbidNonWhitelisted` で pipe を組み、実 HTTP 境界では起きない 400 を assert     | Opus                         |
| `auth.controller.http.spec.ts` の strip テスト | 名前は「APP_PIPE により strip」だが、controller の**明示再構成**だけで成立し、`whitelist` を外しても緑 | Fable（round3 準備中に発見） |

いずれも「緑だが、緑の理由が主張と違う」型。round3 で共有 options の import へ統一し、
`user-profile.dto.spec.ts` の assert を「拒否する」から「除去する」へ変更した。
round4 では `auth.controller.http.spec.ts` を単独因果を名乗らない
「APP_PIPE の strip と controller の明示再構成の二重防御」へ改名した。
明示再構成の単独因果は `user.controller.spec.ts` の POST/PUT 直接呼び出し spec、HTTP 境界での whitelist の
単独因果は `character-sheet-http-validation.spec.ts` の nested DTO HTTP test が担う。
この HTTP test は round5 で `non-finite-formula-save.reproduction.spec.ts` から移設し、移設元を
「非有限式の保存失敗を再現する」責務へ戻した。両 spec と `auth.controller.http.spec.ts` には逆リンクを残している。

#### whitelist はどこで固定されているか（実測）

**独立スクリプトで実測**: 本番 options では4項目すべて strip、`whitelist: true` を外すと
**4項目すべて RETAINED** になり `user-profile.dto.spec.ts` の assert が落ちる。
→ **whitelist の strip 挙動は DTO/pipe レベルで behavioral に固定**されている。
HTTP 境界で実際に nested unknown key が strip される behavioral な事実は
`character-sheet-http-validation.spec.ts` が固定する。

`app.module.spec.ts` が固定するのは次の **metadata / source 事実**であり、HTTP strip の behavioral test ではない:

- production module graph 全体で `APP_PIPE` provider が `APP_VALIDATION_PIPE_PROVIDER` 1本だけである
- options が `{ transform: true, whitelist: true }` と厳密一致する
- Promise import の先にだけある `ConfigService` の factory provider が存在し、非同期走査が await されている
- 到達可能な controller 名が **全10件で厳密一致**する（収集0件のまま否定検査が緑になる事故も防ぐ）
- `MetadataScanner.getAllMethodNames()` で prototype chain を辿った継承 method を含め、
  method 収集が非空かつ `AuthController.login` を含み、controller class / method の local pipe が0件である
- `ROUTE_ARGS_METADATA` 上の対象収集が非空で、パラメータ級 pipe が0件である
- `main.ts` のソースに `useGlobalPipes` がなく、bootstrap で第2の global pipeを登録していない

`@UsePipes` を実際に剥がしたのは **6 controller**（class-level 5件、`AuthController.login` の method-level 1件）で、
pipe 不在を検査する対象10件とは別の数である。
検査側は `DynamicModule` の metadata 直書き系と
`DynamicModule.module` class metadata 系の両方、その imports/controllers を解決し、循環・重複は visited set で停止する。
`forwardRef()` の解決分岐も持つが、現 production graph は0件で、実経路・変異確認ともに未検証の防御コードである。

round5 の同期走査は Promise import を扱えず不完全だった。実際に `AppConfigModule` は
`Promise<DynamicModule>` を返す `NestConfigModule.forRoot()` を imports に持つ。
round5b で収集を `beforeAll` 内の非同期処理へ変更し、PromiseLike 自体を visited に登録してから await し、
解決後の module も通常どおり visited 判定・走査するようにした。local pipe とパラメータ級 pipe の検査は
同期 `it.each` から違反 label 配列の集約 assert へ変更したため、違反時は
`['AuthController.login']` のように対象を直接表示する。

HTTP 境界の behavioral test は `character-sheet-http-validation.spec.ts` に置く。
`PUT /character/:id/sheet` の `changes[0]` とその nested `path` に未知キーを混ぜ、
controller が `changes: dto.changes` を素通しする経路で use case mock への到達前に両方 strip されることを固定する。

`test/test-app.module.ts` にも APP_PIPE provider を追加したが、`TestAppModule` の参照元はゼロで
`*.e2e-spec.ts` も0本のため、現状はデッドな e2e 準備コードでありテストカバレッジには含まれない。

- round3 検証（Fable 独立再実行）: build 成功・全量 **225 suites / 3111 tests 緑**・madge 循環ゼロ・
  `@UsePipes` production 残存 **0**
- round4 検証（Codex 直接実行）: build 成功・focused **5 suites / 117 tests 緑**・
  全量 **225 suites / 3171 tests 緑**・madge **582 files / 循環ゼロ**。
  class-level、method-level、whitelist、APP_PIPE provider の4変異はいずれも狙った spec が赤になり、
  production 4ファイルは開始時の SHA-256 と一致する状態へ復元した。
- round5b 検証（Codex 直接実行）: build 成功、focused **6 suites / 55 tests 緑**、
  全量 **226 suites / 3109 tests 緑**、madge **583 files / 循環ゼロ**。
  round4 → round5b の **62 tests 減**は削除退行ではなく、`it.each` の66ケースを集約 assert 2本へ
  置き換えた表現変更（-64）と同区間の追加検査を相殺した数値。
  suite の **+1** は新規
  `character-sheet-http-validation.spec.ts` による。
  class-level、method-level、whitelist、APP_PIPE provider 削除、別 module の2本目 APP_PIPE、
  parameter pipe、`main.ts` の `useGlobalPipes` の7変異は、すべて狙った test が赤になった。
  各変異を復元後、production 6ファイルの SHA-256 は round5b 開始時と一致した。
- a6 最終仕上げ（Codex 直接実行）: build 成功、focused **3 suites / 15 tests 緑**、
  全量 **226 suites / 3110 tests 緑**、madge **583 files / 循環ゼロ**。
  PromiseLike の await 削除、controller method 収集の空配列化、parameter metadata 収集の空配列化の
  3変異はいずれも追加した assert が赤になった。
  各変異後に `app.module.spec.ts` を復元し、
  開始時の SHA-256 と一致することを確認した。
  production 変更はない。

#### 残る検出漏れ

本検査には次の限界が残る。
完全な収集0件は本ラウンドの非空性 assert で赤になるが、部分的な欠落までは検出しない:

- `main.ts` 以外の bootstrap ファイルからの `useGlobalPipes`
- computed property、文字列分割、別名呼び出し等で `main.ts` のソース文字列検査を回避する登録
- module graph または metadata を runtime に後付けする処理
- 期待名と同名の別 controller class への差し替え
- controller 以外の gateway、resolver、microservice handler に付いた local pipe
- Nest 側の変更で `MetadataScanner.getAllMethodNames()` が全件空を返す場合は非空性と
  `AuthController.login` 包含 assert が検出するが、代表 method を残した部分的な欠落は検出しない
- Nest upgrade で `ROUTE_ARGS_METADATA` の格納先が全面変更された場合は非空性 assert が検出するが、
  旧格納先に1件以上残る段階的・部分的な変更は検出しない
- `forwardRef()` 分岐は現 production graph に対象がなく、実経路・変異ともに未検証

#### 第3群-a の作業中に発見した別件（第4群／第5群へ送る）

`loadJsonFile` が **2実装あり、失敗時の意味論が正反対**:

| 実装                                  | パス解決       | 失敗時                            |
| ------------------------------------- | -------------- | --------------------------------- |
| `src/discord/utils/file.util.ts:9`    | `path.resolve` | **throw**（型付き `<T>`）         |
| `src/discord/utils/loadJsonFile.ts:7` | 生パス         | **握り潰して `undefined` を返す** |

production の2箇所 — `src/discord/features/diceRoll/utils/channel-topic.util.ts:6` と
`src/discord/features/gameSystem/services/select-game-system.orchestrator.ts:21` — は
**握り潰す方**を、しかも `'src/discord/static/gameSystemList.json'` という **cwd 相対パス**で
**module load 時**に呼んでいる。
→ TRPG-SERVER 以外を cwd としてプロセスを起動すると `gameSystemList` が**黙って `undefined`** になり、
消費側で原因から遠い TypeError か空リストとして現れる（本キャンペーンが繰り返し見つけている無音劣化と同型）。
**訂正（俯瞰#5 2026-07-28）**: 当初ここに「握り潰す方の挙動は spec に固定されていない」と記載したが誤り。
`loadJsonFile.spec.ts`（2026-06-02 追加）が握り潰し挙動を固定済み。真のリスクは cwd ではなく
**production イメージに `src/` が無い**こと（Dockerfile は dist のみ COPY）— 俯瞰#5 OV5-2 参照。

第4群（重複の一本化）または第5群（死蔵一掃）で扱う。**第3群-a ではスコープを広げず記録のみ**。

#### 第3群-b（APP_FILTER）の事前調査

pipe と違い **filter は 3 分裂しており、うち 2 つは互いに異なる filter**:

| controller                                                                                          | filter                                                                                                          |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| AuthController / UserController                                                                     | `HttpExceptionFilter`                                                                                           |
| CharacterController                                                                                 | `CharacterHttpExceptionFilter`（`@Catch()` 全捕捉・errorCode 付き envelope を保存するため意図的に非グローバル） |
| **AppController / DiscordController / CharacterSheetTemplateController / CharacterSheetController** | **なし**（Nest 既定の error body）                                                                              |

**グローバル化はフロント可視の変更になる**。フロントが呼ぶ 6 経路のうち
`POST /character/from-template` は **CharacterSheetController（filter なし）**にあり、
`PUT /character/:id/sheet` も同じ controller。

ただし**壊れはしない**: フロントの `ApiResponseUtil.handleError`（`trpg-remix-app/app/lib/api-response.util.ts`）は
両形状を処理する。envelope（`success:false` かつ `error` が string）なら `error` を、
Nest 既定（`{statusCode, message}`）なら `message`（配列なら join）を返す。
→ 変更の実体は「**ユーザーに出るメッセージの出所が `message` から `error` へ切り替わる**」こと。
バリデーションエラーでは Nest 既定が個別メッセージの配列を返すのに対し envelope は単一文字列になるため、
**メッセージの粒度が落ちる**可能性がある。第3群-b では経路ごとに新旧メッセージを実測して比較すること。

`CharacterHttpExceptionFilter` は controller スコープの `@Catch()` なので、
APP_FILTER を足しても character 経路の解決順（method → controller → global）により挙動は保存される。

**追記（2026-07-28・第3群-b 着手時）**: 事前調査の後に並行セッションが `ebd23ea` を積み、
前提が1つ変わった。sheet 系 service（`character-sheet-operation.service.ts` /
`sheet-materializer.service.ts` / `track-range.policy.ts`）は `UnprocessableEntityException` に
**構造化 object body**（`{statusCode: 422, error, message, issues[]}`）を渡して throw し、
filter なしの CharacterSheetController では Nest 既定フィルタが**その object をそのまま返す**。
`issues[]` の fieldUid / path は `ebd23ea` が byte 予算付きで「切り詰めない」と明示した契約。
→ 現行実装のままの `HttpExceptionFilter` を APP_FILTER 化すると、`getHttpExceptionMessage` が
object body を `message` 抽出で平坦化し **`issues[]` が消える**。第3群-b の設計は
この封筒の保存を制約に含めること（案の比較は本節の実測調査結果を参照）。

#### 方法論の失敗（記録）

- **rc=2 の二義性**: `codex_run.sh` は「writer-lock busy」と「prompt-file 不在」を**同じ rc=2** で返す。
  相対パスの `cat >` が cwd 外で失敗しプロンプトが生成されなかった際、
  リトライループがそれを**ロック待ちと誤認して 11 回空回り**した。→ **プロンプト生成もパスも常に絶対パス**にする
- **並行セッションとのファイル衝突**: 並行 api-contract セッションが
  `character.controller.http.spec.ts` に**こちらが書こうとしていたのと同一内容**（未知キーの strip 検証）を
  実装中だった。委譲前に他キャンペーンの `prompt-code-*.txt` を読んで許可ファイルの重なりを確認して回避した。
  → **委譲前に稼働中キャンペーンの許可ファイル欄を確認する**

### 第3群-b: APP_FILTER 段階導入（2026-07-28・完了 `1206a3e`＋`fd710ba`）

証跡: `review-results/g3b-app-filter/`。着手時 HEAD = `ebd23ea`（第3群-a `7b9f3d9` の後に
並行セッションが `ff3e8d6`/`93adb16`/`ebd23ea` を積んだ状態）。

#### フェーズ b-1: 実測調査（完了・read-only Opus 2本並列）

事前調査（本書 第3群-a 節）の指示どおり経路ごとの新旧実測を実施。
結果全文は `result-measure-backend.md` / `result-measure-consumers.md`。

**事前調査の誤りの訂正（2件）**:

- 「フロントが呼ぶ 6 経路」は**過小**。実測は 21 エンドポイント（22 呼び出し点）、
  うち filter なし側 9（post-character / from-template / sheet 保存 / sheet-templates 6本）
- filter なし controller の表から **PerformanceDashboardController が漏れていた**
  （filter なしは 5: App / CharacterSheet / CharacterSheetTemplate / Discord / PerformanceDashboard）

**設計を左右した実測事実**:

1. Nest 11 の名前付き例外（`NotFoundException('...')` 等）は**常に object body**
   `{message, error, statusCode}`（`HttpException.createBody`）。素の string body は
   `new HttpException('str', n)` 直接生成のみ
2. Discord / PerformanceDashboard は全 13 handler が try/catch で非 HttpException を
   HttpException(500) に潰しており、**素の Error が裸の 500 になるのは実質
   9 route のみ**（GET / ・sheet 2本・sheet-templates 6本）
3. ユーザー可視のエラー文言を組むのは `CustomError`（封筒/Nest 既定 両対応）と
   `extractApiErrorMessages`（**封筒非対応・`data.message` しか読まない**）。
   `ApiResponseUtil.handleError` は全呼び出し点で console.error 止まり（ユーザー可視ゼロ）
4. `issues[]`（`ebd23ea` の byte 予算契約）の HTTP 消費者は
   **`non-finite-formula-save.reproduction.spec.ts` 自身のみ**。フロントは読まない
5. Discord platform の HTTP 呼び出しは存在しない（Gateway 方式）。
   `/discord/*`（post-character 除く）と `/discord/performance/*` は HTTP 実消費者未検出

#### 設計裁定: D案（真に未知の例外のみ封筒化）を採用

- **D案**: `BaseExceptionFilter` を継承したグローバル filter を APP_FILTER 登録。
  HttpException **と http-errors（`isHttpError`: statusCode+message を持つ例外。
  body-parser の 413/415 等 — round4 で追加）**は `super.catch()` へ委譲
  （Nest 既定の直列化をバイト単位で保存 = issues[] / conflicts[] / VP 配列 /
  statusCode・error キーすべて不変。headersSent 処理・ログ抑制も Nest 実装を継承）。
  **真に未知の非 HTTP 例外のみ** ErrorResponse 封筒 500 に変換
- **E案（HttpExceptionFilter をそのまま APP_FILTER 化）は棄却**。理由:
  (1) `extractApiErrorMessages` が封筒非対応のため templates/sheet 3画面のユーザー可視文言が
  ラベル固定文字列に**全滅**する（事前調査の「壊れはしない」は誤りだった）、
  (2) `ebd23ea` が直したばかりの 422 診断封筒（issues[]）を破壊する、
  (3) 是正にはフロント改修＋spec 3件更新＋issues→details 写像の設計が必要で
  小スライス統制を超える。**E 方向の完全統一は extractApiErrorMessages の封筒対応を
  前提条件として将来フェーズへ**（本節末尾の残課題参照）
- 500 封筒の `error` は**固定の汎用文言**とし、raw `exception.message` は載せない
  （現行の `'Internal server error'` と同じ開示水準を保存。既存2 filter の
  raw message 露出との不整合は認識の上で、開示拡大をこのスライスで行わない判断）。
  サーバ側ログには例外の name/message/stack と requestId を出し観測性を保存する

#### フェーズ b-2/b-3: 実装と二重レビュー（round1〜4）

- round1: filter 本体＋app.module 登録＋spec ガード＋filter spec 6件。変異 M1/M2/M4/M5 は期待どおり赤。
  M3（委譲除去）で repro spec が赤にならず Codex が停止 → **Fable の指示書が repro spec の
  TestingModule 配線（global filter 未登録）を未検証のまま NOTE 文言を指定していた**
  （`verify-claims-before-prescribing` の3例目としてメモリ記録済み）
- round2: provider 追加 → AppConfigService 未提供の DI エラーで Codex が正当に停止
  （@Global() は本番のみ・spec の個別配線には載らない）
- round3: AppConfigService stub で解消。29件緑・M3 で repro spec 赤化・SHA-256 復元確認
- b-3 二重レビュー: **両輪 needs-fix**（清書: run-review-round1/ と Opus 最終出力）。
  両輪一致: headersSent ガード欠落（Opus は実測で**リクエストのハング**を確認）・
  `String(exception)` が先に throw すると元例外の診断が消失。
  **Opus 単独 high（H-1）**: Express エラー層（body-parser の 413/415 等）は
  RoutesResolver.registerExceptionHandler の instance が {} のため **global filter しか通らず**、
  固定 500 封筒化すると 4xx が 5xx に化け、@UseFilters 3 controller への大きい POST でも発生
  （dist 実測: 200KB POST が導入前 413 → 導入後 500）。
  Opus M-3: repro spec の createHttpApp ヘルパ経由 7 ケース（byte 予算契約の
  「production HTTP」を名乗る群を含む。HTTP ケースはインライン側と合わせ計 8）が
  本番配線を通っていない（round1 レビューの「13 本」は過大で、b-3 再レビューで 7 に訂正）。
  M-4: 解決順を固定するテストがゼロ
- **「実質 9 route のみ」の訂正**: 9 は「route handler から escape する非 HttpException」の数として
  正しいが、APP_FILTER の実適用範囲ではない。Express エラー層は route 非依存・@UseFilters 貫通で
  global filter だけが受ける。影響評価にこの層を含めていなかった
- round4（修正）: isHttpError も super.catch へ委譲（413/415 をバイト単位保存・headersSent と
  ログ抑制も Nest 実装を継承）・封筒分岐に headersSent ガード・診断抽出の安全化
  （filter は throw しない）・createHttpApp の本番配線化・解決順テスト・
  auth/character http spec への global provider 登録（既存 assert が不変性を機械固定）・
  非 Error throw と 413 と headers 送信済みの回帰テスト・NOTE を観測可能な契約へ言い換え
- **development の stack 開示について（意図的決定）**: filter なしだった 5 controller と
  Express エラー層由来の未知例外 500 は、これまで development でも
  `{statusCode:500, message:'Internal server error'}` 固定だった。封筒化により
  development に限り stack が載るようになる（既存2 filter と同じ規約に揃える方向の
  意図的な開示拡大。production は不変）
- 既知の対象外: `npx tsc` 全体で出る test/mocks/auth.mock.ts:48 のエラーは HEAD 由来の既存
  （worktree diff ゼロを確認済み）
- b-3 再レビュー round2: **Opus pass**（round1 の H-1/M-1〜M-4 全解消を実測で確認。
  独立に全量 228 suites / 3166 tests 緑・madge ゼロ・dist 反映も確認）。
  **Codex needs-fix**（新規 Medium 1: `isHttpError` の事前判定が super.catch 内の再判定と重なり、
  accessor-backed getter を持つ敵対的 object で Nest 既定より1回多く評価され、
  3回目の throw で応答喪失 — 「filter は throw しない」宣言への反例）
- round5（最終修正）: 委譲分岐全体に try/catch の**最終安全網**を張り、二次例外は封筒分岐へ
  フォールスルー。**設計判断: 二次例外時は Nest 既定との一致より応答の終端を優先する**
  （良性の HttpException / http-errors はバイト単位不変のまま。敵対的 accessor object のみ
  「応答喪失 or 413」→「必ず封筒 500」に変わる = Nest 既定より厳密に頑健な方向）。
  あわせて 413×@UseFilters controller の機械固定（両輪一致 low）・
  意図的な非 Error throw 3行への理由付き eslint-disable（Opus L-1。受入コマンドに lint が
  無かったため round4 で検出漏れ — 以後の受入に eslint を含める）・
  test-app.module.ts への global filter 写し（Opus L-3・第3群-a の pipe と同じ対称性）

#### 残課題（第3群-b スコープ外・実測で発見）

- **F-4**: `POST /character/from-template` の `applyRollOnCreate` が try 外
  （`character-instantiation.service.ts:34`）→ 未対応ダイス記法が診断ゼロの 500。
  D案で封筒化はされるが根本対応（service 内での分類）は別スライス
- **F-5**: sheet 系 422 body が3系統に分裂（`{statusCode,error,message,issues[]}` /
  `{message,detail}` / `{message,fieldUid,value,min,max}`）→ 第4群の一本化候補
  （俯瞰#5: U5-5b `3493e2c` で wire 上は sheet 封筒1形へ収束。issue 要素型3宣言・内部 carrier は残存 — OV5-6 参照）
- **F-8**: CharacterController の 401 で guard 経由と handler 経由の errorCode 有無が食い違う
- **N-1（b-3 レビューで追加）**: 500 の body がリポジトリ内で3系統になった
  （Nest 既定 / 新 global 封筒（errorCode なし） / CharacterHttpExceptionFilter の
  InternalServerErrorResponse（errorCode: 'INTERNAL_SERVER_ERROR'））。F-5 と同種の分裂 → 第4群候補
- **F-6**: `@ApiErrorResponse` は本番で永久に未適用（deprecated）。user.controller 7箇所は死蔵 → 第5群
- `ErrorHandler.handleHttpError` は production 未使用の第3のエラー形で、死蔵に 4 spec が
  張られている → 第5群
- `extractApiErrorMessages`（`sheetTemplateApi.ts:64-81`）の封筒対応 —
  エラー形状の完全統一（E 方向）の前提条件
  （俯瞰#5: U5 `9eae435` で封筒対応済み — **前提条件は成立**）
- `corsApiWithJwt` は backend の 401/404 を body を読まず一律 500 固定文言へ潰す（フロント既存欠陥）
- InteractionsController 完全死蔵の確証・`/discord/*`（post-character 除く）と
  `/discord/performance/*` の HTTP 実消費者ゼロ → 第5群の裏付け材料

### 俯瞰レビュー#5（2026-07-28・`5434f9c..9eae435` の累積11コミット）

fable-rules の3フェーズ規律による大粒度認知負荷レビュー。対象は M2/M3 `507cfcb`・
第3群-a `7b9f3d9`・第3群-b `1206a3e`+`fd710ba` ＋ 並行分（`ff3e8d6`/`93adb16`/`ebd23ea`・
U5 4コミット `717f083`/`0299113`/`3493e2c`/`9eae435`）。
方式: Opus 側 = 実測4系統（エラー応答系統 / front パーサ・422 / ダイス・F-8 / util・provider 写し）
→ cognitive-load モードA（13件）＋ changeability sweep（12件）→ severity 上位8件の adversarial 反証検証。
Codex 側 = 独立 adversarial（verdict needs-fix・8件）。
証跡: `review-results/overview-5/`（統合判定の全文は `integration-verdict.md`）。

反証検証の総括: 8件すべて **PARTIAL**（REFUTED 0）。骨格の事実は全件 HEAD で再現したが、
定量は過大方向の偏りが一貫（builder「3実装群」→実体2・「同時保持7」→実効4〜5・「401 3形」→2形）。
以下は反証後の数値を正とする。

#### 健全性確認（合成欠陥なし — 両輪一致）

- 第3群-b GlobalExceptionFilter × U5-5b sheet filter の合成は健全: 封筒の入れ子なし・
  requestId 二重生成なし（7生成点は分岐排他）・非 HttpException は sheet filter を素通りして global 封筒へ
- 第3群-b の変異固定 spec 群は U5 の変更（JSDoc 2行）後も検出力維持
- 俯瞰#4 の「UI 70/ロール 50」型の合成起因の挙動欠陥は今回は検出されなかった

#### 採用所見（第4群へ。詳細は integration-verdict.md）

- **OV5-1（high・両輪一致）**: 局所2 filter（`http-exception.filter.ts:97-109`・
  `character-http.exception.ts` 分岐(4)）の `@Catch()` 全捕捉が解決順で global より先に未知例外を捕まえ、
  **raw `error.message` を封筒 error へ露出**。auth 5・users 7・character 6 route で第3群-b の
  「500 は内部診断を隠す」規律がすり抜ける（UserService が下流例外文を連結して再送する実経路確認済み）。
  処方方向: `@Catch(HttpException)` へ狭め未知例外は global へ委譲
  （N-1 の 500 3系統・HttpException 分岐の逐語コピー10行・dev 判定3コピーも同時解消）。挙動変更あり
- **OV5-2（high 相当）**: loadJsonFile の真のリスクは cwd ではなく **production イメージに `src/` が無い**こと
  （Dockerfile は dist のみ COPY → `gameSystemList` が本番で `undefined` の latent 欠陥）。
  処方方向: 2呼び出し元を `file.util.ts`（throw 版）へ・静的 JSON の同梱/解決を修正・重複ファイル削除
- **OV5-3（medium）**: 「ロール結果の親チャンネル投稿」4実装・2契約。void 契約側の custom-dice-modal は
  送信失敗でも「送信しました」。反証検証で boolean 契約側にも 2/6 呼び出しで同型サイレント欠落を追加検出
- **OV5-4（low・trivial）**: 'エラーが発生しました' の literal 直書きが production 11箇所
  （`DEFAULT_ERROR_RESPONSE_MESSAGE` 定数化済み。参照置換のみで純減・両輪一致）
- **OV5-5（medium）**: corsApiWithJwt の status/body 破棄は production 1箇所（`_nest-route.action.tsx:27`）と確定
- **OV5-6（第4群の主設計判断）**: HTTP 40 route が封筒20/非封筒20 の半々・front 3パーサ全てに非封筒
  fallback 残置。**E 方向の前提条件は U5 で成立済み**のため第4群で E 方向を再評価する。
  ErrorEnvelope builder 2実装（ErrorResponse DTO 族 vs `buildSheetErrorEnvelope`）の統合当否は
  両輪で割れた（Codex=byte 会計と結合した意図的分離 / Opus=同一契約型の真の重複）→ 単独先行せず E 設計内で裁定
- **OV5-7（要対応・U5 起源）**: U5-5a の `character-sheet-response-contract.spec.ts` が APP_PIPE 未登録の
  TestingModule で成功契約を検証（Fable 裏取り済み）。実 HTTP spec の配線は3通りに分裂。U5 側の設計意図確認後に処方

#### 第5群への裏付け追加

`ErrorHandler.handleHttpError`（spec 4本が oracle）/ `src/utils/api-response.util.ts`
（15 assertion の oracle・台帳 2497 行に結合記録済み）/ `dice.util.parseDiceNotation`・
`DiceOrchestrator.getBasicResultEmoji`（production 0）/ ErrorResponse サブクラス6種中3種
（Validation/Authorization/Conflict）production 未到達

#### 記録のみ

413/415 等 request 層は sheet 封筒外（機構は AI.test.md と global filter JSDoc に文書化済み）/
sheet 封筒の cause キャリアは message 以外未消費・409 の conflicts は sheet ルートで固定文言に上書きされ
front に届かない / `services/dice/README.md` に虚偽記載（実在2ファイル未記載・存在しない型・
削除 TODO 付きメソッドを推奨例として提示）/ F-4 存続（記録の 34 行は HEAD では 35 行）

#### 統合しない判定（現状維持・両輪一致）

requestId 生成7箇所（分岐排他）/ ダイス parse 3境界（扱う言語が異なる意図的分離。ただし
Opus CH-7「受理ゲート本番2箇所並列」は Codex 判定と対立し未検証 → 第4群 CH-1 設計時に実測）/
`APP_*` provider の spec 登録（同一定数の参照でありロジック複製ではない）

#### 台帳訂正（本俯瞰で実施）

第3群-b 見出し「進行中」→完了 / extractApiErrorMessages 解消の注記 / F-5 wire 収束の注記 /
loadJsonFile「spec に固定されていない」の訂正（`loadJsonFile.spec.ts` は 2026-06-02 から実在 —
未検証主張の台帳化4例目としてメモリ `verify-claims-before-prescribing` へ記録）

### 俯瞰レビュー#4（2026-07-27・第2群完了時点）＋ OV4 反映（0d38e09）

対象: `5308bfc..7c060af`（SP-3 / SP-2 / CE-1）。両輪とも **needs-fix**。
**個別スライスでは原理的に見つからない欠陥**を3件検出し、OV4/OV4b で解消。
清書: `review-results/overview-4/`

#### 横断調査の主眼「表示は集約・保存は分解」

SP-2 と CE-1 が**同じ構造の問題**だったことを受け、同型が他機能に潜んでいないかを両輪に横断調査させた。
結果、**両輪が独立に同じ high** を検出:

- **`extractSkillLevel` の規則不一致**: `values.level → value → base` の**単一 part 採用** vs
  表示側 `getDisplayNumber` の**全 part 合算**。
  **CE-1 が非 base part を保存で維持するようにしたため `base ≠ 合計` が恒久化し、
  編集モーダルで「70」と表示・入力したスキルがスレッドのボタンでは「50」でロールされ結果が保存**されていた
  （CE-1 以前は保存で `{base:70}` に潰れて偶然一致していた）
- 調査で判明: `values.level` / `values.value` は**本番の書き手が一切生成しない**
  （`base`/`other` のみ）。旧 `extractSkillLevel` の優先順チェーンが作った「テスト内だけの概念」だった

#### Opus 単独の high 2件（Fable が実装で裏取り）

- **hub quarantine の誤判定**: `markHubRefreshError` が「終端対象なし（pending ≤ applied）」と
  「CAS 失敗」の2つの理由で `null` を返すのに worker が混同。編集成功直後の一過性失敗で
  **hub が永久 stale・`status` は `active` のままで Web 警告にも出ない**。
  → 3値（`marked`/`not-applicable`/`cas-failed`）へ。**これは SP-2 round9 の Fable の処方ミス**
  （「reject と CAS null の両方」と書いて2つの null の意味を混同していた）
- **REST `PUT /character/:id` の materialized 無防備**: Discord モーダル側にはガードがあるのに REST 側に無く、
  5セクション置換が `sheet.values` を更新しないため**次の materialize で黙って巻き戻る**

#### OV4b（合算化の副作用）

OV4 の合算化により `values: {}`（REST 作成の数値なし項目・モーダル空欄で頻出）が **0 を返し
ラベルが「メモ (0)」**になる退行が生じた。表示側は `Object.keys(values).length > 0` を条件に
合計を出さないため**揃えたはずの規則から逆向きに外れた**。同条件へ是正。
あわせて `cas-failed` の原因 error をログへ復活、metadata のみ更新が 409 にならない spec を追加。

#### 連鎖の構造（記録）

```
CE-1（内訳を保存で維持）→ base ≠ 合計 が恒久化
  → extractSkillLevel の単一part採用が顕在化（UI 70 / ロール 50）
    → OV4 で合算規則へ統一 → values:{} で 0 を返す副作用 → OV4b で是正
```

**各段階が前段の正しい修正から生まれている**。単発レビューでは追跡できない連鎖であり、
俯瞰を挟む方針がなければ CE-1 コミット時点で「UI 70・ロール 50」が残っていた。

- 検証: build 成功・全量 **223 suites / 3063 tests 緑**・循環ゼロ（独立再実行）
- 台帳送り（横断調査の副産物）: palette ラベル書式が2パッケージ3箇所に散在 /
  契約 C-25「parts 全保持」と legacy 正規化の矛盾（契約側に例外条項が無い）/
  連鎖 formula max（`cap → limit → hp`）/ `applyDiscordDelta` は本番呼び出し元ゼロ（第5群候補）/
  `markHubRefreshError` の read 失敗（throw）は依然 quarantine 行き（一過性でも永久 stale）/
  materialized ガードの TOCTOU / `AI.discord.md` に SP-2/SP-3 の規則が未記載

### CE-1 完了追記（2026-07-27・2ラウンド）

編集モーダル保存で `values` の内訳・`index`・`isVisible` が失われる問題を解消。**第2群の最後**。

- **機序**: モーダルの数値欄は**合算値**を初期表示する（`extractFieldEditValues` → `getDisplayNumber`）のに、
  保存側 `buildAttributeValueFromForm` は AttributeValue を**ゼロから作り直して**いた。
  合計は不変だが内訳が消え、特に `applyDiscordDelta` が積む `other`（Discord の ±操作の履歴）が
  **編集のたびに base へ吸収**されていた。`index`（並び順）と `isVisible`（`true` 固定）も失われていた
- **処方**: 「作り直し」→「マージ」。不変条件は **合計 = 入力値**（`base = 入力値 − 非 base part 合計`）。
  非 base part・`index`・`isVisible` を維持。**base が負になっても 0 でクランプしない**
  （クランプすると合計が入力値とズレて利用者の意図に反する）
- **round2（両輪 high）**: round1 は**新しい破壊**を持ち込んでいた — 数値欄が空/非有限のとき
  `valuesObj` が「既存 values から base を除いた形」で初期化されるため、
  `{other:5}` が valid と判定されて保存され **`base` だけが黙って消えた**（旧は `{}` → invalid → 拒否）。
  **旧セマンティクスの正確な保存**へ是正: 空→`{}`（全クリア）／非有限→更新中止／有限→逆算
  - 修正方針は両輪で割れた（Opus=既存値の完全コピー／Codex=明示的な検証失敗）。
    Fable 裁定は**分岐ごとに旧挙動へ合わせる**形。「完全コピー」は空欄を「未編集」と解釈することになり、
    同スライスが description/dice に与えた「空＝意図的クリア」と矛盾するため不採用
- 検証: build 成功・全量 **221 suites / 3036 tests 緑**・循環ゼロ（独立再実行）
- deferred: `add_new` で既存フィールド名を再入力すると同型の破壊が残る（既存キー衝突の検出が無い）/
  セクション丸ごと置換による lost update（repository に revision/CAS が無い・pre-existing）/
  legacy 正準化で `{description}` だけになった項目は description が prefill されず数値編集で消える

### SP-2 完了追記（2026-07-27・8ラウンド）

track リソースの「表示・実効値・報告」の三重乖離を解消。**8ラウンドを要したが、内訳は round1 が実装、
round2〜6 が前ラウンドの退行修正、round7〜8 が Fable の処方ミス（契約違反）の是正**であり、
新機能・好みの改善はゼロ。
清書: `review-results/sp2-resource-clamp/review-20260727-sp2-rounds.md`

- **方針**: evaluator の実効値を唯一の正とし、表示と報告を従わせる＋書き込み側に防波堤
- **範囲方針の正本**: `features/character-sheet/services/track-range.policy.ts`
  （bounds 解決・違反の**方向付き**判定・legacy 正規化・実効値解決）。
  `sheet-values.util.ts` に `isPartsValue`/`sheetValuesEqual`/`partsTotal`/`isResourceField` を集約（3重複→1）
- **判定規則**: 「next が範囲内」または「current と**同じ側**で違反量が非増加」のみ許可。
  比較は**両側とも next bounds**で行う（境界縮小は evaluator/projection の正規化が吸収）
- **hub 失敗の扱い（契約 OP-6/C-11 準拠）**: **backoff 対象は Discord 429 のみ**。
  読み取り面の失敗は分類を問わず**初回で `active → error`**（投影準備失敗＝`PROJECTION_FAILED` /
  テンプレート恒久却下＝`TEMPLATE_UNRESOLVABLE` / 分類外も安全側で即 error）。publication も同じ分類関数を使う
  （round7 で導入した read-path の指数 backoff・試行上限・`active.errorCode` への marker 流用は
  **契約違反のため round8 で全撤去**。-227行）
- **層の是正**: `hub-projection.service.ts` の engine 直 import を解消
  （feature 境界で解決済み実効値と投影用 palette ラベルを生成して渡す形へ）。
  ただし `resource-delta.handler.ts:2` は共有 `EPSILON` を engine から import しており **0件ではない**
  （定数のみ・評価ロジック非依存。完全な遮断は別途判断）
- 検証: build 成功・全量 **221 suites / 3021 tests 緑**・循環ゼロ（独立再実行）

#### 重大な学び（プロセス）

1. **契約書を先に読む（本キャンペーン最大の反省）**:
   `document/character-sheet-proposals/phase2-operation-contracts.md` の **C-11 / OP-6** が
   「**429 のみ backoff**」「分類外→error（安全側）」「**無限リトライ禁止**」を最初から規定していた。
   Fable は契約を参照せずに処方を出し、**3ラウンド（5→6→7）を空費**した:
   - round5: 一過性も即 error（結果的に契約準拠だったが根拠は偶然）
   - round6: 「Conflict/NotFound は復旧可能」と誤認して一過性へ →
     **無限リトライを作り契約違反**（`only draft templates can be published`＝deprecate が
     一方通行である事実を未確認だった）
   - round7: backoff＋上限で「有限化」→ **これも契約の「429 のみ backoff」に反する**
   - round8: 契約どおり即 error へ戻し **-227行**。機構ごと消えた
     → **設計判断の前に、その領域の契約書を検索して読む**。レビュー所見の文言をそのまま処方に写さない
2. **二分法で答えない**: 「一過性/決定的」の二分では round5（厳しすぎ）→ round6（緩すぎ）を往復した。
   「有限回試して終端」という第三の形が正解だった
3. **low でも保留しない種類がある**: 違反の方向性（`12 → -1` が「縮小」として通る）は
   Opus が round3 で low として挙げ Fable が保留 → round4 で Codex が high として再提出。
   **そのスライスが防ごうとしている性質そのものを迂回する所見は severity に関わらず即対応**
4. **spec の空振りが次の見落としを生む**: round2/3 の追加 spec は修正を戻しても緑だった。
   round4 以降**机上ミューテーションをレビュー観点に常設**し、生存ミューテーションを潰す運用にした

#### deferred（次スライス優先順）

1. ~~`TEMPLATE_UNRESOLVABLE` の即終端化~~ → **round8 で解消**（契約準拠により全 read 失敗が初回終端）
2. ~~marker 永続化失敗で試行回数が進まない穴~~ → **round8 で機構ごと撤去され消滅**
3. publication の一過性 `'none'` rollback に再駆動経路が無い
   （worker は active のみ拾う。起動時 sweep で `none`＋threadId＋materialized を再投稿する案）
4. **連鎖 formula max**（`cap → limit(max=cap) → hp(max=limit)` で参照先の生値が読まれる）—
   依存順の位相解決＋循環検出が必要。publish 境界で自己参照/連鎖を禁じる案も
5. 範囲外 legacy track の永続 projection が parts 内訳を失う
6. `error → *` の復旧遷移が無い（SP-2 以前からの設計課題）
7. `character-sheet-operation.service.ts`（645行）の hub read-model 分離
8. resource ラベル書式が生成2箇所・除去1箇所に散在（パッケージ跨ぎで無防備）

### 死蔵経路の発見（SP-3 レビュー副産物・2026-07-27）

`character-thread-select` / `character-thread-select-with-thread` は **customId pattern・handler・分岐は存在するが、
セレクトメニューを組み立てて送出する production 経路が存在しない**（grep 確認済み。実際に組まれているのは
`commands-components/character-thread.service.ts:112` の `character-thread-create-select` のみ）。
`ThreadCreationService`（`character-thread.orchestrator` 経由）はこの死蔵経路の先にあり、
**実運用の `/character-thread` は `CharacterThreadSelectService` → イベント → `ThreadOrchestratorService` →
`ThreadManagerService` を通る**。第5群（死蔵一掃）の対象候補。削除は未実施。

### 証跡の所在について（俯瞰#1 追記）

`review-results/` はルート .gitignore によりローカル限定（codex-delegate 運用の設計どおり）。リポジトリに残る監査結論の正本は `docs/reviews/full-review-2026-07-26.md` と本ファイルの各エントリであり、`review-results/` への参照はローカル作業時のみ有効。

## 2026-07-26 全体レビュー実施（4観点・2層検証・コード変更なし）

TRPG-SERVER 全体（src 326 ファイル＋packages/sheet-projection＋test 基盤）を正しさ・認知負荷・変更容易性・負債の4観点でレビューした。1層＝読み取り専用レビュアー9体、2層＝Must 級所見への敵対的検証7体。報告の正本は **[docs/reviews/full-review-2026-07-26.md](./docs/reviews/full-review-2026-07-26.md)**。

- 実測ゲート: build 成功 / check:circular 循環ゼロ / 209 suites・2676 tests 全通過（ただし誤モック・未カバーで緑のままの実バグを多数検出。緑＝正しさの証明ではない）
- 検証済み Must 16件。最上位: `.env.test` の Atlas 資格情報コミット（TI-1）／`GET /auth/:userId/User` 無認証で OAuth トークン露出（DM-1）／sheet-projection の Docker 未配線＝デプロイ不能（SP-1）／イベントリトライの unhandled rejection でプロセス停止（EV-3）／`1d100<=30` が `1d10030` に化ける（DM-2）
- 着手順（同報告 §4 Decision Artifact）: 第0群=機密・認可即応 → 第1群=デプロイ成立（SP-1/TI-2） → 第2群=確定バグ修正 → 第3群=APP_PIPE/APP_FILTER 段階導入（500 化クラスの根絶） → 第4群=契約一本化（PaletteEntry 4重定義、Phase 3 v3.1 前）・customId Factory/Parser 統一・characterThread 一本化（S3 前） → 第5群=死蔵一掃
- 修正は未実施（レビューのみ）。着手時は挙動保存分に特性化テストを先行させること
- 第3層検証（2026-07-26 追記）: ユーザー指示により Codex CLI（gpt-5.6-sol・xhigh・read-only）で独立再検証を実施。round1 = **pass**（23判定すべて維持、medium 訂正2件〔CE-3 影響範囲の限定・CT-1 到達経路の訂正→DC-30 下流確定（キャラ作成完了イベント経由の自動スレッド作成は機能していない）〕を報告書へ反映済み）。清書: `review-results/full-review-verify/review-20260726-full-review-verify-round1.md`

## 2026-07-26 large-file 静的解析ツールの導入（portable-skills 適応の補完・未コミット）

Playwright E2E プロジェクト（`\\LAPTOP-UBRLUPJM\e2e-playwright`）から `scripts/refactor/analyze-large-files.ts` を移植した。ts-morph でファイル行数・関数様宣言の行数を計測し、閾値超過（file 800行 / function 200行）を advisory warning として JSON レポートに出す。`refactoring-rules` / `large-file-refactor-review-loop` スキルが、リファクタ計画・レビュー前の静的解析としてこのコマンドを参照する。

- コマンド: `pnpm run refactor:large-files:analyze -- --out .tmp/refactor/large-files.json`（`--include` で対象 glob を絞れる。`--out` は `.tmp/` 配下限定）
- 実行系: 元は Node 22 の `--experimental-strip-types` だが、この環境は Node 20.17 のため `ts-node --transpile-only` に載せ替えた
- 依存追加: `ts-morph@28.0.0`（devDependencies。元プロジェクトと同版。既存の madge とは役割が別 — madge は依存・循環、本ツールはサイズ）
- 適応: 対象 glob を `src/**/*.ts` + `test/**/*.ts`、除外を `.tmp/.temp/coverage/dist/logs/node_modules/outputs` に変更。`scripts/` は tsconfig の include 外なので build / lint / madge の対象に入らない
- 検証: 561 ファイル解析・69 警告（上位は大型 spec の describe）。導入後も `pnpm run build` 成功・`check:circular` は「No circular dependency found!」
- 警告はブロッカーではなく分割候補の発見用（ブロッカーは従来どおり check:circular の循環ゼロのみ）
- 見送り: 元プロジェクトの `analyze-dependencies.ts`（レイヤリング違反・未使用 export 検査）は madge 系と役割が重複するため移植しない。必要になったら同じ場所から取得できる

## 2026-07-12 変更容易性改善単位7・Character実DB統合テストの隔離（未コミット）

`character.integration.spec.ts` と `character.crud.spec.ts` を通常Jestから分離し、実行ごとに使い捨てMongoDBを起動する専用契約へ変更した。

### 問題

- 通常Jestのsetupは `.env` の `MONGODB_URI` を保持できたため、unit testから共有Atlas DBへ接続し得た。
- 実DBspecが通常の `*.spec.ts` 収集対象に含まれ、共有DB名、並列実行、接続失敗時のfallback/skipによって結果が環境へ依存していた。
- AttributeValueの正準形はmockだけで検証され、Mongoose `Mixed` の保存・更新挙動とBSON変換後の形を保証できていなかった。

### 改善後の契約

- **事前条件**: 通常テストはhostの外部URIを必ずlocalhost用URIで上書きする。実DBspecは専用Jest configからだけ起動し、Docker CLIが作った `127.0.0.1` の動的port、run ID付きDB名、専用provider markerがすべて一致しなければ開始しない。残留state/lockがある並行・異常終了状態も黙って上書きしない。
- **成功時事後条件**: 専用コマンドは対象2 suiteだけを直列実行し、新規AttributeValueの `values/dice` とlegacy fixtureのread→正規化→update→正準形保存を実MongoDBで確認する。終了時は起動したcontainer、state、lockを残さない。
- **失敗時事後条件**: state欠落、不正URI、外部host、run ID不一致、MongoDB未起動、Docker削除失敗はテスト失敗として可視化する。共有DBへのfallback、接続不能時のskip、cleanup errorの握りつぶしを行わない。
- **不変条件**: 通常Jestは実DB2 suiteを収集せず、専用configはその2 suite以外を収集しない。各runは固有DB名を持つ。legacy CharacterService経路の5セクション更新はMongoose `Mixed` のdeep mergeに依存せず、repositoryがaggregation pipelineの `$literal` でセクション全体を原子的に置換する。省略プロパティは `undefined` をBSONへ渡さず、保存後に `null` を発生させない。

### 実装と判断

- `jest.integration.config.js` と `test:integration` を追加し、通常 `jest.config.js` では対象2 specを除外した。
- `test/testcontainers/` の専用setup/teardownがDocker CLIで `mongo:7` を起動し、`mongosh` のping後に接続stateを渡す。Node Testcontainersの `GenericContainer` も試行したが、このWindows Docker環境ではcontainer取得前に停止したため、同じ使い捨て境界を明示的に制御できるDocker CLIへ限定した。
- 実DBREDで、通常の `$set` が既存 `Mixed` 配下をdeep mergeすること、`undefined` のoptional keyがBSONで `null` になることを確認した。repositoryのセクション更新をpipeline置換へ変更し、CharacterServiceは定義済みoptional keyだけを組み立てるよう修正した。

### 検証

- 通常Jestの `--listTests` に実DB2 specが含まれず、専用configの `--listTests` はその2 specだけ。
- 隔離境界spec: 2 suites / 5 tests成功。外部Atlas、marker付き外部MongoDB、run ID不一致を拒否。
- `test:integration`: 2 suites / 19 tests成功。新規 `values/dice` 往復とlegacy正準化・書戻しを実MongoDBで確認。
- 終了後: 対象MongoDB container 0、`.runtime-state.json` なし、`.runtime-state.lock` なし。
- `typecheck:test` 成功。全体gateとFableレビューは本節の追跡で確定する。

### Fable初回レビュー後の追跡

- 初回結果: **`Approved with follow-up`**。契約による設計、interfaceと実装の分離、ドメインモデル完全性はいずれもPass。
- Medium: CharacterServiceはundefined除去と正準形検証を行うが、repositoryの直接 `create/update/updateForOwner/updateByChannelId` は禁止フィールドしか検証していなかった。repository境界へ `prepareLegacyWrite` を追加し、全undefined entryを除去して、存在する5セクションを `isAttributeSection` で再検証する二重防御へ変更した。
- Low: 残留lockを生の `EEXIST` ではなく手動確認手順付きの契約エラーへ変換。setup途中のcontainer削除失敗はcontainer ID付きで可視化。lockはroot `.gitignore` で既に無視済みだったが、局所 `test/testcontainers/.gitignore` にも明記した。
- Follow-up: pipeline更新後の `updatedAt` を実MongoDBのraw BSONで検証し、一覧順序の時刻契約も固定した。
- 追跡検証: repository 1 suite / 43 tests、実DB 2 suites / 19 tests、`typecheck:test` 成功。終了後のcontainer/state/lock残留0。
- Fable追跡結果: **`Approved`**。初回Medium/Low/follow-upはすべて解消し、3観点はいずれもPass。情報Lowとして残った「属性内の明示的 `undefined` はguardを通る」点も、`isAttributeValue` が存在する全propertyのundefinedを拒否する契約へ狭め、関連7 suites / 172 testsと実DB19 testsで回帰なしを確認した。
- Fable最終確認: **`Approved`**、必須指摘0、3観点Pass。空 `AttributeValue {}` とoptional key省略が有効であることも、提案された境界assertで明示的に固定した。

### 最終全体gate

- 改善単位7の最終対象: core/repository 2 suites / 81 tests、実DB 2 suites / 19 tests、対象lint 0、container/state/lock残留0、`git diff --check` 成功。
- 通常Jestは作業ツリーの並行変更前に198 suites / 2,567 tests全件成功。最終再実行時は追加された改善単位1のcompile error 1 suiteだけが失敗し、**199 suites / 2,588 testsは成功**した。失敗は `src/scripts/backfill-template-pin.spec.ts:36` の `character is possibly undefined`。
- 現在の `typecheck:test` は上記に加え、`src/discord/features/characterSheet/handlers/roll-palette.handler.ts:43` の `string | undefined` を `string` へ渡す型エラーで停止。buildは後者1件で停止する。
- `lint:check` は0 errors / 92 warnings。`check:circular` は525 files / 4 warnings / 循環0。
- 失敗2ファイルはいずれもユーザーが担当する改善単位1の並行差分で、本改善単位2〜7では変更していない。lockfileも変更していない。

### 次にやること

最終Fable確認後、通常Jest全件とbuild/lint/circularを再実行して改善単位2〜7を閉じる。

---

## 2026-07-12 変更容易性改善単位6・AttributeValue正準形（未コミット）

`status / parameter / skill / item / description` の5セクションを、型定義、HTTP DTO、イベント契約、作成コア、CharacterService、Discord編集で同じ `AttributeSection` として扱うよう統一した。

### 問題

- `core/types/attribute.types.ts` は `dice?: string` を持つ一方、`AttributeValueDto` と `CharacterService` の変換が `dice` を落としていた。create/updateの成功後にロール記法だけ消失する事後条件違反だった。
- 辞書型へ付けた `@Type(() => AttributeValueDto)` が辞書全体を単一DTOへ変換し、更新時に `HP` 等のキーを失い得た。
- 作成コアは `Record<string, any>` のプリミティブ能力値を検証した後、`CharacterService` は同じ値を `AttributeValueDto` として読み、空の `values` へ暗黙変換していた。
- Discord編集は省略可能な `index / description / dice` を `null` で保存し、宣言型と永続化値を不一致にしていた。

### 改善後の契約

- **事前条件**: 各セクションはプレーンオブジェクトで、各属性は `name / index / values / description / dice / isVisible` だけを持つ。`values` の全要素は有限数。`dice` は存在する場合は文字列。プリミティブ、配列、`null`、未知キーは受理しない。
- **成功時事後条件**: create/updateはセクションの辞書キー、`values` の全part、`dice` を欠落させずrepositoryへ渡す。CoC/D&D/SW2.5の必須能力値は `values` の合算値を検証する。Discord編集は未指定プロパティを保存しない。
- **失敗時事後条件**: HTTP DTOは400、作成コアは `CharacterCreationValidationError`、直接service入力は明示的な `TypeError` とし、不正値を空属性へ変換せずrepositoryを呼ばない。
- **不変条件**: 実行時判定の正本は `isAttributeNumberParts / isAttributeValue / isAttributeSection`。HTTP DTO、`CharacterCreationData`、`CharacterCreationCoreInput`、`CharacterEntity` は同じ `AttributeSection` に収束する。ダイス構文はゲームシステムごとに異なるため、この境界では文字列性だけを保証し、実行境界の責務を奪わない。

### 検証

- RED確認: DTOの不正形5件とDiscordの旧null形2件が失敗し、service/coreは`dice`未定義・旧プリミティブfixtureで2件の型エラーになった。
- focused: core type guard、DTO、CharacterService、作成コア、Discord純関数の5 suites / 114 tests成功。
- 拡張確認: event handler、Discord modal service、Character controllerの3 suites / 60 tests成功。
- `typecheck:test`、build成功。DB実体でのcreate/read/update往復は、改善単位7の隔離MongoDBで2 suites / 19 tests成功を確認した。

### Fable初回レビュー後の追跡

- 初回結果: `Changes requested`。必須指摘は、旧Discord編集が保存した `index / description / dice: null` を含む別属性が同一セクションに残ると、read-merge-write全体が正準形検証で失敗する回帰。
- 対応: `normalizePersistedAttributeSection / normalizePersistedCharacterAttributes` をdomain mapperへ追加し、repositoryのCharacterEntity読出・作成・更新・削除結果だけに適用。既知legacyのnull除去、有限数プリミティブ、文字列プリミティブ、`name/value`形を情報保持して変換する。未知キーや不正型は黙って捨てず例外。外部DTO/event入力は従来どおり厳格拒否する。
- 中指摘: `updateField / updateFieldByChannelId` に `AttributeSection` 型とservice/repository二重ガードを追加し、プリミティブ素通しspecを正準形へ反転。
- 低指摘: Discord数値入力を `parseFloat + isNaN` から `Number + Number.isFinite` へ変更し、部分文字列・Infinityを格納しない。domain版Validation/Business errorは `error.name` でも明示的に非リトライ化し、陳腐化コメントを更新。
- 追跡RED: mapper不存在、legacy読出未変換、部分更新2経路、非有限入力3件、domain error再試行2件を確認。修正後5 suites / 115 tests成功、`typecheck:test`、build、対象lint 0 errors。
- 改善単位7のDB統合テストへ、新規 `values/dice` 往復に加えて、legacy fixtureのread→正規化→Discord相当updateを追加した。

### 次にやること

改善単位7で、通常Jestからの共有Atlas接続を禁止し、隔離DBでAttributeValueの永続化往復まで完了した。結果と契約は本ファイル冒頭の改善単位7を正とする。

---

## 2026-07-12 変更容易性改善単位5・User / Character認可契約（未コミット）

UserとCharacterのHTTP操作を、認証主体と永続化queryが切れない所有者限定契約へ変更した。詳細契約の正本は `AI.domain.md` の「2026-07-12 User / Character HTTP認可契約」。

- Character: `findByIdForOwner` / `updateForOwner` / `removeForOwner` をrepositoryへ追加し、`characterId + discordUserId` の単一queryで取得・更新・削除。serviceにHTTP用owner-qualified APIを追加し、controllerの個別3操作だけを接続。対象不在と非所有者は同じ404。
- User: controller全体へ `JwtAuthGuard` を適用。path IDとJWT主体の一致を必須化し、本人以外はDB操作前に404。
  （当時の strict `ValidationPipe` は**第3群-a で撤去**。未知 body 項目は 400 でなく strip に変更）
- User入力: HTTP専用 `CreateUserProfileDto` / `UpdateUserProfileDto` は `name/avatarHash` だけ。controllerでも許可項目を再構成し、token・characterIds・bodyの所有者IDをserviceへ渡さない。
- User出力: pure presenterで `UserOutputDto` へ写像し、OAuth token4項目を常に除外。token更新は既存 `AuthService -> UserService` 内部経路を維持。
- 権限正本: Character accessは `Character.discordUserId` のみ。legacy `User.characterIds` の変更はCharacterアクセスを付与しない。

検証: 変更前6 suites / 102 tests。repository owner API不存在3件とUser認可/非漏えい6件をRED確認。Fable初回レビューは対象diff内の重大指摘なしの `Approved with follow-up`。横断監査で発見した `/discord/post-character` のID単独取得・更新を追加RED後にowner-qualified化し、複合Param DTO、Character guard metadata、User出力schemaも追従。最終9 suites / 157 tests成功、`typecheck:test` 成功。Fable追跡レビューは全HTTP controllerの横断検索を含め **`Approved`**。

### 次にやること

改善単位6として、AttributeValueの正準形を定め、`dice` を含むcreate/update/readの情報保存契約を実装する。

---

## 2026-07-12 変更容易性改善単位4・Discord REST操作契約の統一（未コミット）

`DiscordController -> DiscordFacadeService -> DiscordChannelManagerService -> Discord SDK` の入出力契約を、SDKオブジェクトとHTTP結果が混在しない形へ統一した。

### 問題

- facadeがSDK `Message` / `Channel` を返し、controllerは `{ success, messageId/channelId, error }` を期待していたため、成功応答の型と実値が不一致だった。
- facadeの操作オプションが `any` で、controllerからSDK実装まで型保証が途切れていた。
- 単数 `embed` が検証後に捨てられ、frontendが送る `#RRGGBB` 色はDTOで拒否されていた。
- `type: 'text'` 等をDiscord `ChannelType` へ変換せずSDKへ渡し、`thread` は未知値フォールバックでテキストチャンネルになり得た。

### 改善後の契約

- **事前条件**: 送信内容またはEmbedがあり、アクセス権がある。Embed色は整数または `#RRGGBB`。通常チャンネル作成で `thread` は指定できない。
- **成功時事後条件**: facadeは判別可能unionの成功結果を返し、成功結果には対応するIDが必ずある。Embedとチャンネル種別はSDK呼出前に正規化済みである。
- **失敗時事後条件**: SDK側の `null` / ID欠落は `success: false` と失敗メトリクスへ変換する。例外は失敗記録後に再送出する。
- **不変条件**: SDKオブジェクトはfacadeより外へ出ない。成功と失敗のフィールドは同時に成立しない。操作契約は `discord/interfaces` に置き、実装クラスから分離する。

### 検証

- RED確認: SDK値をそのまま返す4ケース、文字列ChannelType未変換、単数Embed欠落、16進文字列色拒否、threadの暗黙処理を各specで確認してから実装。
- focused: 4 suites / 88 tests成功。
- `typecheck:test` 成功、build成功、`check:circular` 496 files / 3 warnings / 循環0。
- `lint:check` は0 errors。今回増やした未使用importを除去し、既存86 warningsを維持する。
- Fable初回レビューは `Approved with follow-up`。空要求は元から400だったため指摘の前提を訂正し、実際に不足していた「複数embedsのみ」の許可を修正。追跡レビューも重大指摘なしの `Approved with follow-up`。残った低指摘の色受理境界と数値thread型も追加実装・specで解消した。
- 別追跡: managerが握ったSDK例外の失敗理由分類と、DTOに残る未使用 `ephemeral` は、この結果契約を破らない既存課題として後続へ送る。

### 次にやること

改善単位5として、User/Characterの取得・更新・削除における所有者判定をcharacterization-firstで固定し、公開境界の認可不変条件を揃える。

---

## 2026-07-12 変更容易性改善単位3・未処理Promise rejectionの可視化（未コミット）

`test/utils/jest-setup.ts` から、Jest Circusの `unhandledRejection` listenerを全削除して空handlerへ置換していた処理を削除した。本番コードは変更していない。

- 安全網: リモートDBへ接続する `character.integration.spec.ts` / `character.crud.spec.ts` だけを除いた同一集合を変更前後で比較。
- 変更前: 186 suites / 2,433 tests成功。
- 変更後: 186 suites / 2,433 tests成功。追加で露出した未処理rejectionは0件。
- 補助検証: `typecheck:test`、build成功、`check:circular` 493 files/3 warnings/循環0、process-level抑制の残存0。
- Claude CLIレビュー: **Approved**。削除前はJest Circusが先に登録したerror listenerをsetup後に消しており、削除によって既定のfailure reportingが復元されることを依存実装まで確認。
- 残存risk: 除外2 suiteは改善単位7のリモートDB隔離後に再実行する。将来の非決定的なsuite failureは未待機Promiseを第一候補として扱う。

### 次にやること

改善単位4として、Discord channel/message操作のSDK戻り値、facade結果、HTTP response DTOの契約をcharacterization-firstで一つに揃える。frontendが利用中のchannel作成経路を優先し、広いDiscord service整理は混ぜない。

---

## 2026-07-12 変更容易性改善単位2・検証処理の修復（未コミット）

変更容易性・設計負債レビューの安全な改善単位2を実施。本番動作は変更せず、検査コマンドの契約を「既定は読取専用、変更は明示コマンドだけ、aliasを本番同様に解決、テスト補助コードも型検査」へ揃えた。

- `lint` を `lint:check` へ委譲し、`lint:fix` だけが `--fix` を持つ構成へ変更。
- `typecheck:test` を追加し、成果物を書かないよう `--incremental false` を指定。`tsconfig.spec.json` の `@*` aliasesをJestと整合。
- `check:circular`、`check:deps`、`analyze:deps` を `--ts-config tsconfig.json` へ統一。
- Jestのerror-handler個別coverage閾値は数値を緩和せず、旧 `src/utils` から現 `src/core/http` へpathだけを追従。
- 新ゲートで露出した23 errorsを解消。参照ゼロの旧test factory/helper 2ファイルは低リスクdead codeとして削除し、test authの古いCookieService import 2箇所を現pathへ更新。
- Lint唯一のerrorは既存listener specのenum/string比較だけだったため、文字列化してテスト意図を維持。

検証: `typecheck:test` 0 errors、`lint:check` 0 errors/86 warnings、対象spec 4 tests成功、build成功、`check:circular` 493 files/3 warnings/循環0、Jest `--showConfig` でcoverage path追従を確認。全Jest/coverageはリモートDB分離前のため未実行。通常pnpmは既存workspace/lockfile差分による `ERR_PNPM_VERIFY_DEPS_BEFORE_RUN` で停止するため、検証時のみ一時的に `--config.verify-deps-before-run=false` を使用し、lockfileは変更していない。

### 次にやること

改善単位3として `test/utils/jest-setup.ts` の空の `unhandledRejection` handlerを独立して外し、focused testで露出する未待機promiseを分類する。広範な失敗が出た場合は本番コード変更へ進まず、原因別の小単位へ再分割する。

---

## 2026-07-07 C 系列 全 slice 完了 ＝ **両計画書（C-1〜C-10・E-1〜E-6）完遂**

Wave 並列（A: C-4/C-5/C-7/C-3b′ を Workflow 4並列 → B: C-9 単独 → C: C-10）で C 系列を完遂。
Codex Wave A レビュー**全5観点指摘なし**（挙動差・シグネチャ不整合・live 経路破断なし・C-3b′ への整形混入も実害なし確認）。

| Slice | コミット            | 要点                                                                                                                                                             |
| ----- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-4   | `387eef6`           | 5 handler の sendToParentChannel（挙動差ゼロを diff 表で確定）を parent-channel.util へ集約。既存 spec 無変更で緑＝挙動保存                                      |
| C-5   | `3374178`           | console.\* 22 箇所 → Nest Logger（許容例外の config 2 ファイルのみ残置）                                                                                         |
| C-7   | `0460900`           | **BREAKING**: DiscordService 委譲ラッパー削除 → facade 直依存（注入元は実測 3 サイト・計画の 4 は stale）                                                        |
| C-3b′ | （amend 済み hash） | 監視系 dead 購読 6・dead emit 6・未使用注入 3 を撤去。live の system.health.status ペアは無傷                                                                    |
| C-9   | `28fc18d`           | tsconfig 第2段階 3 フラグ有効化（機械修正 48 件）。build.json の「効かない上書き」の罠も解消。exactOptionalPropertyTypes は評価のみ（src 49 件・見送り理由記録） |
| C-10  | 変更ゼロ            | **全数採取で open handle 0 件**＝リークは E-5 の 5 分 setTimeout が唯一の源だったと確定（180 suites×3 連続クリーン）                                             |

### ★C-10 の重要発見: suite 未実行型フレークの正体（AI.test.md の旧教訓を訂正）

「N suites failed / failed tests 0」フレークは worker teardown リークとは**無関係**。決定的に再現できた同型事象は
**並行セッションが作成中の `src/domains/character-sheet-template/` の spec** によるもの:
① controller.spec:95 の TS2345（`deleted: true` リテラル型 vs boolean widening → `true as const` で解消を実証済み・原状復帰済み）
② JwtAuthGuard の `JwtTokenService` が TestingModule 未提供 → 7 tests DI エラー（2026-06-07 教訓と同型）。
**→ 並行セッション側での修正が必要（本セッションは未接触）**。以後の全 suite 検証は同 spec の修正まで
`--testPathIgnorePatterns="character-sheet-template"` でベースライン（180 suites / 2401 tests）を固定する。

### 残作業（計画書ベースでは完遂・以下は任意/別枠）

- C-8 手動 smoke（Discord OAuth・実機ダイス）— ユーザー任意
- REST ダイス API 新設（roadmap 側・E-6e で enabler 済み）
- C-9 で記録した dead 掃除候補 1 件（channel-create-orchestrator の未登録リスナーメソッド＋spec）と
  exactOptionalPropertyTypes の再評価（イベント契約の userId optional 整理と同時が効率的）
- test/ ヘルパーの既存 strict 型負債 24 件（C-9 スコープ外として記録）

---

## 2026-07-07 C-9 tsconfig 第2段階フラグの段階有効化（機械的修正のみ・コミットは司令塔側）

計画書 `docs/refactor/refactor-legacy-cleanup-plan-2026-07-06.md` C-9 節。継承関係:
基底 `tsconfig.json`（src＋test を型検査・src/\*_/_.spec.ts 除外）→ `tsconfig.build.json`（nest build・test 除外。
旧 noUnusedLocals/Parameters:false 上書きは撤去済み）／ `tsconfig.spec.json`（ts-jest。strict 系と
noUnusedLocals/Parameters を **意図的に false 上書きのまま維持**＝spec は対象外）／ e2e 2 本は全フラグ継承。

| フラグ                     | エラー→修正                | 内容                                                                                                                                                              |
| -------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| noImplicitOverride         | 10→0                       | `override` 付与のみ（6 ファイル。EventHandler 派生の isRetryableError/getMaxRetries/customValidation・AppConfigService.get・CreateCharacterDto.discordChannelId） |
| noUnusedLocals             | 24→0                       | 未使用 DI パラメータプロパティ 19（constructor から削除・DI graph 上 dead）＋未使用 logger/プロパティ 5。dice-calculation spec の直接 new も引数削除              |
| noUnusedParameters         | 8(+test 6)→0               | 全て `_` プレフィクス改名（シグネチャ互換維持・削除なし）                                                                                                         |
| exactOptionalPropertyTypes | **評価のみ・false のまま** | src 49 件（TS2375:21 / TS2379:18 / TS2412:7 / TS2769:2 / TS2339:1）・test 込み +53。E-4 完了後に再評価（tsconfig にコメント記録）                                 |

- **要注意の判断 1 件**: `channel-create-orchestrator.service.ts` の `handleCharacterCreationCompleted` は
  リスナー未登録の移行残骸だが **spec が `(service as any)` で直接テストしているため削除せず protected 化**
  （noUnusedLocals は private のみ検査）。本来は E 系残骸としてメソッド＋spec の削除が筋＝dead 掃除の別 slice 候補。
- 検証: build 0 / No circular / **全 180 suites 2401 tests 緑（件数不変）**。基底 tsc --noEmit の既存エラー 24 件
  （test/ 配下ユーティリティの strict 型負債・C-9 とは無関係）は増減なしを diff で確認。

---

## 2026-07-07 E-6 全完了（entity/schema 分離・ドメイン境界是正）＝ **E 系列（E-1〜E-6）完遂**

ユーザー「進めて／並列して進められる部分は並列して」。判断1（REST 3本削除）は承認込みと解釈して実施
（E-6b は単独コミット＝revert 一手）。**Wave 並列実行**: Wave1=E-6a/E-6b/E-6e（Workflow で3エージェント並列・
ファイル集合が互いに素）→ Wave2=E-6c（Codex Wave1 レビューと並列）→ Wave3=E-6d。

| Slice | コミット            | 要点                                                                                                                                                                                                                         |
| ----- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-6a  | `04e0b5b`           | threadId 撤去＋creation.completed 条件を discordChannelId 基準へ **bugfix**（characterization RED→GREEN・migration 不要）                                                                                                    |
| E-6b  | `6484123`           | controller §9 準拠化。**discord 系 REST 3 本削除（BREAKING）**・domains 層のイベント発行ゼロ達成・thread.create 発行重複解消                                                                                                 |
| E-6e  | `a8c347e`           | BCDice 実行コア＋保存キー解決（2分岐＋modal 4段 fallback）を domains/dice-roll へ。**Web ダイス API の enabler**。import 元は計画の3→実測6箇所                                                                               |
| E-6c  | `3f83923`           | ゴースト display 連鎖の全解体（handler サービスごと削除・契約 11→10・E-3d 申し送り消化）                                                                                                                                     |
| E-6d  | `199b5e6` `c1ce714` | **CharacterEntity 公開型導入・@Schema を persistence 専用へ閉じ込め**。repository 境界 plain 化（save→toObject/lean 付与）・旧 zod dead 連鎖 2 ファイル削除（-576行）・discord 層 30 ファイル型置換・本番キャスト5箇所全解消 |

- **grep 達成証明**: @Schema Character の import は domains/character 内部＋spec 以外でゼロ／本番の as Character・
  Character 絡み as any ゼロ／src/domains 非 spec の TypedEventService/EVENT_NAMES 参照ゼロ（§9）。
- **Codex レビュー 3 回**（Wave1・c/d、事前の計画設計レビュー含め正確性指摘は全反映）。既知ニュアンス（Low）:
  lean 経路は旧データの schema default 欠損を補完しない → entity docstring に記録（`c1ce714`・実害限定的）。
- 検証: 各 Wave で build 0 / No circular / **全 180 suites 2429 tests 緑**（増減は全 slice の削除/追加分と完全整合）/
  start:dev 23 handler・Discord 初期化成功。セッション再起動を挟んだが全ゲート再実行で無傷を確認。

### 残作業マップ（E 系列完遂後）

- **C 系列残り**: C-4（sendToParentChannel 5重複の共通化）/ C-5（console→Logger）/ C-7 縮小版（DiscordService ラッパー解体）/
  C-9（tsconfig 第2段階・E/C の掃除完了でベストタイミング）/ C-10（フレーク・E-5 で一因解消済み）/ C-3b′（監視系 dead 配線）
- **機能開発（roadmap 側）**: REST ダイス API（POST /dice/roll・GET /dice/results）— E-6e で enabler 完了
- **ユーザー任意**: C-8 手動 smoke（Discord OAuth・実機ダイス）

---

## 2026-07-07 E-6 計画診断＋計画書策定（診断のみ・コード変更なし・ユーザー承認待ち）

ユーザー依頼「E-6 の計画書を練って」。Explore 3系統（Character 露出マップ／threadId 重複＋controller 境界／
共通ロジック棚卸し）＋司令塔裏取り＋**Codex 設計レビュー（High 2・Medium 2・Low 2 → 全て反映）**で
**`docs/refactor/refactor-entity-boundary-plan-2026-07-07.md`（E-6a〜E-6e）を策定**。

### 診断の要点（詳細は計画書）

- **想定より軽い**: 「TS エラー 22 個」の旧記録は陳腐化・`*.entity.ts` 不存在・Document API 依存は本番1箇所・
  CHARACTER_MODEL の discord 層リークゼロ・prod キャスト4箇所。露出は 38 ファイル/281 フィールド参照だが型注釈中心。
  → 全面 DDD 化ではなく**5 slice の右サイズ計画**（診断エージェントの「4〜6週間」見積もりは司令塔判断で棄却）。
- **threadId は deprecated 重複**（正=discordThreadId・migration 不要・フロント両方未使用）。
- **character.controller は §9 三重違反**＋discord 系 REST 3本はフロント呼び出しゼロ＋thread.create 発行重複。
- **Web/Discord 非対称**: BCDice 実行コア・保存キー解決が discord 層のみ＝Web からダイス API が存在しない
  （REST 新設は機能開発として roadmap 側へ＝E-6e はその enabler）。

### Codex レビューで計画を訂正した重要点

1. **[High] E-6d の lean 前提**: repository の書き込み系（create/.save()・findOneAndUpdate 系・findAll/findByUserId）は
   Document を返す（司令塔裏取り一致）→ **repository 境界の plain 化を先行**する順序を計画に明記。
2. **[High] E-6a の条件是正方向**: creation.completed:146-150 は **discordChannelId 基準が正**
   （discordThreadId 基準だと作成直後のスレッド作成を抑止）→ characterization 必須に変更。
3. [Medium] 既存 zod 側 `CharacterEntity`（schemas/character.schema.ts）との名前衝突 → 着手時に dead 判定 or 改名。
4. [Medium] E-6e は custom-dice-modal の4段 fallback も対象に含める。

### ユーザー判断待ちの3点（計画書冒頭に明記）

①E-6b の discord 系 REST 3本削除の可否（公開 API の破壊的変更）／②REST ダイス API 新設（機能開発）の時期／
③E-6f（属性整形の引き上げ）の要否（既定「やらない」）。

### 次にやること

ユーザー承認後: E-6a → (判断①) E-6b → E-6c → E-6d → E-6e（Codex 優先度所見: これらを C 系列残りより先・
E-6e は C-4/C-5 同格・いずれも C-9 より先）。

---

## 2026-07-07 E-5 完了（3層ルーティング1本化）＝ E 系列は E-6（中期）を残すのみ

**コミット `491ddac`**（2ファイル・+75/−297・nestjs-best-practices 委譲＋司令塔裏取り）。

- InteractionCreate 入口（discord-interaction-handler.service・239→131行）から、登録箇所ゼロの Map キャッシュ 3種・
  register\* API・getHandlerStats・clearExpiredInteractions（filter 常 true の壊れ実装）を撤去。
  button/select/modal は `handleComponentInteraction` 1本で InteractionsService（Registry）直結＝**3層→2層**。
- **意図的挙動変更**: processedInteractions の dedup Set＋5分 setTimeout を撤去（計画の撤去候補条項。discord.js は
  同一 interaction を二重配信せず・下流 replied/deferred チェック＋handler try/catch が防波堤・
  「委譲先 reject でもリスナーが落ちない」を spec で明示固定）。**撤去後に対象 spec の Jest exit 警告が消滅＝
  C-10 のリーク源の一つと実測確認**（C-10 の残作業が縮小）。
- 検証: build 0 / No circular / 全 179 suites 2422 tests 緑（−7=削除分一致）/ start:dev リスナー設定・interaction 23・
  Discord 初期化成功 / 残存コード参照ゼロ。discord/DESIGN.md の Phase 2 チェックボックス消化・stale 記述追従。
- **運用メモ**: この slice では Codex CLI が2回連続で応答不達（タスク転送は成功・レビュー本文未返却）。
  司令塔の自己検証（撤去安全性の論拠＋grep＋全ゲート）で代替した。次の slice で Codex 復調を確認すること。

### 次にやること

- E 系列: **E-6 のみ**（entity/schema 分離・中期）— **着手には別計画書の策定が必要＝ユーザーとスコープ合意から**。
- C 系列残り: C-4（sendToParentChannel 5重複の共通化）/ C-5（console→Logger）は E-2/E-4 完了により再評価のうえ実施可。
  C-7 は E-5 完了により縮小版（残り注入元の DiscordService 直依存化）が可能に。C-9（tsconfig 第2段階）/ C-10（フレーク・
  E-5 で一因解消済み）/ C-3b′（監視系 dead 配線の一括整理）。

---

## 2026-07-07 C-3/C-6 完了（dead 第2弾・ephemeral 全数置換）

- **C-3 `9d523a4`**: C-3a=discord.utils.ts（import 元ゼロ再確認）ファイルごと削除／C-3b=PerformanceOrchestrator の
  recordRateLimit・triggerAlert（外部呼び出し元ゼロの委譲ラッパー）撤去＋連鎖孤児化した DiscordMonitor.recordRateLimit 削除
  （alertManager.triggerAlert 本体は @OnEvent 内部利用で live 残置）／C-3c=app.module の AdapterModule コメント残存の最終整理。
  **監視系の広範 dead 配線（metrics-collector @OnEvent 5本 emit 元ゼロ等）は未着手のまま**＝専用 slice 候補（C-3b′）として残る。
- **C-6 `987203d`**: `ephemeral: true` → `flags: MessageFlags.Ephemeral` 全数置換。**計画の「4〜5箇所」は過少で実測 122 箇所**
  （非 spec 77＋spec 45・42 ファイル）。enum widening 2 箇所は as const・テスト基盤モック（jest-setup / discord-module.mock /
  command-manager ローカル）に MessageFlags を実値一致で補完。未消費の ephemeral 宣言 3 箇所（error-handler.ts:22 /
  send-message.dto.ts:61 / message-manager.service.ts:41）はデッド型として記録＝将来の掃除候補。

検証: 各 slice で build 0 / No circular / 全 **179 suites 2429 tests 緑**（C-3 は −1 suite/−11 tests の削除分整合・C-6 は件数不変。
C-6 の全 suite 1 fail は再実行2連続緑＝C-10 既知フレーク）。

---

## 2026-07-07 E-4 全完了（契約一本化・厳密型化・バス1インスタンス化）＝ E 系列コア完遂

E-3f（取りこぼし2件・`bb011c1`）に続き E-4 を 3 slice で完遂。Codex スコープレビュー2回（E-4a / E-4b+c）。

- **E-3f `bb011c1`**: deletion.completed の dead listener・thread creation.completed の dead emit を撤去（E-3 の「発行元（例）」表記の漏れ分）
- **E-4a `5b7d0de`**: 契約を **live 11 種のみ**の unified-event-contracts へ一本化（24種→11種・レガシー契約4ファイル削除・
  −1,767 行）。**`EventName = string` の弱型を `keyof EventMap` 厳密型へ**・EventPayload の any フォールバック廃止・
  EVENT_NAMES 11 種完備。payload は実 emit と購読参照に一致（type フィールド撤去・update.completed を実態へ）。
  **Codex Medium 2件を反映**: event-registry の string→EventName 境界に EVENT_NAMES membership 検証／
  update.completed handler の契約外 updatedFields dead 分岐（shouldNotifyUpdate ごと）撤去
- **E-4b `f8454f3`**: production のイベント名リテラル 29 箇所（14 ファイル）を EVENT_NAMES 定数へ一掃（§15 整合・値同一を Codex 全数確認）
- **E-4c `caaddbe`**: `'TYPED_EVENT_EMITTER'` を forRoot インスタンスの useExisting alias 化＝**バス1本化**。
  空クラス TypedEventEmitter（provider/facade 注入/client attach）撤去。isolation spec を「1バス固定」へ反転。
  設定差（maxListeners 20 / verboseMemoryLeak true へ統一）は警告閾値のみで配送条件に影響なし（Codex が eventemitter2 実装で確認）

検証: build 0 / No circular / 全 **180 suites 2440 tests 緑** / start:dev interaction 23・Registry 1・DI エラー 0・Discord 初期化成功。
docs 追従: AI.event.md（バス1本化）・discord/DESIGN.md（attach 撤去）。

### E 系列の残りと C 系列への材料

- **E-5**（3層ルーティング1本化＝discord/DESIGN Phase 2・独立・いつでも可）と **E-6**（entity/schema 分離・中期・別計画書）のみ。
- **C-3b への追加材料（Codex/E-4 調査の副産物）**: metrics-collector の @OnEvent 5 本（discord.command.\* / discord.event.processed /
  http.request.complete / database.query.complete）は **emit 元ゼロ**・discord-monitor の raw emit（rate-limit/memory/performance.alert）は
  **購読者ゼロ**・alert-manager の @OnEvent('system.alert') も emit 名（system.alert.critical）と不一致疑い。
  監視系の live 配線は performance-orchestrator → system.health.status → alert-manager の1本のみ＝**監視系はほぼ dead 配線**。

### 次にやること

C-3（dead 第2弾・上記監視系材料込みで liveness 確定）/ C-6（ephemeral）/ E-5 のいずれかから。C-4/C-5 は E-2/E-4 完了により再評価可能。

---

## 2026-07-07 E-3 全完了（dead イベント大掃除・5 slice・約 -3,100 行）

E-2 完了で dead 化が確定した系統を、購読3形態（直接 .on / getEventName 間接 / @OnEvent）の全数マップで裏取りしてから 5 slice で撤去。
実装は nestjs-best-practices ×5 並列/逐次委譲・司令塔一括裏取り・Codex スコープレビュー2回（a/b/c と d/e）いずれも正確性指摘なし。

- **E-3a `4b2e51d`**: request 系ヘルパ 7 本（全て呼び出し元ゼロ）→ update.requested/findBy\* の **4 handler をチェーンごと削除**。
  EventRegistry は creation 1 handler 構成へ。creation handler の dead な failed emit も撤去（throw ベースで基底のリトライ/統計は同値）
- **E-3b `dcb8f0e`**: diceroll.execute.completed/failed の dead emit＋typedEventService 注入ごと削除
- **E-3c `4592d07`**: CharacterEditCreationHandler 丸ごと（as any キャスト消滅）・emitSectionSelected・dead listener 2 本
- **E-3d `f62eff5`**: discord UI 系 dead emit **13+1 箇所**（thread-manager 分は計画の「発行元（例）」漏れをスコープ拡張）。
  **重要記録: display 系（handleCharacterDisplayRequest 等）は「聞くだけで何もしない」ゴーストとして残置**
  （発行元 domains/character/character.controller が live のため。連鎖の解体は E-5/E-6 で扱う＝docstring にも明記）
- **E-3e `89b0a8a`**: interactions.service の素の EventEmitter2 注入＋interaction.start/processed emit 撤去（**E-4c の前提完了**。
  EventEmitterModule.forRoot は @OnEvent の監視系〈discord.command.\* 等〉が live のため残置）

検証: build 0 / No circular / 全 **181 suites 2469 tests 緑**（E-2 完了時 186/2555 から −5 suites/−86 tests＝削除 spec 分と整合）/
start:dev interaction 23 不変・EventRegistry 1 handler・DI エラー 0・Discord 初期化成功。
（start:dev の ERROR 1 行は DiscordMonitorService の性能アラートログ＝監視系の正常動作・コード無関係）

### E-4 への申し送り

- dead contract 型が contracts 2 ファイルに残存（discord.message.send.requested / embed.character.update.\* 等）→ **E-4a で一括整理**
- `TypedEventEmitter` は空クラス化済み（provider: core-events.module / 注入先: discord-facade）→ E-4c で撤去判断
- `channel-create-orchestrator` の無効化済み private handleCharacterCreationFailed（contracts 型参照のみ）→ E-4a 整理対象
- `CharacterUpdateCompletedEvent` の契約型ずれ（type/characterId/changes 要求 vs 実 emit）→ E-4a

### 次にやること

E-4a（契約一本化）→ E-4b（EVENT_NAMES 完備）→ E-4c（バス1インスタンス化）。C-3/C-6 は引き続き並行可。

---

## 2026-07-07 E-2f 完了 ＝ **E-2 全完了**（イベント RPC の production 利用ゼロ達成）

**コミット `048eab5`**（9 ファイル・+619/-296・nestjs-best-practices 委譲＋司令塔裏取り＋Codex レビュー）。

- **CharacterCreationCoreService 新設（domains/character/services）**: creation.requested handler から重複チェック・
  gameSystem 別パラメータ検証・characterId 採番・create を移設（Codex が行対行同値を確認）。イベント発行なし（§9 準拠）。
  domains→events 逆流回避のため等価エラークラスを domain 側に定義（name/code ベースの非リトライ判定・failed 発行の意味論維持）。
- **embed-manager.createCharacter**: emit→wait の壊れ順 RPC（**診断未計上の3件目の実バグ**＝モーダル作成が常時 10 秒タイムアウト→
  「キャラは作られるのに失敗応答」）をコア直呼び＋completed 自己発行（fire-and-forget）へ。チャンネル名同期・Embed 投稿・通知の
  CharacterCreationCompletedHandler 連鎖は不変。
- **Codex Medium 対応**: タイムアウトバグ解消により modal-handler 自身の Embed 送信と completed 連鎖の送信が**二重投稿**になる
  経路が顕在化 → modal-handler 側の送信ブロックを撤去（チャンネル投稿は completed 連鎖の1回のみ＝旧 live と同経路。
  本人向け成功 reply は維持・spec で二重投稿しないことを characterization）。Low 対応: コア input 型から characterId 除去。
- 意図的挙動差分: 重複/検証エラーでも creation.failed が emit されるように（failed の恒常購読者ゼロ＝実影響なし・E-3 の掃除対象）。

検証: build 0 / No circular(478) / 全 **186 suites 2555 tests 緑**（+1 suite/+17）/ start:dev handler 23・DI エラー 0・Discord 初期化成功 /
**grep 裏取り: production コードの waitForEvent 呼び出しゼロ**（残存は TypedEventService 定義・spec 回帰ガード・docs のみ）＝ E-2 完了条件達成。

### 記録: jest suite フレーク 1 回観測（C-10 の材料）

全 suite 実行で 1 回だけ「3 suites failed / failed tests 0」（suite 未実行型）が出たが、直後 2 連続で全緑。既知の
worker teardown リーク（C-10）による負荷時フレークの疑い。**suite failed ≠ test failed の場合は即再実行して切り分けること**。

### 次にやること

- **E-3**（dead contracts/emit 一括掃除）: E-2 完了で findBy\*.completed/failed・update.failed 等が完全 dead 化。
  1 slice = 1 系統で分割実施。→ E-4（契約一本化・バス1本化）。C-3/C-6 は並行可。
- C-8 の手動 smoke（Discord OAuth・実 Discord ダイス操作）は引き続きユーザー任意。

---

## 2026-07-07 E-2b/E-2c/E-2d 完了（イベント RPC 是正の第2弾・E-2 残りは E-2f のみ）

3 slice を並列委譲（nestjs-best-practices×3・ファイル重複なし・build/lint はエージェント禁止で dist 衝突回避）→ 司令塔一括裏取り。

- **E-2b `214db1d`**: dice-roll-character-provider（+pagination.module に CharacterModule）と character-section-editor の
  findById RPC → `CharacterService.findOne` 直呼び。両サービスとも TypedEventService は他用途ゼロ＝**注入ごと削除**。
  toObject 互換分岐は型注釈付き維持（findOne は repository `.lean()` 経由で通常 plain＝Codex 確認済み）。
- **E-2c `d4e5f0b`**: enhanced-character-edit の getCharacterByChannelId/getCharacterById を DI 化（typedEventService は
  message/embed 系 emit で live のため残置）。
- **E-2d `8e51698`**: modal-handler の update RPC → `characterService.update` 直呼び＋**completed 通知の発行責務を本サービスへ移転**
  （fire-and-forget・payload は旧 handler の emitSuccessEvent と同形＝CharacterUpdateCompletedHandler の UI 連鎖不変。
  spec で「completed 発行の固定・失敗時未発行」を characterization）。旧 handler のバリデーション群は modal 経路の事前チェックで
  全て担保済みと Codex が確認。

検証: build 0 / No circular / 全 **185 suites 2538 tests 緑**（+5＝追加テスト）/ start:dev handler 23・DI エラー 0・Discord 初期化成功 /
Codex スコープレビュー **4 観点すべて severity none**。

### E-2f の設計メモ（次回着手・要設計の理由）

`CharacterEmbedManagerService.createCharacter` は modal 経由キャラ作成の **live 経路**（character-modal-handler:91）。
creation.requested ハンドラは重複チェック（findByChannelId）・featureId 分岐・characterIdService・create・completed/failed emit を
内包するため、単純 DI 化は不可。**方針案: 中核（validate→create→completed 通知）を application service に抽出し、
events handler と embed-manager の双方がそれを呼ぶ**。creation.requested の他 3 発行元（channel-create-orchestrator /
character-creation.service / typed-event.service ヘルパ）は fire-and-forget のため event 経路残置で整合。

### E-3/E-4a への参考（Codex レビュー副産物）

- `character.update.failed` は恒常購読者ゼロ（E-3 の dead emit リストに追加確認済み）。
- `CharacterUpdateCompletedEvent` の契約型（type/characterId/changes 要求）は旧 handler の実 emit とも不一致＝**既存の二重契約ずれ**（E-4a で解消）。

### 次にやること

E-2f（上記設計で実施）→ E-3（dead contracts/emit 一括掃除）→ E-4。C-3/C-6 は並行可。

---

## 2026-07-07 C-8 マージ＋E-2a/E-2e′ 完了（イベント RPC 是正の第1弾・実バグ2箇所解消）

ユーザー「進めてOK」により C-8 マージ→E-2 着手（Codex バランスレビューの推奨順序どおり）。

### C-8 マージ（`959abeb`・--no-ff）

`refactor/nest-v11-upgrade` を develop へマージ。マージ後 develop で build 0 / No circular / 全 186 suites 2541 tests 緑を再確認。
**Nest v11 環境が正式に develop の基準になった**（手動 smoke はユーザー任意・チェックリストは前節）。ブランチは不要になったら削除可。

### E-2a 完了（`9e92fb6`・nestjs-best-practices 委譲・characterization-first）

`CharacterDisplayService.createCharacterEmbed` のイベント RPC（emit 後 waitForEvent＝**構造的に毎回3秒タイムアウト→null**）を
`CharacterService.findByChannelId` の DI 直呼びへ置換。**タブボタンのキャラ表示バグが解消**。spec は Assert 不変で Arrange のみ
DI mock 化＋「旧 RPC へ戻っていない」回帰ガード（Codex Low 指摘反映）。`findByChannelId.completed/failed` の恒常購読者ゼロは
裏取り済み（@OnEvent・`on()` 両方 grep＋Codex 第三者確認）＝通知連鎖影響なし。旧 events handler の掃除は E-3 で実施。

### E-2e′ 完了（`50926be`・計画訂正: DI 化 → dead 削除）

**計画からの重要訂正**: `ChannelNameSyncService` は module 登録と spec のみで**本番呼び出し元ゼロの dead サービス**と確定
（動的解決含め Codex 第三者検証済み）。DI 化ではなくファイルごと削除（S-5b の CharacterChannelService と同型）。
「DB 更新成功でも 5 秒 timeout で false 報告」の壊れ RPC も呼び出し元ごと消滅。
**注意（E-2d の前提知識）**: `character.update.completed` には `CharacterUpdateCompletedHandler`（discord/events・
`getEventName()` 経由の間接登録のため literal grep では発見不可）という**恒常購読者が存在**する。E-2d（character-modal-handler の
update DI 化）では completed 通知の発行責務の移し先を必ず設計すること。

### 検証（司令塔実測・両 slice）

build 0 / check:circular **No circular(476)** / 全 **185 suites 2533 tests 緑**（−1 suite/−8 tests＝削除 spec 分・新規破損ゼロ）/
start:dev **handler 23 不変・DI エラー 0** / Codex スコープレビュー: 正確性指摘なし・Low 1件（回帰ガード）は反映済み。

### 次にやること

- **E-2b**（dice-roll-character-provider / character-section-editor の findById 系 DI 化）→ E-2c → E-2d（↑注意事項参照）→ E-2f。
- E-2 完了後: E-3（dead contracts/emit 撤去・findBy\*.completed/failed も対象化）→ E-4。C-3/C-6 は並行可。

---

## 2026-07-07 await バグ修正＋C-8 実施（Nest v11・ブランチ上）＋Codex 定期レビュー体制開始

ユーザー指示「C-8 GO・await バグも修正・Codex に定期的にスコープ狭めたレビューと全体バランスレビューをさせる」に基づく。
以後のリファクタでは **slice ごとの Codex スコープレビュー＋節目の全体バランスレビュー**を標準運用とする。

### await バグ修正（develop・コミット `61ef9d4`）

C-2 レビューで検出した `dice-calculation.service.ts:63` の await 漏れを修正（1行）＋ spec の `mockReturnValue`→`mockResolvedValue` 化
（再発時に `toBe(sentinel)` が RED になる回帰テスト）。build 0 / 対象 spec 80 緑 / No circular(478) / 全 186 suites 2541 tests 緑 /
**Codex スコープレビュー LGTM**（await 化で rejection が try/catch の success:false 契約へ正しく収まる・services/dice の dice() 呼び出し
3箇所に同種漏れなし）。param-dice-modal（計算式ダイス）経路の本番バグが解消。

### C-8 実施（ブランチ `refactor/nest-v11-upgrade`・コミット `97dbbef`・**マージは実機 smoke 後**）

コード変更ゼロ・依存 bump のみ: core 系一式 10.4.20→**11.1.27** / cli→11.0.23 / jwt→11.0.2 / passport→11.0.5 / axios→4.0.1 /
swagger→11.4.5 / reflect-metadata→0.2.2 / @types/express→5.0.6（config/mongoose/schedule/event-emitter/mapped-types は据え置き）。

- 検証: peer 警告なし / **build 型エラーゼロ**（事前調査の「数件〜十数件」想定より良好）/ No circular(478) / 全 **186 suites 2541 tests 緑** /
  start:dev で **handler 23 登録・Discord クライアント初期化成功（766ms）・GET / 200・未知ルート 404 JSON**（express5 実ランタイム確認）。
- **Codex スコープレビュー: マージ可・Critical/High なし**。Medium 1件＝`passport-discord@0.1.4`（deprecated）の実 OAuth は
  単体テストで拾えないため**手動 smoke 必須**。Low: express5 query parser 既定変更（現 @Query はスカラー2件で実害低）・
  swagger は decorator のみで `SwaggerModule.setup` 不在（OpenAPI 生成運用があれば schema diff 要確認）。
- **マージ前の手動 smoke チェックリスト（Codex 起案・ユーザー実施）**:
  1. Discord OAuth ログイン一式（`/auth/discord` → callback → JWT cookie 属性 → validate-token → logout）
  2. フロント origin からの credentials 付き CORS リクエスト
  3. JSON body 系 API（POST /character 等）
  4. 実 Discord でボタン/select/modal の代表 customId ルーティング（ダイスロール一式）
- **注意**: node_modules は現在 v11 状態。develop 側で作業を続ける場合は `pnpm install` で v10 に戻すこと（マージ後は不要）。

### Codex 全体バランスレビュー結果（要旨・計画へ反映済み）

総合「C-1/C-2/C-8 の進め方自体は妥当だが、**優先順位に歪み**」:

1. **E-2（イベント RPC の DI 直呼び化）を C-3 以降の掃除より優先すべき**。E-2 は「必ず 3〜5 秒タイムアウト」「DB 更新成功でも false 報告」
   という**実挙動バグ**を含む（E-2a: character-display / E-2e: channel-name-sync が最優先）。
2. 推奨順序: **C-8 を閉じる（smoke→マージ）→ E-2a/E-2e → E-2 残り → E-3 → E-4**。並行余地は C-3/C-6 のみ。
   C-7 は E-5 と同一ファイルのため後回し、C-4/C-5 は E-2/E-4 後に再評価。
3. 計画書追記事項（→ 両計画書へ反映済み）: 優先順位の割り込みルール／C-8 の完了条件に smoke 手順明記／
   DI・依存バージョン・bus を触る slice は全 suite 必須／E-6 の前段棚卸し slice 追加検討。

### 次にやること（バランスレビュー反映後）

1. **ユーザー: C-8 の手動 smoke → GO なら `refactor/nest-v11-upgrade` を develop へマージ**。
2. マージ後、**E-2a/E-2e（イベント RPC の実バグ 2 箇所の DI 化）へ着手**（E 計画書参照・characterization 前倒し必須）。
3. C-3 は E-2 と並行可の範囲で実施。C-8 GO 済みのため案B/C は破棄。

---

## 2026-07-07 C-2 完了（dead dice メソッド撤去・F10 完遂）＋既存 latent bug 1 件検出

C-1 に続き C-2 を実施（nestjs-best-practices へ委譲・司令塔裏取り）。**コミット `c8aa131`**（10 ファイル・+29/-1119）。

### 計画からの訂正（司令塔 grep 裏取り）

- 撤去対象は計画の 7 → **8 メソッド**（`parseAndCalculate` も非 spec 呼び出し元ゼロ＝2026-06-10 残課題リストどおり dead）。
- カスケード確定: **DiceParserService は消費者が orchestrator の dead ラッパーのみ＝丸ごと削除**（F10 の DicePresetService と同型）。
  DiceCalculationService 側も public `parseAndCalculate`・`FlexibleDiceResult`・孤児化 private `applyMultiplierAndModifier` を削除
  （live `calculateAndRoll` は multiplier/modifier を inline 処理・共有 private は維持＝挙動不変）。
- orchestrator の残存 live 6 メソッド: `calculateAndRoll` / `executeBasicNotation` / `getResultEmoji` / `getBasicResultEmoji` /
  `sendToParentChannel` / `sendToParentChannelBasic`（constructor は calculationService 単独注入へ）。

### 検証（司令塔実測）

build 0 / check:circular **No circular(478)**（-2 ファイル整合）/ 全 **186 suites 2541 tests 緑**（-1 suite/-72 tests＝削除 spec 分・
新規破損ゼロ）/ start:dev **handler 8+6+9=23 不変・DI エラー 0**（EADDRINUSE 1 件は検証プロセスの多重起動＝環境要因・コード無関係）/
削除シンボル残存参照ゼロ（残りは live メソッド JSDoc の歴史記述 1 行のみ）/ diff レビュー 3 角度（読み取り専用制約付き）: **C-2 起因 finding 0**。

### ★レビューで検出した既存 latent bug（C-2 スコープ外・未修正・要対応）

**`dice-calculation.service.ts:63` の await 漏れ**: `const diceResult = dice(\`${targetValue}b10\`)`—`dice()`は async のため`diceResult`は **Promise のまま**`DiceCalculationResult.diceResult`に入る。消費者`custom-dice-modal.service.ts:83-84`は
Promise が truthy なので通過し`.rands.reduce`で **TypeError → param-dice-modal（計算式ダイス）経路は本番でエラー返信**になる。
spec は`mockReturnValue`（本来 `mockResolvedValue`）＋orchestrator 全 mock のため緑のまま見逃し。
**修正は 1 行（await 追加）＋spec の mockResolvedValue 化**だが挙動変更＝バグ修正のため C-2 に混ぜず別タスク化。

### 次にやること

- **await 漏れバグ修正**（上記・優先）→ C-3（dead 第2弾: discord.utils.ts 削除・PerformanceOrchestrator liveness 確定・app.module コメント整理）。

pull（origin/develop の PR #12 取り込み・マージ `5a9e393`・コンフリクトなし）後、
`docs/refactor/refactor-legacy-cleanup-plan-2026-07-06.md` の C-1 を trpg-refactor スキルで実施。**コミット `c27c224`**。

### C-1 実施内容（計画からの差分を含む）

- **C-1a**: `@aws-sdk/client-dynamodb` `@aws-sdk/util-dynamodb` `dynamoose` `pg` `express-session` 削除（参照ゼロ再裏取り）。
- **C-1b**: `typeorm` `@nestjs/typeorm` 削除。裏取り結果: `test-db.config.ts`・`mock-typeorm.module.ts` は**利用元ゼロ→ファイルごと削除**。
  `mock.module.ts` は typeorm 由来（`getRepositoryToken(Character)` provider＋`mockCharacterRepository`）のみ除去し
  Mongoose mock・UserService mock は維持。なお **e2e spec は 0 本**（`*.e2e-spec.ts` 不存在・`TestAppModule` 利用元ゼロ）＝
  e2e インフラ全体が休眠と判明（下記スコープ外記録）。
- **C-1c**: `@types/uuid` は**削除**（uuid@11.1.0 が `dist/cjs/index.d.ts` 同梱・build で裏取り）。`eslint-plugin-import` は
  flat config・旧 eslintrc とも参照ゼロのため計画の「devDeps へ移動」から**削除に格上げ**。
- **C-1d**: lint script の ignore 2 件除去（両ディレクトリ実在せず＝lint 対象集合は不変）。
- 純削除系のため characterization 前倒しは省略（計画書の例外規定を適用・build/全 suite/start:dev で担保）。

### 検証（司令塔実測）

build exit 0 / check:circular **No circular(480)** / 全 **187 suites 2613 tests 緑**（ベースライン完全一致）/
lint 従来同等 / start:dev **DI エラー 0・handler 登録 8+6+9=23 不変** / diff レビュー（6 角度並列）**正確性 finding 0**。

### C-8 事前調査結果（案A=v11 全面アップグレードのリファクタリング観点評価・コード変更なし）

ユーザー方針「新しい方（v11）に合わせたい。ただしコードが汚くて難しくないか先に確認」を受けた実測調査。
**結論: 「コードが汚くて難しい」懸念は当たらない。案A は単独ブランチの 1 slice として実行可能（難易度: 低〜中）。**

- 環境: Node v20.17.0（Nest 11 要件を満たす）。nest-cli は標準 tsc ビルダー（webpack 非使用）。
- サテライト peer 実測（node_modules の peerDependencies 直読）:
  - **既に ^10||^11 対応＝変更不要**: config@4.0.2 / mongoose@11.0.3 / schedule@6.0.1 / event-emitter@3.0.1 / mapped-types@2.1.0
  - **v11 化と同時に要 bump（peer ≤10）**: `@nestjs/jwt@10→11` / `@nestjs/passport@10→11` / `@nestjs/axios@3→4` /
    `@nestjs/swagger@7.4→8+`（decorator 利用 9 ファイル・機械的）＋ core/common/platform-express/testing/cli/schematics→^11
  - **必須随伴**: `reflect-metadata 0.1.14→^0.2`（Nest 11 要件・package.json は ^0.1.13）/ `@types/express 4→5`（platform-express@11 は express5）
- コード側の地雷（実測でほぼ無し）:
  - `from 'express'` 直 import は **17 ファイル全てが型 import（Request/Response）のみ**＝実行時 API 依存なし
  - ワイルドカードルート（express5 で構文変更）**ゼロ** / express4 削除 API（res.sendfile 等）使用**ゼロ**
  - `@Query` はスカラー 2 箇所のみ（express5 の query parser 既定変更の影響なし）
  - main.ts は素の `NestFactory.create`＋cookieParser＋enableCors のみ（アダプタ固有コード・カスタムロガーなし）
- 想定作業: 依存 bump 一式 → build の型エラー修正（@types/express@5 の Request/Response 型差分が中心・数件〜十数件想定）→
  全 suite → start:dev → Discord 実機 smoke。計画書の指示どおり単独ブランチ。e2e spec は 0 本のため test:e2e は実質 start:dev＋実機で代替。
- **状態: ユーザーの最終 GO 待ち**（実測上のブロッカーなし）。

### スコープ外記録（別 slice 候補）

- **lint 既存 error 1 件**: `character-edit-channel-create-listener.service.spec.ts:37` の `no-unsafe-enum-comparison`
  （C-1 とは無関係の既存負債。lint script は --fix 付きだが本件は auto-fix 不可）。
- **休眠 e2e インフラ**: `TestAppModule`＋`MockModule` は利用元ゼロ（e2e spec 0 本）・`mockCharacters` の不要 export・
  UserService mock の providers/exports 重複。**C-3（dead 第2弾）で「削除 or e2e 整備」をユーザー判断のうえ扱う**。

### 次にやること

- C-2（DiceOrchestratorService の dead 7 メソッド撤去）から続行。
- C-8 はユーザー GO で単独ブランチ実施（上記調査どおり）。

---

## 2026-07-07 未コミット分の一括コミット（ユーザー承認・5コミット・pathspec 限定・コード変更なし）

2026-06-10〜07-06 に検証済みのまま未コミットだった全差分を、作業系統別に5コミットへ分割してコミット。
いずれも 2026-07-06 ベースライン（build 0 / check:circular No circular / 全 187 suites 2613 tests 緑）で
検証済みの状態をそのまま分割したもの（新規コード変更なし）。作業ツリーはクリーン。

- `02410f1` refactor(discord): **F5** postActionButtons dead path 撤去（4ファイル・-78行）
- `139b6fe` refactor(dice): **F10** DicePresetService ごと dead preset チェーン撤去（8ファイル・+50/-525）
- `f8d5073` fix(dice): **履歴保存修正2件**（2026-06-10 custom modal 保存欠落＋06-11 スレッド内保存キー実親化・5ファイル。
  dice-roll.module.ts の F10 docstring 追従は DiceRollModule 再 import と同一ハンクのためここに同乗）
- `215fd10` docs: AI.\*.md 更新・計画書2本（E/C 系列）・キャラシート提案書一式・ロードマップ（21ファイル）
- `aead1aa` chore(skills): trpg-domain-\* 5本新設＋trpg-architecture/trpg-refactor 配線（7ファイル）

### 記録の陳腐化訂正（重要）

- 2026-06-07 節の「develop はローカル 108 コミット先行・origin push 判断待ち」は**解消済み**。現在は push 済みで、
  逆に **origin/develop がローカルより 2 コミット先行**（PR #12 front-intro-ai マージ＋フロント Skills 導入）。
  **次回作業前に pull で取り込むこと**（分岐防止）。
- stash 3件（`作業中の変更を一時保存`＋WIP 2件）が残存・棚卸し未実施。

### 次にやること

- origin/develop の先行 2 コミットを pull で取り込む。
- C-1（未使用 npm 依存 7 件削除）から着手。C-8（依存バージョン整合）はユーザー判断待ち。

---

## 2026-07-06 全体クリーンアップ分析: 古い書き方・重複・未使用コードの洗い出し（診断＋計画のみ・コード変更なし）

ユーザー依頼「コードベース全体を分析して古い書き方・重複・未使用コードを洗い出し、テストが通る状態を維持したまま順番にリファクタリング計画を追記」。trpg-refactor スキル＋Explore 3系統（未使用/古い書き方/重複）＋司令塔 grep 裏取りで実施。

### ベースライン（司令塔実測）

build exit 0 / check:circular **No circular(480)** / 全 **187 suites 2613 tests 緑**（未コミットの F5+F10・2026-06-10/11 修正込み。AI.test.md 直近記録と一致）。jest 終了時に worker teardown リーク警告あり（全緑には影響なし）。

### 主要な発見（詳細と全リストは計画書へ）

- **未使用 npm 依存 7 件**（司令塔 grep 裏取り済・src+test 参照ゼロ）: `@aws-sdk/client-dynamodb` `@aws-sdk/util-dynamodb` `dynamoose` `pg` `express-session`、＋`typeorm`/`@nestjs/typeorm`（src ゼロ・test の mock 3 ファイルのみ）。`@types/uuid`/`eslint-plugin-import` は dependencies 配置間違い。
- **dead コード**: `DiceOrchestratorService` の 7 メソッド（F10 残課題リストと一致・外部非 spec 参照ゼロ確定。**`sendToParentChannel` は live** ＝ 2026-06-10 残課題リストの候補 8 件から 1 件訂正）／`discord/utils/discord.utils.ts` は **import 元ゼロ＝ファイルごと dead**／`PerformanceOrchestratorService.recordRateLimit`・`triggerAlert`（連鎖 liveness 要再確認）／lint script の実在しないディレクトリ ignore 2 件。
- **古い書き方**: console.\* 直接使用 **非テスト 31 箇所/9 ファイル**（diceRoll pagination に集中）／discord.js 非推奨 `ephemeral: true` 4〜5 箇所／**依存バージョン不整合**（Nest core v10 に v11 系サテライト `@nestjs/config@4`・`@nestjs/mongoose@11`・`@nestjs/schedule@6` ＋ `express@5`。src から express 直 import 多数＝型と実体の乖離が潜在）／tsconfig 第2段階フラグ未有効。**再発ゼロ確認**: process.env・forwardRef・@Global・ConfigService 直 inject・ModuleRef.get・旧バス系統。
- **重複**: `sendToParentChannel` private 実装が **5 handler に重複**／エラーハンドリング 3 系統（うち 1 つは dead 候補）／キャラ embed 生成 2〜3 系統・ダイス計算 5 系統（いずれも中期・要設計）。any 非テスト約 204 件は event contracts に集中＝ **E-4a と同時解消が効率的**。

### 実施計画

- **`docs/refactor/refactor-legacy-cleanup-plan-2026-07-06.md` に C-1〜C-10 の bounded slice として策定済み**（リスク昇順・各 slice の動作保証テスト方針・検証ゲート・E/F 系列との依存関係を定義）。
- 順序: C-1（依存削除）→ C-2（dice dead 撤去=F10 完遂）→ C-3（dead 第2弾）→ C-4〜C-6（重複統合/console/ephemeral）→ C-7（DiscordService ラッパー解体・E-5 進捗確認後）→ C-8（バージョン整合・**要ユーザー判断**）→ C-9（tsconfig 第2段階）→ C-10（jest リーク）。
- E 系列（イベント設計計画）とは独立実施可能。`DiscordInteractionHandlerService` の dead メソッドは E-5 へ吸収（二重作業禁止）。

### 次にやること

- C-1 から順に着手（C-1〜C-3 は純粋な削除系＝characterization 前倒し不要の例外規定を適用、build/全 suite/start:dev で担保）。
- C-8（Nest v11 アップグレード / v10 整合ダウングレード / 現状維持記録）はユーザー判断待ち。

---

## 2026-07-06 ドメイン別 設計ガイドスキル作成（trpg-domain-\*・5本）

ユーザー依頼「下位モデル（Opus/Codex）が参照して設計不備にならないよう、ドメインごとの責務・役割・
やること・やらないことを整理したスキルを作成」。skill-creator スキルのワークフローに沿い、
Explore 3系統（auth/user・character/dice-roll・discord features）で実コードを裏取りしてから執筆。

- **新規スキル（`.claude/skills/`・git 管理）**: `trpg-domain-auth` / `trpg-domain-user` /
  `trpg-domain-character` / `trpg-domain-dice-roll` / `trpg-domain-discord`。
  各スキルは 役割・構成マップ・公開API・やること/やらないこと・既知の落とし穴・検証手順 を定義。
  同日の設計評価で確定した禁止事項（**イベント RPC（waitForEvent）禁止・素の EventEmitter2 禁止・
  H6 循環の再導入禁止・S-1 projection の罠・スレッド保存キーの意味論**）を明文化して下位モデルの再発を防ぐ。
- **エコシステム配線**: `trpg-architecture`（地図）にドメインスキル一覧の節を追加、`trpg-refactor`（司令塔）の
  役割分担と委譲プロンプトの型に「該当 trpg-domain-\* スキルの禁止事項を委譲プロンプトへ注入」を追加。
- 注意: `AI.domain.md` の「イベント駆動パターン」例（requestCharacterSearch）は現方針（クエリは DI 直呼び）と
  矛盾する旧例のため、各スキルで明示的に「踏襲しない」と記載した。

---

## 2026-07-06 設計評価: discord 層⇔ドメイン層の接続・イベント設計（診断のみ・コード変更なし）

ユーザー依頼「TRPG-SERVER の設計評価（discord アプリケーション層とドメイン層の繋がり・イベント設計）」。
trpg-architecture スキル＋Explore 2系統（discord→domains 依存全数・イベント emit/listen 全数）＋司令塔裏取りで診断。

### 健全（裏取り済）

- 依存方向は discord→domains の一方向のみ（逆流ゼロ・実コード forwardRef ゼロ・discord 層からの Mongoose 直アクセスゼロ）。
- Interaction Registry（明示登録・競合検出・未登録統計）と feature 自己登録方式は設計通り機能。

### 発見した構造問題（優先度順）

1. **イベント RPC（waitForEvent + Promise.race）の構造バグ**: `character-display.service.ts:60-71` / `channel-name-sync.service.ts:64-78` は emit（emitAsync＝ハンドラが同期チェーンで完走し `.completed` は発火済み）の**後**に waitForEvent を登録するため**必ず 3〜5 秒タイムアウト**。channel-name-sync は DB 更新成功でも false を報告。correlationId が無いため併走時は他リクエストの応答と混線し得る（wait 先行の他 6 サービスも同様）。Promise.race の負け側 waiter は timeout 時 unhandled rejection ＋ once リスナー残存。**推奨: クエリ系 11 箇所はイベントをやめ CharacterService/DiceRollService の DI 直呼びへ**（イベントは通知専用に限定）。
2. **バス 2 インスタンス残存**: `core-events.module.ts` は `EventEmitterModule.forRoot()`（素の EventEmitter2）と `'TYPED_EVENT_EMITTER'`（別 new）の両方を提供。`interactions.service.ts:36-85` は素のバスへ `discord.interaction.start/processed` を emit（恒常購読者ゼロ＝dead）。
3. **dead contracts 10+ 件**: `character.*.failed` 全て・`diceroll.execute.*`・`discord.message.send.requested`・`characterEdit.section/field.selected` 等が emit のみ（`findBy*.completed/failed` は waitForEvent の一時 once のみが受け手）。
4. **契約の二重管理**: `unified-event-contracts.ts` と `contracts/index.ts`（AppEventContracts）が並存。EVENT_NAMES 定数は 8 件のみで残りはマジック文字列、`characterEdit.creation.*` は契約外（as any キャストあり）。
5. **ドメイン層の薄さ／永続化モデル露出**: domains 39 ファイル vs discord 198（features 119）＝ビジネスロジックの主体が discord 層。Character（Mongoose @Schema）が discord 層 30+ ファイルに型露出（entity/schema 未分離・`discordThreadId`/`threadId` 重複）。`domains/character/character.controller.ts:294,334` が `discord.*` イベントを発行＝ドメインパッケージが Discord ユースケースを知る（ARCHITECTURE §9 と緊張）。同一クエリ（findByChannelId）に DI 直呼びとイベント RPC の 2 経路が併存（S-1 projection 型の片経路バグの温床）。
6. 3 層ルーティング残存（`DiscordInteractionHandlerService` の Map キャッシュ（登録ゼロ）→ InteractionsService → Registry。DESIGN.md Phase 2 未了）。

### 次にやること（提案・未着手）

- **実施計画を `docs/refactor/refactor-event-design-plan-2026-07-06.md` に策定済み**（E-1〜E-6 の bounded slice・依存順序・検証手順・スコープ外を定義）。
- 問題 1 の 2 箇所は実挙動バグのため優先修正候補（正攻法はイベント RPC の DI 化＝クエリをイベントで行わない → 計画 E-2）。
- 問題 2〜4 は events 統合の追加 slice（dead emit 撤去=E-3・契約一本化/素バス排除=E-4）。問題 5 は entity/schema 分離の中期テーマ（E-6・別計画書に切り出し予定）。

---

## 2026-06-10 F5+F10 dead-code 掃除（trpg-refactor スキル・nestjs-best-practices へ2 slice 委譲・司令塔裏取り）

ユーザー依頼「次の作業は何か」→ 残課題棚卸し（本ファイル「次にやること」＋ `docs/reviews/project-issues-report-2026-06-05.md`）からユーザー選択で **F5（postActionButtons dead path）と F10（dice services の dead preset メソッド）の撤去**を実施。純粋な dead-code 削除のため characterization 前倒しは省略（build / check:circular / 既存 spec で挙動不変を担保＝Phase 3 例外規定・理由記録）。**合計 -582行/+47行・未コミット**。

### Slice 1 — F5: `postActionButtons` dead path 撤去（4ファイル・-78行）

- 撤去: `ThreadInteractionService.postActionButtons`（`character_edit_`/`dice_roll_`/`character_info_` ボタン生成。唯一の呼び出し元 `thread-orchestrator.service.ts:79` はコメントアウト済＝dead を司令塔が実コードで裏取り）＋当該コメント行＋`thread-interaction.service.spec` の describe＋`handlers.integration.spec` の dead path characterization（その it しか含まない describe ごと削除・**登録数 23 期待値は不変**）。

### Slice 2 — F10: dead preset チェーン撤去（DicePresetService 丸ごと・6ファイル）

- 司令塔裏取りで **記録（メソッドのみ）より広い dead** と確定: `DiceOrchestratorService` の live 利用は `custom-dice-modal.service` の6メソッド（calculateAndRoll / executeBasicNotation / getResultEmoji / getBasicResultEmoji / sendToParentChannel / sendToParentChannelBasic）のみ。preset 系4メソッド（`handlePresetDiceRoll`/`createPresetButton`/`validatePresetConfig`/`legacyHandlePresetDiceRoll`）は production 呼び出し元ゼロ、`DicePresetService` の参照は orchestrator 委譲のみ → **サービス丸ごと dead**（`preset-dice*` handler は S-5c で撤去済み）。
- 撤去: orchestrator の preset 4メソッド＋`presetService` 注入＋`getServiceStats` の言及、`dice-preset.service.ts`(+spec) 削除、`dice-services.module` providers/exports、`services/dice/index.ts` re-export、orchestrator spec の preset describe（constructor 引数 3→2）。
- docs/docstring 追従（司令塔が直接実施）: `dice-roll.module.ts`/`character-thread-feature.module.ts` の docstring、`services/dice/README.md`（dice-preset 節を撤去注記化・現役プリセットは characterThread の `PresetDiceQuickRollHandler` へ誘導）、`AI.discord.md`。

### 検証（司令塔再裏取り）

- build exit 0 / check:circular **No circular(480)**（削除2ファイル分減・整合）/ **全スイート 187 suites 2625→2603 tests 緑**（−1 suite/−22 tests＝削除した dead spec 分と整合・新規破損ゼロ）/ **start:dev 正常起動・batch 8+6+9＝23 handler 不変・tsc 0 errors・DI 解決エラーなし** / 撤去シンボルの残存参照ゼロ（grep・.ts）/ `/code-review`（medium・7 angle）**finding ゼロ**。

### 残課題（スコープ外・記録のみ）

- `DiceOrchestratorService` の他の呼び出し元ゼロ候補: `legacyCalculateAndRoll` / `legacyParseAndCalculate` / `executeNotation` / `parseFormula` / `evaluateFormula` / `convertToDiceNotation` / `parseAndCalculate` / `getServiceStats`（live は上記6メソッドのみ）。撤去は別 slice（要 grep 再確認）。

### 次にやること

- 本2 slice のコミット（ユーザー承認時・slice 単位・pathspec 限定）。
- 既存残: develop の origin push 判断 / F1+F2（フロント jest roots・characterCreate 空送信）/ F7 プリセット本格ルール / CI 導入・CRLF churn 根治（.gitattributes）。

---

## 2026-06-07 ブランチ `refactor/ref-path-deadcode-cleanup` を develop へマージ（trpg-refactor スキル・司令塔）＋マージ前ブロッカー修正

ユーザー依頼「色々 develop にマージしたい」。調査の結果、**develop 未マージは本ブランチ1本のみ**（他の H1/H3/H6/H9/T2-T5/B-2/events/config/security 系は全てマージ済み）と判明。本ブランチは develop の HEAD を直接の祖先とする**クリーンな FF**（81コミット・304ファイル・+9092/−12858＝ダイスボタン customId 統合キャンペーン S-1〜S-5c ＋ P1-A/B/C/D・構造課題・events 統合・参照パス整理・docs 再編）。

### マージ前 Phase 6 検証で発見したブロッカー（重要）

全スイート実行で **controller spec 3本（auth/user/character）がコンパイルエラーで全件未実行のまま「緑」と誤記録**されていたことが判明。根因と修正の詳細は `AI.test.md` 2026-06-07 節。要点: P1-C(`98d5055`) の filter コンストラクタ `AppConfigService` 注入化に 3 spec が未追従（`auth` の TestingModule だけ正しく `appConfigServiceMock` 登録済・他2本は未提供＋手動 `new` の引数不足）。**コミット `4d41d94`** で修正し、build 0 / check:circular No circular / 全 188 suites 2625 tests 緑を司令塔裏取り。

### マージ実施

- **`--no-ff`**（develop の慣例＝"Merge X into develop" に整合）で `refactor/ref-path-deadcode-cleanup` を develop へマージ。マージコミット **`5b15db8`**（親＝旧 develop `639756d` ＋ branch tip `4d41d94`）。FF 可能だが慣例に合わせ merge commit を作成。コンフリクトなし。
- マージ後の develop で build 0 / check:circular **No circular(482)** を再確認。
- **origin への push は実施せず**（ユーザー選択＝ローカルのみ。develop は origin/develop より 108 コミット先行）。

### ブランチ整理（ユーザー選択＝マージ済み削除）

develop へマージ済みのローカルブランチ **24本を `git branch -d`（安全削除）**: `docs/circular-zero`, `test/events-flow-coverage`, `refactor/`{`auth-user-cycle-h6`, `character-spec-repair`, `config-aggregation`, `cross-cutting-conventions-h1`, `discord-character-ui`, `discord-enhanced-edit`, `discord-modal-handler`, `discord-service-split-dicebuttons`, `discord-service-split-embedmgr`, `discord-service-split-h3`, `discord-testability-backlog`, `discord-thread-creation`, `error-handling-h9`, `error-handling-h9-character`, `events-bus-unification`, `events-docs-t5`, `events-globalbus-removal`, `events-globalbus-removal-t2c`, `events-globalbus-t2b`, `events-layer-inversion-t3`, `events-typed-relocation-t4`, `security-phase-s`}。残ローカルブランチ＝`develop` / `main` / `refactor/ref-path-deadcode-cleanup`（現ブランチは残置）。

### 次にやること

- `develop` の origin push（必要時）。ローカルは 108 コミット先行。
- `refactor/ref-path-deadcode-cleanup` は develop に取り込み済みのため、不要になったら削除可。
- 残 follow-up（任意・別 issue）: `DiceOrchestratorService` の dead な preset メソッド（`createPresetButton`/`handlePresetDiceRoll`）除去。

---

## 2026-06-04 問題点の洗い出し（Codex 相談・司令塔裏取り）＋ roll\* customId 契約 案2 確定・実装計画

ユーザー依頼「Codex と相談しながら今の問題点を洗い出す」。trpg-refactor スキルで Phase 1（コード理解）に集中し、Codex 相談＋司令塔裏取りで診断。**コード変更なし（診断＋計画のみ）**。

### 健全性ゲート（裏取り済・良好）

- `pnpm run build` OK / `pnpm run check:circular` **No circular(507)** / 実コードの `forwardRef`・`process.env` 直接参照・`ModuleRef.get` は**すべてゼロ**（残はコメントのみ）＝P1-A/B/C の構造目標は達成済みと確認。

### 確定した正確性バグ（優先度1・司令塔が実コード裏取り済）

1. **`findByChannelId` projection 不足**（`domains/character/repositories/character.repository.ts:54`）: `.select(...)` に `skill`/`parameter`/`status`/`gameSystemId` が無い。→ P1-D で配線した **`skill_` ボタンは本番で常に「スキルが見つからない」**。preset 本格ルールの前提も崩れる。**1行修正**。
2. **`roll*1d100`（channelId 無し）が throw**: live 生成 `createDiceRollActionRow`（thread-creation.util.ts:220）が channelId 抜きで生成 → `CharacterDiceOrchestratorService.extractChannelId`(`split('*')[1]`) が null → `Channel ID could not be extracted` throw → fallback エラー。スレッドの基本ダイスボタンが壊れている。
3. **`roll*1d100*{characterId}` が characterId を channelId 誤用**（character-display.service.ts:394 / characterEdit character-embed.util.ts:447）→ キャラ未検出。
4. **modal field 名不一致**: `flexible-dice-select.handler.ts:106` が `dice-reason` で生成、`custom-dice-modal.service.ts:38` が `dice-comment` を読む（`getTextInputValue` は不在 field で throw）。Codex 追加発見で `dice-expression`/`roll-reason` 系統の不一致も存在＝想定より広い。
5. **技能/能力ロール `roll*_{name}-{value}` が孤児**: `DiceRollSkillHandler` pattern `/^roll\*[^_]+_/` は `roll*` 直後が `_` の生成形式にマッチせず未routing（handler は在るのに契約食い違い）。`skill_select_{name}_{value}` も孤児。

> 仮説修正の記録: 当初「`roll*` 全体が未routing」と見たが、Codex 相談＋裏取りで「`DiceRollGeneralHandler` pattern `/^roll\*\d+d\d+/` で routing はされるが channelId 抽出で落ちる」「`roll*custom` は startsWith で routing 済」と是正。

### 構造/設計負債（優先度2）

- **`roll*` ダイスUI 生成が5箇所以上に重複**（thread-creation.util / character-channel.service / character-display.service / dice-ui-builder.service / characterEdit character-embed.util）。suffix 有無で routing 挙動が変わる＝バグ2/3 の根本原因。
- **legacy `roll*` 系（スレッド内表示＋履歴）と新 `dice_generic_` 系（親投稿）が二重化**し、両者とも `DiceRollLogicService.handleDiceRoll` に収束。
- **`CharacterChannelService` は module 登録のみで live 呼び出し元が見当たらず＝dead 候補**（削除候補）。`DiceUIBuilderService`(character-channel-orchestrator 経由) は live 性要再確認。

### ドキュメント不整合（優先度3）/ テスト負債（優先度4）

- `AI.refactor.md`/`CLAUDE_HANDOFF.md` が `postActionButtons` を「dead」と記載するが、thread-creation.service 経由の `roll*` 生成は live＝記述ズレ。`interactions/README.md`/`MIGRATION_GUIDE.md` は「Phase 1 未着手」のまま陳腐化。
- handler integration spec は `registry.hasHandler()`（routing 有無）しか見ず、**executor 契約（channelId 抽出・projection 依存）が未テスト**＝バグ1〜3 が緑のまま見逃された。

### ★ユーザー確定の仕様決定（roll\* customId 契約）

1. **表示挙動 = 案2: `dice_generic_` に統一（親チャンネル投稿）**。roll\* のスレッド内 editReply 表示は廃止。**UX 変更を承認**。
2. **旧ボタン救済しない**（channelId 無しの既存貼り済みボタンは対象外・新規生成のみ修正）。
3. **技能/能力ロールは key ベース**（customId に skillKey/abilityKey を持たせ character から再解決。`roll*_{name}-{value}` の表示名+値形式は廃止）。

### 目標契約セット（案2）

- 基本ダイス = `dice_generic_{diceType}_{channelId}`（既存流用・親投稿）
- 技能 = `skill_{channelId}_{skillKey}`（既存流用・key ベース）
- 能力 = **新規 `ability_{channelId}_{abilityKey}`**＋新 handler（skill\_ 同型・`character.parameter` から再解決）
- custom = **channelId 付き契約に整理**＋modal field 名統一（CustomDiceModalService を characterId→channelId 解決へ）

### 実装計画（bounded slice・Codex 起案）

- **S-1**: `findByChannelId` projection 修正（前提・1行＋spec）
- **S-2**: modal field 名統一（`dice-command`+`dice-comment` 系へ。`dice-reason`/`dice-expression`/`roll-reason` の多重不一致を先に grep 棚卸し）
- **S-3**: 能力 handler 新設（`ability_` 契約＋handler＋registry 登録＋parameter 再解決）
- **S-4**: live 生成サイト移行（thread-creation / character-display / characterEdit character-embed /（要確認）dice-ui-builder を新契約へ。characterization の旧 roll\* 期待値を更新）
- **S-5**: legacy `roll*` handler/生成の撤去＋dead（CharacterChannelService 等）整理
- 各 slice 共通検証: tsc --noEmit / build / check:circular（No circular）/ 関連 jest / start:dev（registry 登録・pattern conflict なし）。

### 未確定（実装前にユーザー/司令塔が決める）

- **能力(ability)の対象範囲**: `parameter` のみか `status` も含めるか（characterEdit は status/parameter/skill すべてに roll button を生成）。S-4 着手前に決定。
- custom modal の channelId 統一に伴う `CustomDiceModalService.findOne`→`findByChannelId` 変更の影響範囲。
- `DiceUIBuilderService`/`CharacterChannelOrchestratorService` の最終 live/dead 判定（S-5 前）。

### S-1 完了（2026-06-04・projection 修正・挙動変更=バグ修正の前提整備）

- `character.repository.ts` の `findByChannelId` の `.select(...)` に `status skill parameter gameSystemId` を追加（既存 `attributes/primaryAttributes/createdAt/updatedAt` 等は維持＝additive）。
- characterization: 既存 `character.repository.spec.ts` の findByChannelId が select 文字列を exact 固定済みだったため、現挙動の緑（24）を確認 → 期待値を新 select に更新（24 緑）。
- 検証（司令塔）: `pnpm run build` exit 0 / `check:circular` **No circular(507)** / repository spec 24 緑 / 消費側 `character.service`＋`character-skill-roll.handler` spec 26 緑 / 差分は当該2ファイルのみ（CRLF churn 巻き込みなし）。
- 効果: これで `skill_` ボタン（および key 再解決系）が `character.skill`/`parameter` を取得できる前提が整った（projection 不足による「スキルが見つからない」を解消）。未コミット（ユーザー承認時にまとめてコミット）。

### S-2 完了（2026-06-04・modal field 名統一・挙動変更=バグ修正）

modal field 全棚卸しで canonical 契約を確定: **受け手 `custom-dice-modal.service`** は `param-dice-modal*`→`dice-formula`+`multiplier`+`modifier`+`dice-comment` / `custom-dice-modal*`→`dice-command`+`dice-comment` を読む。これに対する生成側の不一致は2つ:

- **(修正) `flexible-dice-select.handler.ts:106`**: custom modal の理由 field が `dice-reason`＝受け手の `getTextInputValue('dice-comment')` が不在 field で throw → カスタムダイス送信が失敗していた。`dice-comment` に統一。**flexible*dice* 経路は案2で残る durable path** のため S-2 で実施。
- **(S-2 では記録のみ) `dice-button-ui.service.ts:87,96`**: `dice-expression`/`roll-reason`（受け手は `dice-command`/`dice-comment`）。これは **`roll*custom` 経路＝案2で retire 予定**のため、S-4（生成移行）/S-5（dead 整理）で対応（今 fix すると churn）。`character-dice-buttons.service`/`character-thread-select.service` は既に canonical で fix 不要。

検証: characterization-first（実 discord.js を unmock し modal.toJSON() の field を検証＝`dice-button-ui.service.spec` と同方針）で **RED（dice-reason で fieldIds 不一致）→ 修正 → GREEN（6）**。build exit 0 / check:circular **No circular(507)** / 受け手 `custom-dice-modal.service.spec` 9 緑 / 差分は handler＋spec の2ファイルのみ。未コミット。

### S-3 完了（2026-06-04・能力 handler 新設・additive＝既存挙動不変／nestjs-best-practices へ委譲・司令塔裏取り済）

`skill_` の完全ミラーで能力(ability)ロールを新設。**新規5＋編集3（全 additive・削除なし）**:

- 新規 `custom-id/ability-roll.custom-id.ts`（`AbilityRollCustomId`: pattern `ability_`・`create(channelId, abilityKey)`=`ability_{channelId}_{abilityKey}`・`parse`。skill と同一分割意味論）＋ spec。
- 新規 `services/ability-roll.util.ts`（`resolveAbilityRoll`: `character.parameter?.[abilityKey]` を読み `extractSkillLevel`(skill-roll.util から再利用)で数値化・不在 null）。
- 新規 `handlers/ability-roll.handler.ts`（`AbilityRollHandler`: parse→findByChannelId→resolveAbilityRoll→**`DiceRollLogicService.handleSkillRoll` 再利用**（新メソッドなし）→親投稿。CharacterSkillRollHandler 同型）＋ spec。
- 編集 `custom-id/index.ts`（export 1行）／`character-thread-feature.module.ts`（import/providers/constructor/onModuleInit に各1行）／`handlers.integration.spec.ts`（登録 **27→28**・`ability_*` match assertion 追加）。
- 検証（司令塔再裏取り）: build exit 0 / check:circular **No circular(512)** / 3 spec **66 緑** / 新規は untracked・編集は additive のみ（CRLF churn・無関係 revert なし）。**handler 追加は additive で現 routing 不変**（生成側未配線のため実 routing 有効化は S-4 後）。未コミット。

### ★ユーザー確定（2026-06-04・S-4 前提）: status は表示専用

- **能力(ability)対象範囲 = `parameter` のみ**。**status セクションのロールボタンは S-4 で撤去**（status は表示専用＝機能削減を許容）。
- 新契約は **基本=`dice_generic_` / 技能=`skill_` / 能力=`ability_`** の3種＋custom（S-4 で channelId 付き契約に整理）。
- マッピング: skill 生成 → `skill_` / parameter 生成 → `ability_` / 基本ダイス → `dice_generic_` / status 生成 → **削除** / custom → 新 custom 契約。

### 次アクション（S-4 sub-slice 分割）

S-1/S-2/S-3 完了。S-4 は behavior-changing（スレッド内→親投稿・status ボタン撤去）かつ多サイトのため**生成サイト単位の sub-slice**で進める（各独立コミット・characterization は既存 spec が旧 customId 文字列を固定→新契約へ更新）:

- **S-4a**: `thread-creation.util` / `ThreadCreationService` の基本ダイス（`roll*1d100/1d6/2d6`→`dice_generic_`）＋技能（`roll*_…`→`skill_`）＋能力（→`ability_`）＋status ボタン撤去。channelId を生成に渡す signature 化が要る。

> ★ S-4 着手前の重要発見（2026-06-04・司令塔トレース）: **thread 生成に live 経路が2系統併存**している。
>
> - **select 経路**: `character-thread-select.service` → `CharacterThreadOrchestrator` → `ThreadCreationService`（`thread-creation.util` の `createDiceRollActionRow`=`roll*1d100`壊 / `createSkillRollActionRows`=`roll*_`孤児 / preset）。
> - **event 経路**: `discord.thread.create.requested`・`character.update.completed` → `ThreadOrchestratorService` → `ThreadInteractionService`（`SkillRollCustomId.create(discordChannelId, skillKey)`=`skill_`・`FlexibleDiceSelectCustomId`・dice*generic*・preset。基本 roll は `postActionButtons` コメントアウトで非生成・`character_edit_`等は未routing）。
> - 含意: **P1-D で配線した `skill_`/`dice_generic_` は event 経路にしか効いておらず、select 経路（ThreadCreationService）は依然 broken な `roll*`/孤児 `roll*_` を生成**。canonical channelId 源は両経路とも `character.discordChannelId`。
> - したがって S-4a は「ThreadCreationService の生成を ThreadInteractionService と同じ新契約へ揃える」作業。さらに ThreadCreationService(+util) と ThreadInteractionService は skill/flexible/preset 生成が**重複実装**（最終的には S-5 で1系統へ統合すべき）。S-4 は単純移行でなく**dual-path 解消を含む**ため、経路ごとに characterization を張って慎重に進める（Codex 相談も検討）。

- **S-4b**: `character-display.service`（tab 表示の `roll*…*{characterId}`）を新契約へ。
- **S-4c**: characterEdit `character-embed.util`（`roll*…*{characterId}`）を新契約へ。
- **S-4d**: `roll*custom`→新 custom 契約（channelId 付き）移行に合わせ `dice-button-ui.service` の field 不一致（`dice-expression`/`roll-reason`）解消。`dice-ui-builder.service` の live/dead 最終判定。
- **S-5**: legacy `roll*` handler（General/Skill/Custom）/ 残存生成と dead（CharacterChannelService 等）を撤去。

### dual-path 統合戦略（Codex 相談・2026-06-04）＋ live/dead 裏取り

ユーザー選択「dual-path 統合戦略を Codex に相談」に基づく。

**Codex 推奨 = Option 1**: `ThreadCreationService`（select 経路）がボタン UI 生成を **`ThreadInteractionService`（or 単一 UI helper）へ委譲**し生成を単一化。`roll*` 生成を Path A から消す。

- Option 2（util を新契約へ直書き）＝重複残存で却下。Option 3（domain 層 DiceUiPort）＝「domain service は Discord/UI 非依存」違反＋循環リスクで却下。

**司令塔の live/dead 裏取り（S-4 スコープを縮小）**:

- **live な broken `roll*` 生成は実質 Path A（`ThreadCreationService`→`thread-creation.util`）に集約**。
- **dead（production call-site ゼロ・S-5 撤去対象）**: `CharacterDisplayService.createSkillRollButtons/createBasicDiceButtons`（外部呼び出し元なし）／`CharacterChannelOrchestratorService`→`DiceUIBuilderService`（module 登録のみ・entry なし）／`CharacterChannelService`／`ThreadInteractionService.postActionButtons`（call-site コメントアウト）。
- **要確認（S-4c）**: characterEdit `character-embed.util` の `roll*` 生成（別 feature・live 表示に乗るか未確定）。

**Codex 改訂 S-4 sub-slice**: S-4.1 両 path の現挙動を characterization 固定 → S-4.2 custom/flexible の channelId 付き契約策定（`custom_dice_{channelId}` 新設 or 既存 `custom-dice-modal*{channelId}` 流用を確定）→ S-4.3 Path A のボタン生成を ThreadInteractionService へ委譲（主スライス）→ S-4.4 status 撤去・ability rendering → S-4.5 dead generator 隔離 → S-5 撤去。

**ユーザー判断が要る分岐点（次セッション着手前）**:

1. Path A（select 直叩き）を event 経路へ**完全収束**させてよいか（characterization 後に Path A 廃止 / 併存）。
2. Path A の投稿内容・投稿先を Path B に**完全合わせ**してよいか（UI 微差の許容）。
3. ability ボタンは常時表示か、skill と同グルーピングか。
4. custom の canonical customId = `custom_dice_{channelId}` 新設 / `custom-dice-modal*{channelId}` 流用（後者が「channelId-bearing」を満たすか確認）。
5. dead（DiceUIBuilder/CharacterChannel 等）は live 不在を最終確認のうえ S-5 で撤去、の順序でよいか。

### ★ユーザー確定（2026-06-04・推奨デフォルト採用）＋ S-4.1 完了

確定デフォルト（上記分岐点の回答）: **Option 1 で Path A を event 経路の契約へ完全収束** / custom は既存 **`custom-dice-modal*{channelId}` 流用**（S-2 で field 修正済・channelId-bearing） / ability は skill と同様に**常時表示** / dead は **S-5 で撤去**。

**S-4.1 完了（characterization・新規コード変更なし）**: Path A の全生成器の現挙動が `thread-creation.util.spec.ts` で **exact 固定済み**であることを確認（安全網が既存）:

- `createDiceRollActionRow` → `['roll*1d100','roll*1d6','roll*2d6','roll*custom']`（spec:138）
- `createSkillRollActionRows` → `roll*_回避-40*char-123`（spec:226・label `回避(40)`）
- `createParameterSelectMenu` → `flexible-dice-param*char-123`（spec:147）/ `createPresetButtons` → `preset-dice*char-123*parameter*str*60*3`（spec:179）
- baseline: thread-creation.util + thread-creation.service spec **36 緑**。S-4.3 でこれらの期待値を新契約（`dice_generic_`/`skill_`/`ability_`・status 除外）へ更新する（意図的な before→after）。

**次**: S-4.2（custom 契約は流用確定のため軽微）→ **S-4.3（Path A のボタン生成を ThreadInteractionService へ委譲＝主スライス・behavior-changing）**。S-4.3 以降は nestjs-best-practices へ委譲予定。

### S-1/S-2/S-3 コミット完了（2026-06-04・ユーザー承認・pathspec 限定）

事前 staged の無関係差分・CRLF churn を巻き込まず、自分の差分のみを独立コミット:

- **S-1** `92245cd`（character.repository.ts + spec・2 files）
- **S-2** `0959a35`（flexible-dice-select.handler.ts + spec・2 files）
- **S-3** `eadf8ee`（ability-roll 新規5＋編集3・8 files）

### S-4.3 精査で判明（2026-06-04・要レイアウト確定）

「委譲」は thin でなく converged レイアウト確定が前提:

- ThreadInteractionService(event 経路) は **基本ダイスの独立行を持たない**。`createGenericButtons`(`dice_generic_` 1d6/2d6/1d20/1d100) は **generic ゲームシステム時の preset fallback** としてのみ生成（`postPresetDiceButtons` の default ケース）。
- 2サービスの **preset 実装が別物**: Path A=`createPresetButtons`(`preset-dice*{id}*…`) / event=ゲームシステム別(`dice_coc7_`等)＋generic(`dice_generic_`)。
- **ability 生成はどちらの経路にも無い**（S-3 で handler/契約は新設済だが UI 生成は未）。
- channelId 源: event 側は `character.discordChannelId`（generic は `|| characterId` fallback）。
- → S-4.3 = ThreadCreationService.displayCharacterInfo を ThreadInteractionService の post 系（flexible/preset/skill＋新規 ability）へ委譲し、Path A 独自の roll* 基本行・util 生成を撤去。**ThreadInteractionService に postAbilityRollButtons(parameter 反復・`AbilityRollCustomId`) を新設**。レイアウトは event 経路に揃える（基本 roll* 独立行は廃止し flexible/preset でカバー）。

**要ユーザー確定**: 新規スレッドの converged レイアウト（推奨: フレキシブルダイス＋プリセット＋スキル＋能力。基本 `roll*1d100` 独立行は廃止）。

### S-4.3 完了（2026-06-04・dual-path 収束・behavior-changing／nestjs-best-practices 委譲・司令塔裏取り＋start:dev 実機確認）

ユーザー確定レイアウト=_*基本ダイス(dice*generic\*)＋フレキシブル＋プリセット＋スキル(skill\*)＋能力(ability_)**（基本行は残し dice*generic* で修復・custom は flexible メニュー）。

- **ThreadInteractionService**（単一生成元）に public `postBasicDiceButtons`（`dice_generic_{1d100/1d6/2d6}_{discordChannelId}` の3ボタン行）と `postAbilityRollButtons`（`postSkillRollButtons` ミラー・`character.parameter`→`ability_{discordChannelId}_{key}`）を新設。
- **ThreadCreationService**（select 経路）: `ThreadInteractionService` を注入し `displayCharacterInfo` の try/fallback 両方で5 post メソッドへ委譲。roll* 生成依存の private 4メソッド（postActionButtons/postSkillRollButtons/postFlexibleDiceMenu/postPresetDiceButtons）と未使用化した util import を撤去。→ \*\*select 経路の broken `roll*`/孤児 `roll\*\_` 生成を解消\*\*。
- **ThreadOrchestratorService**（event 経路）: 既存 flexible/preset/skill に basic/ability を additive 追加し両経路を収束。
- 検証（司令塔再裏取り）: build exit 0 / check:circular **No circular**（ThreadCreationService→ThreadInteractionService は循環なし）/ 4 spec **105 緑**（thread-interaction/creation/orchestrator + handlers.integration）/ **start:dev で `AbilityRollHandler [button] → ability_` 含む全 handler 登録・bot 接続・Cannot resolve/DI/循環エラーなし**＝挙動（DI 解決）確認。diff は当該6ファイルのみ（CRLF churn 非混入）。**コミット済 `d6410a6`**（pathspec 限定）。
- 軽微: `postAbilityRollButtons` の docstring に「値0以下スキップ」とあるが実装は skill ミラーで個別スキップなし（doc 微差・挙動は skill と一貫）。

### S-4c 完了＝dead 確定（2026-06-04・司令塔トレース）＋ S-4 機能的完了

**characterEdit の roll\* は dead**: `buildCharacterDiceRollButtons`(character-embed.util.ts:383) は行分割ループが**コメントアウト**され**常に `[]` を返す**（buttons[] を組むが actionRows に積まない）。`buildSectionedEmbeds:496` の `components.push(...diceRollButtons)` は空 push。`sendSectionedEmbeds`(components 送信あり) は**呼び出し元ゼロ**、live な `createSectionedEmbeds` 利用（enhanced-character-edit:76,495）は `{ embeds }` のみ・message-updater も実質 roll* を含まない。→ characterEdit は roll* を Discord に出さない。

**結論: live な broken roll\* 生成は S-4.3 で解消済みの Path A のみ。S-4 は機能的に完了**（残りは純粋な dead-code 整理＝S-5）。

### S-5 dead-code インベントリ（司令塔が grep 検証・撤去対象）

全 src で _*roll* / character-dice_ を生成する live コードは皆無**（S-4.3 後）。よって以下は全て dead（登録されるが発火しない handler 含む）:

**A. 純粋関数/メソッド（DI 非関与・低リスク）**

- `thread-creation.util.ts`: `createDiceRollActionRow`/`createSkillRollActionRows`/`createParameterSelectMenu`/`createPresetButtons`/`chunkButtonsIntoRows`（非spec 呼び出し元ゼロ）＋ 対応 spec describe。
- `characterEdit/utils/character-embed.util.ts`: `buildCharacterDiceRollButtons`/`appendDiceRollButtonsFromData`/`buildBasicDiceButtons`/`extractDiceRollValue`（dead チェーン）＋ `buildSectionedEmbeds` の dead push（494-496）＋ 対応 spec。
- `character-display.service.ts`: `createSkillRollButtons`/`createBasicDiceButtons`（呼び出し元ゼロ・サービス自体は embed 用に live なのでメソッドのみ）。

**B. dead サービス（DI provider 撤去・中リスク）**

- `CharacterChannelService`（module 登録のみ・呼び出し元ゼロ）。
- `CharacterChannelOrchestratorService` ＋ `DiceUIBuilderService`（production entry なし）。
- characterEdit `CharacterEmbedManagerService.sendSectionedEmbeds`（呼び出し元ゼロ・メソッドのみ）。

**C. dead 登録 handler クラスタ（registry 登録あり・発火なし・高リスク＝start:dev で handler 数確認必須）**

- characterThread: `CharacterDiceHandler`（pattern `character-dice`・生成元なし）＋委譲先 `CharacterDiceButtonsService`＋`CharacterDiceHistoryService`。
- diceRoll: legacy `DiceRollGeneralHandler`(`^roll\*\d+d\d+`)/`DiceRollSkillHandler`(`^roll\*[^_]+_`)/`DiceRollCustomHandler`(`roll*custom`) ＋委譲先 `CharacterDiceOrchestratorService`＋`DiceButtonUIService`＋`DiceHistoryService`。
- **注意**: 撤去で registry 登録数が減る（現 runtime 総数から general/skill/custom/character-dice の4 handler 減）。module の providers/onModuleInit/registerHandlers 更新＋handlers.integration.spec の登録数・hasHandler 期待値更新が必要。`DiceRollModalHandler`/`DiceRollPresetHandler`/pagination 等は live のため残す。

**進め方**: A→B→C の順（リスク昇順）で独立スライス。各 build/check:circular/jest、C は start:dev で handler 登録数・無エラーを必ず確認。`DiceRollLogicService`・preset・flexible・skill*・ability*・dice*generic* は live のため絶対残す。

#### S-5a 完了（2026-06-04・group A 純粋関数 dead 撤去・コミット `9dfede7`・nestjs 委譲＋司令塔裏取り）

- 撤去: thread-creation.util の5関数／character-embed.util の buildCharacterDiceRollButtons・appendDiceRollButtonsFromData・buildBasicDiceButtons・extractDiceRollValue（+buildSectionedEmbeds の空 push）／character-display.service の createSkillRollButtons・createBasicDiceButtons。対応 spec describe＋未使用 import も削除。
- 検証（司令塔再裏取り）: 撤去シンボルの**残存参照ゼロ**（grep）／build exit 0／check:circular **No circular(512)**／3 spec **60 緑**／diff は6ファイル -744行（DI/handler/module 不変）。挙動不変（全 dead）。

#### S-5b 完了（2026-06-04・dead サービス3つ＋sendSectionedEmbeds 撤去・コミット `fafcbe2`・nestjs 委譲＋司令塔裏取り）

- 撤去: `CharacterChannelService`／`CharacterChannelOrchestratorService`／`DiceUIBuilderService`（各+spec）＋ `CharacterEmbedManagerService.sendSectionedEmbeds`。`character-thread-feature.module` の import/providers/exports から除去。
- 検証（司令塔再裏取り）: 残存参照ゼロ／build 0／check:circular **No circular(506)**／jest（characterThread+characterEdit）**674 緑**／**start:dev 正常起動・DI 解決エラーゼロ・handler 登録 0 failed**。-2408行。挙動不変（全 dead）。

#### S-5c 完了（2026-06-04・dead 登録 handler クラスタ撤去・コミット `ecc6d63`・nestjs 委譲＋司令塔裏取り）

撤去（27 files・-4296行）: diceRoll の `DiceRollGeneral/Custom/Preset/Skill` handler ＋ `CharacterDiceOrchestratorService`＋`DiceButtonUIService`＋`DiceHistoryService`、characterThread の `CharacterDiceHandler`＋`CharacterDiceButtonsService`＋`CharacterDiceHistoryService`(+character-dice-format.util/character-dice-history.pure)。両 module の providers/onModuleInit/registry 登録、dead 専用だった `DiceRollModule`/`DiceRollPaginationModule` import も除去（`DiceServicesModule` は DiceRollLogicService が live のため維持）。handlers.integration.spec 登録数 28→23・dead routing を未登録へ更新。

- 検証（司令塔再裏取り）: 残存参照ゼロ／build exit 0／check:circular **No circular**／jest **54 suites 538 緑**／_*start:dev で registry 23 handler（batch 8+6+9・S-4.3 の 28 から −5）・dead handler 未登録・live handler（dice*generic\*/skill\*/ability_/preset-quick/flexible/modal/pagination）健在・DI エラー 0**。想定外 M（character-thread.orchestrator/thread-orchestrator/dice-roll-modal）は実変更0＝CRLF のみ＝スコープ外不接触。
- コミット手順: 事前 staged の無関係 junk と混在していたため `git reset`（作業ツリー保全）→ S-5c パスのみ stage → commit。**事前 staged 群は unstage されたが作業ツリーに完全保持**（AI.discord.md 削除等は未コミットのまま残存）。
- live 維持: `DiceOrchestratorService`(services/dice・custom-modal)／`DicePresetService`(dead メソッド createPresetButton/handlePresetDiceRoll は残置・別 issue)／`DiceRollModalHandler`／`PresetDiceQuickRollHandler`。

> **S-5 完了 ＝ ダイスボタン customId 統合キャンペーン（案2）完了**。S-1〜S-5c の7コミットで「主要バグ修正＋dead-code 約7000行撤去」を達成。残る軽微 follow-up: `DiceOrchestratorService` の dead な preset メソッド除去（任意・別 issue）。

#### （参考・S-5c 着手前の確定分析）司令塔が liveness 完全 disambiguate 済

**確定**: `DiceOrchestratorService.createPresetButton`（`preset-dice*` 生成）は**呼び出し元ゼロ**＝S-4.3 で Path A の preset 生成が `dice_coc7_`/`dice_generic_`(ThreadInteractionService) に切替わった結果 **preset-dice\* は dead**。よって:

- **diceRoll: legacy `DiceRollGeneralHandler`(`^roll\*\d+d\d+`)/`DiceRollSkillHandler`(`^roll\*[^_]+_`)/`DiceRollCustomHandler`(`roll*custom`)/`DiceRollPresetHandler`(`preset-dice*`) の4つすべて dead**（生成元が全て撤去/不在）。委譲先 `CharacterDiceOrchestratorService`＋`DiceButtonUIService`＋`DiceHistoryService` も dead（消費元が dead handler のみ）。
- **characterThread: `CharacterDiceHandler`(`character-dice` 生成元なし)＋`CharacterDiceButtonsService`＋`CharacterDiceHistoryService` も dead**。
- **残す（live）**: `DiceOrchestratorService`(services/dice・custom-dice-modal が使用)／`DicePresetService`(DiceOrchestratorService 経由・ただし createPresetButton/handlePresetDiceRoll は dead メソッド)／`DiceRollModalHandler`(custom/param-dice-modal)／pagination／`DiceGenericHandler`/`PresetDiceQuickRollHandler`/`CharacterSkillRollHandler`/`AbilityRollHandler`/`FlexibleDiceSelectHandler` 等。
- **手順**: dice-roll.module / character-thread-feature.module の providers/onModuleInit/registerHandlers から該当 handler を除去 → handler/orchestrator/service ファイル＋spec 削除 → `handlers.integration.spec.ts` の登録数（現 28→24想定）と roll\*/character-dice の hasHandler 期待値を更新 → **start:dev で registry 登録数の減少・無エラー・live handler 健在を必ず確認**。`DiceOrchestratorService` の dead な preset メソッド除去は任意（別途）。
- 注意: registry 登録数が runtime で減る（roll\* General/Skill/Custom/Preset の4 + character-dice の1 = 5減）。`character-dice-buttons.service` は `DicePresetService`/`DiceRollPaginationService` 等を inject しているため、module の不要 import 整理も伴う。

---

## 2026-06-04 P1-D 後続 ③ dice*(coc7|dnd5e|sw25)* preset ボタンを配線（方針A 最小機能化・挙動変更=バグ修正）

Codex 仕様設計＋ユーザー判断「方針A: 全 action 最小機能化」に基づく。skill\_ に続く未routing latent bug の修正。
**Codex 調査で確定した制約**: (a) 専用ゲームルール（SAN 値比較・武器ダメージ式等）は未実装、(b) `CharacterRepository.findByChannelId`
の select に `status/skill/parameter/gameSystemId` が含まれず stats 取得経路が破綻している。よって正規 semantic 判定は
不可能で、暫定 **system 既定 notation を振り action を reason ラベル化**して機能させる（完全ルールは次フェーズ）。

### 実装（コミット `fa1ff5b` 本体＋`3ca3470` spec 補強）

- 新規 `custom-id/preset-dice.custom-id.ts`: `PresetDiceCustomId`（pattern `/^dice_(coc7|dnd5e|sw25)_/`・create/parse）＋
  `resolvePresetDiceRoll(system, action)` → system 既定 notation（coc7=1d100 / dnd5e=1d20 / sw25=2d6）と reason ラベル
  （base はそのまま「技能判定」「d20攻撃」「2d6判定」、semantic は「SAN値判定（簡易）」「セーヴィング・スロー（簡易）」
  「魔法行使（簡易）」等で生成側ボタンラベルと整合）。
- 新規 `PresetDiceQuickRollHandler`（button・pattern 上記）: parse → resolve → deferUpdate →
  `DiceRollLogicService.handleDiceRoll`（feature 境界維持・skill\_ と同方針）→ 親チャンネル投稿。
  DiceGenericHandler / CharacterSkillRollHandler と同型の堅牢化（invalid customId→reply / success:false / throw→followUp /
  親投稿失敗→fallback followUp）。
- module 登録（DiceServicesModule 経由で DiceRollLogicService 解決）。
- handlers.integration.spec: dice*coc7*/dnd5e*/sw25* を未routing→routed へ（dice*generic* との区別・未対応 system は未routing 維持を固定）、登録総数 26→27。

### Codex 実装レビュー結果（指摘なし or P2 のみ・反映済）

- 実装本体（正しさ・routing・堅牢化）に致命傷なし。
- **委譲先**: skill\_ レビューで指摘された「event emit 欠落」は preset-dice では発生せず（`handleDiceRoll` 経路は completed/failed event を emit する）。embed/履歴UI なしは DiceGenericHandler 同型＝別 issue 扱い。
- P2 spec 不足3件（空 action / 空 channelId / 親投稿失敗 fallback）は `3ca3470` で追加（jest 2 suites 19 緑）。

### 挙動変更（意図的・バグ修正）

dice*(coc7|dnd5e|sw25)*\* クリックが「現在処理できません」→ system 既定 notation を振り親チャンネルへ結果投稿。
semantic 弱さ（SAN ボタンが SAN チェックせず単に 1d100）は (簡易) ラベルで明示。**全 13 個の preset ボタン**
（coc7×5 + dnd5e×4 + sw25×4）が機能化。

### 検証

- build / check:circular **No circular(507)** / jest 11 suites 99 緑（後に spec 補強で 21 緑追加）/
  start:dev で `PresetDiceQuickRollHandler [button] → ^dice_(coc7|dnd5e|sw25)_` 登録・**handler 総数 31→32**・無エラー。

### 残（仕様判断後の別タスク）

- **本格ルール実装**: SAN 値比較・武器ダメージ式・能力値ボーナス・命中-回避判定・魔法行使判定等。先に
  `CharacterRepository.findByChannelId` の select 拡張（status/skill/parameter/gameSystemId 取得）が必要。
- **dead path 整理**: `postActionButtons`（character*edit*/dice*roll*/character*info*）はコメントアウト中（撤去候補・別 issue）。

---

## 2026-06-04 Codex 優先度④ CharacterDiceButtonsService DI 整理（コミット `f4d8534`・挙動不変）

Codex 構造アセスメント優先度④。`CharacterDiceButtonsService` が constructor 内で `new CharacterDiceHistoryService(...)`
（provider 外生成）していたのを通常 DI 注入へ。テスト容易性向上。

- `CharacterDiceHistoryService`（@Injectable だが module 未登録だった）を `character-thread-feature.module.ts` の providers に登録。
- `character-dice-buttons.service.ts`: historyService を constructor 注入へ・new 撤去。専ら new 用だった `characterService` 注入を除去（import も撤去）。`diceRollService`/`paginationService` は他用途で継続使用のため保持。
- spec: TestingModule に実 `CharacterDiceHistoryService`（mock 依存で構築）を追加し、saveRollResult テストを維持。
- **公開 API 影響なし**: `new CharacterDiceButtonsService` は本番・spec とも皆無（Nest DI のみ）と確認。旧コメント「公開 API を変えないため new」の前提は不要だった。
- 検証: build / check:circular No circular(503) / jest 3 suites 36 緑 / start:dev 起動・総数31・DI エラーなし。

---

## 2026-06-04 P1-C 完了（非 DI 2件の process.env を Codex 設計案A で解消・挙動不変）

deferred だった非 DI 2件（`error-handler.ts` static / `api-response.dto.ts` DTO）を Codex 設計（案A: DI 境界で env 判定を
解決し下位へ引数で渡す）で解消。**本番コードの process.env 直接参照は P1-C で完全解消**（main.ts(`8222f72`) + 下記）。

### slice1 — ErrorHandler.handleHttpError（コミット `3a69b2e`・挙動不変）

- static utility は DI 不可のため `options?: { isProduction?: boolean }` を追加し `process.env.NODE_ENV==='production'` を撤去（既定 false）。
- **本番呼び出し元なし（spec のみ）**＝影響限定。spec を `{ isProduction }` 引数へ（process.env テスト間リークも解消）。

### slice2-3 — ErrorResponse.stack の dev 判定を filter 注入へ（コミット `98d5055`・挙動不変）

- **発見**: `ApiResponseUtil.error/.internalServerError` は実呼び出し元なし（dead・コメント参照のみ）。実 stack の ErrorResponse 生成は
  `HttpExceptionFilter` と `CharacterHttpExceptionFilter` の **2 filter のみ**＝当初懸念した controller 全体への波及は不要だった。
- `ErrorResponse`/`InternalServerErrorResponse` に `includeStack`（既定 false）を追加し constructor 内 `process.env.NODE_ENV==='development'` を撤去。
- 2 filter に `@Injectable()`＋AppConfigService 注入し `includeStack = get('app.environment')==='development'` を生成へ渡す（@UseFilters(Class)＋@Global で DI 解決）。
- byte-identical 根拠: app.environment は env.NODE_ENV と等価＝production→stack 無し / development→stack 有り を維持。dead な ApiResponseUtil は既定 false（test 環境では旧挙動も stack 無し＝filter spec の oracle 一致維持）。
- 検証: build / check:circular No circular(503) / jest 4 suites 37 緑（新 api-response.dto.spec の includeStack matrix・2 filter・error-handler）/ start:dev 起動・総数31・DI エラーなし。

### 到達点

- 本番コードの `process.env` 直接参照（main.ts / error-handler / api-response.dto）を**全て AppConfigService 経由または呼び出し側注入へ**。config module / env validation / test 内の process.env は規約上の許容例外。**P1-C 完了**。

---

## 2026-06-04 P1-D slice2（characterThread customId 契約化＋未routing skill\_ 修正・Codex 推奨の最優先）

> 注: foundation / Part1 / Part2 は挙動不変。Part3（skill\_ 配線）は **campaign 初の意図的な挙動変更（バグ修正）**。

Codex の構造アセスメント（§8 達成後の次の実害は「feature 内 customId 契約不一致」）に従い characterThread に着手。
characterEdit と同型に foundation → 安全な生成移行を実施。**未routing の latent gap を発見し、Codex レビューで方針確定**。

### foundation（コミット `ac0f479`・15ファイル）

- 新規 `features/characterThread/custom-id/`（7 family）: 各 handler の pattern 定数（thread-select=regex /
  thread-create / tab=`character-tab*` / flexible-dice-param=`flexible-dice-param*` / character-dice / dice-generic=`dice_generic_` /
  flexible-dice-select=`flexible_dice_`）。照合意味論（registry base handler の exact/startsWith・`*`/`-` はリテラル・regex test）を docstring 化。
- 7 handler の `getCustomIdPattern()` を pattern 定数参照へ（完全同一）。
- 検証: build / check:circular No circular(497) / jest 10 suites 106 緑 / start:dev で 7 handler が従来一致 pattern 登録・総数30・無エラー。

### 未routing gap の発見と Codex レビュー（重要）

`thread-interaction.service.ts`（live・thread-orchestrator が注入）が生成するボタンのうち、**registry のどの handler pattern にも
対応しない群**を発見（handler は全てハイフン系 prefix、生成はアンダースコア系のため startsWith 不一致）。Codex が実コードで裏取り:

- `skill_*`（postSkillRollButtons・**実送出**）/ `dice_coc7_*` `dice_dnd5e_*` `dice_sw25_*`（postPresetDiceButtons・**実送出**）＝**未routing の latent bug**（クリック時「現在処理できません」reply）。
- `character_edit_` / `dice_roll_` / `character_info_`（postActionButtons）＝呼び出し元が thread-orchestrator.service.ts:79 で**コメントアウト＝dead path**かつ未routing。
- `flexible_dice_` / `dice_generic_` ＝routing 済み（handler + integration spec 緑）。
- **方針（Codex レビュー）**: routing 化はクリック時挙動が変わる明確な挙動変更のため、本 refactor では行わない。**現状を characterization spec で事実固定し、routing 修正は仕様決定後の別タスク**。

### Part 1 — 未routing の characterization 固定（コミット `09d61c4`）

`handlers.integration.spec.ts` に「上記 latent group は現状 hasHandler===false」を固定（skill*/dice_coc7*/dnd5e*/sw25*/character*edit*/dice*roll*/character*info*）。jest 48 緑＝実際に未 routing であることを確認。

### Part 2 — routed 生成の Factory 化（コミット `785bc60`・slice2 本体）

- custom-id に `create()` 追加: `FlexibleDiceSelectCustomId.create(channelId)` / `DiceGenericCustomId.create(diceType, channelId)`（pattern と prefix 同一）。
- `thread-interaction.service.ts` の routed 生成5サイト（flexible*dice*×1・dice*generic* 1d6/2d6/1d20/1d100）を Factory へ。
- byte-identical 検証: 既存 `thread-interaction.service.spec` が生成文字列固定済（`flexible_dice_ch-flex` / `dice_generic_1d6_ch-g` 等）→ 緑＝完全同一。
- 検証: build / check:circular No circular(497) / jest 11 suites 137 緑 / start:dev 総数30・無エラー。

### Part 3 — 未routing `skill_` を配線して機能化（コミット `dd18624` prep + `6883156` fix・挙動変更=バグ修正）

ユーザー判断（方針A: 配線して機能化・skill\_ から段階的）＋Codex レビューに基づく。**性質: リファクタ regression ではなく
元からの未配線バグ**（司令塔が git 履歴で裏取り＝これら prefix を扱う handler は過去にも存在しない・`DiceRollLogicService.handleSkillRoll` は実在）。

- `dd18624`（prep・挙動不変）: `custom-id/skill-roll.custom-id.ts`（`SkillRollCustomId` pattern/create/parse。channelId は最初の `_`、残りを skillKey）と
  `services/skill-roll.util.ts`（`extractSkillLevel` を thread-interaction の private から純粋関数へ移管＋`resolveSkillRoll`）を新設し、
  postSkillRollButtons の生成を契約＋util へ（byte-identical・既存 spec `skill_ch-skill_dodge` で固定）。
- `6883156`（fix・挙動変更）: `CharacterSkillRollHandler`（button・pattern `skill_`）を新設し registry 登録。
  parse → `CharacterService.findByChannelId` → `resolveSkillRoll` → `DiceRollLogicService.handleSkillRoll` へ委譲し、
  結果を親チャンネルへ投稿（DiceGenericHandler と同型）。handlers.integration.spec で skill\_ を未routing→routed へ移動・登録数 25→26。
  新 handler spec で wiring（parse・skill 解決・引数・エラー経路）を固定。
- 挙動変更（意図的）: `skill_` クリックが「現在処理できません」→ 1d100 スキル判定実行＋親チャンネル投稿。
- 検証: build / check:circular No circular(501) / jest 5 suites 115 緑 / start:dev で `CharacterSkillRollHandler [button] → skill_` 登録・**handler 総数 30→31**・無エラー。

#### Part 3b — Codex 実装レビュー反映の堅牢化（コミット `f482e89`）

Codex に skill\_ 実装をレビューさせ、**委譲先は現状維持（`DiceRollLogicService` 直＝feature 境界を汚さない・ユーザー判断）**としつつ、
仕様判断不要の correctness 修正を適用:

- `SkillRollCustomId.parse`: 空 channelId（先頭 `_`）/ 空 skillKey（末尾 `_`）/ 区切りなしを null で弾く。
- `resolveSkillRoll`: skillKey が character.skill に**存在しない場合は null**（従来は skillValue=0 で「目標値0の誤ロール＋DB保存」が発生し得た）。handler は null→ephemeral error で中断。
- handler: 親チャンネル投稿失敗（スレッド外/親取得不可）時の成功経路に fallback の followUp 通知。
- spec 追加: `skill-roll.custom-id.spec`（parse edge）＋ handler spec に skill 不在 / success:false / throw / スレッド外投稿失敗。
- 検証: build / check:circular No circular(502) / jest 4 suites 92 緑 / start:dev で skill\_ 登録・総数31・無エラー。
- **deferred（記録）**: embed 表示＋履歴UI更新（orchestrator 経由なら付くが feature 結合を生むため不採用）、`handleSkillRoll` の event emit 欠落（既存 skill roll 全体の課題・新 handler 固有でない）。

### 残（別タスク・別 slice）

- **routing 修正の続き（要仕様決定）**: `dice_coc7_*` / `dice_dnd5e_*` / `dice_sw25_*` は依然未routing（characterization で固定済）。
  Codex 所見では semantic preset（sanity/save/magic 等）は専用ルール未実装＝「単純ダイス＋ラベル」までに限定するか完全ルールは次フェーズ、の判断が要る。skill\_ と同方式で段階的に配線可能。
- **dead path 整理**: `postActionButtons`（character*edit*/dice*roll*/character*info*）はコメントアウト中。生成メソッドごと撤去するかは別 issue。
- **follow-up**: routed handler 側 parse（`flexible_dice_` の replace / `dice_generic_` の split）の契約化。

---

## 2026-06-04 P1-D slice1 Slice A/B/C（Codex 設計に基づく生成・button 分岐・解析 regex の移行・挙動不変）

foundation（下記 `e1dcf9e`）に続き、**Codex に残作業のスコープ設計を委譲**（生成/解析サイトを A〜F の6 slice へ分割。
最大リスクは「strict parser へ直置換すると loose matcher の受理範囲が狭まる」点。message 探索系は parser 化しない方針）。
その設計に沿い、**Slice A（生成サイト）/ Slice B（button 分岐）/ Slice C（characterId 抽出 regex）を実装**（ユーザー判断で C まで実施し再判断）。

### Slice A — 生成サイトを Factory へ（コミット `a67df77`・3ファイル）

- `utils/character-embed.util.ts`(7) / `utils/character-ui.util.ts`(section-select 2 + field-edit 1 + 定数 dedup) /
  `services/character-section-editor.service.ts`(edit-section 1) の **customId 生成 literal を custom-id Factory 呼び出しへ**。
  Factory は同一 template 文字列を返すため **byte-identical**。`SECTION_SELECT_CUSTOM_ID_PREFIX` は契約モジュールを真実源に。
- byte-identical 検証: **既存 spec が全生成サイトの custom_id 文字列を固定済**（character-embed.util.spec の edit-section/refresh/
  compact-view/field-edit/field-add/create-basic/create-cancel、character-ui.util.spec の section-select/field-edit）。移行後も緑＝出力完全同一。

### Slice B — button 分岐を述語へ（コミット `4417346`・5ファイル）

- `enhanced-character-edit.service.ts` の `handleButtonInteraction` が `customId.startsWith(...)` で行う4分岐を
  **契約モジュールの述語**（`CharacterRefreshCustomId.is` / `CharacterCompactCustomId.is` / `CharacterCreateCustomId.isBasic` / `isCancel`）へ。
  いずれも prefix の startsWith（**空 id でも true・substring は false** ＝旧分岐と byte-identical な受理範囲）。
- `custom-id/custom-id-predicates.spec.ts` 新設で境界（空 id・前方一致でない substring・他 family 非該当）を固定。

### Slice C — characterId 抽出 regex を契約へ（コミット `99f7a88`・2ファイル）

- `character-section.custom-id.ts`: 非アンカー解析パターン `CHARACTER_EDIT_SECTION_PARSE_PATTERN` / `CHARACTER_SECTION_SELECT_PARSE_PATTERN` を追加（greedy・prefix が途中でも match する現挙動を保存）。
- `character-section-editor.util.ts`: `CHARACTER_ID_PATTERNS` の直書き4本を契約定数参照へ（field の2本は foundation で定義済だが未使用だった `CHARACTER_FIELD_EDIT/ADD_PARSE_PATTERN` を結線）。順序・正規表現とも従来と完全同一＝byte-identical。
- **据え置き（Codex 指針＝loose を strict 化しない）**: `extractSectionFromCustomId`（`-status-` 等 includes）/ `isFieldOperationCustomId` / `isSectionSelectionCustomId`（includes）は受理範囲が変わるため移行せず。

### 各 slice 検証（司令塔・独立検証）

- A: build / check:circular No circular(488) / jest 6 suites 152 緑 / start:dev 6 handler pattern 不変・総数30・無エラー。
- B: build / check:circular No circular(489) / jest 7 suites 99 緑（新述語 spec 含む）/ start:dev 総数30・無エラー。
- C: build / check:circular No circular(489) / jest 5 suites 142 緑（`extractCharacterIdFromCustomId` の greedy `a-b-c-123`・section-select `id-1`・null 境界）/ start:dev 総数30・無エラー。

### 残（Codex 設計の Slice D〜F・未着手）

- **D**: modal の生成/解析（`char-edit-{sectionType}-{fieldKey}-{id}` legacy ／ `char-edit-modal-{sessionId}` session の2系統。`character-section-editor.util.ts:181-191` ほか）。
- **E**: create modal parse（`character-modal-handler.util.ts:70-84` の `parseBasic` 相当）。
- **F**: message 探索の `includes` 群（`enhanced-character-edit.util.ts:106-121`、`character-modal-handler.service.ts:488-504,582-590`）→ **parser 化せず literal を helper へ集約のみ**（Codex 指針）。
- **要注意（移行しない / loose 維持）**: `extractCharacterIdFromCustomId`(非アンカー正規表現)、`extractCharacterIdFromSectionSelect`(prefix 不一致でも元文字列を返す `replace`)、modal legacy parser の dash 入り id 保持、`includes('character-create-basic')`(startsWith より広い)。C〜F は drift リスクが上がり literal 集約の価値は下がるため、慎重 or Codex スコープ前提。

---

## 2026-06-04 P1-D slice1（characterEdit customId 契約モジュール新設・foundation のみ・コミット `e1dcf9e`・挙動不変）

CLAUDE_HANDOFF.md の P1-D（customId contract 集約・diceRoll の `custom-id/` 先行例に倣う）。ユーザー方針「**characterEdit から
1 feature ずつ着手（bounded）**」に従い characterEdit から着手。今回は **契約モジュール導入 + handler の pattern 参照まで（foundation）**で、
生成/解析サイトの Factory/Parser 移行は **未実施＝literal のまま＝挙動同一**（下記 inventory 付き follow-up）。

### 実施（コミット `e1dcf9e`・14 ファイル）

- **新規 `features/characterEdit/custom-id/`**（refresh / create / compact / section / field / modal の6 family + index）:
  各 family の pattern 定数 + `create*` / `parse*` の純粋関数（discord.js / NestJS DI 非依存）。diceRoll `custom-id/` と同型。
- **6 handler の `getCustomIdPattern()`** を直書き文字列/正規表現 → pattern 定数参照へ置換（**pattern は完全同一**。例:
  `CharacterSectionCustomId.pattern = /^character-(edit-section|section-select)-/`）。
- `handlers.integration.spec.ts`: Factory 生成 customId が handler pattern に match するテストを追加。

### 検証（司令塔がサブエージェント報告を再裏取り＝報告が garbled だったため実状態を全確認）

- build(nest) OK / **check:circular No circular dependency found!(488)** / jest characterEdit + interactions/handlers 統合 + registry
  = **31 suites 411 tests 緑**（customId フォーマットを固定する spec 群も緑＝生成/解析の文字列等価） / **start:dev で characterEdit 6 handler が
  従来と完全一致の pattern で登録・handler 総数 30 不変・無エラー**＝挙動不変。
- `/code-review`(focused): section custom-id は純粋モジュールで文字列/regex 完全同一。handler は pattern 定数を参照（直書き消滅）。
  customId 無関係に `M` 表示の services（channel-name-sync 等）は **CRLF-only churn と確認しコミットから除外**（混入なし）。

### 残（P1-D slice1 follow-up＝生成/解析サイトの Factory/Parser 移行・**未着手 inventory**）

サブエージェントは契約モジュール + handler 参照までで停止（最終編集が途中で切れた）。生成/解析サイトは **literal 直書きのまま**で、
変種が多く byte-identical 保存リスクが高い大ぶり作業のため、**scoped follow-up（慎重 or Codex スコープ推奨）**として保留。対象（`git grep` 実測）:

- 生成: `utils/character-embed.util.ts`（edit-section / refresh / compact-view / field-add / field-edit / create-basic / create-cancel）、
  `services/character-section-editor.service.ts`(edit-section)、`utils/character-ui.util.ts`(field-edit / SECTION_SELECT_PREFIX)、
  `services/character-section-editor.util.ts`(buildDirectModalId=`char-edit-{sectionType}-{fieldKey}-{id}` / buildSessionModalId=`char-edit-modal-{sessionId}`)。
- 解析: `enhanced-character-edit.service.ts`(create-basic/cancel/refresh/compact-view の startsWith)、`services/character-modal-handler.service.ts`(多数 includes)、
  `services/character-modal-handler.util.ts`(`char-edit-modal-` / `char-edit-` prefix + create-basic 正規表現)、`services/character-section-editor.util.ts`(解析正規表現4本)、
  `utils/enhanced-character-edit.util.ts`(refresh/compact-view 正規表現)。
- **注意**: field family は生成側が `character-field-edit-{sectionType}-{id}` / `character-field-add-{sectionType}-{id}`（handler pattern `character-field-` が両者を prefix 包含）、
  modal family は session 形式(`char-edit-modal-`)と legacy 形式(`char-edit-`)の2系統、create family は `{channelId}-{userId}` の2引数。移行時は各変種の Factory/Parser を byte-identical に揃え spec で固定すること。

### slice2

- characterThread の customId 契約モジュール化（同方式）。

---

## 2026-06-04 P1-C process.env 整理（main.ts を AppConfigService 経由へ・非 DI 2件は設計要で deferred）

CLAUDE_HANDOFF.md の P1-C。本番コードの実 process.env 直接参照は3箇所のみ（crypto.util はコメント文）。

### 実施（コミット `8222f72`・挙動不変）

- **main.ts の bind-address** を AppConfigService 経由へ。`process.env.NODE_ENV === 'production'` → `configService.get('app.environment') === 'production'`（configuration.ts:44 で environment=env.NODE_ENV・production 判定は等価。無効値は development フォールバックだが production 判定に影響なし）。`process.env.DOCKER_ENV` → `configService.getRaw('DOCKER_ENV')`（typed key でないため getRaw で AppConfigService 経由に一元化）。bind-address ロジック不変。
- 検証: build / check:circular(481) / start:dev で dev bind-address「http://127.0.0.1:3000」「IPv4 (127.0.0.1)」＝旧挙動と一致・無エラー＝挙動不変。

### 残（P1-C・非 DI のため設計判断要・deferred）

- `core/http/error-handler.ts:98`（**static utility クラス**・`handleHttpError` 内 `process.env.NODE_ENV === 'production'`）と `core/dto/api-response.dto.ts:85`（**DTO**・`new` 生成・constructor 内 `process.env.NODE_ENV === 'development'` で stack 含有判定）。いずれも **DI 不可**のため AppConfigService を注入できない。
- 撤去には「呼び出し側（@Injectable な `http-exception.filter` 等）から env/isDev を渡す」or「環境を保持する仕組み」の**設計が必要**（ハンドオフ明記）。`ApiResponseUtil`（非 DI util）も ErrorResponse を生成するため、両経路の整合も要る。標準的な NODE_ENV モード判定であり撤去は invasive なため、**focused 設計タスク（Codex スコープ推奨）として deferred**。config module / env validation / test 内の process.env は規約上の許容例外。

---

## 2026-06-04 P1-B 残 forwardRef を全解消（全て vestigial・挙動不変）

CLAUDE_HANDOFF.md の P1-B。discord/feature 配下の module `forwardRef` を 1 件ずつ通常 import へ戻す。**調査の結果4件すべて
vestigial（実循環は prior リファクタで既に解消＝逆方向 import がコメントアウト済。madge も循環ゼロ）**で、port 切り出し等の
構造変更は不要だった。コミット `c4dabf1`（DiscordModule→InteractionsModule）＋`427c843`（残3件）。

### 解消した forwardRef（各々「逆方向 import が無い＝循環なし」を確認のうえ通常 import へ）

- `DiscordModule → InteractionsModule`（`c4dabf1`）: P1-A で InteractionsModule を slim 化（feature import 撤去）した結果、
  InteractionsModule は DiscordModule へ戻る経路を持たず（imports は InteractionRegistryModule[imports なし]+EventEmitterModule のみ・
  DiscordModule は誰からも import されない）→ 循環消滅。
- `DiscordIntegrationModule → CharacterModule`（`427c843`）: CharacterModule は DiscordIntegrationModule を import しない（コメントアウト済）。
- `CharacterEditModule → CharacterModule`（`427c843`）: CharacterModule は characterEdit を import しない。
- `CharacterThreadFeatureModule → DiscordIntegrationModule`（`427c843`）: DiscordIntegrationModule は characterThread を import しない（コメントアウト済）。

### 検証（司令塔・各段／最終まとめ）

- build 成功 / check:circular **No circular dependency found!（481）** / start:dev で「Nest application successfully started」・
  handler 総数 **30 不変**・ChannelCreate listener 登録・**循環/Cannot resolve/cannot-create エラーなし**＝DI グラフが forwardRef なしで
  解決＝挙動不変。

### 到達点

- discord/feature 配下の**実 `forwardRef()` は全消失**（残るは `domains/character/character.module.ts` のコメントアウト行のみ＝
  かつての DiscordIntegrationModule 循環の名残・実コードではない）。**P1-B 完了**。次は P1-C（process.env）。

---

## 2026-06-04 P1-A 後続 InteractionsService.execute() の characterEdit 特例分岐を撤去（コミット `2640395`・Codex レビュー済）

P1-A の残「execute() 特例 → Registry 経路」を実施。**characterization は既存 `interactions.service.spec.ts` が現挙動を固定済み**だったため、それを土台に移管。

### Phase 1 で確定した挙動差（撤去の安全性根拠）

- `discord-interaction-handler.service` の buttons/modals/selects Map は常に空 → 全 interaction が `InteractionsService.execute()` 経由。execute() は StringSelect の `character-section-select-*`/`character-edit-*`/`character-field-*` を `CharacterSectionEditorService.execute()` へ**直接**委譲し、Registry の `CharacterEditSectionHandler`(`^character-(edit-section|section-select)-`)/`CharacterEditFieldHandler`(`character-field-`) を**影で潰す legacy bypass**だった。
- 両 registry handler は `EnhancedCharacterEditService.handleSelectMenuInteraction()` → `sectionEditor.execute()` を呼ぶ。**happy path は両経路とも sectionEditor.execute で同一**。
- 差分: registry 経路は ①`characterEdit.section.selected`/`.field.selected` を追加発火（**購読者ゼロ**＝contract 定義のみ・観測影響なし）、②エラー時の挙動（特例＝ephemeral reply「セクション選択の処理中にエラーが発生しました。」＋rethrow / registry＝log＋購読者ゼロの error event・reply なし）。→ **実質差は「section-select エラー時の ephemeral reply の有無」のみ**（happy path 不変）。

### 実施

- `interactions.service.ts`: execute() の characterEdit 特例分岐を撤去し、全 interaction を `handleInteraction()`（Registry）へ委譲。`CharacterSectionEditorService` の import / constructor inject を撤去。
- `interactions.service.spec.ts`: execute() の characterEdit セレクト3テストを「Registry へ委譲（registry.route 呼び出し）」へ更新、特例 error テスト2件を削除、sectionEditor mock/provider を除去（Phase 5: バス変更に伴う呼び出し先 expectation 更新）。

### 検証（司令塔裏取り・`/code-review` 含む）

- build 成功 / check:circular No circular dependency found!(479) / jest interactions.service + handlers.integration + registry + characterEdit = **31 suites 425 tests 緑** / start:dev で `CharacterEditSectionHandler`/`CharacterEditFieldHandler` の registry 登録・handler 総数 30(不変)・Cannot resolve なし＝**characterEdit セレクトが registry 経路で正規 handler に届くことを実機確認**。
- `/code-review`(high): 正確性バグなし。挙動差は上記の意図した error-path 差のみ。隣接 cleanup（`discord-interaction-handler.service.ts:172-174` の冗長 `character-section-select-` if＝特例撤去で fallthrough と dead-equivalent）を follow-up に記録。

### コミット状況・残（Codex レビュー結果反映）

- **コミット済 `2640395`**。Codex が「execute 特例撤去は安全（happy path 不変／error 時は汎用エラー応答経路へ・専用文言は follow-up polish で可）」「prep（ModuleRef/Controller 撤去）と同一ファイル・同一目的なので分離せずまとめてコミットしてよい」と承認。
- **ChannelCreate 移設 完了（コミット `c27d155`・Codex 設計承認済）= P1-A 完了**:
  - 新規 `CharacterEditChannelCreateListenerService`（characterEdit feature・OnModuleInit で `DiscordClientService.on(Events.ChannelCreate)` 登録・handler は旧 `InteractionsService.handleChannelCreate` と同一＝GuildText のみ→`ChannelCreateOrchestratorService.execute`・error は log して握りつぶす）。CharacterEditModule providers に追加。
  - `InteractionsService`: `handleChannelCreate()`/`loadClient()` と `ChannelCreateOrchestratorService` inject を撤去（thin service 化）。`InteractionsController`: dead な `handleCommand()`/`handleChannelCreate()`/`client`/`ChannelCreateOrchestratorService` inject を撤去（handleCommand 呼出元ゼロ）。`discord-facade`: `loadClient` 呼び出し＋未使用化した InteractionsService inject を撤去。
  - **`InteractionsModule` から `CharacterEditModule` import を撤去 → interactions core は feature module を一切 import しない（§8 達成）**。imports は `InteractionRegistryModule`＋`EventEmitterModule` のみ。
  - 検証: build / check:circular **No circular(481)** / jest characterEdit+interactions+facade **35 suites 481 緑** / start:dev で `CharacterEditChannelCreateListenerService` の ChannelCreate 登録ログ・handler 総数30不変・Cannot resolve なし / `/code-review`(focused) handler ロジック旧と同一・正確性バグなし＝挙動不変。
- **軽微 follow-up 完了（コミット `e880269`）**: `discord-interaction-handler.service.ts` の冗長 `character-section-select-` if（特例撤去で fallthrough と dead-equivalent）を削除し未登録セレクトを単一 fallback に統一。spec の「3分岐」→「2分岐」更新（character-section-select- の routing 不変 regression guard は維持）。build/check:circular(481)/jest 20 tests 緑・挙動不変。**→ P1-A は follow-up 含め完了。次は P1-B/C/D（別パケット・Codex 判断）**。

---

## 2026-06-04 P1-A InteractionsModule slim 化（monitoring/DiceServices 撤去・挙動不変）＋ execute() 特例の挙動差を特定

Codex 司令塔の委譲（`CLAUDE_HANDOFF.md` P1-A）。InteractionsModule を Registry + thin service へ寄せる。
**挙動不変で安全な module slim 化のみ実施**し、挙動影響のある execute() 特例撤去は Phase 1 分析の結果を記録して後続に残した。コミット `0ccf0d5`（interactions.module.ts のみ）。

### 実施（挙動不変・`0ccf0d5`）

- 監視サービス（PerformanceOrchestrator/MetricsCollector/Alert/DiscordMonitor）の providers/exports を InteractionsModule から撤去。**DiscordModule が既に同4サービスを providers/exports で所有**しており、InteractionsModule 側は重複登録（Metrics/Alert は `@OnEvent` を持つため重複インスタンスで二重 @OnEvent 登録になっていた）。撤去で単一所有・単一登録に。start:dev で各サービスが**1回のみ初期化**されることを確認。
- `DiceServicesModule` の import / re-export を撤去（構造課題③ Part B 以降 interactions は dice を直接使わず、diceRoll/characterThread feature は DiceServicesModule を直接 import するため re-export 依存もなし。commands/discord も未使用を grep 確認）。
- 未使用の `CharacterModule` import を撤去（InteractionsService/Controller は CharacterService を inject しない）。
- 検証: build 成功 / check:circular No circular dependency found!(479) / start:dev で「successfully started」・BOT 起動・登録 handler 総数 30(不変)・monitoring 単一初期化・Cannot resolve/実エラーなし＝挙動不変。

### ★ Phase 1 分析: execute() characterEdit 特例撤去は「挙動影響あり」（後続・要 characterization）

interactions の interaction dispatch 実経路を実コードで確認:

- `DiscordInteractionHandlerService` の buttons/modals/selects Map は**常に空**（register\* 呼び出し元ゼロ）→ 全 button/select/modal は `InteractionsService.execute()` へフォールバック＝**execute() が実経路**。
- `InteractionsService.execute()` は StringSelectMenu の `character-section-select-*`/`character-edit-*`/`character-field-*` を `CharacterSectionEditorService.execute()` へ**直接**委譲（Registry をバイパス）。それ以外は `handleInteraction()`→`routeInteraction()`→`InteractionRegistryService.route()`。
- Registry には `CharacterEditSectionHandler`(`^character-(edit-section|section-select)-`)・`CharacterEditFieldHandler`(`character-field-`) が登録済みだが、上記特例が**先に握るためバイパスされている**。両 handler は `EnhancedCharacterEditService.handleSelectMenuInteraction()` → `sectionEditor.execute()` を呼ぶ。

**等価性の結論**: happy path は両経路とも `sectionEditor.execute(interaction)` で**同一**。ただし Registry 経路は ①`emitSectionSelected` を追加発火、②エラー処理が異なる（特例＝ephemeral reply「セクション選択の処理中にエラーが発生しました。」＋rethrow / Registry＝`emitError`＋`handleServiceError`・reply なし）。→ **特例撤去は error path・イベント発火が変わる挙動変化**。ハンドオフ目標「挙動は変えない」かつ skill の安全網方針に従い、blind 撤去はしない。

### 残（P1-A 後続・要 characterization／一部 Codex 判断）

1. **execute() 特例撤去 → CharacterEditModule import 撤去**: `interactions.service.spec.ts` で現挙動（特例の委譲先・error 時 reply）を characterization 固定 → Registry 経路へ寄せる（emitSectionSelected/error 差を許容する設計判断 or handler 側で reply 等価化）→ `CharacterSectionEditorService` inject 除去。
2. **ChannelCreate 委譲**: `InteractionsService.loadClient()`→`handleChannelCreate()`→`ChannelCreateOrchestratorService.execute()`。これは interaction でなく Discord channel event。feature/discord-event 側へ移せれば `ChannelCreateOrchestratorService` inject も外れ、**CharacterEditModule import を完全撤去**できる。影響大なら残件（ハンドオフ明記）。
3. 上記2つが解けて初めて InteractionsModule の最後の feature import（CharacterEditModule）が外れる。

---

## 2026-06-03 構造課題③ Part B characterThread の feature 移管・CharacterThreadFeatureModule import 撤去（挙動不変）

③ 最終段の characterThread 分。handler 7個と委譲先サービスを feature 所有へ移し、interactions.module から
**CharacterThreadFeatureModule import を撤去**＝interactions core が characterThread feature を import しない形へ是正。
コミット `1975af6`（27ファイル）。実装は nestjs-best-practices サブエージェントへ委譲し、**司令塔が build/circular/start:dev で再裏取り**。

### 実施

- handler 7個(+spec): `interactions/handlers/character-thread` → `features/characterThread/handlers`（rename）。
- `CharacterThreadSelectService`(+spec): `interactions/select` → `features/characterThread/services`（characterThread 3 handler 専用・CharacterThreadOrchestrator を inject）。
- character-dice クラスタ4ファイル(+spec): `interactions/button` → `features/characterThread/services`（CharacterDiceButtonsService=character-dice handler 専用 DI provider／CharacterDiceHistoryService=`new` 生成の plain class／character-dice-format.util・character-dice-history.pure=純関数）。
- `CharacterThreadFeatureModule`: 7 handler＋CharacterThreadSelectService＋CharacterDiceButtonsService を providers 追加、`OnModuleInit` で registry 登録、imports に `InteractionRegistryModule`・`DiceServicesModule`・`DiceRollModule`・`DiceRollPaginationModule` を追加（**forwardRef 新規なし**）。
- `interactions.module`: 上記の import/provider/export/onModuleInit を全撤去し **CharacterThreadFeatureModule import を撤去**。不要化した `DiceRollModule`/`DiceRollPaginationModule` import も撤去。class 本体は空（OnModuleInit 不要に）。
- `interactions/button`・`interactions/select`・`interactions/handlers/character-thread` は空になり消滅。

### 設計メモ

- `CharacterDiceButtonsService` が `DiceRollPaginationService` を使うため `CharacterThreadFeatureModule → DiceRollPaginationModule`（feature→feature）依存が生じるが、pagination は leaf module で逆流なし＝循環なし（check:circular 475 で実証）。

### 検証（司令塔がサブエージェント報告を再裏取り）

- `pnpm run build` 成功 / `pnpm run check:circular`：**No circular dependency found!（475 files）** / `pnpm jest`（features/characterThread + interactions）= **34 suites / 499 tests 緑** / `pnpm run start:dev`：characterThread handler 7個の registry 登録（CharacterThreadFeatureModule.onModuleInit 経由）・**登録総数 30（移管前と同数＝欠落/二重なし）**・`Cannot resolve`/実エラーなし＝**挙動不変を実機確認**。

### ③ の到達点・残

- diceRoll / characterEdit / characterThread の handler は**全て feature 所有**・各 feature module が registry 登録（§8 の handler 所有形を達成）。
- interactions.module の feature module import は **CharacterThreadFeatureModule 撤去済み**。**残るは `CharacterEditModule` のみ**＝`InteractionsService` の旧 if 分岐 `execute()`（`interactions.service.ts:164-199` で `CharacterSectionEditorService` を使用）が障壁。Registry 代替を characterization で確認のうえ旧経路を撤去すれば CharacterEditModule import も外せる（**挙動影響あり・要承認**）。

---

## 2026-06-03 構造課題③ characterEdit handler の feature 移管（Part A・挙動不変）＋ §8 完全撤去の真の障壁を特定

③ 最終段（interactions.module の feature module import 全撤去）に着手。characterEdit から実施。**handler 所有は feature へ
移したが、CharacterEditModule import の撤去は別の深い結合がブロック**することが判明（重要）。コミット `a5369cf`。

### Part A 実施（handler 6個を feature 所有へ・コミット `a5369cf`）

- characterEdit interaction handler 6個(+spec) を `interactions/handlers/character-edit/` → `features/characterEdit/handlers/` へ rename（base class は `interactions/handlers/base` 参照、service は `../enhanced-character-edit.service`）。
- `CharacterEditModule`: 6 handler を providers 追加・`InteractionRegistryModule` を import・`OnModuleInit` で registry 登録（diceRoll と同方式）。CharacterEditModule は `discord-event-handlers.module` も import するため singleton 維持＝onModuleInit が走り登録される。
- `interactions.module`: 6 handler の provider/constructor/onModuleInit 登録を撤去。
- 検証: build / check:circular(475) / jest 30 suites 400 tests 緑 / start:dev で characterEdit handler 6個の registry 登録(CharacterEditModule 経由)・無エラー＝挙動不変。

### ★ §8「feature module import 全撤去」の真の障壁（Phase 1 で特定）

handler 移管だけでは import は外せない。interactions 常駐コードが feature サービスに結合しているため：

- **characterEdit（撤去ブロック・挙動影響あり）**: `InteractionsService`（interactions core 中核）が `CharacterSectionEditorService` を inject し、**旧 if 分岐ルーティング**（`interactions.service.ts:164-199` の `execute()`）で `character-section-select-`/`character-edit-`/`character-field-` を手動ルーティングしている（「discord-interaction-handler 互換のため」）。これは Registry が置き換えるはずの旧経路（CharacterEditSection/FieldHandler が同 customId を担当）。CharacterEditModule import を外すにはこの旧 execute() 経路の撤去が前提＝**Registry が完全代替するか確認のうえ削除する挙動影響リファクタ**。なお `InteractionsService` の `CharacterUIService` 注入は**未使用（dead injection）**。
- **characterThread（撤去 feasible・InteractionsService 結合なし）**: interactions 常駐で characterThread feature を使うのは `CharacterThreadSelectService`(interactions/select/) のみ（`CharacterThreadOrchestrator` を inject）。これは characterThread 3 handler 専用。handler 7本＋`CharacterThreadSelectService`＋`CharacterDiceButtonsService`(character-dice handler 専用) を feature へ移せば CharacterThreadFeatureModule import は撤去可能（diceRoll Step5b 規模。`CharacterDiceButtonsService` は `CharacterDiceHistoryService` 等 interactions/button 常駐への依存があり整理要）。

### 残（③ 全体）

- **characterThread 移管（Part B）**: 7 handler ＋ CharacterThreadSelectService ＋ CharacterDiceButtonsService（＋CharacterDiceHistory 整理）を feature へ → CharacterThreadFeatureModule import 撤去。挙動不変リファクタ。
- **characterEdit の InteractionsService 旧 execute() 撤去**: Registry 代替を安全網で確認 → 旧 if 分岐削除 → CharacterUIService(dead) と CharacterSectionEditorService 注入を除去 → CharacterEditModule import 撤去。**挙動影響ありのためユーザー承認＋characterization 必須**。

---

## 2026-06-03 構造課題③ Step5b orchestrator/dice ロジックの feature 移管・DiceServicesModule 新設（挙動不変）

③（H4 / §8）の **diceRoll 分の完了ステップ**。Step5a（CustomDiceModalService 移管）に続き、orchestrator と
共有 dice ロジックを整理して **DiceRollFeatureModule の `InteractionsModule` import を撤去**＝feature ⇄ interactions core
の結合を解消。**Option A（services/dice 中立配置）を採用し2分割で実施**（ユーザー承認済み）。コミット `352683a`(5b-1)・`354a53f`(5b-2)。

### Phase 1 の確定事実（単語境界 grep で精緻化）

- 真に共有なのは `DiceRollLogicService` のみ（orchestrator→feature ＋ character-thread handler 2本(dice-generic/flexible-dice-select)→interactions）。依存は domains/core のみのクリーンな leaf。
- `DiceHistoryService`・`DiceButtonUIService` は **orchestrator 専用**（`character-dice-buttons` が使うのは別物 `CharacterDiceHistoryService`。`git grep "DiceHistoryService"` の部分一致に注意）→ orchestrator と共に feature へ。
- `DicePresetService`/`DiceOrchestratorService` 等 services/dice 群は上流（interactions/features）依存ゼロ＝leaf module 化可能。

### Step5b-1（reorg・`352683a`）: DiceServicesModule 新設

- `discord/services/dice/dice-services.module.ts`（DiceServicesModule）を新設。providers/exports = `DiceRollLogicService`(移設)・`DiceOrchestratorService`・`DiceCalculationService`・`DiceParserService`・`DicePresetService`。imports = `DiceRollModule`・`CharacterModule`（TypedEventService は core-events @Global）＝leaf module。
- `dice-roll-logic.service`(+spec) を `interactions/button` → `services/dice` へ rename（同 depth で相対 import 不変）。
- `interactions.module`: 5サービスの ad-hoc provide（§5.3 違反）を撤去し `DiceServicesModule` を import＋**re-export**（commands/discord/feature の下流互換維持）。character-thread handler 2本の import パス更新。

### Step5b-2（移管・import 撤去・`354a53f`）

- `CharacterDiceOrchestratorService`・`DiceButtonUIService`・`DiceHistoryService`(+spec) を `interactions/button` → `features/diceRoll/services` へ rename（depth 差のため相対 import を絶対 `src/` へ書換）。
- diceRoll handler 4本（custom/general/preset/skill）の orchestrator import を feature 内パス（`../../services/...`）へ更新。
- `dice-roll.module`(feature): 3サービスを providers 追加、imports に `DiceServicesModule`・`DiceRollModule`(DiceHistoryService の DiceRollService) を追加し、**`InteractionsModule` import を撤去**。
- `interactions.module`: 移管3サービスの import/provider/export を撤去（character-thread の DiceRollLogicService・character-dice-buttons の DicePresetService は DiceServicesModule から解決）。

### 検証（各段で司令塔裏取り）

- 5b-1: build 成功 / check:circular **No circular dependency found!(475)** / jest 9 suites 202 tests 緑 / start:dev で character-thread handler 登録・無エラー。
- 5b-2: build 成功 / check:circular **No circular dependency found!(475)** / jest **47 suites 461 tests 緑** / start:dev で DiceRollSkill/General/Custom/Preset/Modal・DiceGeneric/FlexibleDiceSelect の registry 登録・無エラー起動＝**feature が InteractionsModule なしで全 dice handler を解決＝挙動不変**。

### 到達点・残

- **diceRoll feature は interactions core を import しない**（`InteractionRegistryModule` のみ）。§8「feature が registry に handler を登録」の diceRoll 分は**完了**。dice 計算・ロジックは中立 `DiceServicesModule`(services/dice) が所有（§5.3/§6 是正・旧 interactions ad-hoc provide を解消）。
- 残（③ 全体）: characterEdit/characterThread の handler も feature 登録へ → 最終的に `interactions.module` の feature module import（`CharacterEditModule`/`CharacterThreadFeatureModule`）を全撤去。

---

## 2026-06-03 構造課題③ Step5a CustomDiceModalService を feature へ移管（挙動不変）

③ の続き（Step5 = orchestrator/modal を feature へ移し `dice-roll.module` の `InteractionsModule` import 撤去）の
**第一弾**。Phase 1 で「Step5 は単純移動でなく共有 dice モジュールの設計が必要」と判明したため、**結合のない
`CustomDiceModalService` だけ先行移管**する安全な独立コミット（`16c4c03`）。InteractionsModule import 撤去は
orchestrator 移管（共有 primitive モジュール化＝Step5b）で達成予定。

### Phase 1 の発見（dice クラスタの結合）

- `CustomDiceModalService`：interactions/button 依存ゼロ（`CharacterService`＋`DiceOrchestratorService`(services/dice) のみ）→ **単独で feature へ移せる**。
- `CharacterDiceOrchestratorService`：`DiceButtonUIService`(専用)＋`DiceRollLogicService`(character-thread handler 2本も使用)＋`DiceHistoryService`(character-dice-buttons も使用) に依存し、さらに `DiceHistoryService→DiceRollPaginationService` と結合が密。共有 primitive を「feature 所有」か「`discord/services/dice` 中立」かは設計判断・循環リスクありで Step5b に分離（ユーザー承認済みの段階分割）。

### 実施（Step5a・コミット `16c4c03`）

- `custom-dice-modal.service.ts`(+spec) を `interactions/modal/` → `features/diceRoll/services/`（rename。サービスは絶対 import のみ／spec は同ディレクトリ相対のため移動でパス不変）。`interactions/modal/` は空に。
- `dice-roll-modal.handler`(+spec) の import を `../../services/custom-dice-modal.service` へ更新。
- `interactions.module`：CustomDiceModalService の import/provider/export を撤去（消費者は feature の modal handler のみ＝interactions core 消費者なし）。
- `dice-roll.module`(feature)：CustomDiceModalService を provider 追加。`CharacterService` 解決のため `CharacterModule` を import（**forwardRef なし**・feature→domains の許容方向）。`DiceOrchestratorService` は既存 `InteractionsModule` export 経由で解決。

### 検証（司令塔裏取り）

- `pnpm run build` 成功 / `pnpm run check:circular`：**No circular dependency found!（474 files）**（feature→CharacterModule で循環増えず）。
- `pnpm jest`（custom-dice-modal + dice-roll-modal handler + handlers.integration + registry）：**5 suites / 85 tests 緑**。
- `pnpm run start:dev`：**Nest application successfully started** / `DiceRollModalHandler [modal] → ^(custom|param)-dice-modal` を registry 登録 / `Cannot resolve`・DI 失敗・実エラーなし＝**実機で挙動不変**（feature 所有の CustomDiceModalService が CharacterService(CharacterModule)・DiceOrchestratorService(InteractionsModule export) を解決）。

### 残（Step5b・未着手）

- `CharacterDiceOrchestratorService`（＋専用 `DiceButtonUIService`）を feature へ移し、共有 primitive（`DiceRollLogicService`/`DiceHistoryService`）を共有モジュール化（`discord/services/dice` 中立配置 or feature 配下のどちらかを要設計判断）。完了後に `dice-roll.module` の `InteractionsModule` import を撤去。
- その後 characterEdit/characterThread も feature 登録へ → `interactions.module` の feature module import を全撤去（§8 目標形）。

---

## 2026-06-03 構造課題③ diceRoll 移管（handler/pagination を interactions core → feature・挙動不変）

構造課題③（H4 / ARCHITECTURE §8「feature 側が registry に handler を登録」・§5.3「provider 所有」）の本体ステップ。
InteractionRegistryModule 分離（第一歩・下記）に続き、diceRoll の interaction handler と pagination の**所有権を
InteractionsModule から DiceRollFeatureModule 配下へ移管**。実装コミット `fde91e8`（61ファイル・rename 35＋新規 module）。
サブエージェント実装 → **司令塔が報告を再裏取りしてコミット・記録**（報告に誤りあり・下記）。

### 実施

- handler 12個(+spec): `interactions/handlers/dice-roll/` → `features/diceRoll/handlers/dice-roll/`（rename）。
- pagination 11ファイル: `discord/components/pagination/` → `features/diceRoll/services/pagination/`（rename・`components/pagination` は空に）。
- 新規 `DiceRollPaginationModule`（pagination 2 service を providers/exports、`DiceRollModule`(domains) を import）。
- `DiceRollFeatureModule`: handler 12 を providers 化＋`OnModuleInit` で `InteractionRegistryService.registerHandlers` に自登録（集中→分散）。`InteractionRegistryModule`＋`DiceRollPaginationModule` を import。
- `interactions.module`: diceRoll handler/adapter/pagination の配線を全撤去。button 系の pagination 解決用に `DiceRollPaginationModule` のみ import。

### 設計判断（2点）

- **差分1（pagination 独立モジュール化）**: interactions core の `CharacterDiceButtonsService`/`DiceHistoryService`(button/) が `DiceRollPaginationService` を直接 inject するため、pagination を独立 `DiceRollPaginationModule` に切り出し、interactions と feature の双方が import（相互 import＝循環を回避）。所有権は feature 配下＝§5.3 の精神に合致。
- **差分2（Step5 未達）**: `dice-roll.module`(feature) の `InteractionsModule` import は維持。diceRoll handler が `CharacterDiceOrchestratorService`(interactions/button/)・`CustomDiceModalService`(interactions/modal/) を inject するため。`DiceRollFeatureModule → InteractionsModule` の一方向のみで、InteractionsModule は feature を import しないため循環なし。

### 検証（司令塔が報告を再裏取り）

- サブエージェント報告「interactions→diceRoll 依存 grep ゼロ」は**不正確**と判明。実際は interactions(button系) が `DiceRollPaginationService`/`DiceRollPaginationModule` を import 継続（＝差分1 の意図した依存）。**ただし循環は生んでいない**ことを check:circular で実証。「ハンドラ配線は撤去・pagination 依存は残置」が実態。
- `pnpm run build` 成功 / `pnpm run check:circular`：**No circular dependency found!（474 files）**。
- `pnpm jest`（registry + features/diceRoll + interactions/button + handlers.integration）：**40 suites / 445 tests 緑**（報告の 31+36+150 を内包）。
- `pnpm run start:dev`：**Nest application successfully started** / DiscordBOT 起動(TRPG*BOT#8068) / **diceRoll handler 12個が InteractionRegistryService に各1回登録**（dice-page-prev/next/first/last/cancel/select・dice-char-select・`^roll\*[^*]+\_`・`^roll*\d+d\d+`・roll*custom・preset-dice\*・`^(custom|param)-dice-modal`）/ ERROR・Cannot resolve なし＝**実機で挙動不変を確認**。

### コミット範囲（pathspec・前作業の未コミット物は温存）

- `fde91e8` は diceRoll/interactions/pagination 配下のみ（`git commit --only` で pathspec 指定）。前作業由来の未コミット（doc 削除7本・構造課題⑤の characterEdit 追加分・`character.service.spec.ts` の net-zero ノイズ・大量の CRLF only `M`）は index/working tree に温存し巻き込まない。

### 残（③ の続き・未着手）

- **Step5**: `CharacterDiceOrchestratorService`(button/)・`CustomDiceModalService`(modal/) を feature へ移し、`dice-roll.module` の `InteractionsModule` import を撤去（差分2 の解消）。
- characterEdit/characterThread の handler も feature 登録へ → 最終的に `interactions.module` の feature module import を全撤去（§8 目標形）。
- **follow-up（docs）**: `interactions/README.md`（前作業で未コミット）が「Phase 1 未着手＝InteractionsModule 所有」と記載しており本移管で陳腐化。`interactions/MIGRATION_GUIDE.md` ともども現状（diceRoll は feature 所有）へ要更新。本コミットでは前作業の未コミット .md を巻き込まないため未着手。

---

## 2026-06-03 デッドコード除去（参照パス／過去形イベント）ブランチ `refactor/ref-path-deadcode-cleanup`

司令塔が grep＋実ファイルで実証した2件のデッドを**挙動不変で除去**。独立コミット単位の2タスク。

### タスク1: `CharacterEventHandlerService` をファイルごと削除（完全デッド）

- 実体: `onModuleInit`→`registerEventListeners()` はログ1行のみで**何も登録しない**（File-based Handlers へ移行済み・登録無効化済み）。private ハンドラ群（update/search/searchById/searchByName/generateUniqueShortCharacterId）は呼び出し元ゼロ。外部 inject ゼロ。
- 着手前 grep 再確認: 参照は `character.module.ts` の import/providers/exports 3箇所＋`character-event-integration.service.ts` の doc コメント言及のみ。実 DI ゼロ。
- 実施: `character-event-handler.service.ts` と `.spec.ts` を削除。`character.module.ts` の providers/exports/import から除去。
- 副作用は onModuleInit のログ1行のみ＝削除で挙動不変。

### タスク2: 過去形デッドイベント `character.updated` / `character.deleted` の emit を全廃

- **購読者ゼロ再実証**: 非テストコードに `.on`/`@OnEvent`/`waitForEvent`/`once`/registry 購読なし。`EventRegistryService` の登録対象は requested 系5ハンドラのみ（過去形なし）。`events/handlers/character-event.handler.ts` は**実在せず**（DESIGN.md の記載が陳腐化）。discord が購読するのは完了形 `character.update.completed`/`character.deletion.completed`（別経路）。→ 過去形 emit は誰にも届かないデッド。
- 実施: emit 7箇所削除（`character.service.ts` 5＝update/updateField/updateFieldByChannelId/remove/removeByChannelId、`character.controller.ts` 2＝update/remove）。`removeByChannelId` の emit 専用だった事前 `findByChannelId` 取得も除去。service が `TypedEventService`/`EVENT_NAMES` を完全未使用化したため import・コンストラクタ注入を削除（controller は discord.\* emit で継続使用のため残置）。
- 未参照定義の整理: `EVENT_NAMES.CHARACTER_UPDATED`/`CHARACTER_DELETED`（参照ゼロ）を**削除**。contracts 型キー `'character.updated'`/`'character.deleted'` は spec が「emit しないこと」を型安全に検証するため**残置し DEPRECATED コメント付与**（新規 emit 禁止を明記）。`character.created` は今回対象外で温存。
- 安全網テスト更新: service.spec / controller.spec の「過去形を emit する」検証を「**emit しないことを確認**」へ反転。integration.spec の `once('character.updated'|'character.deleted')` 待受を「payload が null（=emit されない）＋DB 反映/削除は従来どおり」へ更新。completed 系・discord.\* 系の検証は維持。

### 検証

- `pnpm run build` 成功（タスク1後・タスク2後とも）。
- `pnpm jest src/domains/character`：**7 suites / 115 tests 緑**（integration 含む。当環境は DB モック有効で integration も全9件緑＝新規破損ゼロ）。
- `pnpm run check:circular`：**No circular dependency found!**（新規循環なし）。

---

## 2026-06-03 構造課題⑤ 巨大サービス分割（CharacterEmbedManagerService・挙動保存）

`discord/features/characterEdit/services/character-embed-manager.service.ts`（612行）を `refactor-for-testability` で分割。**公開 API シグネチャ・外部挙動不変**。

### 手順・抽出

- **手順0 characterization 先行**：既存 spec が公開メソッド出力（Embed の title/color/fields、メニュー options、footer 切り詰め、send 呼び出し）を固定。変更前緑を確認。
- Embed/ボタン/メニュー生成の純関数10（`buildBasicEmbed`/`buildSectionEmbed`/`buildEditComponents`/`buildCharacterDiceRollButtons`/`buildFieldSelectMenu`/`buildNewCharacterEmbed`/`buildCharacterCreatedEmbed` 等）を `characterEdit/utils/character-embed.util.ts`（Character→Builder を返す純関数）へ抽出。service の各公開メソッドは util へ1行委譲。
- 副作用（`sendSectionedEmbeds`=channel.send / `createCharacter`=typedEventService.emit）は service に残置。

### 制約遵守（ARCHITECTURE）

- util に DI 無し（TypedEventService を渡さない）。discord.js 依存のため §12 通り **feature 配下**（shared でない）に配置。`EmbedSectionType` は util を正本に service が re-export し既存10ファイルの import 互換維持。新規循環なし。

### 改善指標・検証（司令塔裏取り）

- **service 612 → 180 行**（整形ロジックを全て util へ。残るは副作用2メソッド＋orchestration）。util 純関数割合100%。
- create-test で純関数に +22 ケース追加（data undefined/空/24件超 footer/add専用/未知null 等の分岐網羅）。
- `pnpm run build` 成功 / `pnpm jest src/discord/features/characterEdit`：**21 suites・310 tests 緑**（characterization 33 含む＝挙動不変） / `pnpm run check:circular`：**No circular dependency found!**

---

## 2026-06-03 構造課題④ 横断コードを §12 決定表へ再配置（挙動保存）

ARCHITECTURE §12 決定表違反（`src/utils/` に横断コードが滞留）を是正。**ファイル移動＋import 更新のみ・ロジック不変**。

### 実施（移動4＋import 更新48ファイル）

- 純粋関数 → `src/shared/utils/`：`error-helpers.ts`（isErrorWithMessage/getErrorMessage）・`crypto.util.ts`（鍵引数注入・config非依存）。
- DI サービス → `src/core/http/`：`cookie.service.ts`（@Injectable・Express Response 操作）・`error-handler.ts`（Logger/framework 依存・参照42）。
- 全 import 元（48 .ts）のパスを新配置へ更新。`api-response.util.ts` は提案通り温存。

### 検証（司令塔裏取り）

- 旧パス（`src/utils/error-handler` 等）への参照ゼロを grep 確認。
- `pnpm run build` 成功（import 解決の総合チェック）。
- `pnpm run check:circular`：**No circular dependency found!**（core/http へ移した error-handler が逆流を作らないことを確認）。
- 移動4ファイルの spec：**64 tests 緑**（ロジック不変）。

### 運用メモ・提案（未実施＝別タスク）

- 委譲サブエージェントは報告直前に malformed tool call で失敗したが、**移動＋import 更新の作業自体は完了**しており、司令塔が build/circular/spec/grep で挙動保存を裏取りした。
- 提案（要判断・未実施）：①`api-response.util.ts`（実装参照ゼロ・spec のみ）の廃止 ②`error-handler.ts` の `process.env.NODE_ENV` 直読みを AppConfigService 経由へ（DI 化で挙動が変わりうるため今回は process.env のまま移動） ③型 `src/types/*`→`core/types`（`express/index.d.ts` は tsconfig 型解決のため除外）。

---

## 2026-06-03 構造課題②（ARCHITECTURE §9 domain 純粋性）フェーズ1/2（ブランチ `refactor/ref-path-deadcode-cleanup`）

ARCHITECTURE §9（domain は TypedEventService 直接依存・feature event 名直書きを避ける）/ §15（event name の文字列直書き追加を禁止）違反のうち、**挙動不変で安全な範囲のみ**を実施。emit の層移譲（§9 本丸）は設計判断を要するため **提案に留め未実装**（下記フェーズ3提案）。

### フェーズ1: 安全網（characterization）強化

- 既存 `character.service.spec.ts` / `character.controller.spec.ts` は update/remove 等の主要 emit を既に固定済みだった。**未カバーだった emit 経路**にテスト追加：
  - service: `updateField`（`character.updated` / updateType=`updateField-<field>`）、`updateFieldByChannelId`（同 + channelId）。各々「成功時 emit」「未検出時 emit しない」。
  - controller: `createDiscordThread`（`discord.thread.create.requested`）、`displayCharacterOnDiscord`（`discord.character.display.requested`）。emit payload・未検出404・未認証401・displayType 既定値 enhanced を固定。
- **変更前コードで緑**を確認（service+controller 50 tests green）＝characterization 成立。test-expansion 評価は全対象 **緑(A)**（短関数・依存2–3・副作用は emit/log のみ mock 可・分岐単純。唯一の黄要素「event 名直書き」はフェーズ2の是正対象そのもの）。

### フェーズ2: feature event 名の直書き→定数化（挙動不変）

- `src/events/contracts/index.ts` に **`EVENT_NAMES`** 定数を新設。`as const satisfies Record<string, keyof CharacterEventContracts>` で契約に存在する名前のみ許可（タイポ・契約乖離をコンパイル時に検出）。
- 直書き文字列を置換（同じ event 名・payload で emit ＝ 挙動不変）：
  - `character.service.ts`: `character.updated`×3 / `character.deleted`×2 → `EVENT_NAMES.*`
  - `character.controller.ts`: `character.updated` / `character.deleted` / `discord.thread.create.requested` / `discord.character.display.requested`
  - `character-event-handler.service.ts`（**全体がデッドコード**＝後述）: `character.update.failed` / `findByChannelId.completed|failed` / `findById.completed|failed` / `findByName.completed|failed`
- 残る直書きはコメントアウト済みデッド行（service の行91）のみ。
- 検証: `build` 成功・character domain **119 tests green**（integration の実 emit 経路含む＝定数化後も挙動不変を実証）・`check:circular` 循環ゼロ（`domains/character → events/contracts` は純粋型/定数 import で新規依存方向なし。元から event-handler が同 import 済み）。

### フェーズ3提案（emit 層移譲・★未実装。承認後に別途）

§9 本丸＝「domain から TypedEventService inject を撤去し feature/application 層が publish」の構造変更。判明した実態を踏まえた提案：

1. **`character.updated` / `character.deleted`（過去形）には実購読者が存在しない**。grep 実証：`.on('character.updated'|'character.deleted')` はソース上ゼロ。discord の File-based handler が購読するのは `character.update.completed` / `character.deletion.completed`（完了形）。→ これら過去形 emit（service 5・controller 2）は **発火しても届かない可能性が高い**。移譲より先に「本当に不要なら削除」を検討すべき（要・発火経路の最終確認）。リスク低だが purచase不明なため要設計判断。
2. **`character-event-handler.service.ts` は全体がデッドコード**。`registerEventListeners()` がコメント通り無効化（リスナー登録スキップ）され、`handleCharacterUpdateRequested`/`SearchRequested` 等の private メソッドはどこからも呼ばれない。`onModuleInit` も実質ログのみ。ファイル先頭コメントも「レガシー・将来削除予定」と明記。→ **ファイルごと削除候補**（spec も連動）。今回は直書き排除のため定数化のみ実施（削除は別タスクで上申）。
3. **`discord.thread.create.requested` / `discord.character.display.requested`（controller の2エンドポイント）** は discord 側に実購読者あり（`DiscordThreadCreateRequestedHandler` 等）。これらは「domain controller が discord feature event を直接 publish」する §9 違反。移譲先候補：character feature 用の application/orchestrator 層を新設するか、これらエンドポイント自体を discord feature 側へ移すか。**購読側挙動が変わる危険があり、循環依存（domains→features 逆流）回避の設計が必要**。要・承認。

> 結論: フェーズ1/2 は挙動不変で完了。フェーズ3は「過去形 emit の生死確認＋デッドハンドラ削除」を先行する方が安全で、emit 層移譲（新 orchestrator or discord 移設）はその後。いずれも独断実装せず提案に留めた。

---

## 2026-06-03 参照・経路の全体監査（読み取り専用・コード未変更）

「各関数がどう使われるか（参照・呼び出し経路）」「現構成の妥当性」「保守リスクのあるフォルダ」を洗い出すため、`src/` を8区画に分け**フォルダ単位でサブエージェント（読み取り専用）を並列起動**し、grep で参照を実証。**司令塔（メイン）が報告を裏取りし、矛盾・誤報告を是正**。コードは一切変更していない（build/check:circular 未影響）。

### 司令塔の裏取りで確定した事実（grep 実証）

- **`core/events/typed-event.service.ts:3` が `../../events/contracts` を import**（`core/events → src/events` の依存方向違反＝実害は「イベント契約型の置き場所」問題）。※events 担当の「参照なし」報告は**誤り**、core 担当が正しい。
- **イベント基盤が二重 `@Global`**：`core/events/core-events.module.ts:12` と `events/events.module.ts:49` の両方を `app.module.ts:31,36` が import。`@Global` は他に config のみ（正当）。
- **`src/auth/` は0ファイル（空の残骸ディレクトリ）**。`from '*/auth'` 参照ゼロ＝削除安全。
- **`discord/utils/convertToJSON.ts`（3関数）は非spec参照ゼロ＝デッド確定**。
- **`core/dto/domain.dto.ts`（DtoDomainFactory/PaginationDto/SearchDto）は非spec参照ゼロ＝デッド確定**。
- `discord.embed.update.requested` / `discord.notification.requested` は **emit されている**（`discord/events/handlers/character.creation.completed.ts:129,159`・`characterEdit/.../character-edit-feature.handler.ts:121`）。※events 担当の「emit地点不明＝デッドイベント疑い高」は**誤り**。`src/events/handlers/discord-integration.handler.ts` はログ購読のみ（実処理は各 feature・仕様通り）。
- `discord/utils/getCategory.ts`・`createCategory.ts` は各1関数。discord-utils 担当が主張した「`discord.util.ts` に同名関数あり＝重複」は**裏取りで確認できず（要再精査・重複と断定しない）**。

### 確定デッドコード／低リスク整理候補（build/check:circular で裏取り前提）

| 対象                                                                                                                                                                                                        | 根拠                                                                       | リスク |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| `src/auth/`（空ディレクトリ）                                                                                                                                                                               | 0ファイル・参照ゼロ                                                        | 低     |
| `discord/utils/convertToJSON.ts`                                                                                                                                                                            | 非spec参照ゼロ                                                             | 低     |
| `core/dto/domain.dto.ts` の3 export                                                                                                                                                                         | 非spec参照ゼロ                                                             | 低     |
| `CharacterEventHandlerService` の `UserService` inject（`character-event-handler.service.ts:5,19`）                                                                                                         | `userService.` 呼び出しゼロ（未使用注入）                                  | 低     |
| `interactions/channel/*`（character-channel-create / diceroll-channel-create）, `interactions/select/dice-character-select.service.ts`, `interactions/modal/custom-dice-modal.service.ts` の adapter 重複側 | Module 登録のみで handler は features/adapters 版を import（**要再精査**） | 中     |

### 構造的な保守リスク（要設計判断・既知 H 課題と対応）

1. **core/events ⇄ src/events の責務分割が未確定**（H2 の積み残し）。`typed-event.service`(core) がイベント契約(src/events/contracts) に依存し、@Global も二重。→ contracts を `core/events` 配下へ寄せ、@Global を1本化する案。**挙動保存テスト必須**。
2. **domain 純粋性違反（ARCHITECTURE §9）**：`character.service.ts`(10,70/emit 158,201,231,258,285)・`character.controller.ts`(28,58/emit 210,245,309,349)・`character-event-handler.service.ts` が `TypedEventService` を直接 inject＋feature event 名を直書き。→ event emit を feature/application 層へ移譲（H5/Step5）。**安全網テスト必須**。
3. **interactions core → features の import 29行**（既知 H4・Registry 移行途中）。handler/controller/service/module/`interactions.list.ts` が features を import。ARCHITECTURE §8 目標は「feature 側が registry 登録」で向きが逆。→ Step4 diceRoll Feature 分離と同調して是正。
4. **横断コード置き場所違反（§12 決定表・H1 積み残し）**：`utils/error-handler.ts`→`core/http`、`utils/error-helpers.ts`→`shared`、`utils/cookie.service.ts`→`core/http`、`utils/crypto.util.ts`→`shared`、`utils/api-response.util.ts`→廃止 or `core/http`（実装参照ゼロ・spec のみ）。型 `src/types/*`→`core/types`（express 拡張は例外）。
5. **巨大サービス**：`characterEdit/services/character-embed-manager.service.ts`(612)・`character-modal-handler.service.ts`(597)・`characterThread/character-channel.service.ts`(549・Phase3 で一部無効化中)。Embed 生成ロジックが characterEdit/characterThread 3箇所に分散＝共通 util 抽出余地。

### 健全と確認できた箇所（現構成維持で良い）

- commands 層は features への薄い委譲アダプタとして**生存・重複なし**（CommandsController のみ参照希薄＝別途精査）。
- domain の依存方向は良好（user→auth 再混入なし・H6 維持・循環ゼロ）。Repository/Entity/DTO 基盤は明確。
- events の File-based Registry・request-response パターン・逆流ゼロ（src/events→features なし）は健全。
- core/http の interceptor/filter/decorator は auth/user/character で実使用・宙吊りなし。

### 次にやること（着手はユーザー承認後・各々小PR・安全網テスト先行）

- [x] 低リスク整理を**全て実施済み（2026-06-03、下記記録参照）**：`src/auth` 空ディレクトリ削除（git管理外）／`convertToJSON`（＋spec）削除／`domain.dto.ts` ファイル全体削除（AttributeObject 含め参照ゼロ）／`CharacterEventHandlerService` の未使用 UserService inject 削除（＋spec整合）。build成功・循環ゼロ。
- [x] 中リスク（interactions/channel・select・modal の重複 adapter）を実コード再精査のうえデッド確定→削除（**2026-06-03 完了、下記記録**）。
- [x] 構造課題① **イベント基盤の forRoot 二重・@Global 二重を解消（2026-06-03 完了、下記記録）**。安全網テスト先行＋start:dev 実機検証で挙動不変を証明。
- [x] 構造課題② **domain の event 名直書きを EVENT_NAMES へ集約（§9/§15・2026-06-03 完了、下記記録）**。emit 層移譲（§9本丸）は購読者ゼロ等の発見とともに提案に留め未実装。
- [x] 構造課題④ **横断コードを §12 決定表へ再配置（2026-06-03 完了、下記記録）**。error-helpers/crypto.util→shared、cookie.service/error-handler→core/http。挙動保存。
- [x] 構造課題⑤ **巨大サービス分割: CharacterEmbedManagerService を純関数抽出（612→180行・2026-06-03 完了、下記記録）**。characterization 緑で挙動不変。
- [x] デッドハンドラ `CharacterEventHandlerService` 削除・過去形イベント `character.updated`/`character.deleted` の emit 全廃（購読者ゼロ実証・2026-06-03 完了、下記記録）。
- [~] 構造課題③（interactions→features 向き是正 H4・大規模）**第一歩 = registry の独立 `InteractionRegistryModule` 分離 完了（2026-06-03、下記記録）**。**第二歩 = diceRoll handler/pagination の feature 移管 完了（2026-06-03、コミット `fde91e8`・上記記録・start:dev で handler 12 登録確認・挙動不変）**。残: **Step5a＝CustomDiceModalService 移管 完了（`16c4c03`）／Step5b＝orchestrator/button-ui/history を feature へ移管・DiceServicesModule 新設・`dice-roll.module` の InteractionsModule import 撤去 完了（`352683a`+`354a53f`）＝diceRoll feature ⇄ interactions 結合を解消（§8 diceRoll 分 完了）**。**characterEdit handler の feature 移管 完了（Part A・`a5369cf`）**。**characterThread handler/サービスの feature 移管＋CharacterThreadFeatureModule import 撤去 完了（Part B・`1975af6`・挙動不変）**。残はただ1つ: characterEdit の CharacterEditModule import 撤去＝`InteractionsService` の旧 if 分岐 execute()（CharacterSectionEditorService 使用）の撤去が前提＝**挙動影響ありで承認＋characterization 必須**（詳細は上記「真の障壁」節）。これを除き §8 の feature module import 撤去は diceRoll/characterThread で達成。
- [ ] 残バックログ: `api-response.util` 廃止（**spec oracle で現役→spec 改修とセット**）／`error-handler` の AppConfig化／型 `src/types/*`→`core/types`（**tsconfig 調整要**）／contracts の DEPRECATED 過去形型最終削除。

---

## 2026-06-03 構造課題③ 第一歩: registry を独立 InteractionRegistryModule に分離（挙動不変）

H4（interactions→features の向き是正・§8 目標「feature 側が registry に handler を登録」）の**安全な第一歩**。handler 移動は伴わず、DI 構造の整理のみ＝挙動不変。

### 現状（司令塔の精査）

- `InteractionRegistryService`/`PatternMatcherService` は `interactions.module` の providers に直接登録され、onModuleInit が全 handler を集中登録。
- `interactions.module` は `CharacterEditModule`/`CharacterThreadFeatureModule`（feature module）を import（§8 違反）。
- feature→InteractionsModule の import は `features/diceRoll/dice-roll.module.ts:4,15` の1箇所のみ。

### 実施

- 新規 `discord/interactions/registry/interaction-registry.module.ts`（`InteractionRegistryModule`、@Global 無し、registry/pattern-matcher を providers/exports）。
- `interactions.module`：registry/pattern-matcher を providers から外し `InteractionRegistryModule` を import（exports は re-export で public API 同一）。onModuleInit の集中登録は不変。

### 検証（司令塔裏取り）

- `pnpm run build` 成功 / `pnpm jest src/discord/interactions/registry` **36 tests 緑** / `pnpm run check:circular` **No circular dependency found!**（新規循環なし）。
- `pnpm run start:dev`：`InteractionRegistryModule dependencies initialized`、**全 handler が registry に登録**（CharacterEdit/DicePage/DiceRoll/CharacterThread 系の customId パターン）、ERROR/Cannot resolve なし＝**挙動不変を実機確認**。

### 後続ステップ（段階的・未着手）

1. `features/diceRoll/dice-roll.module.ts` の import を `InteractionsModule`→`InteractionRegistryModule` へ細くする（interactions→feature 全体依存を断つ足場）。
2. diceRoll handler 群を `interactions/handlers/dice-roll/` → feature 側へ移し、`DiceRollFeatureModule` の onModuleInit が自分の handler を registry 登録（集中→分散）。挙動固定テスト＋start:dev で routing 不変を都度証明。
3. 同様に characterEdit/characterThread も feature 登録へ。最終的に `interactions.module` の feature module import を撤去。

---

## 2026-06-03 構造課題① イベント基盤の forRoot/@Global 二重を解消（安全網先行・挙動不変）

### 精査で判明した実態（重要）

イベント基盤は「TypedEventService 1系統に統一済み」と記載されていたが、**実際は emitter が2系統併存**していた：

- **TypedEventService**：`core-events.module.ts` が独自に `new` した `TYPED_EVENT_EMITTER`（character.\* / EventRegistry が使用）。
- **グローバル EventEmitter2**：`EventEmitterModule.forRoot()` 由来（`@OnEvent` 8箇所＝diceRoll・monitoring系、直接 inject 5箇所が使用）。
- 両者は**別インスタンス**で互いに独立（TypedEventService.emit はグローバル `@OnEvent` に届かない）。

問題：`EventEmitterModule.forRoot()` が **2回**呼ばれ（`core-events.module:15`・`events.module:52`、設定相違）ARCHITECTURE §15 違反。`@Global` も二重（core-events・events）。app.module の import 順（CoreEvents 先→Events 後）で forRoot は**後勝ち**＝events 側設定（maxListeners:20 / verboseMemoryLeak:true）が現状有効値だった。

### 安全網（characterization・変更前に緑を確認）

test-expansion→create-test で3点を固定（全項目テスタビリティ🟢）：

- A. `typed-event.service.spec.ts`（既存）— TypedEventService の emit/on 往復（独自 emitter 経路）。
- **B（最重要）`metrics-collector.service.onevent.spec.ts`（新規）** — `EventEmitterModule.forRoot` を組んだ最小 TestingModule で `eventEmitter.emit('discord.command.start'/'complete')` → ハンドラが**メソッド直呼びでなく emit 経由で発火**し状態変化することを固定。AlertManager の `@OnEvent('system.alert')` も1本。
- C. `typed-event-isolation.spec.ts`（新規）— 独自 emitter とグローバル EventEmitter2 が別インスタンスである現状を固定。

### 変更（2ファイルのみ）

- `core/events/core-events.module.ts`：forRoot 設定を events 側の現状有効値へ統一（`maxListeners 10→20`・`verboseMemoryLeak false→true`、他は同一）。
- `events/events.module.ts`：`EventEmitterModule.forRoot()` を imports から削除、exports の `EventEmitterModule` を削除、`@Global()` を削除、未使用 import（`Global`/`EventEmitterModule`）を整理。グローバル EventEmitter2 は **CoreEventsModule（@Global）の forRoot 1つで全域供給**。EventsModule の exports（EventRegistryService/DiscordIntegrationHandler）は外部 DI ゼロのため @Global 解消で誰も壊れない（grep 確認済み）。

### 検証結果（司令塔裏取り）

- `pnpm run build` 成功。
- 安全網3 spec：**29 tests 緑のまま**（＝挙動不変の証明）。B の emit 経由配線テストも緑。
- `pnpm run check:circular`：**No circular dependency found!**（474 files・新規循環なし）。
- `pnpm run start:dev`：**「Nest application successfully started」**／全 InstanceLoader 初期化成功／monitoring 系（@OnEvent 保持）初期化／TypedEventService ハンドラ登録／**DiscordBOT 起動（TRPG_BOT#8068）**／MaxListeners 警告・ERROR・Unhandled なし。

### 残課題（派生）

- `discord/interactions/interactions.module.ts:206` の `EventEmitterModule` import は CoreEventsModule の @Global forRoot が供給するため冗長だが、今回は未変更（別途整理可）。
- **emitter 2系統併存そのもの**（TypedEventService 独自 emitter ↔ グローバル @OnEvent）は設計判断事項。将来 monitoring を TypedEventService 契約へ寄せるか、現状の分離を正とするかは別課題。`src/events/AI.event.md` の「1系統統一」表現は実態（2 emitter）に合わせた追補が必要。

---

## 2026-06-03 中リスク整理 実施（interactions 重複 adapter のデッド削除・挙動不変）

監査の中リスク候補を**司令塔が実行経路まで遡って再精査**し、デッド4件を確定して削除した。

### 再精査で判明した実行経路の真実

- Discord interaction の実行は `InteractionRegistryService.registerHandlers([...])`（`interactions.module.ts` onModuleInit）に登録された **handler 経由のみ**。channel/select/modal の各サービスは「handler の委譲先 provider」で、handler が DI しなければ実行されない。
- `discord-interaction-handler.service.ts` の `registerButton/registerModal/registerSelectMenu` は**定義のみで呼び出し元ゼロ**（`this.buttons/modals/selects` Map は常時空→`interactionsService.execute` へフォールバック）＝**旧登録経路は死亡**。配列収集（getModals 等）経路も無い。
- `DiceCharacterSelectService` と `CustomDiceModalService` は**同名クラスが2箇所に定義された DI 地雷**。handler の import 先が現役、もう一方がデッド（非対称）：
  - `dice-character-select.handler.ts:4` → `features/diceRoll/adapters/dice-character-select.adapter`（**adapters版が現役**）。
  - `dice-roll-modal.handler.ts:4` → `interactions/modal/custom-dice-modal.service`（**interactions/modal版が現役**）。

### 削除した4件（spec 連動・module 登録除去）

| 削除（デッド）                                                      | 現役の正                                                                                 | module 登録除去                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `interactions/channel/character-channel-create.service.ts`（+spec） | controller が `ChannelCreateOrchestratorService` を直接実行(interactions.controller:106) | `interactions.module.ts` import/providers/exports |
| `interactions/channel/diceroll-channel-create.service.ts`（+spec）  | 同上                                                                                     | 同上                                              |
| `interactions/select/dice-character-select.service.ts`（+spec）     | `features/diceRoll/adapters/dice-character-select.adapter.ts`（温存）                    | 登録なし（import 元ゼロ）                         |
| `features/diceRoll/adapters/custom-dice-modal.adapter.ts`（+spec）  | `interactions/modal/custom-dice-modal.service.ts`（温存）                                | `dice-roll.module.ts` import/providers/exports    |

計 削除8ファイル・編集2ファイル（module 2本）。

### 検証結果（司令塔裏取り）

- `pnpm run build` 成功（**S4 の同名トークン DI 解決もエラーなし**。残る `CustomDiceModalService` 参照は全て現役 interactions/modal版へ解決）。
- `pnpm run check:circular`：**No circular dependency found!**（472ファイル・新規循環なし）。
- 現役側2ファイル（adapters dice-character-select / interactions modal）は未編集で残存・参照ゼロ確認。

### 残課題（派生）

- `interactions/select/character-thread-select.service.ts` は今回対象外（別途精査）。
- 同名クラス2実装の DI 地雷は今回2組を解消したが、`features` ↔ `interactions` 間で責務が二重化する構造（H4 Registry 移行の途中状態）は残る。Step4 で向きを揃える際に解消。

---

## 2026-06-03 低リスク整理 実施（デッドコード／未使用注入の一掃・挙動不変）

上記監査で確定した低リスク整理候補のうち3点を、**独立コミット可能な単位**で実施。挙動を変えない除去であり、各ステップ後に build・check:circular で裏取り（S3 は spec も実行）。コミットはメインが別途まとめて行う。

### S1: `discord/utils/convertToJSON.ts` 削除（デッドコード）

- 削除: `src/discord/utils/convertToJSON.ts`（`filterAndFormatInput` / `convertCharacterInfoToJson` / `convertCharacterJsonToString` の3関数）と専用テスト `convertToJSON.spec.ts`。
- 裏取り: 非spec参照ゼロを grep 再確認。barrel(`core/dto` 等の index)経由 re-export なし。spec は3関数専用で生存関数を含まず。
- 検証: build OK / `No circular dependency found!`。

### S2: `core/dto/domain.dto.ts` 削除（ファイル全体・デッド）

- サブエージェントは当初 `DtoDomainFactory` / `PaginationDto` / `SearchDto` の3 export のみ削除し、混在していた `AttributeObject` 型を「範囲外」として温存した。
- **司令塔の裏取りで `AttributeObject` も非spec参照ゼロ**と判明（`grep -rn AttributeObject src` が空）。残す意味がないため**ファイルごと削除**へ切り替え。
- `core/dto` に barrel(index.ts)は存在せず、`domain.dto` への import 参照もゼロ。
- 検証: build OK / `check:circular`「No circular dependency found!」/ `grep domain.dto|AttributeObject src` 全消滅。

### S3: `CharacterEventHandlerService` の未使用 `UserService` inject 削除

- 変更: `character-event-handler.service.ts` から `UserService` の import(旧5行) と constructor の `private readonly userService: UserService`(旧19行) を削除。`userService.` 呼び出しはコード内ゼロ＝未使用注入。クラス本体・public/private メソッドは不変。
- spec 整合: `character-event-handler.service.spec.ts` から `UserService` の import / `mockUserService` / provide / `expect(mockUserService.addCharacterId).not.toHaveBeenCalled()` を削除（呼ばれないものの assert は不要）。
- `character.module.ts` の providers から本サービスは削除していない（現役・3件参照）。
- 検証: build OK / `No circular dependency found!` / `pnpm test character-event-handler.service.spec.ts` = **4 passed**。

---

## 2026-06-03 ドキュメント整合性監査・整理（全 .md を現行仕様へ追従）

リファクタ進展（H1〜H10 / Phase S / H6 循環解消 / テスタビリティ評価）に対し、`.md` 群（node_modules 除く全 42 本）が陳腐化していたため、**ドキュメント毎にサブエージェントを起動して現行コード・正本と照合**し、不整合を是正した。司令塔（メイン）が照合結果を裏取りし、機械的編集は編集サブエージェントへ委譲、判断を要する編集（AI.md 刷新・AI.features.md・削除・本記録）はメインが実施。コードは一切変更していない（build/check:circular に影響なし）。

### 横断的に是正した陳腐化（事実）

- 「型安全性100%完全達成」= 誇張（実態 any 多数・非テスト約230件）→ 現実的表現へ。対象: `AI.md` / `AI.architecture.md`(両) / `AI.domain.md` / `AI.types.md`。
- 「循環は UserDomain⇄AuthDomain のみ許容」= H6（2026-06-01）で解消済み・**現在ゼロ**へ統一。対象: `AI.domain.md` / `src/ARCHITECTURE.md`（現状表）/ `src/discord/AI.discord.md` / `src/events/DESIGN.md`。
- 「イベント駆動移行100%/3系統バス」→ `TypedEventService` 1系統（`core/events`）へ統一済みに修正。`src/events/DESIGN.md` の TypedEventService 配置を `shared/application`→`core/events`（T4 反映漏れ）へ訂正。`src/events/AI.event.md` は現状節と履歴の境界を明示。
- デッドコード3点（`character-id.service.ts`/`character.schema.ts`/`CharacterEventHandlerService`）の「削除可」誤判定に訂正注記（現役）。対象: `docs/refactor/refactoring-audit-2026-05-30.md` ほか。
- `npm run`→`pnpm run`、カバレッジ等の古い数値スナップショットに「最新は AI.test.md」注記。

### 削除（役目を終えた一過性メモ / 空ファイル）7 本

`AI.discord.md`(root, src 版と重複) / `src/claude.md`(旧実行トレース) / `INTERACTION_REGISTRY_IMPLEMENTATION.md`(空) / `src/type-error-fixes.md`(解消済み) / `コメントアウト箇所管理.md` / `adapters復旧必要性分析.md`(復旧不要で決着) / `postFlexibleDiceMenu-flow-analysis.md`(解決済み)。
※ `CLAUDE_HANDOFF.md` は委譲フローの運用ファイルのため**維持**（空テンプレ）。

### 改稿・新規

- `README.md`(root): NestJS 雛形 → プロジェクト固有（pnpm / Quick Start / `test:e2e:tc` / 正本リンク）。
- `src/discord/features/characterEdit/README.md`: 実在しない旧ファイル記述を削除し実構成（`EnhancedCharacterEditService` 中心）へ全面改稿。
- `AI.features.md`(空)→ 正本（DESIGN.md / features README）への索引文書として整備。
- `AI.md`: 冒頭サマリ刷新（正本ポインタ追加）・専門ドキュメント索引を正本/履歴に再編・末尾の無意味断片を削除・Phase 3 を履歴明示。
- `src/discord/{DESIGN.md, interactions/README.md, MIGRATION_GUIDE.md, features/README.md, services/channel/README.md}`: Phase 0/1 進捗・削除済み 5 サービス・型表記を実態へ追従。

### 派生課題（ドキュメント整理の範囲外＝別タスク）

- ~~`discord-facade.service.ts` は現役だが DESIGN の目標フローから除外＝**廃止計画が宙ぶらりん**（Phase 1 で要決着）。~~ → **決着（2026-06-03・ドキュメントのみ／コード不変）**: 実コード精査の結果、**facade は存続**で確定し DESIGN.md §4.5 に明記。旧メモ `docs/history/DISCORD_SERVICES_ANALYSIS.md` の「Phase1 廃止／TypedEventService 代替」は事実誤認（facade に `emitEvent` は無く、`initializeDiscord` 起動オーケストレーション＋REST `DiscordController` 裏付け＋ヘルス集約が実責務でイベント発行はしない）のため撤回。`§4.2 目標フロー` 図に無いのは図が interaction ルーティング専用だから。**実ランタイム経路は `main.ts`/`discord.controller` → `DiscordService`(@deprecated ラッパー) → `DiscordFacadeService` → 各専門サービス**で、`DiscordFacadeService` を直接注入するのはラッパーのみ（Grep 確認）。よって真の廃止対象は `DiscordService` ラッパーであり、DESIGN.md Phase 4 に「main.ts/discord.controller を facade 直注入へ置換 → ラッパー削除」を具体化。**挙動を変える置換は安全網テスト＋ユーザー承認後**（本記録時点では未着手＝コード不変）。
- ~~`src/discord/features/characterEdit/index.ts` の `CharacterEditServiceFactory` が実在しない `./character-channel-create.service` を `require`＝**デッドコード**（呼ぶと失敗）。~~ → **削除済み（2026-06-03）**: 呼び出し元ゼロ（Grep 確認）の未使用 Factory を class ごと削除。実サービス（ChannelDetectionService/CharacterCreationService/CharacterNotificationService）は `./services` から export 済みで DI 経由利用のため挙動不変。検証: build 成功 / check:circular「No circular dependency found!」/ characterEdit spec 21 suites・292 tests 緑。

---

## 2026-06-02 テスタビリティ評価マップ作成（テスト負債レジスタ＝赤リスト）

単体テスト拡充の前段として、spec の無い本体実装 **195 ファイルを緑/黄/赤/対象外で評価**（評価のみ・テスト未作成）。
詳細マップは [AI.test.md](./AI.test.md) の「全体テスタビリティ評価マップ」を正本とする。

**リファクタ観点の要点**：mock 困難＝設計負債の **🔴 赤 約20 件**は、根本原因が **Discord API I/O（fetch/instanceof/create/send/edit/Collection）とロジックの密結合**。H3 巨大サービス分割と同型で、**副作用境界（`ChannelPort`/`MessagePort`/`ThreadPort` 等の Adapter）を切り出してから characterization → テスト**の順で挙動保存して進める。赤の全リストと seam は AI.test.md に記載。

進め方：赤は1件ずつ独立 PR・`refactor-for-testability`（ARCHITECTURE 制約注入：純粋層に DI を持ち込まない／循環を増やさない）で。**挙動を変える着手は別途ユーザー承認後**。`character-channel.service.ts` は Phase3 メンテ中（無効化）のためデッドコード整理 or Phase3 完了の別タスク。

**進捗（2026-06-02 続き）**: 🟢 緑（≈25）に続き 🟡 黄を消化中。interaction handlers（25）・diceRoll adapters（9）・domain repositories（4）・jwt-auth.guard・dice-roll.service・event handler（3）まで spec 追加完了（本体不変・循環ゼロ・build 成功）。**赤（mock 困難＝設計負債）は今回も着手せず deferred 維持**。テスト進捗の正本は [AI.test.md](./AI.test.md)。マップの訂正：diceRoll adapters は「薄い委譲」ではなく pagination 複数メソッドを呼ぶオーケストレーション型だった（テスト可能なので 🟡 のまま）。

**進捗（2026-06-02 さらに続き＝黄 第2バッチ）**: event handlers（update/findByName/`event-handler.base`）・feature orchestrators 7（thread/character-thread/character-channel/performance/dice-result/roll-dice/character-dice）・misc 8（http.service/configuration/winston.config/base-command.service/performance-dashboard.controller/custom-dice-modal.service/dice-character-select.service/dice-history.service）に spec 追加（計 18 spec/236 test・本体不変・循環ゼロ・build 成功・全体スイートの既存 41 失敗は不変）。これで**評価マップで名指しの 🟡 黄はほぼ消化**。

- **新規 🔴 設計負債候補（赤レジスタへ追加）**: `discord/interactions/button/dice-history.service.ts` — fire-and-forget 背景処理＋`Date.now` rate-limit `Map`＋lock `Map`＋`parentChannel.send` が密結合でテストが脆い。seam: Clock 注入／背景更新を public 分離／rate-limit を純関数化。**着手はユーザー承認後**（`character-dice-history.service.ts` とは別物）。
- **テスト基盤の負債**: グローバル `test/utils/jest-setup.ts` の discord.js モックが `EmbedBuilder.setTimestamp`/`setURL`/`setFooter`/`Colors` を欠き、各 spec が個別回避。グローバル補完が望ましい（別タスク）。

**棚卸し更新（2026-06-02・黄残の再評価）**: spec 無しロジック 64 件を 5 並列で再分類（正本は AI.test.md 第2次評価マップ）。

- **新規 🔴 赤3 → 全て改善完了（2026-06-02・承認後 refactor-for-testability 実施）**: 詳細は AI.test.md 赤1/赤2/赤3。各々 characterization 先行→純関数抽出→seam 化→create-test、**公開 API シグネチャ・外部挙動不変**を緑テストで証明。司令塔が build/check:circular/対象テストを裏取り。
  - `discord/services/channel/channel-cache.service.ts` … Clock/Timer(setInterval→onModuleInit)/fetch を seam 化、snowflake/TTL/LRU/stats を `channel-cache.pure.ts` へ抽出。37 件緑。
  - `discord/features/characterThread/services/channel-manager.service.ts` … 選別ロジック(sort/slice25/map)とカテゴリ判定 predicate を `channel-manager.util.ts` へ抽出。34 件緑。
  - `discord/features/characterEdit/services/character-section-editor.service.ts` … customId 解析・getSectionData・modalId 判定・サニタイズ・最重要のフィールド値抽出(AttributeValue/レガシー/プリミティブ3分岐)を `character-section-editor.util.ts` へ抽出（469→約300行）。63 件緑＋消費者 17 件緑。
  - 全工程で `pnpm run build` 成功・`check:circular` 「No circular dependency found!」・新規循環ゼロを確認。グローバル `jest-setup.ts` に discord.js モック欠落の `TextInputBuilder.setValue` を1行補完（既存テスト非影響）。
  - 既知の別負債（本改善と無関係・据え置き）: `message-manager.service.ts:198` の `const batches = []` が `never[]` 推論で `discord-channel-manager.service.spec.ts` がコンパイル不可。`const batches: string[][] = []` の型注釈で解消見込み。チップ起票済み。
- **dead code 検出 → 削除済み（2026-06-02）**: `discord/interactions/button/dice-page-{cancel,first,last,next,prev}-button.service.ts` 5本は adapter 版（`features/diceRoll/adapters/dice-page-*-button.adapter.ts`・テスト済み・DI 登録済み）と重複の**未使用実装**だった。削除前検証で、全 import が adapter 版を指し（interactions.module.ts / dice-roll.module.ts / 各 handler）、`button/...-button.service` への実コード参照がゼロであることを Grep で確認のうえ削除。検証結果：`pnpm run build` 成功／`features/diceRoll/adapters` テスト 9 suites・53 件緑／`check:circular` は「No circular dependency found!」。残る `*.service` 言及は dependency-analysis.json / DESIGN.md / MIGRATION_GUIDE.md のドキュメント側のみ（必要に応じ別途整理）。
- 残 actionable バックログ: 🟢 緑3（`dice-roll-logic.service` 等）／🟡 黄 約25。次は緑→黄で `create-test` 継続。

---

## 2026-06-01 H6 AuthModule⇄UserModule 循環の解消（forwardRef 撤去・挙動保存）

ブランチ `refactor/auth-user-cycle-h6`。最後まで残っていた `domains/auth/auth.module.ts ⇄ domains/user/user.module.ts`（forwardRef）を解消。ARCHITECTURE §10（AuthService→UserService 許容 / UserModule→AuthModule 原則禁止 / 共通 port 切り出し）に準拠。**認証・トークン検証の挙動は不変**。

循環の真因：`JwtAuthGuard` が `AuthService` を注入していたため、guard を使う UserModule が AuthService→UserService を引き込んで循環していた。さらに UserController が `AuthService.validateToken` を直接利用。

破断方式（JWT 検証 primitive を下位モジュールへ抽出）：

- **新設 `JwtTokenService`**（`src/domains/auth/token/jwt-token.service.ts`）：`AuthService.validateToken`/`parseJwt` のロジックをそのまま移設。依存は `JwtService` のみ（UserService に依存しない）。検証ロジック・例外・戻り値は不変。
- **新設 `AuthTokenModule`**（`src/domains/auth/token/auth-token.module.ts`）：`JwtModule.registerAsync`（旧 AuthModule の設定を移設）と `ConfigModule` を import し、`JwtTokenService` / `JwtAuthGuard` / `JwtModule` を providers/exports。`@Global` 不使用の下位共通モジュール。
- **`JwtAuthGuard`**：`AuthService` 注入 → `JwtTokenService` 注入へ繋ぎ替え（`request.user = payload` 等の挙動は不変）。
- **`AuthService.validateToken`/`parseJwt`**：`JwtTokenService` へ委譲する薄いラッパに変更（AuthController の validate-token 等の既存呼び出しは挙動不変）。
- **`UserController`**：`AuthService` 注入を撤去し `JwtTokenService` を注入（findOne の validateToken）。`JwtAuthGuard` は AuthTokenModule 由来。`JwtTokenPayload` は型 import のまま。

モジュール配線 before/after：

- `AuthModule`：`forwardRef(() => UserModule)` → 通常 import に戻す。`JwtModule` 登録を撤去し `AuthTokenModule` を import＋**re-export**（下流の Character/Discord が従来どおり AuthModule 経由で JwtAuthGuard を解決できるよう互換維持）。providers から `JwtAuthGuard` 除去。
- `UserModule`：`forwardRef(() => AuthModule)` を削除し `AuthTokenModule` を import。これで user→auth(module) が消滅。

検証結果：

- `pnpm run build`：成功。
- `pnpm run check:circular`：**No circular dependency found!（0 件）**。これまで許容していた auth⇄user が消滅し、循環ゼロを達成。
- `pnpm test src/domains/auth src/domains/user`：5 suites / 66 tests 緑。既存 spec のモック構造を追従（auth.service.spec は実体 JwtTokenService を登録、user.controller.spec は AuthService モック→JwtTokenService モックへ）。新規 `jwt-token.service.spec.ts`（有効/無効トークン検証）を追加。
- `pnpm run start:dev`：AuthTokenModule/UserModule/AuthModule/CharacterModule/DiscordModule の DI 解決成功、"Nest application successfully started"。

---

## 2026-06-01 H9-character エラーハンドリング統合（character.controller・挙動完全保存）

ブランチ `refactor/error-handling-h9-character`。対象は `domains/character/character.controller.ts`（9 メソッド全てが `@Res()`＋手動 try/catch＋`ApiResponseUtil` 直呼び）。auth/user と同様に `core/http` の `ResponseInterceptor`＋例外フィルタへ controller スコープで置換し、**envelope/status/message/error/errorCode を完全保存**。`ApiResponseUtil` 本体・他 controller・core/http 共通実装は不変。グローバル登録なし。

### auth/user との差分と最小追加

character は汎用 `ApiResponseUtil.error` ではなく**専用ヘルパ**（`authenticationError`/`notFoundError`/`internalServerError`）を使っており、これらは `errorCode` と固定 `message`（'認証エラー'/'未発見エラー'/'サーバーエラー'）を持つ `ErrorResponse` サブクラスを生成していた。共通 `HttpExceptionFilter` は `errorCode` を再現できないため、character スコープ専用に最小追加した（`src/domains/character/character-http.exception.ts`）。

- **`CharacterHttpExceptionFilter`（`@Catch()`）**：`CharacterAuthenticationException`→`AuthenticationErrorResponse`(401)、`CharacterNotFoundException`→`NotFoundErrorResponse`(404)、それ以外→`InternalServerErrorResponse`(500)。いずれも core/http の DTO を再利用するため envelope は `ApiResponseUtil.authenticationError/notFoundError/internalServerError` と完全一致。
- 成功封筒化は共通 `ResponseInterceptor`＋`@ResponseMessage`/`@HttpCode` を流用。**meta を持つ一覧系**（findAll/summaries）は interceptor が meta を落とすため、`SuccessResponse(data, message, meta, uuidv4())` を直接 return（interceptor は `instanceof SuccessResponse` を素通し）して meta を保存。

### エンドポイント別 保存マッピング

| method                     | success (status / message)                                                                | error                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| create                     | 201 / 'キャラクターを作成しました'                                                        | 認証欠落 401(authenticationError,'認証トークンがありません') / DB 500(internalServerError) |
| findAll                    | 200 / 'キャラクター一覧を取得しました'（meta 付き）                                       | 同上 401 / 500                                                                             |
| findUserCharacterSummaries | 200 / 'キャラクターサマリーを取得しました'（meta 付き）                                   | 同上 401 / 500                                                                             |
| findOne                    | 200 / 'キャラクターを取得しました'                                                        | not found 404(notFoundError,'キャラクター') / 500                                          |
| update                     | 200 / 'キャラクターを更新しました'（character.updated emit）                              | 404 / 500                                                                                  |
| remove                     | 200 / 'キャラクターを削除しました'（`{message,characterId}`・character.deleted emit）     | 404 / 500                                                                                  |
| updateDiscordEmbed         | 200 / 'キャラクター情報の取得が完了しました'                                              | 認証 401 / not found 404 / 500                                                             |
| createDiscordThread        | 201 / 'Discordスレッド作成を開始しました'（discord.thread.create.requested emit）         | 401 / 404 / 500                                                                            |
| displayCharacterOnDiscord  | 200 / 'Discordキャラクター表示を開始しました'（discord.character.display.requested emit） | 401 / 404 / 500                                                                            |

Discord 連携 3 メソッドは cookie/redirect の副作用が無く、`@Res()` を完全に return 化（`@SkipResponseWrapper` 不要）。`extractAuthenticatedUser` は `UnauthorizedException`→`CharacterAuthenticationException` に変更（catch 経由の authenticationError と同一 envelope）。

### 検証結果

- `git grep '@Res()' character.controller.ts`：0 件。
- `pnpm run build` 成功。
- `pnpm test character.controller.spec.ts`：**26/26 緑**。spec は新方式（戻り値/throw 検証）＋実機同様の interceptor/filter を介した最終 envelope を `ApiResponseUtil.success/authenticationError/notFoundError/internalServerError` と requestId/timestamp 除き完全一致比較。
- `pnpm run check:circular`：**No circular dependency found**（新規循環なし。character-http.exception は core/dto のみ参照）。
- 既存の `character.integration.spec.ts`（実 DB 依存・トランザクション/イベント）は**変更前から 7 failed の pre-existing**（stash で確認、本変更と無関係）。`character.crud.spec.ts` は単独実行で 9/9 緑（フル並列実行時のみ DB 競合で flaky）。

### 残課題

- 実 HTTP 経由の E2E は未実施。最終的に auth/user/character を共通フィルタ＋グローバル登録へ寄せる際、character の専用 errorCode 保存をどう一般化するか（共通 `HttpExceptionFilter` の `ApiError` 拡張 or 専用例外の昇格）を検討。

## 2026-06-01 H9 エラーハンドリング統合（auth/user controller のみ・挙動完全保存）

ブランチ `refactor/error-handling-h9`。対象は `domains/auth/auth.controller.ts` と `domains/user/user.controller.ts` の 2 つのみ。`character.controller` 他・`ApiResponseUtil` 本体は不変。**レスポンス形（envelope/status/message）を一切変えない**ことを成功条件に、`@Res()`＋try/catch＋`ApiResponseUtil` 直呼びの NestJS アンチパターンを宣言的方式へ置換した。

### 追加した仕組み（`src/core/http/`、controller スコープ適用・グローバル登録なし）

- **`ResponseInterceptor`**：ハンドラ戻り値を `ApiResponseUtil.success` と同一の `SuccessResponse(data, message, undefined, uuidv4())` でラップ。message は `@ResponseMessage` メタ（無ければ '成功'）。`SuccessResponse` 既存インスタンスは二重ラップしない。
- **`HttpExceptionFilter`（`@Catch()`）**：throw を `ApiResponseUtil.error` と同一の `ErrorResponse(errorMessage, label, undefined, undefined, stack, uuidv4())` に整形。
  - `ApiError`（独自 `HttpException`）が throw された場合は最優先で status/label/errorPayload を採用（個別 404/401 分岐の再現）。
  - 素の例外は `@ApiErrorResponse(status, label)` メタを fallback として適用（= 変換前の「catch が全エラーを固定 status＋固定 label に潰す」挙動の再現）。メタも無ければ既定 500/'エラーが発生しました'。
- **デコレータ**：`@ResponseMessage(msg)` / `@ApiErrorResponse(status,label)` / `@SkipResponseWrapper()`（redirect・空返却の非封筒化マーカー）。
- envelope は `ApiResponseUtil` と**同一クラス（`SuccessResponse`/`ErrorResponse`）・requestId=uuid・timestamp**を再利用し形を完全一致。

### エンドポイント別 保存マッピング

auth: validate-token=success 200/'成功'・error 401/'トークン検証に失敗しました' ／ login=200/'成功'・401/'ログインに失敗しました'（code 無し BadRequestException も catch 同様 401 に潰れる挙動を保存）／ logout=200/'成功'・500/'ログアウトに失敗しました'（失敗時ログ出力も保持）／ getUser=200/'成功'・not found は `ApiError(404,'エラーが発生しました','ユーザーID … が見つかりません')`／DB エラー 500/'ユーザー情報の取得に失敗しました'。discordLoginCallback は動的 redirect のため `@Res({passthrough})`＋`@SkipResponseWrapper()`＋`@ApiErrorResponse(401,'Discord認証コールバックに失敗しました')`。
user: 全 success 200/'成功'。create=err 500/'ユーザー作成に失敗しました'、findOne=500/'ユーザー取得に失敗しました'（not found は `ApiError(404,…,'ユーザーが見つかりません')`）、getDiscordGuilds=500/'Discord Guild一覧取得に失敗しました'（user 不在 `ApiError(401,…,'認証トークンがありません')`）、update/addCharacter/removeCharacter/remove も同様に各 500 ラベル＋not found 404。全エンドポイント `@HttpCode(200)` で 200 を保存。

### 検証結果

- `pnpm run build` 成功。
- `pnpm test src/domains/auth src/domains/user src/core/http`：6 suites / 67 tests 緑。controller spec は「戻り値/throw を検証」＋「実機同様の interceptor/filter を介した最終 envelope が変換前の `ApiResponseUtil.success/error` と一致（requestId/timestamp 除き完全一致）」を保証。interceptor/filter 単体テストも追加。
- `pnpm run check:circular`：許容済み UserDomain⇄AuthDomain 1 件のみ（新規循環なし。core/http は依存を一方向に保つ）。
- `@Res()`（引数なし）：対象 2 controller で 0 件。残る `@Res({passthrough:true})` は cookie 設定/redirect の副作用境界のみで、レスポンス本体は interceptor/filter が封筒化。

### 残課題・注意

- `discordLoginCallback` は動的 redirect のため `@Res({passthrough:true})` を維持。`@HttpCode` でなく redirect なので envelope 対象外。passthrough で redirect 後にハンドラが undefined を返す経路は controller spec では緑だが、実 HTTP（redirect 後の二重送信有無）は **E2E 未検証**。本番投入前に手動/E2E で redirect 動作の確認推奨。
- `ApiResponseUtil` は character 等が継続使用のため温存。将来 character spec の AttributeValue ドリフト解消後、同方式を character.controller へ展開し最終的にグローバル登録へ寄せる案。

## 2026-05-30 全フォルダ監査を実施（NestJS ベストプラクティス照合）

`src` 直下10フォルダ（domains, discord, events, core, config, auth, middleware, shared, types, utils）に
専任サブエージェントを割り当て、4視点（設計・依存／コード品質／テスト・保守性／未完成・負債）＋
`nestjs-best-practices` スキル（40ルール）で「劣っている点」を洗い出した。

- 詳細レポート: `docs/refactor/refactoring-audit-2026-05-30.md`
- フォルダ別の生所見: `outputs/refactor-audit/findings/<folder>.md`（セッション作業領域）

### 監査で判明した構造的問題（3点）

1. **横断コードの置き場所の乱立** — `core`/`shared`/`utils`/`types` が重複し、`core/shared`⇔`src/shared`、
   型置き場が `src/types`/`core/types`/`shared/types` の3系統に分散。規約が未確立。
2. **複数の移行が同時に途中停止** — イベントバス一本化、Discord Interactions の Registry 移行、
   `process.env`→`AppConfigService` 集約、`forwardRef` 撤廃、エラーハンドリング統合がいずれも新旧並存。
3. **ドキュメントと実装の乖離** — 「型安全100%」「循環依存0」の主張に対し、`any` が約360件（非テスト約230件）・
   `forwardRef` 循環・`process.env` 直読み（約25ファイル）が残存。

### High 優先課題（横断）

- H1 横断レイヤー責務未確立 / H2 **イベントバス3系統**（EventBusService/GlobalEventBusService/TypedEventService）
  ＋registry/router/manager 三重 / H3 Discord 巨大サービス / H4 Interactions 新旧並存（InteractionsModule が feature を import）/
  H5 ドメイン純粋性の崩れ（Controller の @Res 手動レスポンス＋デッドコード3点）/ H6 auth 二重構造(forwardRef 循環) /
  H7 設定アクセス非集約 / H8 型安全性の実態乖離(`req.user: any`, any 約230件) / H9 エラーハンドリング三重化 /
  H10 純粋層への混入＋機密ログ(`crypto.util.ts` の config 参照, `auth.controller.ts` のトークン console.log)

### 特に緊急（セキュリティ）

- `auth.controller.ts:103-133` 等が **JWT トークン / Authorization ヘッダを console.log 出力**している。
  機密漏洩リスクのため最優先で除去すること。

### 確認されたデッドコード（domains）

- `character-id.service.ts`（利用箇所ゼロ、ID生成は別3系統に分散）
- `character/schemas/character.schema.ts`（zod 248行、参照ゼロの未配線並行実装）
- `CharacterEventHandlerService`（自称レガシー、リスナー登録は空・private 群は呼び出し元なし）

> ⚠️ **2026-05-31 訂正（実コード再確認）**: 上記デッドコード3点の判定は**実態と乖離しており当てにできない**。
>
> - `character-id.service.ts`（`CharacterIdService`）は **4ファイルで参照・使用中**（`CharacterCreationRequestedHandler`
>   経由でキャラ作成のユニーク ID 採番に使われる現役経路）。「利用箇所ゼロ」は**誤り**。削除すればキャラ作成が壊れる。
> - `character/schemas/character.schema.ts` は参照1件、`CharacterEventHandlerService` は参照3件あり、完全な死蔵とは限らない。
> - **結論: これらは安易に削除しない。削除前に必ず実コードで再精査すること。** 監査レポートの同記述も同様に要訂正。

### 推奨着手順（ARCHITECTURE.md の移行順序に整合）

1. 規約の明文化（横断コード／型の置き場所の決定表、`req.user` の any 排除）
2. 機密ログの即時除去（auth.controller のトークン出力）→ console.\* の Logger 統一に着手
3. events/DESIGN.md 作成 → バス3系統を TypedEventService へ統一・registry 一本化・contracts 逆流依存撤去・
   EventsModule/InteractionsModule の feature import 排除
4. 設定集約（AppConfigService に typed accessor、process.env/生 ConfigService 置換、crypto 鍵もここへ）
5. エラーハンドリング統合（単一 ErrorHandler ＋例外フィルタ、Controller の @Res＋try/catch を戻り値方式へ）
6. デッドコード一掃 ＋ Discord 巨大サービス分割（diceRoll Feature 分離から）、domain の event 直接依存除去
7. auth/user の forwardRef 解消（port 切り出しで UserModule→AuthModule を断つ。src/auth と domains/auth 統合。最後に実施）

各ステップは小さな PR に分割し、`pnpm run build` → `pnpm run start:dev` → `pnpm run check:circular`
で循環参照を確認する（UserDomain⇄AuthDomain のみ許容）。

### 次にやること

- [x] 横断コード／型の置き場所の決定表を作成し本書と `AI.types.md` に追記 → **H1 完了（2026-06-01）**：`src/ARCHITECTURE.md` §12 を決定表化（core=DIサービス/インフラ、shared=純粋関数、utils 解消方針、型は core/types 一本化、express 拡張は例外）。`AI.types.md` に正本ポインタ追記。適用（utils/types のファイル移動）は挙動保存の小 PR で順次。
- [x] `auth.controller.ts` 等の機密 console.log を削除（セキュリティ最優先）→ **Phase S で完了（下記）**
- [x] `src/events/DESIGN.md` を作成（バス一本化の具体設計）→ **完了（2026-05-31）**。T1〜T5 まで実施済み。
- [ ] High 課題を Issue / Phase plan 化して着手順に並べる

---

## 2026-05-31 Phase S（セキュリティ最優先）完了

ブランチ `refactor/security-phase-s`。計画書 `docs/refactor/refactor-phase-S-plan.md` の S1〜S4 を実施。
各ステップは nestjs-best-practices スキルのサブエージェントに委譲し、`pnpm run build` /
`pnpm run check:circular` で検証（循環は許容の UserDomain⇄AuthDomain 1件のみ、新規循環なし）。

### S1: 機密ログ除去（完了）

- `auth.controller.ts`: `console.log('Authorization'/'headers')`（JWT・全ヘッダ漏洩）、
  `User object to save` の `JSON.stringify(user)`（discord access/refresh token 漏洩）等、計7行削除。
- `auth.service.ts`: `console.log(redirectUri)`、params 全ループ debug（**client_secret 漏洩**）、
  Discord プロフィール全体 JSON 出力 等、計8行削除。
- **判断: login レスポンス body の `token: jwt` は削除しない。** フロント（Remix loader
  `trpg-remix-app/app/features/auth/api/authLoader.tsx`）が `auth.token` に依存しており、消すと
  ログインが壊れる。「Cookie 専用移行」は別 Issue（下記 残課題）。

### S2: 機密 env 必須化 ＋ crypto 鍵の config 集約（完了）

- `config/environment.validator.ts`: `JWT_SECRET` / `DISCORD_TOKEN_ENCRYPTION_KEY` に最小長32文字検証、
  `REDIRECT_URL` は値がある場合のみ URL 形式検証を追加（エラーに機密値は出さず長さのみ表示）。
- crypto を**純粋関数 ＋ DI サービス**に分離（ARCHITECTURE 方針＝utils は純粋関数のみ）：
  - `utils/crypto.util.ts` … 鍵を引数で受け取る純粋関数化（process.env 直読み廃止）。
    アルゴリズム `aes-256-gcm`・鍵導出 `scryptSync(key,'salt',32)`・フォーマットは維持＝**後方互換あり**。
  - `core/shared/services/crypto.service.ts`（新規）… `@Injectable`、`AppConfigService` から
    `security.discordTokenEncryptionKey` を取得し CryptoUtil へ委譲。`SharedModule` に登録・export。
  - 呼び出し元（`auth.service.ts` 6箇所、`user.service.ts` 1箇所）を CryptoService 注入へ置換。
  - spec: `crypto.util.spec.ts` を鍵引数対応に更新、`crypto.service.spec.ts` 新規（往復・鍵未設定エラー）。

### S3: CORS 二系統解消（完了）

- no-op の `middleware/cors.middleware.ts` を削除。`app.module.ts` から `NestModule`/`configure()`/
  `CorsMiddleware` 配線を撤去（`import { Module }` のみに）。CORS は `main.ts` の `enableCors` に一本化。
- `main.ts`: 未使用の `import cors from 'cors'` を削除。`frontendUrl` 空時に fail-fast するガードを追加し
  `origin` を確定値化（`credentials: true` 維持）。`cors` npm パッケージは未使用＝削除可（未削除・報告のみ）。

### S4: req.headers['user'] 無検証認証導線を Guard 一本化（完了）

- `character.controller.ts` の `extractAuthenticatedUser` と `user.controller.ts` の `getDiscordGuilds`
  から `req.headers['user']` の `JSON.parse` フォールバックを除去し、`JwtAuthGuard` が設定する
  `req.user`（`express/index.d.ts` で `JwtTokenPayload` 宣言済み）のみを使用。`as unknown as` キャスト除去。
- 対象ルートは全て `@UseGuards(JwtAuthGuard)` 付与済み（抜けなし）。

### ⚠️ Phase S 完了後の重要な運用上の注意・残課題

- **【対応済み】** S2 の最小長32文字検証は **`NODE_ENV=production` のときのみ強制**（dev/test は緩和）に調整。
  必須チェック（値の存在）と `REDIRECT_URL` 形式検証は全環境で維持。これによりローカル/開発は既存の短い秘密
  （12文字）でも起動でき、本番のみ強い秘密を要求する。`environment.validator.ts` の `validate()` 内で
  `if (result.NODE_ENV === 'production')` ガードにより実装。dev=success / prod=fail を dist 直叩きで確認済み。
  - ⚠️ **本番デプロイ時の注意**: 本番 env の `JWT_SECRET` / `DISCORD_TOKEN_ENCRYPTION_KEY` は32文字以上が必須。
    `JWT_SECRET` 変更 → 既存 JWT 無効化（再ログイン、影響小）。`DISCORD_TOKEN_ENCRYPTION_KEY` 変更 →
    scrypt 出力が変わり**既存 DB の暗号化 Discord トークンが復号不能**（ユーザーは Discord 再連携が必要）。
    本番で鍵を伸ばす場合は移行計画（再認証フローの案内等）が必要。
- **【別 Issue】** login レスポンス body の `token: jwt` を廃し Cookie(httpOnly) 専用へ移行する。
  フロント（Remix loader が body token で自前 Cookie を設定）の改修が前提。
- **【別 Issue／既存負債】** `auth.controller.spec.ts`・`auth.service.spec.ts`・`user.controller.spec.ts`・
  `user.service.spec.ts`・`character.controller.spec.ts` 等が **Phase S 着手前から** 型/メソッド/モジュール
  不整合でコンパイル不能。Phase S の変更は新規破損を加えていない（stash ベースライン比較で確認済み）が、
  これら spec の修復は別タスク。
- **【未着手】** `cors` パッケージの package.json からの削除、`discord.controller.ts` の独自
  `AuthenticatedRequest` 型一本化（Phase T 型整理へ）。

---

## 2026-05-31 次フェーズ計画（整理）

Phase S 完了後の状況を実コードで再確認し、着手順を整理した。`process.env` 直読みは監査の「約25」ではなく
**実際は9ファイル**（非 spec）。デッドコード3点の判定は誤り（上の訂正注記参照）。

### A. 現ブランチ（refactor/security-phase-s）の締め

- [x] auth/user の壊れた spec を修復（4 suites / 62 tests green）。Guild 系メソッドは Auth→User へ移管済みと判明（`AI.test.md` 記載）。
- [x] pre-commit フックの健全化（`git add .` 撤去・ステージ限定）とテンプレート同期、`prettier.config.js` の CommonJS 化。
- [x] 監査の「デッドコード3点」記述を訂正（本書・監査レポート）。
- [ ] **develop へマージ**（前に `pnpm run build`→`start:dev`→`check:circular` の最終確認。push 要否はユーザー判断）。
- [ ] Phase S スピンオフのバックログ化（下記「別 Issue」群：token の Cookie 専用移行 / 未使用 `cors` パッケージ削除 / 本番 env 32文字必須の周知）。

### B. High 課題（ARCHITECTURE.md の移行順・推奨シーケンス）

1. **H7 設定集約** … `process.env` 直読みを `AppConfigService` へ。**DI 可能な3クラスは移行完了**（2026-05-31, ブランチ `refactor/config-aggregation`）：`channel-cache.service`・`discord-command-registration.service`・`performance-dashboard.controller`。`DISCORD_CACHE_TTL`/`MESSAGE_CACHE_LIMIT`/`CHANNEL_CACHE_LIMIT`/`TEST_MOCK_DISCORD` を schema/validator/configuration/ConfigPaths へ追加し `discord.*` で公開、NODE_ENV は既存 `app.environment` を使用。
   - **残**（DI 困難・別途）：`core/dto/api-response.dto.ts`・`utils/error-handler.ts` の NODE*ENV 直読み（DTO/静的 util で DI 不可）。設定層の読み取り（`config.service`・`configuration` の PROTOTYPE*\*・`environment.validator`）は env→config 境界として維持。
2. **H2/H4 イベントバス一本化＋Interactions registry** … **完了（2026-05-31）**。`events/DESIGN.md` の T1〜T5 を全実施し、安全網テスト（挙動固定）＋build/check:circular/start:dev で挙動不変を都度証明しつつ develop へ段階マージ。
   - **T1**: デッドな `EventRouterService` 撤去。
   - **T2(a/b/c)**: レガシー `GlobalEventBusService` を完全撤去し**バスを `TypedEventService` 1系統に統一**（3系統並存を解消）。生フローは型付き契約に追加のうえ移設、dead 利用は削除。
   - **T3**: events→features 逆流を解消。完了系4ハンドラを `src/discord/events/handlers/`（`DiscordEventHandlersModule`）へ移設し `TypedEventService.on` 自己購読化。EventsModule の feature `forwardRef` import を撤去 → events 層は domains/core/shared 依存のみ。
   - **T4**: `TypedEventService` を `shared/application`→`core/events` へ移設、@Global `CoreEventsModule` 新設、旧 `src/shared/shared.module` 削除（import 48ファイル更新）。
   - **T5**: `src/events/AI.event.md` 冒頭に現状の正アーキテクチャ節を追加し以降を履歴と明示。
   - 正本は `src/events/AI.event.md` 冒頭節＋`src/events/DESIGN.md`。登録は events 層=EventRegistry（File-based）／discord 層=自己購読 の2経路。監査の「contracts 逆流」は実在せず、逆流は handlers→features / EventsModule→feature の import だった（T3 で是正済み）。
3. **H9 エラーハンドリング統合** … **auth/user controller 完了（2026-06-01, ブランチ `refactor/error-handling-h9`）**。`core/http` の controller スコープ例外フィルタ＋レスポンスインターセプタへ置換、envelope/status/message を完全保存（詳細は冒頭 2026-06-01 節）。残: character 他は spec ドリフト解消後に展開し、最終的にグローバル登録へ寄せる。
4. **H3/H5 Discord 巨大サービス分割** … pagination 等の分割＋（再精査後の）デッド整理（中〜大）。
   - **H3 `character-dice-buttons.service.ts` 分割完了（2026-06-01, ブランチ `refactor/discord-service-split-dicebuttons`, 挙動保存）**：848→287 行。純粋整形ロジック（getResultEmoji/formatResultText/getSuccessText/formatDiceRollResultAsText）を `button/character-dice-format.util.ts`（discord.js/Nest 非依存・§12 の feature 配下 util）へ抽出し新規ユニットテスト 23 件追加。履歴・保存・ページネーション表示（saveRollResult/createPaginatedDiceRoll/updateDiceRollHistoryAsync/handleParentChannelMessage/createFallbackControls＋throttle/lock 状態）を `button/character-dice-history.service.ts` へ抽出。公開 API（data/execute/handleDiceRoll/コンストラクタ）不変。コンストラクタ不変制約のため history service は注入済み依存から内部 `new` で生成・再利用（DI provider 追加なし＝module 無変更）。既存 21 テスト緑維持、build 成功、check:circular 循環ゼロ。残デッド：`handleParentChannelMessage` は未呼び出し（移設のみ・削除は別タスク）。
5. **H6 auth/user forwardRef 解消** … port 切り出し＋`src/auth`/`domains/auth` 統合。影響最大＝最後（大）。
6. 随時: **H1/H8** 横断コード・型の置き場所決定表＋`any` 削減。

### C. テスト負債（別トラック）

- `character`/`discord` 系 spec が **AttributeValue モデルドリフト**でコンパイル不能（Phase S 着手前から）。`test-expansion`/`create-test` で別タスク修復。auth/user spec は A で修復済み。

### 進め方

各 High 課題は `trpg-refactor` スキル（理解→nestjs-best-practices へ実装委譲→build/check:circular 検証→AI.\*.md 記録）で小さな PR に分割して進める。循環参照は UserDomain⇄AuthDomain のみ許容。
