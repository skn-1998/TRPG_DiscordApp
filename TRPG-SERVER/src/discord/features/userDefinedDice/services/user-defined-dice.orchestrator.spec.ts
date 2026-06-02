// 本サービスは channel instanceof TextChannel を判定し、ChannelType / Collection を実 new するため、
// グローバル jest-setup の discord.js モックを無効化し実挙動を使う。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

// util は副作用の境界としてスタブ化する。
jest.mock('../../../utils/tableDice', () => ({ tableDice: jest.fn() }))
jest.mock('../../gameSystem', () => ({ convertSearchText: jest.fn() }))

import { Test } from '@nestjs/testing'
import { ChannelType, Collection, TextChannel } from 'discord.js'
import { createMockAutocompleteInteraction } from '@discord-test-utils'
import { UserDefinedDiceOrchestrator } from './user-defined-dice.orchestrator'
import { tableDice } from '../../../utils/tableDice'
import { convertSearchText } from '../../gameSystem'

const tableDiceMock = tableDice as jest.MockedFunction<typeof tableDice>
const convertSearchTextMock = convertSearchText as jest.MockedFunction<typeof convertSearchText>

/**
 * UserDefinedDiceOrchestrator は Discord の autocomplete / execute を処理する handler。
 * - autocomplete: guild の channels.cache から GuildText/PublicThread を抽出し、
 *   入力が空ならカテゴリ('オリジナル表')配下を、非空なら Fuse 検索結果を respond する。
 * - execute: 指定 channel のメッセージを集約し tableDice(スタブ) の結果を reply する。
 *
 * util(tableDice / convertSearchText) は副作用の境界としてモックし、
 * channels.cache は実 discord.js Collection、TextChannel 判定は実 prototype を使う。
 */
