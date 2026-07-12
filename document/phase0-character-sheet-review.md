# Phase 0（キャラクター作成基盤）再レビュー — /route-design-work 実行記録

> **対象**: [document/phase0-character-sheet.md](phase0-character-sheet.md)（2026-05-30 設計）とその実装状況
> **ステータス**: **v2 — Codex 検証 R1（必須6件・重大6件）を全反映。順位確定はユーザー承認待ち**
> **モード**: Route and orchestrate（S-1 `frame-purpose-goal-means` → S-2 `prioritize-design-debt`）
> **最終更新**: 2026-07-12

## 最重要発見（R1 で確定）

**Web からのキャラクター作成は現在機能していない。**
フロントは `characterId: ''` を送信（characterCreate.tsx:57）→ HTTP controller は optional の `CharacterInputDto` を受理（character.controller.ts:84）→ しかし `CharacterService.create()` が ID 未指定を明示拒否（character.service.ts:85）。
サーバー発行 fallback（`characterId || generateUniqueCharacterId`）は **Discord/event 系の `CharacterCreationCoreService`（:111）にしか存在しない**。
＝ Phase 0 の中核 DoD「Web 作成成功」は未達のまま、経路自体が障害状態。

## Design Route（要約）

| Order | Skill | Single purpose | 結果 |
|---|---|---|---|
| 調査 | —（実測＋R1 で経路再検証） | DoD 各項目の実装状況を呼び出し経路単位で確定 | 完了 |
| S-1 | frame-purpose-goal-means | Phase 0 の目的・目標・手段の現時点有効性（達成/未達/置換）判定 | Partial |
| S-2 | prioritize-design-debt | 残項目の処置順（提案） | Partial（**確定順位はユーザー承認待ち**） |

---

## S-1: Framing 再検証（v2）

### Evidence Ledger（実測 2026-07-12・R1 で経路検証済み）

| ID | Locator | 内容 | 状態 |
|---|---|---|---|
| E-1 | app/routes/character+/（create.tsx 不在） | P0-1 未達 | Verified |
| E-2 | characterCreate.tsx:10,43,66／routes/character+/index.tsx:5 | action は route から re-export されるが **UI は `<Form>` を使わずクライアント直 API**。API 自体は JwtAuthGuard 保護＝損失は「認証欠如」ではなく「**Remix action 境界・SSR context・入力/エラー処理統一の迂回**」 | Verified |
| E-3 | routes/character+/index.tsx:10,59,104 ＋ ホームからの導線残存 | mock 一覧が本物のように表示される | Verified |
| E-4 | create-character.dto.ts:39,84／update-character.dto.ts:7 | **characterId 必須の `CreateCharacterDto` は create 境界では未使用**（主用途は `UpdateCharacterDto extends PartialType(...)`）。create 実経路は optional の `CharacterInputDto` | Verified（v1 の誤認を修正） |
| E-5 | character.service.ts:85／character-creation-core.service.ts:111 | **HTTP create は ID 未指定を拒否・fallback は CreationCore（Discord/event）経路のみ** | Verified |
| E-6 | trpg-remix-app/jest.config:2 | P0-7 達成 | Verified |
| E-7 | character.model.ts:59／character.entity.ts:76（作業ツリー・PH-2 進行分含む） | **トップレベル templateId は不採用が正**。現行は nested の `sheet`/`templatePin`/`computedCache`/`palette`/`hub`（v1.2/Phase 2 設計へ置換済み） | Verified |
| E-8 | design-v1.md v1.2・phase2-operation-contracts.md v3・phase2-implementation-plan.md | 置換先の確定設計。**PH-5 は saveSheet/summary/バッジ/最小編集が対象で、作成ウィザード・OP-3 API 接続は未計画** | Verified |
| E-9 | _user.user.character.tsx:98／characterList.tsx:52 | legacy `CharacterCreate` は **/user/character の作成モーダルでも使用中**（/character 専用ではない） | Verified |

