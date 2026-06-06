# プロジェクト問題点レビュー報告 2026-06-05

> 本書は **レビュー専用**。実装コード・既存 docs は一切変更していない。新規作成はこの 1 ファイルのみ。
> 委譲元: `CLAUDE_HANDOFF.md` 冒頭「プロジェクト問題点レビュー報告書（2026-06-05）」。
> 根拠は実ファイルパス（可能なら行番号・grep 件数）を添える。実コードで確証が取れないものは `未確認` / `推測:` と明記する。
> 対象: `C:\workspace\dokcer-trpg-remix-app` モノレポ全体（TRPG-SERVER ＝ NestJS バックエンド / trpg-remix-app ＝ Remix フロントエンド）。
> 棚卸し基準コミット: `ecc6d63`（S-5c）。作業ツリーには大量の未コミット dirty があり、本書は dirty 由来か実装由来かを各 finding で切り分ける。

---

## 結論

重要度順の主要問題（詳細は Findings）。

1. **(P1) frontend のテストが 1 件も実行されていない** — `jest.config.cjs` の `roots` が存在しない `src/` を指し、実体は `app/` 配下。テストファイルも 0 件。回帰防止が frontend では機能していない（F1）。
2. **(P1) キャラクター作成 UI が Discord 連携フィールドを空で送信** — `characterCreate.tsx` が `discordUserId` / `discordChannelId` / `characterId` を空文字列で送る。データ整合性リスク（F2）。
3. **(P2) CI / 自動テストゲートが存在しない** — `.github/workflows` 不在。build / test / check:circular は手動実行のみ（F3）。
4. **(P2) 作業ツリーが大規模に未コミット/未追跡** — `TRPG-SERVER/docs/` ディレクトリ全体が未追跡（正本級の棚卸し 2 本を含む）、削除済み docs 7 本が未コミット、計 136 ファイル変更。正本が git 履歴に残らない導線リスク（F4）。
5. **(P2) `postActionButtons` の dead path** — `character_edit_` / `dice_roll_` / `character_info_` を生成するコードは live に残るが、呼び出し元はコメントアウト・registry 未登録（F5）。
6. **(P2) frontend の認可チェック未実装** — 管理者権限・リソース所有者チェックが `auth-guards.ts` で TODO のまま（F6）。
7. **(P2) プリセットダイスの「本格ルール」未実装** — SAN 値判定・武器ダメージ等は system 既定 notation ＋「（簡易）」ラベルの暫定実装（F7）。
8. **(P3) Discord 設計ドキュメントの As-Is が陳腐化** — DESIGN.md / interactions README / MIGRATION_GUIDE が解消済みの「God Module」「Phase 未着手」を記載（F8）。
9. **(P3) 「TypeScript 型安全性 100%」は誇張** — server 非テストで `any` 約 215 件、frontend 約 30 件（F9）。
10. **(P3) 将来実装 TODO が複数の event handler に残置** — creation source 分岐が CharacterEdit へ一律フォールバック等（F11）。

> **P0（即時対応が必要な本番停止級）は本レビューでは検出されなかった**。過去に確認されていた致命的バグ（projection 不足・channelId 抽出 throw・modal field 不一致）は「ダイスボタン customId 統合キャンペーン（案2・S-1〜S-5c）」で修正済み（`AI.refactor.md` 末尾）。残る問題は P1 以下。

---

## Findings

各 finding: `ID / 優先度 / 種別 / 問題 / 根拠 / 影響 / 推奨対応 / 次の検証`。
優先度 = P0/P1/P2/P3。種別 = bug / architecture / test / docs / operations / frontend / unknown。

---

### F1 — frontend のテストが収集されず 1 件も実行されない

- **優先度**: P1
- **種別**: test / frontend
- **問題**: jest 設定が実プロジェクト構造と乖離し、テストが収集・実行されていない。テストファイル自体も存在しない。
- **根拠**:
  - `trpg-remix-app/jest.config.cjs:2` — `roots: ['<rootDir>/src']`。だが実コードは `app/` 配下（`app/routes`・`app/features` 等）。`src/` ディレクトリは実質空。
  - `trpg-remix-app/jest.config.cjs:13-19` — `coverageThreshold` global 80%。テスト 0 件では満たせない。
  - `app/**` 配下に `*.test.ts(x)` / `*.spec.ts(x)` は **0 件**（Explore 調査）。
  - `trpg-remix-app/package.json:12` — `"test": "jest"` は定義済みだが上記理由で空回り。
