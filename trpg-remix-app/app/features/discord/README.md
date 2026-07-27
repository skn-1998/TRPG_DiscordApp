# Discord Bot Operations from Remix Client

## 📋 概要

この機能により、RemixクライアントアプリケーションからサーバーのDiscord Botを操作できます。  
WebアプリケーションからDiscordチャンネルへのメッセージ送信、チャンネル作成、Bot状態確認などが可能です。

> **現行実装の注記（2026-07-27）**: 以下の Bot 操作 API と使用例は履歴資料です。現在のフロント実装は、Discord サーバー一覧の取得・選択肢変換・キャラクター投稿だけを公開しています。

## 🔄 アーキテクチャ

```
Remix Client → TRPG-SERVER → Discord Bot → Discord API
```

1. **Remix Client**: WebアプリケーションからのUI操作
2. **TRPG-SERVER**: NestJSサーバー（Discord Bot機能付き）
3. **Discord Bot**: Discord.jsベースのBot
4. **Discord API**: Discord公式API

## 📡 利用可能なAPI

### 1. メッセージ送信

```typescript
import { sendDiscordMessage } from '~/features/discord/api/discord.service'

// 基本的なメッセージ送信
await sendDiscordMessage({
  channelId: '1234567890123456789',
  content: 'Hello from Remix!'
})

// リッチなEmbedメッセージ
await sendDiscordMessage({
  channelId: '1234567890123456789',
  embed: {
    title: '重要なお知らせ',
    description: 'セッションが開始されました',
    color: '#ff0000',
    fields: [
      {
        name: 'GM',
        value: 'Admin User',
        inline: true
      },
      {
        name: '参加者',
        value: '4名',
        inline: true
      }
    ]
  }
})
```

### 2. チャンネル作成

```typescript
import { createDiscordChannel } from '~/features/discord/api/discord.service'

// テキストチャンネル作成
await createDiscordChannel({
  guildId: '1234567890123456789',
  name: 'new-session',
  type: 'text',
  topic: 'TRPG Session #1',
  position: 5
})

// ボイスチャンネル作成
await createDiscordChannel({
  guildId: '1234567890123456789',
  name: 'voice-session',
  type: 'voice',
  parentId: '9876543210987654321' // カテゴリID
})
```

### 3. Bot状態確認

```typescript
import { getDiscordBotStatus } from '~/features/discord/api/discord.service'

const status = await getDiscordBotStatus()
console.log(`Bot Status: ${status.online ? 'Online' : 'Offline'}`)
console.log(`Guilds: ${status.guilds}`)
console.log(`Users: ${status.users}`)
console.log(`Ping: ${status.ping}ms`)
```

### 4. ギルド情報取得

```typescript
import { getDiscordGuildInfo } from '~/features/discord/api/discord.service'

const guild = await getDiscordGuildInfo('1234567890123456789')
console.log(`Guild: ${guild.name}`)
console.log(`Members: ${guild.memberCount}`)
console.log(`Channels: ${guild.channels.length}`)
```

## 🎯 実用的な使用例

### 1. キャラクター情報のDiscord送信

```typescript
import { sendCharacterToDiscord } from '~/features/discord/api/discord.service'

// キャラクター作成完了時にDiscordに通知
const handleCharacterCreated = async (characterId: string) => {
  try {
    const result = await sendCharacterToDiscord(
      characterId,
      '1234567890123456789' // 通知先チャンネルID
    )

    if (result.success) {
      console.log(`Character info sent to Discord: ${result.messageId}`)
    }
  } catch (error) {
    console.error('Failed to send character info:', error)
  }
}
```

### 2. ダイスロール結果の送信

```typescript
import { sendDiceRollToDiscord } from '~/features/discord/api/discord.service'

// ダイスロール実行後にDiscordに結果を送信
const handleDiceRoll = async (channelId: string) => {
  try {
    const result = await sendDiceRollToDiscord(channelId, '2d6+3', {
      total: 11,
      details: '[4, 4] + 3',
      success: true
    })

    if (result.success) {
      console.log(`Dice roll result sent: ${result.messageId}`)
    }
  } catch (error) {
    console.error('Failed to send dice roll:', error)
  }
}
```

### 3. セッション管理用チャンネル自動作成

```typescript
import { createDiscordChannel } from '~/features/discord/api/discord.service'

// 新しいTRPGセッション開始時にチャンネルを自動作成
const createSessionChannels = async (sessionName: string, guildId: string) => {
  try {
    // テキストチャンネル作成
    const textChannel = await createDiscordChannel({
      guildId,
      name: `session-${sessionName}`,
      type: 'text',
      topic: `TRPG Session: ${sessionName}`
    })

    // ボイスチャンネル作成
    const voiceChannel = await createDiscordChannel({
      guildId,
      name: `voice-${sessionName}`,
      type: 'voice'
    })

    return {
      textChannelId: textChannel.channelId,
      voiceChannelId: voiceChannel.channelId
    }
  } catch (error) {
    console.error('Failed to create session channels:', error)
    throw error
  }
}
```

## 🛠️ Remixコンポーネントでの使用例

### Discord操作コンポーネント

