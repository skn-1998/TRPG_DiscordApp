# Phase 2 操作契約書 — model-domain-invariants 出力

> **分類**: 操作契約（A-2。/route-design-work S-2 成果物。契約型プログラミングの実装仕様）
> **ステータス**: **v3 — R1（必須8件＋中4件）全反映 → R2 確認ラウンド（条件付き）の追記6件を「v3 追補」として反映済み。S-3 進行可**
> **前提**: [phase2-goal-contract.md](phase2-goal-contract.md)・design-v1.md v1.2 §1/§3/§4/§8・design-v1-ui.md §3/§5・Phase 1 実装
> **最終更新**: 2026-07-08

## Domain Contract

Result: Partial（GAP は 2 件まで縮小。S-3 の事前条件〔目的・範囲・目標構造・検証環境〕は充足）
Model purpose: **テンプレート由来キャラクターの「値の正本性」と「投影の一貫性」を、Web と Discord の並行操作下で維持する**（P-1/P-2）
Normal state（**materialized キャラのみに適用**）: `sheet.values`（入力のみ）→ `computedCache` → `palette`／互換投影（同一 materialize の産物）→ `revision` 単調増加、`hub.appliedRevision ≦ hub.pendingRevision ≦ revision`

### キャラクターの3状態（v3・R2 反映）

| 状態 | 判定 | 正本 | 対象操作 | UI |
|---|---|---|---|---|
| **legacy-unpinned** | `sheet` なし・`templatePin` なし | 現行 5 セクション | 旧経路すべて（不変）。OP-4 の対象 | 旧 UI |
| **legacy-pinned** | `sheet` なし・`templatePin` あり | 現行 5 セクション | 旧経路すべて（不変） | 旧 UI |
| **materialized** | `sheet` あり（`sheet.templateId` が pin） | `sheet.values`（三層モデル） | OP-1/2/3/5/6/7/8。**旧書き込み経路は拒否**（C-16） | hub |

- **pin は2種類を区別する**: `templatePin`（legacy 用の軽量 marker。OP-4 が付与）と `sheet.templateId/templateVersion`（materialized の正式 pin。OP-3 が初期化）。状態判定は上表の順で決定的（`sheet` の有無が最優先）。

- backfill（OP-4）は **sheet を作らない**。`templatePin: { templateId, templateVersion, pinnedBy }` という**軽量 marker** を追記するだけ（Normal state の部分 sheet 問題を構造的に回避）。legacy→materialized の変換は Phase 3 の migrate の領分。
- **pin のライフサイクル**（旧 C-3 の分割）: OP-3 が初期化／OP-4 が未設定時のみ確立／確立後は全操作で不変。

### Evidence

| Evidence ID | Source and locator | Rule or example | Authority | Confidence |
|---|---|---|---|---|
| E-1 | design-v1.md §3 | 三層モデル・投影 read-only・materializer 専有 | ユーザー確定 | 高 |
| E-2 | design-v1-ui.md §2「編集と保存」（決着・欠陥5） | **baseRevision＋dirty diff・field＋parts キー単位 auto-merge・真の重複のみ 409** | ユーザー確定 | 高 |
| E-3 | design-v1.md §1（v1.2） | parts 合算・track クランプ・reset 意味論 | ユーザー確定 | 高 |
| E-4 | design-v1.md §4 | palette key registry・soft128/hard512・customId v2 | ユーザー確定 | 高 |
| E-5 | design-v1-ui.md §3・§5(f/g/i/j) | hub 固定＋ephemeral・hubMessageId 永続化・キュー・失敗3分類・**権限喪失は通知** | ユーザー確定 | 高 |
| E-6 | goal 契約 v2 M-2 | backfill 実行契約 | S-1 | 高 |
| E-7 | trpg-domain-character スキル | characterId 不変・projection 明示・update 2系統・DTO/Zod | 規約 | 高 |
| E-8 | Phase 1 実コード（R1 レビューで照合） | evaluator は parts 未対応（非 number→0）・palette は kind:roll のみ・instantiation は 5 セクションのみ create・テンプレ解決は所有者のみ/published 条件なし・templateId unique | 実測 | 高 |
| E-9 | dice-roll-logic.service.ts:46,227 | 履歴保存＝スレッドなら実親チャンネル・createText 1 回 | 実装済み挙動 | 高 |
| E-10 | docker-compose.yml | NestJS は単一インスタンス運用（worker 前提の根拠） | 構成 | 高 |
| E-11 | Codex フルモデルレビュー R1 | 本契約 v1 への必須8件・中4件・軽微 | — | 高 |

