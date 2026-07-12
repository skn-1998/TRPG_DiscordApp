# Phase 2 実施計画 — plan-ai-assisted-refactoring 出力

> **分類**: 実施計画（A-3。/route-design-work S-3 成果物。計画専用 — 実行は E-9 の明示依頼に基づき司令塔が別途進行）
> **ステータス**: Complete（計画として）。実行は PH-0/PH-1 から開始
> **前提**: [phase2-goal-contract.md](phase2-goal-contract.md)（P-*/G-*）・[phase2-operation-contracts.md](phase2-operation-contracts.md)（v3。OP-*/C-*/T-*）
> **最終更新**: 2026-07-12

## AI-assisted Refactoring Plan
Result: Complete
Completion scope: Refactoring plan only（実行開始の権限は E-9「設計実装をしていって」で付与済み）

### Evidence Ledger

| Evidence ID | Source and locator | 内容 | Verification |
|---|---|---|---|
| E-1 | phase2-goal-contract.md v2 | P-0〜P-4・G-1〜G-11・進行仮定 I-1/I-2/I-4 | Verified（S-1 レビュー済み） |
| E-2 | phase2-operation-contracts.md v3 | OP-1〜9・C-1〜26・T-1〜24（R2 で S-3 進行可） | Verified |
| E-3 | Phase 1 実装＋全ゲート緑（未コミット） | 変更基盤。挙動固定の土台 | Verified（本会話） |
| E-4 | AI.character.md「AttributeValue正準形の契約」＋core/types の実行時 guard | 投影保存境界（C-25）の正本 | Verified |
| E-5 | 体制合意（本会話） | 実装/レビュー=Codex・ゲート/LGTM=Claude・コミット/実機受入=ユーザー | Verified |
| E-6 | docker-compose.yml | 単一 NestJS インスタンス（OP-6 worker 前提） | Verified |

### Purpose and Quality Goals

| Purpose ID | 内容 | Quality Goal ID | 受入条件（測定可能） | Authority |
|---|---|---|---|---|
| PUR-1（=P-1） | テンプレ由来キャラの Discord 実働 | QG-1（=G-1/G-4/G-5） | 受入シナリオ行列（実機）＋registry 併存 | ユーザー（実機受入） |
| PUR-2（=P-2） | 既存を壊さない移行 | QG-2（=G-2/G-3/G-8/G-9/G-10） | characterization 緑・全 suite 緑・静的検査 0 件・競合 spec 緑 | ゲート（決定的） |
| PUR-3（=P-3/P-4） | hub 運用と版可視化 | QG-3（=G-5/G-6/G-7/G-11） | hub 状態機械 spec・バッジ表示 | ゲート＋実機 |

### Phases

| Phase ID | 目的 | Owner | 許可範囲（書き込み） | 禁止 | 予定成果物 | 検証（生の証拠） | 停止/切戻し | Readiness |
|---|---|---|---|---|---|---|---|---|
| PH-0 挙動固定 | QG-2 | Codex 実装（テストのみ）→Claude ゲート | TRPG-SERVER の spec 新規のみ | 本体コード変更 | (a) **characterization: 代表 legacy キャラ fixture の materialize 出力 ≡ 現行 5 セクション（golden 比較）** (b) 旧経路スモークの明文化（既存 suite 実行記録） | jest 出力・golden fixture ファイル | テストが現行挙動と不一致→本体変更せず設計へ差し戻し | Ready |
| PH-1 engine 拡張 | OP-1/2 前提（C-17/C-6/C-25 素材） | Codex→Claude | packages/sheet-engine のみ | 他パッケージ | parts 対応の値解決・clamp helper・**template-aware value schema 生成**（未知/computed uid 拒否・型/parts 構造検査） | engine jest（既存 27＋新規）・tsc | 既存 27 の破壊→即修正ループ | Ready |
| PH-2 domain 拡張 | C-2/3/5/18/23/26 | Codex→Claude | domains/character・domains/character-sheet-template（validator/service）・app.module | discord 層・features | Entity/@Schema へ sheet/templatePin/computedCache/palette/hub/appliedInteractionIds・**repository 三分割 API**（CAS $inc）・**全 `.select` 更新＋exact spec**・summary へ templateVersion/hub.status・テンプレ解決 (version, published)・投影キー重複の publish 拒否 | build・circular・repository/service spec・全 suite | 全 suite 赤→修正ループ。projection 漏れは T 系 spec で検出 | Ready |
| PH-3 features 実装 | OP-1/2/3 中核（C-1/4/6/7/14/15/17/19/20/21/25） | Codex→Claude | features/character-sheet | domains の追加変更（PH-2 で完結させる）・discord | materializer v2（正準形投影・parts 全保持・resource palette・clamp）・saveSheet（三方向マージ決定表＋CAS 再試行）・instantiation v2（createMaterializedCharacter）・冪等キー | T-1〜5,11〜13,17〜20,22 相当の spec・全 suite | 同上 | Ready |
| PH-4 backfill | OP-4（C-8/22） | Codex→Claude→**ユーザー（本番実行）** | scripts（TRPG-SERVER 内 standalone）＋package.json scripts | 既存データ書式 | `backfill:template-pin`（dry-run 既定/--execute/--rollback・marker） | T-6 integration・dry-run ログ | dry-run 結果が想定外→実行しない | Ready |
| PH-5 Web 接続 | OP-1 API・OP-9・G-7 | Codex→Claude | TRPG-SERVER controller（character）・trpg-remix-app | エディタ機能追加 | saveSheet エンドポイント（409 payload）・summary 拡張の表示・**キャラページの templateVersion バッジ＋hub.status 警告**・materialized キャラの最小編集画面（既存 TemplateFormRenderer 再利用） | server spec・front typecheck/build/jest | 同上 | Ready |
| PH-5b テンプレ作成導線＋旧作成撤去（**U-1/U-2/U-3 決定により追加**） | OP-3 の production 接続・P0 レビュー D-1a/D-2 の停止スライス | Codex→Claude | TRPG-SERVER controller（from-template エンドポイント）・trpg-remix-app（/templates 作成導線・旧 CharacterCreate 撤去・/character redirect） | Discord コマンド（I-1 境界） | POST /characters/from-template（認可＝テンプレ所有者）＋/templates の「このテンプレートで作成」最小フォーム＋CharacterCreate 利用箇所の撤去＋/character→/user/character redirect | server/front spec・front ゲート・**G-1 受入の作成手段が成立** | 同上 | Ready（PH-3 後） |
| PH-6a Discord 新経路 | OP-2/7・C-12/13/16/19 | Codex→Claude | discord/features（新 handler・custom-id）＋旧経路へのガード挿入点 | commands.list（**I-1 境界**）・旧挙動の変更 | roll_/res_ 契約モジュール＋handler（ack 先行・冪等・所有者）・**C-16 旧書き込み経路ガード** | handler spec・registry 登録数 spec 更新・全 suite | 旧経路 spec 破壊→即停止 | Ready |
| PH-6b hub | OP-5/6/8（C-9/10/11/24） | Codex→Claude | packages/sheet-projection（新設）・discord/features・features/character-sheet（hub 状態 API 呼び出し） | — | sheet-projection（行分割/embed/警告の純関数＋golden fixture）・hub 投稿（CAS 状態機械）・durable worker・OP-8 接続 | T-7/8/9a-c/21/24 相当・projection golden・全 suite・start:dev | 同上 | Ready |
| PH-7 受入 | QG-1/3 の実機 | Claude（準備）→**ユーザー（受入）** | ドキュメントのみ | — | 実機チェックリスト（G-1/G-5 行列）＋起動・登録ログ＋LGTM 報告 | 実機結果（ユーザー） | 実機 NG→該当 PH へ切戻し | Not ready（D-3 待ち） |

