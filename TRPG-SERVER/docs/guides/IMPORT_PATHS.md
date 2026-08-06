# 絶対パスインポート設定ガイド

（最終確認: 2026-06-03。パスエイリアス方式は現役）

このプロジェクトでは、TypeScriptとJestで絶対パスインポートが使用できるように設定されています。

## 利用可能なインポート方法

### 1. srcからの絶対パス（推奨）

```typescript
// 相対パスの代わりに
import { CharacterService } from '../../../domains/character/character.service'

// 絶対パスを使用
import { CharacterService } from 'domains/character/character.service'
```

### 2. エイリアス（オプション）

```typescript
// @エイリアス
import { CharacterService } from '@domains/character/character.service'
import { DiscordService } from '@discord/discord.service'
import { SharedModule } from '@shared/shared.module'

// ドメイン別エイリアス
import { Character } from 'domains/character/models/character.model'
import { DiscordUIService } from 'discord/services/discord-ui.service'
import { EventBusService } from 'events/bus/event-bus.service'
```

## 設定ファイル

### tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "*": ["./*"],
      "src/*": ["./*"],
      "@/*": ["./*"],
      "@domains/*": ["./domains/*"],
      "@discord/*": ["./discord/*"],
      "@events/*": ["./events/*"],
      "@shared/*": ["./shared/*"],
      "domains/*": ["./domains/*"],
      "discord/*": ["./discord/*"],
      "events/*": ["./events/*"],
      "shared/*": ["./shared/*"]
    }
  }
}
```

### jest.config.js

```javascript
module.exports = {
  moduleNameMapper: {
    // エイリアス
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@domains/(.*)$': '<rootDir>/src/domains/$1',
    '^@discord/(.*)$': '<rootDir>/src/discord/$1',

    // 絶対パス
    '^domains/(.*)$': '<rootDir>/src/domains/$1',
    '^discord/(.*)$': '<rootDir>/src/discord/$1',
    '^events/(.*)$': '<rootDir>/src/events/$1',
    '^shared/(.*)$': '<rootDir>/src/shared/$1',

    // src/からの絶対パス
    '^src/(.*)$': '<rootDir>/src/$1'
  }
}
```

## 使用例

### Before (相対パス)

```typescript
import { DiscordClientService } from '../../services/discord-client.service'
import { Character } from '../../../../../domains/character/models/character.model'
```

### After (絶対パス)

```typescript
import { DiscordClientService } from 'discord/services/discord-client.service'
import { Character } from 'domains/character/models/character.model'
```

## 利点

1. **可読性**: インポートパスが明確で理解しやすい
2. **保守性**: ファイル移動時にインポートを変更する必要が少ない
3. **一貫性**: プロジェクト全体で統一されたインポート方法
4. **開発効率**: IDEの補完機能が向上

## 注意事項

- ビルド、開発、テスト環境すべてで動作確認済み
- 既存の相対パスインポートも引き続き動作します
- 新しいファイルでは絶対パスの使用を推奨
