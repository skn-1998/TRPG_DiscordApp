# Character Template Feature

`trpg-remix-app/app/features/characterTemplate` を触るときに読む。詳細の正本は同ディレクトリの `AI.feature.md`、`AI.types.md`、`AI.ui.md`、`AI.api.md`、`AI.security.md`。

## Scope

- MVP はフロントエンドのみ。localStorage と mock routes で動かす。
- 将来 TRPG-SERVER 統合できるよう、API/権限/監査/公開ギャラリー設計を docs に残す。
- ルートは `/mock/template-editor` と `/mock/template-gallery` を維持する。

## DSL

- `schemaVersion` は現在 `2`。
- タブは `basic`, `status`, `parameter`, `skill`。
- field type は `text`, `textarea`, `number`, `select`, `checkbox`, `computed`, `roll`。
- field id は一意で、英数字と underscore を基本にする。
- layout はタブごとの 12 カラムグリッド。

## Formula And Dice

- computed は `{fieldId}` 参照、`+ - * /`、`max/min/floor/ceil/round` を扱う。
- roll は `[NdM]`, `[NdM+K]`, `[NdM-K]` を扱う。
- 式とダイスロールは分離する。

```ts
// Avoid
computed: "{pow} * 5 + [1d6]"

// Prefer
roll: "rollBonus" -> "[1d6]"
computed: "san" -> "{pow} * 5 + {rollBonus}"
```

## Validation

- 重複 field id を検出する。
- computed の未定義参照と循環参照を依存グラフで検出する。
- formula と diceFormula の構文を検証する。
- 必須、min/max、select options、タブ未割当もチェックする。

## UI

- Editor と Preview を中心に組む。
- Desktop は editor/preview の 2 カラム、tablet は上下、mobile はタブ切替または単カラムを基本にする。
- Mantine の `Tabs`, `TextInput`, `NumberInput`, `Textarea`, `Select`, `Checkbox`, `Button`, `Grid`, `Card/Paper`, `Alert`, `Notification` を優先する。
- エラーは具体的なメッセージにする。例: `IDが重複しています: pow`。

## Security

- formula evaluation で `eval` を使わない。
- 許可された演算子/関数だけを評価する。
- `label`, `description`, `options.label` などユーザー入力由来の表示は HTML として展開しない。
- localStorage には機密情報を保存しない。
- MVP の dice random は `Math.random()`。サーバー統合時は `crypto.randomInt()` を検討する。

## Future Server Integration

- CRUD: `POST/PUT/GET/DELETE /templates`
- Gallery: `GET /templates`, `GET /gallery/templates`
- Publish/version: `/templates/:id/publish`, `/templates/:id/versions`
- Validation: `POST /templates/validate`
- 権限は owner/admin、公開テンプレート閲覧、draft 非公開を前提にする。