### 拒否・失敗の分類法（v2・R1 中4）

- **境界拒否**（供給側入口で検査。呼出し側事前条件にしない）: 未認証・非所有者・DTO/Zod 外形不正・customId パース不能・未知/computed uid の提出
- **ドメイン拒否**（状態に基づく期待された拒否）: 真の値競合・テンプレ未 publish・palette エントリ不在・クランプによる delta 縮退（＝拒否ではなく縮退成功として扱う）
- **冪等成功 / no-op**: 有効 hub が既にある OP-5・対象 0 件の OP-4・同一 interaction の再配送
- **運用失敗**（外部システム・時間起因）: Discord 429／Unknown Message／Missing Access・再試行予算超過
- **契約違反**（バグ。起きてはならない）: computed uid の残存・部分作成・pin 変更・二重 hub・二重加算

### Operations

| Operation ID | Inputs | 呼出し側事前条件 | 供給側保証（成功事後条件） | 期待拒否/no-op | 運用失敗の扱い | 契約違反バグ | 原子性・副作用 |
|---|---|---|---|---|---|---|---|
| OP-1 `saveSheet`（Web 保存） | characterId・`{ baseRevision, changes: [{path, baseValue, newValue}] }`（path は fieldUid＋partsKey 粒度） | materialized キャラであること（供給側も検査） | **値ベース三方向マージ**: 各 change について現在値==baseValue なら適用。全適用後に評価→cache/palette/投影/`hub.pendingRevision` を**同一 doc 更新**で `revision=old+1` 保存。fast-path: baseRevision==現 revision なら比較省略で全適用 | 現在値≠baseValue の change が 1 件でもあれば **409＋conflict payload（path・current・base・yours）**。評価エラー→422・DB 無変更 | — | computed uid 残存・投影/cache 不整合・revision 飛び | Mongo 単一 doc 更新＝原子（hub 反映は pendingRevision 経由の結果整合） |
| OP-2 `applyResourceDelta`（Discord ±） | channelId・paletteKey・delta・interaction（id・押下者） | —（検査はすべて供給側） | **ack 先行**（3 秒制約は成功時時間制約）→ 所有者検証 → `interaction.id` を**冪等キーとして doc 内に記録**し二重適用を防止 → 最新取得→clamp(old+delta) の実効 delta を parts.other へ→OP-1 と同一の保存（CAS）。**CAS 競合は時間予算内（総試行上限 5 回 or 2 秒の早い方）で再取得・再計算** | palette 不在／非所有者→ephemeral 拒否。**同一 interaction 再配送→no-op 成功応答**。clamp で実効 delta=0→「上限/下限です」ephemeral | 予算超過→ephemeral「混み合っています」＋Logger | クランプ無視・parts.other 以外への書込・二重加算 | 値更新は原子。応答→保存の順序逆転による二重加算は冪等キーで遮断 |
| OP-3 `createMaterializedCharacter` | templateId・version・入力 values・JWT | —（検査は供給側） | テンプレ解決＝**(templateId, version 一致, status=published, 所有者)**〔Phase 2 は単一バージョン世界。複数版化は Phase 4 のスキーマ変更として明示除外〕→ 値の**テンプレート整合検査（C-17）**→ rollOnCreate（server 実行）→評価→ **sheet・cache・palette・投影・hub(status:none) を含む 1 回の insert**（`CharacterService.createMaterializedCharacter` 新設・revision=1） | 未 publish／version 不一致→409「publish が必要」／未知 uid・型不整合→422（作成しない） | — | 部分作成（insert 前に全要素を構築することで排除） | insert 1 回＝原子 |
| OP-4 `backfillTemplatePin` | `--execute`/`--rollback` | dry-run 出力の確認（既定 dry-run） | 対象＝`sheet` も `templatePin` も無いキャラのみへ `templatePin{templateId:'legacy-coc', templateVersion, pinnedBy:'backfill-<date>'}` を**追記のみ**。件数・ID 一覧をログ。`--rollback` は **pinnedBy が本スクリプト値の marker のみ** unset | 対象 0 件→正常終了（冪等） | — | sections/values への書込・pin 済み上書き・sheet の生成 | doc ごと原子。冪等で全体を担保 |
| OP-5 `postHub`（スレッド作成時） | thread・materialized キャラ | スレッド作成成功 | **状態機械**: `hub.status: none → publishing(opId) → active(messageId)`。publishing を**先に永続化**→投稿（メッセージに opId marker を埋め込み: embed footer）→active＋messageId 保存。**status が publishing/不明のままなら自動再投稿しない**（reconciliation: opId でスレッド内照合できた場合のみ active 復元。できなければ error とし Web に表示・手動 rebuild は Phase 3） | 既に active→no-op（冪等） | 投稿失敗→status を none へ戻す（副作用未発生が確定している場合のみ）。不確定→**posted-but-untracked** として status:error＋Logger | **二重 hub 投稿**（状態機械と opId 照合で排除） | 非原子窓を状態として明示管理 |
| OP-6 `hubRefresh`（durable） | —（doc 内フィールド駆動） | — | **`hub.pendingRevision` は OP-1/2 の保存と同一 doc 更新で書かれる**（enqueue 消失なし）。単一 worker（E-10 前提を明記）が `pending>applied` の doc を処理: 処理時に最新を再取得して edit→成功で `appliedRevision=処理した revision`。in-memory キューは起床手段のみ。**保証は「最終的に最新 revision へ収束」＋「同一キャラの同時 edit は 1」**（stale edit の瞬間的発生は許容） | — | 失敗3分類: Unknown Message→再投稿＋messageId 更新／**Missing Access→status:error（非リトライ）＋Web キャラページに警告表示（E-5 の通知要件）**／429→retryAt 設定で backoff。分類外→error 扱い（安全側） | 古い revision を applied として記録・無限リトライ | 結果整合が仕様。復旧は periodic sweep（起動時＋定期） |
| OP-7 `executePaletteRoll` | channelId・paletteKey・interaction | — | `roll_` パース→palette から notation 解決→**既存 DiceRollLogic へ委譲**（結果投稿・履歴保存〔実親チャンネル意味論 E-9〕は既存経路のまま）。**handler 側で履歴を追加保存しない**ことが完了条件 | palette 不在→ephemeral（ロール系は参加者全員可） | dice 実行後の履歴保存失敗→既存経路の挙動に従属（結果返信は妨げない） | palette を介さない再評価・二重履歴 | 読み取り＋既存経路の副作用のみ |
| OP-8 `connectCharacterToDiscord` | characterId・guild/channel 選択 | Web 認証済み所有者 | 既存のスレッド作成フロー（creation.completed 経路）に接続し、materialized キャラなら discordChannelId/ThreadId 設定後 **OP-5 を呼ぶ**。legacy キャラは従来どおり（hub なし） | 既接続→no-op or 案内 | OP-5 に従属 | — | 各ステップは既存経路の契約に従属 |
| OP-9 `getCharacterSummaries`（read） | JWT | — | summary に **templateVersion（pin または sheet 由来）と hub.status** を含めて返す（G-7・OP-6 通知の表示面） | — | — | projection 追加漏れ（C-18） | 読み取りのみ |

