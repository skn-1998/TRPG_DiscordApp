import { Guild } from 'discord.js'
import { getChannelIdByName } from './searchChannelID'

// getChannelIdByName が参照するプロパティ(name/id)のみを持つ最小チャンネル mock。
type MockChannel = { name: string; id: string }

describe('searchChannelID', () => {
  describe('getChannelIdByName', () => {
    // guild.channels.cache.find(predicate) を満たす最小 mock。
    const createGuild = (channels: MockChannel[]): Guild => {
      return {
        channels: {
          cache: {
            find: (predicate: (channel: MockChannel) => boolean) => channels.find(predicate)
          }
        }
      } as unknown as Guild
    }

    it('名前が一致するチャンネルの id を返す', () => {
      // Arrange
      const guild = createGuild([
        { name: 'general', id: '111' },
        { name: 'ダイス', id: '222' }
      ])

      // Act / Assert
      expect(getChannelIdByName(guild, 'ダイス')).toBe('222')
    })

    it('一致するチャンネルが存在しない場合は空文字列を返す', () => {
      // Arrange
      const guild = createGuild([{ name: 'general', id: '111' }])

      // Act / Assert
      expect(getChannelIdByName(guild, 'ダイス')).toBe('')
    })

    it('チャンネルが1件も無い場合は空文字列を返す', () => {
      // Arrange
      const guild = createGuild([])

      // Act / Assert
      expect(getChannelIdByName(guild, 'ダイス')).toBe('')
    })
  })
})