- **影響**: frontend 側の回帰検知が皆無。`pnpm test` を緑と誤認するリスク（収集 0 件で exit 0 になり得る／coverage 閾値で fail する可能性は要確認）。
- **推奨対応**: `roots` を `['<rootDir>/app']` へ修正、または `app/` にテストを配置。最低限、API クライアントと action/loader の unit テストを追加。
- **次の検証**: `cd trpg-remix-app; pnpm test`（実際に何 suite 収集されるか）。`jest --listTests` で対象 0 件を確認。

---

### F2 — キャラクター作成 UI が Discord 連携フィールドを空送信

- **優先度**: P1（**未確認**: この component が live な作成導線か）
- **種別**: bug / frontend
- **問題**: キャラクター作成リクエストで `characterId` / `discordUserId` / `discordChannelId` を空文字列のまま送信している。
- **根拠**: `trpg-remix-app/app/features/character/components/characterCreate.tsx:58,61,62`
  - `characterId: '' // 仮のID生成`
  - `discordUserId: '' // TODO: 実際のユーザーIDを設定`
  - `discordChannelId: '' // TODO: 実際のチャンネルIDを設定`
- **影響**: 作成キャラクターが Discord ユーザー/チャンネルに紐づかない。バックエンド側 validation が緩い場合、不完全レコードが永続化される。`findByChannelId` 経路（ダイスボタン等）が空 channelId のキャラに解決できない。
- **推奨対応**: 認証済みユーザーの discordUserId / 対象 channelId を loader/action から供給。バックエンド DTO 側の必須バリデーションも確認。
- **次の検証**: 当 component の実際のマウント箇所（routes からの参照）を追跡。`character` ドメインの作成 DTO（`src/domains/character/dto`）が空文字列を許容するか確認。

---

### F3 — CI / 自動テストゲートが存在しない

- **優先度**: P2
- **種別**: operations
- **問題**: リポジトリに CI 定義がなく、build / test / lint / check:circular が手動実行に依存している。
- **根拠**: `.github/workflows` ディレクトリ不在（`ls .github/workflows` → not found）。ルートに CI 設定ファイルなし。
- **影響**: PR/コミット時の自動検証がない。F1（frontend テスト空回り）と相まって、回帰が人手のチェック漏れで通過し得る。`AI.refactor.md` の健全性ゲートは作業者の手動実行記録に依存。
- **推奨対応**: 最低限 GitHub Actions で TRPG-SERVER の `pnpm build` / `pnpm test` / `check:circular`、frontend の `typecheck` / `test` を回す。
- **次の検証**: `docker-compose.yml` / 各 `Dockerfile` は存在（ビルド経路はある）。CI 化の前提は揃っている。

---

### F4 — 作業ツリーが大規模に未コミット/未追跡（正本 docs を含む）

- **優先度**: P2
- **種別**: operations
- **問題**: 多数のファイルが未コミットで、特に **`TRPG-SERVER/docs/` ディレクトリ全体が git 未追跡**。正本級の棚卸し文書も履歴に入っていない。
- **根拠**（本タスク開始時点の `git status --porcelain`）:
  - 変更総数 **136** ファイル / 削除（D）**15** 件。
  - `?? TRPG-SERVER/docs/` — docs ディレクトリ丸ごと未追跡。配下に `reviews/feature-inventory-2026-06-05.md`・`reviews/document-inventory-review-2026-06-05.md`（直近の正本級成果物）、`guides/`・`history/`・`refactor/` の再配置分が含まれる。
  - `?? TRPG-SERVER/src/discord/features/diceRoll/custom-id/` — 未追跡（feature-inventory も `??` と記録）。
  - 削除済み未コミット docs 7 本（`AI.discord.md`(root) / `INTERACTION_REGISTRY_IMPLEMENTATION.md` / `adapters復旧必要性分析.md` / `postFlexibleDiceMenu-flow-analysis.md` / `src/claude.md` / `src/type-error-fixes.md` / `コメントアウト箇所管理.md`）＝ `AI.refactor.md:1037-1039` の意図的削除リストと一致。
  - 大量の `M`（主に `.md` と CRLF churn）。`document-inventory-review` でも「CRLF＋formatter churn 多発」と記録。