### Completeness Inventory（v2 訂正）

| Element ID | 種別 | Scope | Evidence | Rationale |
|---|---|---|---|---|
| D-1 sheet(values/revision) ＋ **templatePin（legacy 用 marker）** | data | target | E-1, R1-7 | 2 状態モデル |
| D-2 computedCache／D-3 palette／D-5 互換投影 | data | target | E-1 | — |
| D-4 **hub{status, messageId, threadId, opId, pendingRevision, appliedRevision, retryAt, errorCode}** | data | target | E-5, R1-5/6 | 状態機械＋durable queue |
| D-6 **処理済み interaction id（冪等キー・doc 内 ring または TTL）** | data | target | R1-3 | 二重加算防止 |
| L-1 engine 評価 | logic | **target（Phase 2 拡張必須）**: parts 合算の値解決・resource palette 生成（kind:'resource'）・クランプ・template-aware value Zod。〔v1 の「実装済み」は誤り＝R1-2〕 | E-3, E-8 | Phase 1 は number 直値のみ |
| L-2 sheet-projection（hub ViewModel） | logic | target | E-5 | 新設 |
| L-3 hub worker（単一プロセス前提・sweep） | logic | target | E-10 | — |
| L-4 **旧書き込み経路ガード** | logic | target | R1 中3 | C-16 |
| OP-migrate／reset／secret/GM | operation | excluded | Phase 3／未決／凍結 | — |
| **複数バージョン共存スキーマ**（templateId+version 複合キー） | data | **excluded（Phase 4）** | R1-6 | Phase 2 は単一バージョン世界と明示 |