### Goal 再判定

| 旧 Goal（DoD） | 判定 | 根拠 |
|---|---|---|
| P0-7 jest roots | **Closed（達成）** | E-6 |
| P0-4 characterId サーバー生成 | **未達（経路別）**: HTTP=欠落（**機能障害**・D-1a）／Discord・event=達成（CreationCore fallback）／materialized=OP-3 が別途契約済み | E-5 |
| P0-1 /character/create | **条件付き Accept（作らない）提案**: ただし「/templates→OP-3 が導線になる」は現状**未実装**（OP-3 の production caller なし・PH-5 スコープ外）。**代替 Goal（テンプレ選択→作成ウィザード→OP-3 API 接続）を新規に確保することを Accept の条件とする** | E-8 |
| P0-2/3/6 action 分離・直 API 廃止 | 未達・有効（D-1b。ただし方式は Needs discovery） | E-2, E-9 |
| P0-5 mock 一覧撤去 | 未達・有効（D-2。解決方式は U-2 依存） | E-3 |
| P0-8 install/typecheck 前提 | Closed（現環境で typecheck 緑を随時確認済み） | 本会話ゲート |
| §3.4/§4.4 テスト項目・§3.5/§4.5 DoD | **未達多数**（Web 作成成功系 DoD は障害により失敗状態）。個別は下記「判定漏れ台帳」 | E-1〜5 |

### Phase 0b の項目別判定（「全部禁止」を撤回し3分類・R1 反映）

| 0b 項目 | 判定 |
|---|---|
| 固定5セクションの `CharacterSheetTemplate` 型（§4.1.3） | **Replaced**（schema v3。実施禁止） |
| モデル直下の `templateId/templateVersion`（§3.2.2） | **Replaced**（nested `sheet`/`templatePin`。実施禁止） |
| `description` を式保存先にする案（§7-3） | **Replaced**（v1.2 §2.1 notation 文法＋computed。実施禁止） |
| AttributeValue（values/description/dice/isVisible）の意味論 | **Still valid**（互換投影の正準形として現役。2026-07-12 の正準形契約が正本） |
| フロント↔サーバー型整合（§4.1.1 の趣旨） | **Already implemented（別形）**（@trpg/sheet-engine の共有型で達成） |

### 判定漏れ台帳（R1 指摘の補完）

| 旧文書箇所 | 判定 |
|---|---|
| §2 TDD/純関数/意図コメント/JSDoc 規約 | **継続有効（非正本の参考規約）**。実運用は Phase 1/2 の spec 様式・契約書が正本 |
| §4.2 AI 文書更新（front AI.character.md） | 未達（**現在も空**）。処置は D-5 に併合（supersession 注記と同時に最小記載） |
| §5 リスク（Discord ID 必須前提／二重導線／description 二重用） | Discord 経路=解消（CreationCore）／二重導線=**現存（U-2）**／description=Replaced |
| §6 Phase 1 引き継ぎ項目 | 旧文書のいう "Phase 1" は不成立（テンプレ構想へ転換）。**引き継ぎ先は design-v1 系に置換** |
| §7 未決（redirect 先・/character vs /user/character・prefix） | prefix=Replaced／redirect と二重導線=**未決のまま現存（U-2）** |

---

## S-2: Design Debt Priority（v2）

Result: Partial（確定順位・Accept 承認・受容期限はユーザー）

### Debt Comparison

