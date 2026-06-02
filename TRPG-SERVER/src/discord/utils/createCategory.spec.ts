import { ChannelType, Guild } from 'discord.js'
import { createCategory } from './createCategory'

// createCategory は guild?.channels.create を呼ぶだけの薄いラッパー。
// 副作用の境界(channels.create)のみ jest.fn でモックし、ChannelType は実 discord.js を使う。
// create に渡す引数(name/type)と戻り値の受け渡し、null guild 時の optional chaining を検証する。

describe('createCategory', () => {
  // guild.channels.create(...) を満たす最小 mock。
  const createGuild = (create: jest.Mock): Guild => {
    return {
      channels: { create }
    } as unknown as Guild
  }

  it('guild が null の場合は undefined を返す', async () => {
    // Act
    const result = await createCategory(null, 'シナリオ')

    // Assert
    expect(result).toBeUndefined()
  })

  it('guild がある場合は channels.create に name と GuildCategory を渡して呼ぶ', async () => {
    // Arrange
    const create = jest.fn().mockResolvedValue({ id: 'cat-1' })
    const guild = createGuild(create)

    // Act
    await createCategory(guild, 'シナリオ')

    // Assert
    expect(create).toHaveBeenCalledWith({
      name: 'シナリオ',
      type: ChannelType.GuildCategory
    })
  })

  it('guild がある場合は channels.create の戻り値をそのまま返す', async () => {
    // Arrange
    const created = { id: 'cat-1', name: 'シナリオ' }
    const create = jest.fn().mockResolvedValue(created)
    const guild = createGuild(create)

    // Act
    const result = await createCategory(guild, 'シナリオ')

    // Assert
    expect(result).toBe(created)
  })
})