describe('UserDefinedDiceOrchestrator', () => {
  let service: UserDefinedDiceOrchestrator

  // channels.cache 用の Collection を生成（.filter/.map/.find を実装する実 Collection）
  const createChannelCache = (
    channels: Array<{ id: string; name: string; type: number; parentId?: string | null }>
  ) => {
    const collection = new Collection<string, (typeof channels)[number]>()
    for (const ch of channels) collection.set(ch.id, { parentId: null, ...ch })
    return collection
  }

  // channels.cache を持つ guild を備えた autocomplete インタラクションを生成
  const createAutocompleteInteraction = (focusedValue: string, cache: ReturnType<typeof createChannelCache> | null) =>
    createMockAutocompleteInteraction({
      focusedOption: { name: 'channel', value: focusedValue },
      base: { guild: (cache ? { channels: { cache } } : null) as never }
    })

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [UserDefinedDiceOrchestrator]
    }).compile()

    service = moduleRef.get(UserDefinedDiceOrchestrator)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('autocomplete', () => {
    it('guild が無い場合は何もせず return する', async () => {
      // Arrange
      const interaction = createAutocompleteInteraction('', null)

      // Act
      await service.autocomplete(interaction)

      // Assert
      expect(interaction.respond).not.toHaveBeenCalled()
    })

    it('focusedValue が空でカテゴリが存在しない場合は全チャンネルを最大25件 respond する', async () => {
      // Arrange: GuildText と PublicThread のみ抽出対象。カテゴリ('オリジナル表')は存在しない
      const cache = createChannelCache([
        { id: 'c1', name: 'text-a', type: ChannelType.GuildText },
        { id: 'c2', name: 'thread-b', type: ChannelType.PublicThread },
        { id: 'c3', name: 'voice', type: ChannelType.GuildVoice }
      ])
      const interaction = createAutocompleteInteraction('', cache)

      // Act
      await service.autocomplete(interaction)

      // Assert: voice は除外され、GuildText/PublicThread のみ
      expect(interaction.respond).toHaveBeenCalledWith([
        { name: 'text-a', value: 'c1', parentId: null },
        { name: 'thread-b', value: 'c2', parentId: null }
      ])
    })

    it('focusedValue が空でカテゴリは存在するが配下が無い場合は全チャンネルを respond する', async () => {
      // Arrange: カテゴリは存在するが、その配下に属するチャンネルが無い
      const cache = createChannelCache([
        { id: 'cat', name: 'オリジナル表', type: ChannelType.GuildCategory },
        { id: 'c1', name: 'text-a', type: ChannelType.GuildText, parentId: null }
      ])
      const interaction = createAutocompleteInteraction('', cache)

      // Act
      await service.autocomplete(interaction)

      // Assert: 配下0件なので全 GuildText/PublicThread を返す
      expect(interaction.respond).toHaveBeenCalledWith([{ name: 'text-a', value: 'c1', parentId: null }])
    })

    it('focusedValue が空でカテゴリ配下にチャンネルがある場合は配下のみを respond する', async () => {
      // Arrange: カテゴリ配下のチャンネルと、配下でないチャンネルを混在させる
      const cache = createChannelCache([
        { id: 'cat', name: 'オリジナル表', type: ChannelType.GuildCategory },
        { id: 'c1', name: 'under-cat', type: ChannelType.GuildText, parentId: 'cat' },
        { id: 'c2', name: 'outside', type: ChannelType.GuildText, parentId: null }
      ])
      const interaction = createAutocompleteInteraction('', cache)

      // Act
      await service.autocomplete(interaction)

      // Assert: parentId が cat のものだけ
      expect(interaction.respond).toHaveBeenCalledWith([{ name: 'under-cat', value: 'c1', parentId: 'cat' }])
    })

    it('focusedValue が非空の場合は convertSearchText と Fuse 検索結果を respond する', async () => {
      // Arrange: convertSearchText(スタブ)で検索語を返し、Fuse が name に一致するものを拾う
      convertSearchTextMock.mockReturnValue(['ねこ'])
      const cache = createChannelCache([
        { id: 'c1', name: 'ねこ表', type: ChannelType.GuildText },
        { id: 'c2', name: 'いぬ表', type: ChannelType.GuildText }
      ])
      const interaction = createAutocompleteInteraction('ねこ', cache)

      // Act
      await service.autocomplete(interaction)

      // Assert: 検索語生成に focusedValue が渡り、一致した 'ねこ表' のみ返る
      expect(convertSearchTextMock).toHaveBeenCalledWith('ねこ')
      expect(interaction.respond).toHaveBeenCalledWith([{ name: 'ねこ表', value: 'c1', parentId: null }])
    })
  })

  describe('execute', () => {
    // TextChannel として instanceof 判定を通すフェイクチャンネルを生成
    const createTextChannel = (name: string, messages: Array<{ content: string }>) => {
      const channel = Object.create(TextChannel.prototype)
      channel.id = 'ch-1'
      channel.name = name
      // messages.fetch は Collection を返す（[...entries()] で展開される）
      const collection = new Collection<string, { content: string }>()
      messages.forEach((m, i) => collection.set(String(i), m))
      channel.messages = { fetch: jest.fn().mockResolvedValue(collection) }
      return channel
    }

    // execute 用 ChatInput インタラクション（guild.channels.cache.find で channel を解決）
    const createExecuteInteraction = (channel: unknown, channelIdArg = 'ch-1') => {
      const cache = new Collection<string, unknown>()
      if (channel) cache.set('ch-1', channel)
      const interaction = createMockAutocompleteInteraction({
        options: { channel: channelIdArg },
        base: { guild: { channels: { cache } } as never }
      })
      ;(interaction.isChatInputCommand as unknown as jest.Mock).mockReturnValue(true)
      return interaction as never as Parameters<UserDefinedDiceOrchestrator['execute']>[0]
    }

    it('chatInputCommand でない場合は何もせず return する', async () => {
      // Arrange
      const interaction = createExecuteInteraction(createTextChannel('t', [{ content: 'a' }]))
      ;(interaction.isChatInputCommand as unknown as jest.Mock).mockReturnValue(false)

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('guild が無い場合は何もせず return する', async () => {
      // Arrange
      const interaction = createMockAutocompleteInteraction({ base: { guild: null } }) as never as Parameters<
        UserDefinedDiceOrchestrator['execute']
      >[0]
      ;(interaction.isChatInputCommand as unknown as jest.Mock).mockReturnValue(true)

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('チャンネルが見つからない場合は「チャンネルが見つかりませんでした。」を reply する', async () => {
      // Arrange: cache に該当 channel が無い
      const interaction = createExecuteInteraction(null)

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith('チャンネルが見つかりませんでした。')
    })

    it('TextChannel でメッセージが空の場合は「メッセージが見つかりませんでした。」を reply する', async () => {
      // Arrange: 空文字のみ → contents が空になる
      const channel = createTextChannel('表チャンネル', [{ content: '' }])
      const interaction = createExecuteInteraction(channel)

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith('表チャンネル：メッセージが見つかりませんでした。')
      expect(tableDiceMock).not.toHaveBeenCalled()
    })

    it('tableDice の戻りが falsy の場合は「エラーが発生しました」を reply する', async () => {
      // Arrange
      tableDiceMock.mockReturnValue(undefined)
      const channel = createTextChannel('表', [{ content: 'りんご' }, { content: 'みかん' }])
      const interaction = createExecuteInteraction(channel)

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith('エラーが発生しました')
    })

    it('正常時は tableDice の戻りを reply し、複数件は isDirect=false で渡す', async () => {
      // Arrange
      tableDiceMock.mockReturnValue('結果: りんご')
      const channel = createTextChannel('表', [{ content: 'りんご' }, { content: 'みかん' }])
      const interaction = createExecuteInteraction(channel)

      // Act
      await service.execute(interaction)

      // Assert: contents 抽出と isDirectToTableDice=false の引き渡しを検証
      expect(tableDiceMock).toHaveBeenCalledWith('表', ['りんご', 'みかん'], false)
      expect(interaction.reply).toHaveBeenCalledWith('結果: りんご')
    })

    it('単一メッセージが bcdice 表形式の場合は isDirect=true で tableDice に渡す', async () => {
      // Arrange: bcdiceTableRegExp に一致する単一メッセージ
      tableDiceMock.mockReturnValue('直接結果')
      const direct = 'タイトル\n1D6\n1:あたり'
      const channel = createTextChannel('表', [{ content: direct }])
      const interaction = createExecuteInteraction(channel)

      // Act
      await service.execute(interaction)

      // Assert
      expect(tableDiceMock).toHaveBeenCalledWith('表', [direct], true)
    })

    it('TextChannel でないチャンネルの場合は「チャンネルが見つかりませんでした。」を reply する', async () => {
      // Arrange: TextChannel.prototype でない通常オブジェクト
      const interaction = createExecuteInteraction({ id: 'ch-1', name: 'voice' })

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith('チャンネルが見つかりませんでした。')
      expect(tableDiceMock).not.toHaveBeenCalled()
    })
  })
})