- **由来切り分け**: **すべて本タスク以前から存在する既存 dirty**（委譲メモ「既知の作業ツリー状態」と一致）。本レビューが新規作成する `project-issues-report-2026-06-05.md` も `docs/` 未追跡配下に置かれるため `??` になる（想定どおり）。
- **影響**: 正本（棚卸し 2 本・本書）が commit されないと履歴に残らず、別セッション/レビュアーが参照できない。意図的削除と未整理 churn が混在し、安全な commit 単位の選別が難しい。
- **推奨対応**: `docs/` の正本（reviews/guides/history/refactor）を pathspec 限定でコミット。削除 7 本のコミット是非は Codex/ユーザー判断。CRLF churn は `.gitattributes` / formatter 設定で根治を検討。
- **次の検証**: `git status --porcelain -- TRPG-SERVER/docs/` で未追跡範囲を確定。`git add -n` でドライラン。**本タスクでは stage/commit しない**。

---

### F5 — `postActionButtons` の dead path（生成は live・配線なし）

- **優先度**: P2
- **種別**: bug（latent）/ architecture
- **問題**: `character_edit_` / `dice_roll_` / `character_info_` ボタンを生成するコードが live に残るが、呼び出し元はコメントアウトされ、handler も registry 未登録。クリックしても routing されない潜在経路。
- **根拠**:
  - 生成: `src/discord/features/characterThread/services/thread-interaction.service.ts:35-49`（live コードに存在）。
  - 呼び出し元: `src/discord/features/characterThread/services/thread-orchestrator.service.ts:79` が **コメントアウト**。
  - registry 未登録（`feature-inventory-2026-06-05.md` #1・D5 で確定状態 = dead）。
- **影響**: 撤去 or 機能化の判断が未決のまま dead コードが残置。誤って配線されると未 routing ボタンが露出するリスク。
- **推奨対応**: feature-inventory の推奨どおり、まず A（dead 撤去）。機能追加（custom-id 契約化＋handler 新設）は別タスク。`/discord` 内に閉じる単独 slice。
- **次の検証**: `pnpm test -- thread-interaction.service.spec.ts`（spec:64-86 が生成のみ固定）。

---

### F6 — frontend の認可チェック（管理者/所有者）が未実装

- **優先度**: P2
- **種別**: frontend / operations（security）
- **問題**: 認可ガードに管理者権限・リソース所有者チェックが TODO のまま実装されていない。
- **根拠**: `trpg-remix-app/app/utils/auth-guards.ts:78`（`// TODO: 将来的に管理者権限チェックを追加`）/ `:95`（`// TODO: 将来的にリソース所有者チェックを追加`）。
- **影響**: frontend のセキュリティモデルが不完全。最終的な認可はバックエンドに依存する想定だが、UI ガード欠如は誤操作・情報露出につながり得る。
- **推奨対応**: 認可はバックエンドを single source of truth としつつ、frontend ガードを実装。バックエンド側のリソース所有者検証（character/user ドメイン）が効いているかも併せて確認。
- **次の検証**: バックエンド `JwtAuthGuard` 適用範囲（`character.controller.ts` / `user.controller.ts` の所有者検証）を確認。

---

### F7 — プリセットダイスの「本格ルール」未実装（暫定機能のみ）

- **優先度**: P2
- **種別**: bug（機能未完）
- **問題**: `dice_(coc7|dnd5e|sw25)_*` プリセットは、専用ゲームルール（SAN 値比較・武器ダメージ式・命中-回避・魔法行使等）が未実装。system 既定 notation ＋「（簡易）」ラベルで暫定機能化されている。
- **根拠**:
  - `src/discord/features/characterThread/custom-id/preset-dice.custom-id.ts:10,69,94`（「専用ゲームルール…は未実装」「専用ルール未実装の semantic action は『（簡易）』」）。
  - `src/discord/features/characterThread/handlers/preset-dice-quick-roll.handler.ts:14`（「専用ゲームルール…未実装かつ findByChannelId が stats 非返却」）— ただし projection 前提は S-1 で拡張済（`character.repository.ts`）。
  - 設計記録: `AI.refactor.md`「P1-D 後続 ③」節（`fa1ff5b`）。