### Conditions（v2）

| Condition ID | Op | 種別 | Condition | 執行責任 |
|---|---|---|---|---|
| C-1 | 1,2,3 | Invariant（保存境界） | values に computed uid なし | **C-17 の拒否**＋materializer |
| C-2 | 1,2,3 | Invariant（保存境界） | cache・palette・投影・pendingRevision は同一 doc 更新の産物 | materializer＋repository（1 update） |
| C-3a | 1,2,5,6,7 | Invariant | characterId・確立済み pin を変更しない | repository 更新条件 |
| C-3b | 3／4 | Post | OP-3 は pin を初期化／OP-4 は未設定時のみ確立 | 各実装 |
| C-4 | 1 | Post | 三方向マージ: current==base→適用・不一致→409＋payload | service |
| C-5 | 1,2 | Post | 保存成功で revision=old+1 | repository（$inc＋CAS） |
| C-6 | 2 | Post | 実効 delta＝clamp(old+delta)−old を parts.other へ | materializer |
| C-7 | 1,2,3 | Invariant（保存境界） | 同一 fieldRef の palette key 不変 | key registry |
| C-8 | 4 | Pre/Post | 対象＝pin/sheet 双方未設定のみ・追記のみ・冪等・rollback は marker 限定 | スクリプト＋更新条件 |
| C-9 | 5 | Invariant | hub は none/publishing/active/error の状態機械に従い、publishing 永続化→投稿→active の順。自動再投稿なし | hub サービス |
| C-10 | 6 | Post | 収束保証: 最終 applied==最新 revision（stale の瞬間発生は許容・記録は最新のみ） | worker |
| C-11 | 6 | Failure | 3 分類＋分類外は error。error は Web 表示（OP-9） | worker |
| C-12 | 2,7 | Pre（境界） | customId は契約モジュールのパーサのみで解釈 | custom-id モジュール |
| C-13 | 2 | Pre（境界） | 変異系＝所有者のみ・ロール系＝全員可 | handler |
| C-14 | 1,3 | Failure | 評価エラー時 DB 無変更・フィールド単位エラー | service |
| C-15 | 3 | Post | 全 materialized 要素を 1 insert（部分作成なし） | `createMaterializedCharacter` |
| C-16 | — | Invariant | **旧書き込み経路（characterEdit modal・旧 applyDiscordDelta 系）は materialized キャラを検出したら拒否**（ephemeral 案内）。legacy キャラは従来どおり → GAP-2 は状態分離＋本ガードで解消 | 旧経路入口に検査追加 |
| C-17 | 1,3 | Pre（境界） | 提出キーは pin テンプレートの入力可能 field uid に限定・型/parts 構造が定義と一致・未知/computed uid は 422 | **template-aware Zod**（engine 生成） |
| C-18 | 9 | Post | summary の projection に templateVersion・hub.status を含む（全 `.select` と exact spec を S-3 変更対象に列挙） | repository |
| C-19 | 2 | Post | 同一 interaction.id の再実行は no-op（冪等） | 冪等キー記録 |