```typescript
// app/components/DiscordControls.tsx
import { useState } from 'react'
import { sendDiscordMessage, getDiscordBotStatus } from '~/features/discord/api/discord.service'

export function DiscordControls() {
  const [message, setMessage] = useState('')
  const [channelId, setChannelId] = useState('')
  const [botStatus, setBotStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleSendMessage = async () => {
    if (!message || !channelId) return

    setLoading(true)
    try {
      const result = await sendDiscordMessage({
        channelId,
        content: message
      })

      if (result.success) {
        alert('メッセージが送信されました！')
        setMessage('')
      } else {
        alert('メッセージ送信に失敗しました')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckStatus = async () => {
    try {
      const status = await getDiscordBotStatus()
      setBotStatus(status)
    } catch (error) {
      console.error('Error getting bot status:', error)
    }
  }

  return (
    <div className="discord-controls">
      <h3>Discord Bot Controls</h3>

      <div className="bot-status">
        <button onClick={handleCheckStatus}>Bot Status Check</button>
        {botStatus && (
          <div>
            <p>Status: {botStatus.online ? '🟢 Online' : '🔴 Offline'}</p>
            <p>Guilds: {botStatus.guilds}</p>
            <p>Ping: {botStatus.ping}ms</p>
          </div>
        )}
      </div>

      <div className="message-sender">
        <input
          type="text"
          placeholder="Channel ID"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
        />
        <textarea
          placeholder="Message content"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          onClick={handleSendMessage}
          disabled={loading || !message || !channelId}
        >
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </div>
    </div>
  )
}
```

### キャラクター一覧でのDiscord連携

```typescript
// app/components/CharacterListWithDiscord.tsx
import { useState } from 'react'
import { sendCharacterToDiscord } from '~/features/discord/api/discord.service'

export function CharacterListWithDiscord({ characters }: { characters: any[] }) {
  const [selectedChannelId, setSelectedChannelId] = useState('')

  const handleSendToDiscord = async (characterId: string) => {
    if (!selectedChannelId) {
      alert('チャンネルを選択してください')
      return
    }

    try {
      const result = await sendCharacterToDiscord(characterId, selectedChannelId)

      if (result.success) {
        alert('キャラクター情報をDiscordに送信しました！')
      } else {
        alert('送信に失敗しました')
      }
    } catch (error) {
      console.error('Error sending character to Discord:', error)
      alert('エラーが発生しました')
    }
  }

  return (
    <div className="character-list-discord">
      <div className="discord-settings">
        <input
          type="text"
          placeholder="Discord Channel ID"
          value={selectedChannelId}
          onChange={(e) => setSelectedChannelId(e.target.value)}
        />
      </div>

      <div className="character-list">
        {characters.map((character) => (
          <div key={character.characterId} className="character-item">
            <h4>{character.characterName}</h4>
            <p>System: {character.gameSystemId}</p>
            <button
              onClick={() => handleSendToDiscord(character.characterId)}
              disabled={!selectedChannelId}
            >
              Send to Discord
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## 🔐 セキュリティ

### 認証要求

すべてのDiscord Bot操作APIは JWT認証が必要です：

```typescript
// APIクライアントは自動的にJWTトークンを含めます
import { apiClient } from '~/lib/api-client'

// 認証が必要なエンドポイント
// - POST /discord/send-message
// - POST /discord/create-channel
// - GET /discord/status
// - GET /discord/guild/:guildId
// - GET /discord/channel/:channelId
```

### 権限管理

Discord Bot側で適切な権限が設定されている必要があります：

- **メッセージ送信**: `Send Messages`権限
- **チャンネル作成**: `Manage Channels`権限
- **ギルド情報取得**: `View Channels`権限

## 🚨 エラーハンドリング

### 一般的なエラー

```typescript
try {
  await sendDiscordMessage(messageData)
} catch (error) {
  if (error.message.includes('Channel not found')) {
    // チャンネルが見つからない場合
  } else if (error.message.includes('Missing permissions')) {
    // 権限不足の場合
  } else {
    // その他のエラー
  }
}
```

### エラーレスポンス例

```json
{
  "success": false,
  "error": "チャンネルが見つからないか、テキストチャンネルではありません"
}
```

## 🎯 実際の使用シナリオ

### 1. TRPGセッション進行支援

- セッション開始時に参加者にDiscordで通知
- キャラクター情報の共有
- ダイスロール結果の記録

### 2. 管理機能

- 新規ユーザー登録時の通知
- システムメンテナンス情報の配信
- エラー発生時のアラート

### 3. コミュニティ機能

- 新しいキャラクター作成の共有
- セッション募集の投稿
- 成果物の共有

## 📝 API仕様

### HTTP エンドポイント

| Method | Path                          | Description        |
| ------ | ----------------------------- | ------------------ |
| POST   | `/discord/send-message`       | メッセージ送信     |
| POST   | `/discord/create-channel`     | チャンネル作成     |
| GET    | `/discord/status`             | Bot状態取得        |
| GET    | `/discord/guild/:guildId`     | ギルド情報取得     |
| GET    | `/discord/channel/:channelId` | チャンネル情報取得 |

### 認証

全てのエンドポイントでJWT認証が必要です。

### レスポンス形式

```typescript
// 成功時
{
  "success": true,
  "messageId": "1234567890123456789" // 該当する場合
}

// エラー時
{
  "success": false,
  "error": "エラーメッセージ"
}
```

この機能により、RemixアプリケーションからDiscord Botを完全に制御できるようになり、よりリッチなユーザーエクスペリエンスを提供できます。
