# AI.features.md — Discord features（機能モジュール）索引

**最終更新: 2026-06-05**

> このファイルはかつて空だったため、内容の二重管理を避け **正本への索引** として整備した。
> feature（`src/discord/features/` 配下の機能モジュール）の構成・customId 契約・handler 登録の詳細は、
> 各正本を参照すること。

## 正本ポインタ

- **機能棚卸し（現状スナップショット・実コード根拠）**: [docs/reviews/feature-inventory-2026-06-05.md](./docs/reviews/feature-inventory-2026-06-05.md) — feature を含む全機能の現状・実装待ち・未配線・ドキュメントずれは本棚卸しを参照（本ファイルは索引に留める）
- **設計・customId 契約・Phase 計画**: [src/discord/DESIGN.md](./src/discord/DESIGN.md)
- **feature 一覧と各サービス構成**: [src/discord/features/README.md](./src/discord/features/README.md)
- **Interactions レイヤー（Registry / handler 作法）**: [src/discord/interactions/README.md](./src/discord/interactions/README.md) ／ [MIGRATION_GUIDE.md](./src/discord/interactions/MIGRATION_GUIDE.md)
- **Discord 層の現状メモ**: [src/discord/AI.discord.md](./src/discord/AI.discord.md)
- **リファクタ進捗の正本**: [AI.refactor.md](./AI.refactor.md)

## 現状の feature（`src/discord/features/`）

| feature            | 概要                                                                                                                                                                                                                                                           | 個別 README                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `diceRoll/`        | ダイスロール（adapters / services / utils / handlers / custom-id）。※「Phase 1 未着手・InteractionsModule が直接 provide」は陳腐化＝現状は feature module 化済み（handler 8 を registry 登録）。詳細は[棚卸し](./docs/reviews/feature-inventory-2026-06-05.md) | [README](./src/discord/features/README.md)               |
| `characterEdit/`   | キャラクター編集（`EnhancedCharacterEditService` 中心 + services / utils / events）                                                                                                                                                                            | [README](./src/discord/features/characterEdit/README.md) |
| `characterThread/` | キャラクター専用スレッド/チャンネル（orchestrator + manager 群 + utils）                                                                                                                                                                                       | [README](./src/discord/features/README.md)               |
| `gameSystem/`      | ゲームシステム選択（`SelectGameSystemOrchestrator` 中心）。registry 登録なし。slash command 経路が主と推測されるため、実 routing は棚卸しの未確認欄を参照                                                                                                      | [README](./src/discord/features/README.md)               |
| `userDefinedDice/` | ユーザー定義ダイス表（`UserDefinedDiceOrchestrator` 中心）。registry 登録なし。slash command 経路が主と推測されるため、実 routing は棚卸しの未確認欄を参照                                                                                                     | [README](./src/discord/features/README.md)               |

## 設計原則（[DESIGN.md](./src/discord/DESIGN.md) より要約）

- `InteractionsModule` は feature module を import しない。feature 側が Registry に handler を明示登録する。
- customId は Factory / Parser / Handler パターンに集約（文字列直書きを避ける）。
- 依存方向は `features → domains → core → shared`。`@Global` / `forwardRef` は原則禁止。循環依存はゼロ。