- **影響**: SAN ボタン等が semantic 判定をせず単純ダイスを振る。UX 上は「（簡易）」で明示されるが、TRPG ルール的には未完。
- **推奨対応**: ゲームシステム単位で sub-slice（coc7→dnd5e→sw25）。各々 characterization を張ってから semantic 実装。
- **次の検証**: `findByChannelId` の status/skill/parameter/gameSystemId projection（S-1 で拡張済）を前提に、system 別ルールを実装。

---

### F8 — Discord 設計ドキュメントの As-Is が陳腐化

- **優先度**: P3
- **種別**: docs
- **問題**: Discord 層の設計文書が、解消済みの「God Module」「3 層ルーティング並存」「forwardRef 残存」「Phase 未着手」を As-Is として記載。
- **根拠**:
  - `src/discord/DESIGN.md:4`（「Phase 0 一部着手 / 未完了」）・§2-3（God Module 等）。
  - `src/discord/interactions/MIGRATION_GUIDE.md:16,18`（「🟡 一部着手 / 未完了」）。
  - `src/discord/interactions/README.md`（特例分岐「移管予定」表記）。
  - 実態は P1-A/B/C・S 完了で解消（`AI.refactor.md` 健全性ゲート / `feature-inventory` D1・D2 / `document-inventory-review` P1）。
- **影響**: 実装と乖離した As-Is が新規作業者を誤導する。ただし各文書とも目標アーキ・原則は現役で、誤導は限定的。
- **推奨対応**: 設計方針変更を伴わない**注記更新に限定**（「実装は P1-A/B/C・③・S で解消済み、現状は feature-inventory 参照」）。docs-only slice。**触らない範囲のため本タスクでは未改稿**。
- **次の検証**: feature-inventory D1/D2・document-inventory-review P1 の該当行。

---

### F9 — 「TypeScript 型安全性 100%」は誇張（`any` 多数残存）

- **優先度**: P3
- **種別**: architecture / type
- **問題**: 旧スナップショットの「型安全性 100%達成」表現に反し、`any` が多数残る。
- **根拠**:
  - server 非テスト `any`（`: any` / `as any` 等）grep ヒット **約 215 件**（`TRPG-SERVER/src/**/*.ts` 除 `*.spec.ts`）。
  - frontend `any` grep ヒット **約 30 件**（`trpg-remix-app/app/**`）。
  - `AI.md:14` 自身が「『100%』は誇張。実態は any 多数残存（非テスト約230件）で段階的削減中」と既に是正注記。正本は `AI.types.md`。
  - 実例: `src/events/handlers/character.creation.requested.ts:215,263`（`as any` / `character: any`）等。
- **影響**: 型安全の主張と実態が乖離。実害は限定的（AI.md で注記済み）だが、`AI.md` 中盤以降の 2025 年スナップショットは依然「100%」表現を含み読み手を惑わせ得る。
- **推奨対応**: 既に AI.md 冒頭で注記済み。追加対応は不要だが、`any` 削減は AI.types.md の段階計画に従う。
- **次の検証**: `AI.types.md` の削減計画と実カウントの突き合わせ。

---

### F10 — dice services の dead な preset メソッド残置

- **優先度**: P3
- **種別**: bug（minor）/ cleanup
- **問題**: `DiceOrchestratorService` / `DicePresetService` に呼び出し元のない preset 生成メソッドが残る。
- **根拠**: `AI.refactor.md` S-5c 節（「`createPresetButton`/`handlePresetDiceRoll` は残置・別 issue」）。`feature-inventory-2026-06-05.md` #3・#4。
- **影響**: 低。dead コードによる可読性低下のみ。`DiceRollLogicService` 等 live サービスとは独立。
- **推奨対応**: live 呼び出し元ゼロを grep 再確認のうえ 1 サービスずつ撤去。`/discord/services/dice` に閉じる低リスク slice。
- **次の検証**: `rg -n "createPresetButton|handlePresetDiceRoll" src/discord/services/dice`（**本タスクでは未再実行＝未確認**。撤去前に要検証）。