### One-condition Tests（v2・R1-9 反映）

| Test ID | Condition | 内容 | Level |
|---|---|---|---|
| T-1 | C-1/C-17 | computed uid 提出→422／未知 uid→422 | unit |
| T-2a | C-4 | 非重複（Web: HP.base × 先行 Discord: HP.parts.other）→ **auto-merge 成功・rev+2** | unit（barrier: 保存順を固定） |
| T-2b | C-4 | 真の重複（同一 path・base 不一致）→409＋payload 内容 | unit |
| T-2c | C-4 | 順序逆転（Web 先行→Discord 後行）でも両変更が最終状態に反映 | unit |
| T-3 | C-5 | CAS 条件付き $inc の repository spec | repository |
| T-4 | C-6 | クランプ縮退（実効 delta のみ）・delta=0 応答 | unit |
| T-5 | C-7 | 再 materialize で既存 key 不変 | unit |
| T-6 | C-8 | 冪等 2 回目 0 件・rollback は marker 限定・pin 済み不変 | integration |
| T-7 | C-9 | publishing 永続化→投稿失敗（副作用未発生確定）→none 復帰／不確定→error・**自動再投稿なし** | unit |
| T-8 | C-10 | edit を deferred promise で停止中に保存 2 回→再開後 **edit 総数が同時 1 を超えず最終 applied==最新** | unit（deferred＋fake timer） |
| T-9a | C-11 | Unknown Message→再投稿＋id 更新 | unit |
| T-9b | C-11 | Missing Access→非リトライ・status:error | unit |
| T-9c | C-11 | 429→retryAt 設定・上限内再試行 | unit |
| T-10 | C-13 | 非所有者 ±→拒否／非所有者 roll→成功 | unit |
| T-11 | C-14 | 評価エラー→422・DB 無変更 | unit |
| T-12 | C-15 | insert 引数に全要素／評価失敗→insert 0 回 | unit |
| T-13 | C-2 | cache と palette 値の一致 | unit |
| T-14 | C-3a/C-3b | 保存系で pin 変更が拒否される／OP-4 の確立条件 | repository/unit |
| T-15 | C-12 | 不正 customId がパーサで弾かれ handler 本体に到達しない | unit |
| T-16 | C-16 | materialized キャラへの旧 modal/±→拒否・legacy キャラ→従来どおり | unit |
| T-17 | C-19 | 同一 interaction.id 二重配送→加算 1 回・応答 2 回とも成功 | unit |

### Gaps and Questions（v2 で縮小）

| Issue ID | Related | 内容 | Authority | 方法 |
|---|---|---|---|---|
| GAP-A | OP-6 | 単一 worker 前提（E-10）は現行 compose 構成に依存。スケールアウト時は分散 lease が必要（Phase 2 では前提として明記のみ） | 構成事実 | 契約に前提を明記済み・変更時に再設計 |
| GAP-B | OP-5 | posted-but-untracked からの自動 reconciliation（opId 照合）の実装コスト次第では「error→Phase 3 手動 rebuild」へ縮退可 | S-3 実装判断 | スライス設計で決定（縮退可と明記） |

## v3 追補（R2 確認ラウンドの追記6件。該当 OP/Condition の記述を上書き・追加する）

### 追補1: 三方向マージ決定表（OP-1 を上書き。C-20）