| Debt ID | 内容（現状 vs 理想） | 種別 | 損失 | 解消コスト | 提案判断 |
|---|---|---|---|---|---|
| **D-1a** | **Web 作成経路の ID 採番欠落＝機能障害**（HTTP create が必ず拒否）。理想=HTTP 経路にもサーバー発行（CreationCore と同義の fallback を service へ、または controller で CoreService 経由に統一） | Core・**機能障害** | 高（Web から作成不能） | 小（fallback 1 箇所＋spec） | **Fix now 筆頭**（ただし U-1 で「legacy Web 作成を廃止」を選ぶなら“停止スライス”に転換） |
| D-1b | legacy 作成 UI の action 迂回構造（E-2）と将来のテンプレ導線への置換 | Core | 中（保守性・一貫性） | (a) 分離実装=中／(b) 置換=大（ウィザード＋OP-3 接続の新規 Goal が前提） | **Needs discovery**（実利用状況・U-1 の方針・(a)(b) 別見積が先） |
| D-2 | mock 一覧の残存＋二重導線 | 表示導線（Core 寄り） | 中（偽データ表示） | U-2 の選択次第（実 loader 化 or /user/character へ redirect） | **Fix now 候補（U-2 決定後）**。二重 loader 追加は負債固定になるため単独先行しない |
| D-3 | /character/create 不在 | — | — | — | **条件付き Accept**: 代替 Goal（テンプレ作成ウィザード＋OP-3 接続。Phase 2 完了後の PH-5b/Phase 3 として起票）確保を条件。承認と受容期限はユーザー |
| D-5 | phase0 文書の正本性混乱＋front AI.character.md 空 | docs | 中（0b の Replaced 項目を誤実施するリスク） | 極小 | **Fix now（即日可）**: supersession 注記（項目別 3 分類を転記）＋本レビューへのリンク |

### First Safe Slice（提案・実行はユーザー承認後）

| 順 | Debt | Scope | 完了条件 |
|---|---|---|---|
| 1 | D-5 | 旧文書へ注記追記＋front AI.character.md 最小記載 | docs のみ・リンク整合 |
| 2 | D-1a | HTTP create の ID 採番修復（CreationCore 経由への統一を推奨）＋回帰 spec（ID 省略で 201・ID 指定で従来どおり） | 全 suite＋characterization 緑 |
| 3 | D-2 | U-2 の決定（redirect 推奨: /character→/user/character）→ 実装 | front ゲート緑 |

### Unknowns → **ユーザー決定（2026-07-12）**

| ID | 決定 | 帰結 |
|---|---|---|
| U-1 | **廃止**（legacy Web 作成は修復せず撤去。作成導線は再設計＝テンプレ経由へ） | D-1a は「修復」から**停止スライス**へ転換（CharacterCreate の利用箇所撤去）。D-1b は再設計に吸収され消滅 |
| U-2 | **二重導線を解消**（redirect 可・消せるなら消す） | /character 配下の mock 一覧・埋め込み作成を撤去し、/user/character へ redirect（または route 削除） |
| U-3 | **承認** | 代替 Goal「テンプレ選択→作成→OP-3 接続」を **Phase 2 PH-5b** として起票（implementation-plan に追加済み）。U-1 の撤去と同一スライスで置換として実施 |

上記により First Safe Slice は改訂: ① D-5（docs・実施済み）→ ② **PH-5b**（旧作成 UI 撤去＋/character redirect＋最小テンプレ作成導線＋OP-3 エンドポイント。PH-3 完了が前提）。D-1a 単独の「ID 採番修復」は不要になった（HTTP create は明示 ID 契約のまま残置し、Web からの呼び出し元を撤去）。

## レビューループ記録

- **R1（2026-07-12・Codex フルモデル）**: 判定「修正後可」。重大6・中4・軽微4 → **v2 で全反映**:
  P0-4 を経路別未達へ訂正（**Web 作成障害の発見**）／E-4・E-5 を実呼び出し経路で再構成／E-7 を現行 nested 実装へ更新し 0b を項目別 3 分類（Replaced/Still valid/Already implemented）へ／P0-1 Accept に代替 Goal 条件を付与／D-1 推奨(b)を撤回し Needs discovery＋D-1a（障害修復）と D-1b（構造置換）に分離／判定漏れ台帳（§2/§4.2/§5/§6/§7・P0-8・DoD）を追加／E-2 の損失表現を是正（認証欠如ではなく action 境界の迂回）／Core/Non-core と見積の是正。