---

### F11 — event handler の「将来実装」TODO 残置

- **優先度**: P3
- **種別**: bug（機能未完）
- **問題**: 作成 source 別分岐や編集環境セットアップが未実装で、フォールバック/no-op になっている。
- **根拠**:
  - `src/events/handlers/character.creation.requested.ts:229,241,253` — CharacterThread / GameSystem / DiceRoll 向け作成が **すべて CharacterEdit 処理へフォールバック**（`logger.warn('... not implemented yet')`）。
  - `src/discord/features/characterEdit/events/handlers/character-edit-creation.handler.ts:157` — `setupCharacterSheet` 未実装（debug ログのみ・例外は握り潰し `:167-169`）。
  - `src/discord/events/handlers/character.deletion.completed.ts:102` — 削除/アーカイブ選択が TODO。
- **影響**: 中〜低。creation source による差別化が効かず一律 CharacterEdit 経路になるが、フォールバックで機能は動作。`setupCharacterSheet` は no-op だが失敗扱いにしない設計。
- **推奨対応**: source 別分岐の要否を仕様判断。不要なら分岐自体を削除して「未実装フォールバック」の warn ノイズを除去。
- **次の検証**: creation source（event payload）が実際に CharacterThread/GameSystem/DiceRoll を取り得るか、emit 側を追跡。

---

### F12 — frontend API クライアントのセキュリティ観点（要精査）

- **優先度**: P3（**推測**: Explore サブエージェント報告ベース・本書作成者は api-client を直接精読していない）
- **種別**: frontend / operations（security）
- **問題**: 開発時の TLS 検証無効化・CSRF 未実装・本番 console ログ除外の不確実性が報告された。
- **根拠（推測・要 Codex 確認）**:
  - `trpg-remix-app/app/lib/api-client.ts:9-14` — `NODE_TLS_REJECT_UNAUTHORIZED='0'`（開発環境限定とされる）。
  - CSRF トークン未実装（form action 経路）。JWT Bearer 経路はリスク低。
  - `isDevelopment` 条件付き `console.log` が本番ビルドで tree-shake 除去されるか未確認。
- **影響**: 本番で TLS 無効化が誤適用されると中間者攻撃リスク。ログ残存で情報露出の可能性。
- **推奨対応**: 本番ビルドで `NODE_TLS_REJECT_UNAUTHORIZED` 設定と console 出力が除去されることを実ビルドで確認。CSRF の要否を form 経路の脅威モデルで判断。
- **次の検証**: `api-client.ts` を実精読。`pnpm build` 後の bundle で TLS 設定・console を grep。

---

### F13 — gameSystem / userDefinedDice の実 routing 経路が未追跡

- **優先度**: P3
- **種別**: unknown
- **問題**: 2 feature が interaction registry 非登録。slash command 完結が推測だが、autocomplete/select 経路の有無が未確認。
- **根拠**: `features/gameSystem` / `features/userDefinedDice`（onModuleInit 登録なし）。`feature-inventory-2026-06-05.md` #6・未確認欄。
- **影響**: 低。設計どおりなら問題なし。未追跡のため latent gap の可能性は残る。
- **推奨対応**: slash command dispatch（`commands.controller.ts` / `commands.service.ts`）からの呼び出し経路を実トレース。
- **次の検証**: `commands.list.ts` の `create-dice-channel` / `user-dice` → orchestrator の routing 確認。

---

## すぐ直す候補

明確な不具合で、局所修正かつ低〜中リスクのもの。

- **F1**: `jest.config.cjs:2` の `roots` を `app/` へ修正（または `app/` へテスト配置）。frontend の回帰防止を最低限機能させる。
- **F2**: `characterCreate.tsx:58,61,62` の空文字列フィールドを実値供給に修正（live 導線か確認のうえ）。
- **F5**: `postActionButtons` dead path を撤去（feature-inventory 推奨 A）。`/discord` 内に閉じる。
- **F10**: dice services の dead preset メソッド撤去（grep 再確認後）。

