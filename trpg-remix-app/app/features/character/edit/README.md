# Character Edit Feature

TRPGキャラクターシート作成・編集機能のメインフォルダです。

## 構成

```
edit/
├── coc/                      # Call of Cthulhu (COC) 専用コンポーネント
│   ├── components/
│   │   ├── template/         # テンプレート選択
│   │   ├── description/      # 基本情報入力
│   │   ├── skill/           # スキル編集
│   │   ├── status/          # 能力値・ステータス
│   │   └── index.tsx        # コンポーネントexport
│   ├── types/               # COC専用型定義
│   └── index.tsx            # メインエディタコンポーネント
└── index.ts                 # フィーチャーexport
```

## 実装済み機能

### COC キャラクターシート作成

- **テンプレート選択**: 探索者、学者、運動家、神秘主義者の4つのテンプレート
- **基本情報入力**: 名前、年齢、性別、職業、出身地、住所、外見、背景設定
- **能力値管理**: 8つの基本能力値（STR, CON, POW, DEX, APP, SIZ, INT, EDU）
- **副次能力値自動計算**: HP, MP, SAN, アイデア, 幸運, 知識, ダメージボーナス
- **スキル管理**: 6カテゴリ（戦闘、対人、知識、身体、精神、サバイバル）に分類された全スキル
- **ステップ式UI**: 4段階のウィザード形式で入力をガイド
- **バリデーション**: 必須項目チェックと値の範囲チェック
- **通知機能**: 保存時やエラー時の通知表示

### デザイン

- **Mantine UI**: プロジェクトのtheme.tsに沿ったカラーリング
- **レスポンシブ対応**: デスクトップ・タブレット・スマートフォン対応
- **アクセシビリティ**: キーボードナビゲーション、スクリーンリーダー対応

## 使用方法

### 基本的な使用

```tsx
import { COCCharacterEdit } from '~/features/character/edit'

;<COCCharacterEdit onSave={(data) => console.log('保存:', data)} onCancel={() => console.log('キャンセル')} />
```

### 編集モード

```tsx
<COCCharacterEdit initialData={existingCharacter} onSave={handleSave} onCancel={handleCancel} />
```

## ルーティング

- `/character/coc/edit` - COCキャラクター作成ページ
- `/character` - キャラクター一覧ページ（作成ボタンあり）

## 今後の拡張予定

- [ ] 他のTRPGシステム対応（D&D 5e、ソードワールド2.5等）
- [ ] キャラクターシートPDF出力
- [ ] 画像アップロード機能
- [ ] ダイスロール機能統合
- [ ] キャラクター共有機能