change ごとに次の順で最初に該当する規則を適用する:

| # | 判定 | 動作 |
|---|---|---|
| 1 | `newValue == baseValue` | **ignore**（クライアントの no-change 送信） |
| 2 | `currentValue == baseValue` | **apply** |
| 3 | `currentValue == newValue` | **converged no-op**（同値収束。競合にしない） |
| 4 | それ以外 | **真の競合 → 409**＋payload |

- 比較は正規化後の値等価（parts は key ごと・欠損 key は 0 とみなさず「欠損」として区別）。
- 保存は revision CAS。**CAS 失敗時は最新を再取得して決定表から再実行**（総試行 5 回 or 2 秒。予算超過は 409 と同形の再取得案内）。

### 追補2: OP-2 冪等の原子化と保持期間（C-21）

- `interaction.id` の記録は **delta 適用と同一の doc 更新**に含める（`appliedInteractionIds` リング・**保持は直近 20 件**。それより古い再配送は Discord 側の再配送特性上発生しないため期限切れ扱いで no-op 応答）。
- 「記録済み id」を検出したら値を変更せず成功応答（no-op）。

### 追補3: hub フィールドの状態別契約と CAS 遷移（OP-5/OP-6 を上書き。C-24）

```
hub: {
  status: 'none' | 'publishing' | 'active' | 'error',
  opId?, messageId?, threadId?,
  pendingRevision?, appliedRevision?, retryAt?, errorCode?
}
```

- 遷移はすべて **CAS**（条件付き更新）: `none→publishing` は「status=none の場合のみ」成立（同時実行の二重投稿を排除）。`publishing→active` は opId 一致条件付き。
- **worker 適格条件**: `status='active' AND pendingRevision > appliedRevision` のみ編集対象。
- **OP-5 は投稿時点の materialized revision を `appliedRevision` に記録**する（投稿直後の不要 refresh を防ぎ、投稿中に入った新保存は pending が上回ることで後続 refresh に収束）。
- 収束保証は**条件付き**: 「status=active である限り、最終的に applied==最新 revision」。error/publishing 中は保証対象外（error は Web 表示で人間へ）。

### 追補4: repository 操作の三分割（C-23）

| 操作群 | 対象状態 | 書ける範囲 |
|---|---|---|
| materialized-write（`createMaterializedCharacter` / `saveSheetMaterialized`） | materialized | sheet・cache・palette・投影・hub.pending（**単一 doc 更新**） |
| legacy-write（既存 update 系） | legacy-* のみ（**materialized には C-16 で拒否**） | 現行 5 セクション等（従来どおり） |
| metadata-write（`setTemplatePin` / `setHubState`） | 状態別に限定 | templatePin（legacy-unpinned のみ）／hub フィールドのみ |

### 追補5: 投影の正準形保存境界（C-25/C-26。AI.character.md「AttributeValue正準形の契約（2026-07-12）」と接続）

- materialize 後・永続化前に **5 投影すべてへ `isAttributeSection`（core/types/attribute.types.ts）を適用**。失敗時は insert/update 0 回（C-14 と同形）。
- **parts 全保持**: parts を持つ値は `{base, buff, temp, other, ...}` を `AttributeValue.values` にそのまま保持（`{base: 合算}` へ畳まない）。computed number は `{values:{base: 値}}`、dice 結果は `dice: string`。
- `display` は応答専用であり**永続投影に含めない**。非有限値・未知キーは永続化前に拒否。
- **publish 時検査の追加**: 同一投影セクション内の field id／canonical path の重複を publish で拒否（現行の uid 重複検査だけでは投影キーの無言上書きを防げない）→ domain validator への追加（S-3 変更対象）。

### 追補6: 追加条件と追加テスト