## 設計判断が必要な候補

仕様/方針決定を伴うため、実装前に Codex/ユーザー判断が要るもの。

- **F3**: CI 導入（対象・トリガ・必須ジョブの選定）。
- **F6**: frontend 認可モデル（UI ガードの責務範囲・バックエンドとの分担）。
- **F7**: プリセットダイス本格ルールの実装方針（system 別 sub-slice・どこまで semantic 化するか）。
- **F11**: creation source 別分岐の要否（実装するか、分岐ごと削除して warn ノイズを消すか）。
- **F8**: Discord 設計 docs の注記更新可否（**触らない範囲**＝Codex 判断）。

## 後回しでよい候補

実害が小さい / 既に注記済み / 履歴として許容されるもの。

- **F4**: 大規模 dirty の整理（正本コミット・CRLF 根治）。本タスクでは触らない。コミット単位の選別は Codex/ユーザー判断。
- **F9**: 「型安全性 100%」表現の是正（`AI.md` 冒頭で既に注記済み）。
- **F12**: frontend API クライアントのセキュリティ精査（推測段階・要実精読）。
- **F13**: gameSystem / userDefinedDice の routing 経路確認（設計どおりの可能性が高い）。

---

## 未確認・推測

- **F2 の live 性**: `characterCreate.tsx` が実際にマウントされる作成導線かは未追跡（routes からの参照を未トレース）。空送信は実コードで確認済みだが、影響範囲は `未確認`。
- **F10 の真の dead 性**: `DiceOrchestratorService`/`DicePresetService` の preset メソッドの live 呼び出し元ゼロは `AI.refactor.md` の記載に依拠。本書では grep 再実行していない（`未確認`）。
- **F12 全般**: `api-client.ts` の TLS 設定・CSRF・本番ログ除去は Explore サブエージェント報告ベースの `推測`。本書作成者は当該ファイルを直接精読していない。
- **build / test の現状**: 委譲方針に従い本タスクでは TRPG-SERVER の `pnpm build` / `pnpm test` / `check:circular` を**再実行していない**。健全性（build OK / No circular / forwardRef・process.env・ModuleRef ゼロ）は `AI.refactor.md`（2026-06-04 裏取り）の記録に依拠＝`未確認`（本セッションでは未検証）。
- **config の `process.env` 直接参照**: `src/config/config.service.ts:58`（`getRaw`）と `src/config/configuration.ts`（`PROTOTYPE_*`）に残るが、いずれも **config module 内部＝ARCHITECTURE §11 の許容例外**。違反ではない（参考情報）。
- **`EventEmitterModule.forRoot()`**: `src/core/events/core-events.module.ts:15` に 1 箇所のみ。これはバス一本化の唯一の正規初期化で、ARCHITECTURE が禁じる「**新規追加**」には該当しない（規約遵守）。
- **frontend のテスト exit code 挙動**: 収集 0 件で `pnpm test` が exit 0 になるか coverageThreshold で fail するかは未検証（`未確認`）。
- **commands.list.ts の 6 コマンドの実 routing 細部**: Explore 棚卸し由来。dispatch 実装は未確認（feature-inventory と同じ留保）。

---

## 実行した調査コマンド

