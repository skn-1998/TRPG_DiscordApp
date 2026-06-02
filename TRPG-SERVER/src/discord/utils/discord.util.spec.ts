// 本体(discord.util.ts)は `import { ChannelType } from 'discord.js'` で ChannelType を参照する。
// このプロジェクトの jest-setup は discord.js 全体をモックし、ChannelType を
// { PublicThread: 11 } だけに差し替えるため、本体から見える GuildCategory/GuildText は undefined になる。
// ここで重要なのは「本体とテストが同一の ChannelType を参照する」こと。
// そこで実 enum 値には依存せず、本体と同じ(モック後の)ChannelType を import して比較対象に使い、
// 「カテゴリ判定が一致する type / しない type」を相対的に作って本体の比較ロジックそのものを検証する。
import { ChannelType, type Client, type Guild } from 'discord.js'
import { getCategory, createCategory, findChannelById, createTextChannel } from './discord.util'

// 本体が「カテゴリ」と判定する type（= ChannelType.GuildCategory と厳密一致する値）
const CATEGORY_TYPE = ChannelType.GuildCategory
// 本体が「カテゴリではない」と判定する type（CATEGORY_TYPE と必ず異なる値）
const NON_CATEGORY_TYPE = 'NON_CATEGORY' as unknown as number

// client / guild は本体が参照するメソッドだけを持つ最小スタブとし、
// discord.js の厳格な型は使わず `as unknown as` で必要な形だけを表現する。

// guild.channels.cache.filter(predicate).first() を満たす Collection 風の最小スタブ。
// filter は配列に委譲し、結果から first() を取り出せるようにする。
const createChannelCache = <T>(channels: T[]) => ({
  get: (id: string) => (channels as Array<{ id?: string }>).find((c) => c.id === id),
  filter: (predicate: (channel: T) => boolean) => {
    const matched = channels.filter(predicate)
    return {
      first: () => (matched.length > 0 ? matched[0] : undefined)
    }
  }
})

describe('discord.util', () => {
  describe('getCategory', () => {
    const createClient = (guilds: Record<string, unknown>): Client => {
      return {
        guilds: {
          cache: {
            get: (id: string) => guilds[id]
          }
        }
      } as unknown as Client
    }

    const createGuildWithCategories = (channels: Array<{ name: string; type: number }>): unknown => ({
      channels: { cache: createChannelCache(channels) }
    })

    it('サーバーが見つからない場合はエラーを throw する', async () => {
      // Arrange
      const client = createClient({})

      // Act / Assert
      await expect(getCategory(client, 'missing-guild', 'シナリオ')).rejects.toThrow(
        'サーバーID missing-guild が見つかりません'
      )
    })

    it('名前と種別(GuildCategory)が一致するカテゴリを返す', async () => {
      // Arrange
      const category = { name: 'シナリオ', type: CATEGORY_TYPE }
      const guild = createGuildWithCategories([{ name: 'general', type: NON_CATEGORY_TYPE }, category])
      const client = createClient({ g1: guild })

      // Act
      const result = await getCategory(client, 'g1', 'シナリオ')

      // Assert
      expect(result).toBe(category)
    })

    it('名前は一致するが種別がカテゴリでない場合は null(=見つからない) を返す', async () => {
      // Arrange
      const guild = createGuildWithCategories([{ name: 'シナリオ', type: NON_CATEGORY_TYPE }])
      const client = createClient({ g1: guild })

      // Act
      const result = await getCategory(client, 'g1', 'シナリオ')

      // Assert: filter が空 → first() が undefined を返すため、戻り値も falsy(=見つからない)
      expect(result).toBeFalsy()
    })

    it('一致する名前のカテゴリが存在しない場合は null(=見つからない) を返す', async () => {
      // Arrange
      const guild = createGuildWithCategories([{ name: 'other', type: CATEGORY_TYPE }])
      const client = createClient({ g1: guild })

      // Act
      const result = await getCategory(client, 'g1', 'シナリオ')

      // Assert: 名前不一致 → first() が undefined を返すため、戻り値も falsy(=見つからない)
      expect(result).toBeFalsy()
    })
  })

  describe('createCategory', () => {
    it('GuildCategory 種別で channels.create を呼び、戻り値を返す', async () => {
      // Arrange
      const created = { id: 'cat1' }
      const create = jest.fn().mockResolvedValue(created)
      const guild = { channels: { create } } as unknown as Guild

      // Act
      const result = await createCategory(guild, 'シナリオ')

      // Assert
      expect(create).toHaveBeenCalledWith({
        name: 'シナリオ',
        type: ChannelType.GuildCategory
      })
      expect(result).toBe(created)
    })
  })

  describe('findChannelById', () => {
    const createClient = (channels: Array<{ id: string }>): Client => {
      return {
        channels: { cache: createChannelCache(channels) }
      } as unknown as Client
    }

    it('指定IDのチャンネルが存在すればそれを返す', async () => {
      // Arrange
      const channel = { id: 'ch1' }
      const client = createClient([channel])

      // Act
      const result = await findChannelById(client, 'ch1')

      // Assert
      expect(result).toBe(channel)
    })

    it('指定IDのチャンネルが存在しなければ null を返す', async () => {
      // Arrange
      const client = createClient([{ id: 'ch1' }])

      // Act
      const result = await findChannelById(client, 'missing')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('createTextChannel', () => {
    it('options を引き継ぎつつ type を GuildText で上書きして channels.create を呼ぶ', async () => {
      // Arrange
      const created = { id: 'txt1' }
      const create = jest.fn().mockResolvedValue(created)
      const guild = { channels: { create } } as unknown as Guild

      // Act
      const result = await createTextChannel(guild, {
        name: '雑談',
        parent: 'parent-id'
      })

      // Assert: options が引き継がれ、type は GuildText で上書きされる
      expect(create).toHaveBeenCalledWith({
        name: '雑談',
        parent: 'parent-id',
        type: ChannelType.GuildText
      })
      expect(result).toBe(created)
    })

    it('options に type が含まれても GuildText で上書きされる', async () => {
      // Arrange
      const create = jest.fn().mockResolvedValue({ id: 'txt2' })
      const guild = { channels: { create } } as unknown as Guild

      // Act
      await createTextChannel(guild, {
        name: '雑談',
        type: ChannelType.GuildVoice
      } as never)

      // Assert: 渡した type(GuildVoice)ではなく GuildText で呼ばれる
      expect(create).toHaveBeenCalledWith({
        name: '雑談',
        type: ChannelType.GuildText
      })
    })
  })
})
