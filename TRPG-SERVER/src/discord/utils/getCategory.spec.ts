import { ChannelType, Guild } from 'discord.js'
import { getCategory } from './getCategory'

// getCategory が参照するプロパティ(name/type)のみを持つ最小チャンネル mock。
// discord.js の厳格な GuildBasedChannel 型は使わず、必要な形だけを表現する。
// type は本体の比較対象 ChannelType.GuildCategory と「一致/不一致」を作れればよいので
// unknown を許容する（テスト環境では discord.js がモックされ ChannelType が差し替わるため、
// enum の実数値に依存せず本体の比較ロジックそのものを検証する）。
type MockChannel = { name: string; type: unknown }

describe('getCategory', () => {
  // guild.channels.cache.find(predicate) を満たす最小 mock。
  // 配列に対して find を委譲することで discord.js の Collection 相当の挙動を再現する。
  const createGuild = (channels: MockChannel[]): Guild => {
    return {
      channels: {
        cache: {
          find: (predicate: (channel: MockChannel) => boolean) => channels.find(predicate)
        }
      }
    } as unknown as Guild
  }

  // 本体が「カテゴリ」と判定する type（= ChannelType.GuildCategory と厳密一致する値）
  const CATEGORY_TYPE = ChannelType.GuildCategory
  // 本体が「カテゴリではない」と判定する type（CATEGORY_TYPE と必ず異なる値）
  const NON_CATEGORY_TYPE = 'NON_CATEGORY'

  it('名前と種別(GuildCategory)が一致するチャンネルを返す', () => {
    // Arrange
    const category: MockChannel = { name: 'シナリオ', type: CATEGORY_TYPE }
    const guild = createGuild([{ name: 'general', type: NON_CATEGORY_TYPE }, category])

    // Act
    const result = getCategory(guild, 'シナリオ')

    // Assert
    expect(result).toBe(category)
  })

  it('名前は一致するが種別がカテゴリでない場合は undefined を返す', () => {
    // Arrange
    const guild = createGuild([{ name: 'シナリオ', type: NON_CATEGORY_TYPE }])

    // Act / Assert
    expect(getCategory(guild, 'シナリオ')).toBeUndefined()
  })

  it('一致する名前のカテゴリが存在しない場合は undefined を返す', () => {
    // Arrange
    const guild = createGuild([{ name: 'other', type: CATEGORY_TYPE }])

    // Act / Assert
    expect(getCategory(guild, 'シナリオ')).toBeUndefined()
  })

  it('guild が null の場合は undefined を返す', () => {
    expect(getCategory(null, 'シナリオ')).toBeUndefined()
  })
})