| コマンド / 操作                                                                                                 | 重要な結果                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short` / `--porcelain`                                                                            | 変更総数 **136**・削除 **15**。`?? TRPG-SERVER/docs/`（docs 丸ごと未追跡）・`?? .../diceRoll/custom-id/`・削除 7 docs 未コミット を確認（F4）。                                                                                                                       |
| `rg "TODO\|FIXME\|未実装\|deferred\|NotImplemented" TRPG-SERVER/src`（Grep tool）                               | live コードの TODO を抽出（F11 の creation/edit/deletion handler、F7 の preset、其他は spec/正常な `deferred` 判定）。                                                                                                                                                |
| `rg "forwardRef\|@Global\|EventEmitterModule.forRoot\|ModuleRef.get\|process.env" TRPG-SERVER/src`（Grep tool） | 実コードの `forwardRef`/`ModuleRef.get` はゼロ（ヒットは docs 履歴と rule のみ）。`@Global` は config.module / core-events のみ。`EventEmitterModule.forRoot` は core-events.module.ts:15 の 1 箇所（規約遵守）。`process.env` 実コードは config 内部の許容例外のみ。 |
| `grep -rn ": any\|as any" TRPG-SERVER/src --exclude=*.spec.ts \| wc -l`                                         | server 非テスト `any` **約 215 件**（F9）。                                                                                                                                                                                                                           |
| `grep -rn ": any\|as any" trpg-remix-app/app \| wc -l`                                                          | frontend `any` **約 30 件**（F9）。                                                                                                                                                                                                                                   |
| `ls .github/workflows`                                                                                          | 不在＝CI なし（F3）。`docker-compose.yml` / 各 `Dockerfile` は存在。                                                                                                                                                                                                  |
| `Read` jest.config.cjs / characterCreate.tsx                                                                    | F1（roots=src）・F2（空フィールド送信）を実ファイルで直接確認。                                                                                                                                                                                                       |
| Explore サブエージェント（frontend 全体）                                                                       | package scripts・ルート構成・mock/TODO・tsconfig strict・テスト 0 件・api-client 所見を取得（F1/F2/F6/F12 の一次情報。security 系は推測として F12 に隔離）。                                                                                                          |
| `Read` 正本 docs                                                                                                | `AI.md` / `AI.refactor.md`（〜443行）/ `src/ARCHITECTURE.md` / `docs/README.md` / `feature-inventory-2026-06-05.md` / `document-inventory-review-2026-06-05.md` / `AGENTS.md` を精読し、解決済み事項と残課題を切り分け。                                              |

---

## Claude から Codex へのレビュー依頼事項

1. **F2 の優先度確定**: `characterCreate.tsx` が live な作成導線か（routes 参照の有無）を判定し、空 `discordUserId`/`discordChannelId` 送信を P1 として扱うか確認。バックエンド作成 DTO の必須バリデーションも要確認。
2. **F1 の修正方針**: `jest.config.cjs` の `roots` 修正 + frontend テストの初期セットを Claude に実装委譲するか。coverageThreshold 80% を維持するか緩めるか。
3. **F4 のコミット判断**: `TRPG-SERVER/docs/` 正本（reviews/guides/history/refactor）と本レビュー報告書のコミット是非、削除 7 docs のコミット是非。CRLF churn の根治（`.gitattributes`）方針。**本タスクでは未実施**。
4. **F8 の docs 注記更新可否**: DESIGN.md / interactions README / MIGRATION_GUIDE の As-Is 注記更新を許可するか（触らない範囲のため未改稿）。
5. **F5 の処理方針**: `postActionButtons` dead path を撤去（A）するか機能化（B）するか。feature-inventory は A 推奨。
6. **F7 の実装スコープ**: プリセット本格ルールをどこまで semantic 化するか、system 別 sub-slice の着手順。
7. **F12 の精査委譲**: `api-client.ts` のセキュリティ観点（TLS 無効化の本番除去・CSRF・ログ除去）を実精読で確定する作業を Claude に委譲するか。
8. **健全性の再検証要否**: 本セッションでは build/test/check:circular を未再実行。コミット前に Codex 主導で再実行するか。

---

## Codex レビュー追記

Claude の報告後、Codex が上位 finding を追加確認した。

- **F1 は確認済み**: `trpg-remix-app/jest.config.cjs` は `roots: ['<rootDir>/src']` だが、`trpg-remix-app/src` は存在しない。`trpg-remix-app/app` 配下の `*.test.ts(x)` / `*.spec.ts(x)` も確認時点では検出されなかった。
- **F2 は live 導線に近い**: `trpg-remix-app/app/routes/character+/index.tsx` が `CharacterCreate` を表示し、`action as _action` を `~/features/character` から export している。`characterCreate.tsx` の `characterId` / `discordUserId` / `discordChannelId` 空文字列送信は、単なる未使用 component ではなく、少なくとも `/character` route の作成 UI に接続されている。
- **検証未実行のまま**: 本レビューでは依然として `pnpm test` / build / typecheck は実行していない。F1/F2 の修正前には frontend の `pnpm test` と `pnpm typecheck` の現状 failure/exit code を別途確認する。