| Condition ID | Op | 種別 | Condition |
|---|---|---|---|
| C-20 | 1 | Post | 追補1 の決定表どおりに change を処理する |
| C-21 | 2 | Post | interaction.id 記録と delta 適用が同一 doc 更新・保持 20 件・既録 id は no-op |
| C-22 | 全 | Pre | 3 状態判定は「sheet の有無→templatePin の有無」の順で決定的 |
| C-23 | — | Invariant | repository 操作は追補4 の三分割に従い、群を跨ぐ書き込みをしない |
| C-24 | 5,6 | Invariant | hub 遷移は CAS・worker 適格条件・OP-5 の appliedRevision 記録に従う |
| C-25 | 1,2,3 | Invariant（保存境界） | 5 投影が isAttributeSection を満たし・parts 全保持・display 非永続・非有限拒否 |
| C-26 | publish | Pre | 投影セクション内 field id/canonical path 重複を publish で拒否 |

| Test ID | Condition | 内容 |
|---|---|---|
| T-18 | C-20 | 決定表 4 規則それぞれ（同値収束 no-op を含む）＋CAS 失敗→再マージ成功 |
| T-19 | C-21 | 同一 doc 更新に id と delta が含まれる（update 引数 assert）・21 件目で最古が押し出される |
| T-20 | C-22 | 3 状態それぞれの判定・sheet と templatePin 両方あるキャラは materialized 扱い |
| T-21 | C-24 | none→publishing の CAS 競合で片方のみ成立・publishing 中の worker 非適格 |
| T-22 | C-25 | parts が全 key 保持で永続される・display 不在・NaN 拒否・未知キー拒否 |
| T-23 | C-26 | 投影キー重複テンプレートの publish 拒否 |
| T-24 | C-24 | OP-5 投稿時 applied=投稿 revision・投稿中の新保存が後続 refresh で収束 |

### レビューループ記録

- **R1（2026-07-08・Codex フルモデル）**: 判定「修正後可」・必須8件＋中4件。全反映:
  (1) OP-1 を値ベース三方向マージ（baseValue 提出・parts キー粒度・真の重複のみ 409）へ — E-2 との矛盾解消
  (2) OP-2 に parts 合算/resource palette/クランプ/template-aware Zod を **Phase 2 必須対象**として棚卸し訂正（L-1）、ack 先行・interaction.id 冪等キー・時間予算付き再試行
  (3) OP-3 を `createMaterializedCharacter`（全要素 1 insert）へ・テンプレ解決 (templateId, version, published) と単一バージョン世界の明示
  (4) OP-4 を templatePin marker 方式へ（部分 sheet の排除・rollback marker）
  (5) OP-5 を状態機械（none/publishing/active/error・opId marker・自動再投稿禁止）へ
  (6) OP-6 を durable（pending/applied を保存と同一 doc 更新）＋単一 worker 前提＋収束保証へ弱め・権限喪失の Web 通知
  (7) pin ライフサイクル分割（C-3a/b）・2 状態モデル導入
  (8) C-17（template-aware 入力検査）新設・C-16（旧経路ガード）新設で GAP-2 解消・OP-8/OP-9 追加・テスト分解（T-2a-c/T-8/T-9a-c 等）・拒否分類法の導入
  軽微: 再試行の定義明確化（総試行 5 回 or 2 秒）・locator 修正・OP-7 失敗の分離。
- スパークでの先行 R0 は CLI 更新に伴い中断（記録のみ）。
- **R2（2026-07-12・Codex フルモデル・確認ラウンド）**: 判定「条件付き不可 → 追記6件で S-3 進行可」。
  追記6件を **v3 追補**として反映: (1) 三方向マージ決定表（同値収束 no-op・CAS 再試行） (2) interaction id＋delta の原子化と保持期間 (3) legacy-unpinned を含む 3 状態判定と 2 種 pin の区別 (4) repository 操作の三分割 (5) hub の状態別フィールド・CAS 遷移・worker 適格条件・条件付き収束保証 (6) `isAttributeSection` による投影保存境界＋parts 全保持＋publish 時の投影キー重複拒否。
  加えて「AttributeValue 正準形の契約（AI.character.md 2026-07-12）」との整合条件を C-25 として接続。