**依存**: PH-0‖PH-1 → PH-2 → PH-3 → {PH-4‖PH-5‖PH-6a} → PH-6b → PH-7。
**切戻し**: 全変更は未コミット作業ツリー上。各 PH の変更ファイル一覧を実行記録に残し、PH 単位で checkout 可能にする。

### Planned Evidence Gates（抜粋）

| Claim ID | Phase | 実行後に検証する主張 | 生の証拠 | 受入規則 |
|---|---|---|---|---|
| CL-1 | PH-0 | legacy 挙動が固定された | golden fixture＋jest 緑 | 完全一致（正規化なし） |
| CL-2 | PH-3 | 三方向マージが決定表どおり | T-18 系 spec | 4 規則＋CAS 再試行の各ケース緑 |
| CL-3 | PH-6a | 旧経路無傷 | 全 suite＋handlers.integration の registry 数 | 旧契約 handler 数不変＋新規追加分のみ増 |
| CL-4 | PH-6b | 二重 hub 投稿なし | T-21 CAS spec | 同時実行で 1 件のみ成立 |
| CL-5 | 各 PH | 静的検査 0 件（M-7） | rg 出力 | domains に discord.js/イベントRPC/forwardRef ゼロ |

### Human Decisions

| Decision ID | Phase | 内容 | Authority | Status |
|---|---|---|---|---|
| D-1 | 着手前（推奨） | **Phase 1 成果のコミット** | ユーザー | **Approved（2026-07-12）→ 実行済み（4 分割: engine／workspace／実装本体／設計文書）** |
| D-2 | — | goal 進行仮定 I-1（Discord テンプレ作成は Phase 3）/I-2（hub は新規スレッドのみ）の追認 | ユーザー | **Approved（2026-07-12・推奨案どおり）** |
| D-3 | PH-7 | 実機受入（G-1/G-5 行列） | ユーザー | Pending |

### Risks and Unknowns

| Issue ID | Related | 内容 | Recovery | Execution allowed? |
|---|---|---|---|---|
| I-A | PH-2 | projection 追加漏れ（S-1 教訓）は最頻リスク | exact spec＋T-系で検出。レビュー観点に固定 | Yes |
| I-B | PH-6b | GAP-B: posted-but-untracked の reconciliation 実装コスト | 高コストなら「error→Phase 3 手動 rebuild」へ縮退（契約許容済み） | Yes |
| I-C | 全体 | 未コミット土台（D-1 未決）での多層変更 | PH 毎の変更ファイル記録・LGTM 時にコミット再提案 | Yes |
| I-D | PH-6a | 旧 ± 経路の実在調査（R1 で特定不能）→ C-16 ガード挿入点の確定が先 | PH-6a 冒頭に調査ステップ（read-only）を含める | Yes |
