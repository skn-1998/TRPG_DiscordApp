import { Test } from '@nestjs/testing'

// --- モジュールロード時副作用の遮断 ---
// 対象ファイル冒頭で loadJsonFile(...) が import 時に実行されるため、
// 小さな GameSystemJSON 配列を返すようスタブ化する。
jest.mock('../../../utils/file.util', () => ({
  ...jest.requireActual('../../../utils/file.util'),
  loadJsonFile: jest.fn(() => [
    { ID: 'cthulhu', NAME: 'クトゥルフ', SORT_KEY: '', HELP_MESSAGE: 'クトゥルフのヘルプ' },
    { ID: 'sword-world', NAME: 'ソード・ワールド', SORT_KEY: '', HELP_MESSAGE: 'SWのヘルプ' }
  ])
}))
jest.mock('../../../utils/getCategory', () => ({ getCategory: jest.fn() }))
jest.mock('../../../utils/createCategory', () => ({ createCategory: jest.fn() }))
jest.mock('../utils/search.util', () => ({ convertSearchText: jest.fn() }))

import { SelectGameSystemOrchestrator } from './select-game-system.orchestrator'
import { MessageFlags, PermissionsBitField } from 'discord.js'
import { getCategory } from '../../../utils/getCategory'
import { createCategory } from '../../../utils/createCategory'
import { convertSearchText } from '../utils/search.util'

const mockedGetCategory = getCategory as jest.MockedFunction<typeof getCategory>
const mockedCreateCategory = createCategory as jest.MockedFunction<typeof createCategory>
const mockedConvertSearchText = convertSearchText as jest.MockedFunction<typeof convertSearchText>

describe('SelectGameSystemOrchestrator', () => {
  let orchestrator: SelectGameSystemOrchestrator

  beforeEach(async () => {
    jest.clearAllMocks()
    const moduleRef = await Test.createTestingModule({
      providers: [SelectGameSystemOrchestrator]
    }).compile()
    orchestrator = moduleRef.get(SelectGameSystemOrchestrator)
  })

  describe('autocomplete', () => {
    it('focusedValueが空文字なら空配列でrespondする', async () => {
      // Arrange
      const respond = jest.fn()
      const interaction = {
        options: { getFocused: jest.fn().mockReturnValue('') },
        respond
      } as any

      // Act
      await orchestrator.autocomplete(interaction)

      // Assert
      expect(respond).toHaveBeenCalledWith([])
      expect(mockedConvertSearchText).not.toHaveBeenCalled()
    })

    it('focusedValueが非空ならconvertSearchTextとFuse検索結果を{name,value}でrespondする', async () => {
      // Arrange: convertSearchText は検索語配列を返す（'クトゥルフ' でヒットさせる）
      mockedConvertSearchText.mockReturnValue(['クトゥルフ', 'くとぅるふ', 'クトゥルフ'])
      const respond = jest.fn()
      const interaction = {
        options: { getFocused: jest.fn().mockReturnValue('クトゥルフ') },
        respond
      } as any

      // Act
      await orchestrator.autocomplete(interaction)

      // Assert
      expect(mockedConvertSearchText).toHaveBeenCalledWith('クトゥルフ')
      expect(respond).toHaveBeenCalledTimes(1)
      const respondedArg = respond.mock.calls[0][0] as Array<{ name: string; value: string }>
      expect(respondedArg).toContainEqual({ name: 'クトゥルフ', value: 'cthulhu' })
    })

    it('検索結果は最大25件にスライスされてrespondされる', async () => {
      // Arrange: 検索語をそのまま使い、結果件数を 25 件以下に保つ前提を検証
      mockedConvertSearchText.mockReturnValue(['ソード・ワールド'])
      const respond = jest.fn()
      const interaction = {
        options: { getFocused: jest.fn().mockReturnValue('ソード・ワールド') },
        respond
      } as any

      // Act
      await orchestrator.autocomplete(interaction)

      // Assert
      const respondedArg = respond.mock.calls[0][0] as unknown[]
      expect(respondedArg.length).toBeLessThanOrEqual(25)
    })
  })

  describe('execute', () => {
    const buildInteraction = (overrides: {
      isChatInputCommand?: boolean
      gamesystem?: string
      channelName?: string | null
      guildChannelsCreate?: jest.Mock
      baseHasManageChannels?: boolean
      interactionHasManageChannels?: boolean
      userId?: string
      guildOwnerId?: string
    }) => {
      const channelsCreate = overrides.guildChannelsCreate ?? jest.fn()
      const basePermissionsHas = jest.fn().mockReturnValue(overrides.baseHasManageChannels ?? true)
      const member = { permissions: { has: basePermissionsHas } }
      const membersFetch = jest.fn().mockResolvedValue(member)
      const guild = {
        ownerId: overrides.guildOwnerId,
        channels: { create: channelsCreate },
        members: { fetch: membersFetch }
      }
      const reply = jest.fn()
      const memberPermissionsHas = jest.fn().mockReturnValue(overrides.interactionHasManageChannels ?? true)
      const getString = jest.fn((key: string, _required?: boolean) => {
        if (key === 'gamesystem') return overrides.gamesystem
        if (key === 'channel-name') return overrides.channelName ?? null
        return null
      })
      const interaction = {
        isChatInputCommand: jest.fn().mockReturnValue(overrides.isChatInputCommand ?? true),
        options: { getString },
        reply,
        guild,
        user: { id: overrides.userId ?? 'user-1' },
        memberPermissions: { has: memberPermissionsHas }
      } as any
      return {
        interaction,
        reply,
        channelsCreate,
        guild,
        membersFetch,
        basePermissionsHas,
        memberPermissionsHas
      }
    }

    it('chatInputCommandでない場合は何もせず即returnする', async () => {
      // Arrange
      const reply = jest.fn()
      const interaction = {
        isChatInputCommand: jest.fn().mockReturnValue(false),
        reply
      } as any

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(reply).not.toHaveBeenCalled()
    })

    it('チャンネル上では ManageChannels があっても基底権限が無ければ作成処理へ到達しない', async () => {
      // Arrange
      const { interaction, reply, channelsCreate, membersFetch, basePermissionsHas, memberPermissionsHas } =
        buildInteraction({
          gamesystem: 'cthulhu',
          baseHasManageChannels: false,
          interactionHasManageChannels: true
        })

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(membersFetch).toHaveBeenCalledWith('user-1')
      expect(basePermissionsHas).toHaveBeenCalledWith(PermissionsBitField.Flags.ManageChannels)
      expect(memberPermissionsHas).not.toHaveBeenCalled()
      expect(reply).toHaveBeenCalledWith({
        content: 'このコマンドを実行するにはチャンネル管理権限が必要です',
        flags: MessageFlags.Ephemeral
      })
      expect(mockedGetCategory).not.toHaveBeenCalled()
      expect(mockedCreateCategory).not.toHaveBeenCalled()
      expect(channelsCreate).not.toHaveBeenCalled()
    })

    it('Administrator の基底権限があればチャンネルを作成できる', async () => {
      // Arrange
      mockedGetCategory.mockReturnValue({ id: 'cat-1' } as any)
      const send = jest.fn().mockResolvedValue({ pin: jest.fn() })
      const channelsCreate = jest.fn().mockResolvedValue({ send })
      const { interaction, membersFetch, basePermissionsHas } = buildInteraction({
        gamesystem: 'cthulhu',
        baseHasManageChannels: true,
        guildChannelsCreate: channelsCreate
      })

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(membersFetch).toHaveBeenCalledWith('user-1')
      expect(basePermissionsHas).toHaveBeenCalledWith(PermissionsBitField.Flags.ManageChannels)
      expect(channelsCreate).toHaveBeenCalledTimes(1)
    })

    it('ギルドオーナーの全基底権限があればチャンネルを作成できる', async () => {
      // Arrange
      mockedGetCategory.mockReturnValue({ id: 'cat-1' } as any)
      const send = jest.fn().mockResolvedValue({ pin: jest.fn() })
      const channelsCreate = jest.fn().mockResolvedValue({ send })
      const { interaction, membersFetch, basePermissionsHas } = buildInteraction({
        gamesystem: 'cthulhu',
        baseHasManageChannels: true,
        guildChannelsCreate: channelsCreate,
        userId: 'owner-1',
        guildOwnerId: 'owner-1'
      })

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(membersFetch).toHaveBeenCalledWith('owner-1')
      expect(basePermissionsHas).toHaveBeenCalledWith(PermissionsBitField.Flags.ManageChannels)
      expect(channelsCreate).toHaveBeenCalledTimes(1)
    })

    it('指定ゲームシステムがリストに無い場合はエラーメッセージでreplyする', async () => {
      // Arrange
      const { interaction, reply, channelsCreate } = buildInteraction({ gamesystem: 'unknown-system' })

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(reply).toHaveBeenCalledWith('ゲームシステムが見つかりませんでした : unknown-system')
      expect(channelsCreate).not.toHaveBeenCalled()
    })

    it('channel-name指定があればそれをチャンネル名に使う', async () => {
      // Arrange
      mockedGetCategory.mockReturnValue({ id: 'cat-1' } as any)
      const send = jest.fn().mockResolvedValue({ pin: jest.fn() })
      const channelsCreate = jest.fn().mockResolvedValue({ send })
      const { interaction } = buildInteraction({
        gamesystem: 'cthulhu',
        channelName: 'マイチャンネル',
        guildChannelsCreate: channelsCreate
      })

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(channelsCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'マイチャンネル', parent: 'cat-1' }))
    })

    it('channel-name未指定ならゲームシステムのNAMEをチャンネル名に使う', async () => {
      // Arrange
      mockedGetCategory.mockReturnValue({ id: 'cat-1' } as any)
      const send = jest.fn().mockResolvedValue({ pin: jest.fn() })
      const channelsCreate = jest.fn().mockResolvedValue({ send })
      const { interaction } = buildInteraction({
        gamesystem: 'cthulhu',
        channelName: null,
        guildChannelsCreate: channelsCreate
      })

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(channelsCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'クトゥルフ' }))
    })

    it('getCategoryが偽ならcreateCategoryの結果をparentに使う', async () => {
      // Arrange
      mockedGetCategory.mockReturnValue(undefined)
      mockedCreateCategory.mockResolvedValue({ id: 'created-cat' } as any)
      const send = jest.fn().mockResolvedValue({ pin: jest.fn() })
      const channelsCreate = jest.fn().mockResolvedValue({ send })
      const { interaction } = buildInteraction({
        gamesystem: 'cthulhu',
        guildChannelsCreate: channelsCreate
      })

      // Act
      await orchestrator.execute(interaction)

      // Assert
      expect(mockedCreateCategory).toHaveBeenCalledWith(interaction.guild, 'ダイスロールチャンネル')
      expect(channelsCreate).toHaveBeenCalledWith(expect.objectContaining({ parent: 'created-cat' }))
    })

    it('チャンネル作成→HELP_MESSAGE送信→pin→完了replyの一連を実行する', async () => {
      // Arrange
      mockedGetCategory.mockReturnValue({ id: 'cat-1' } as any)
      const pin = jest.fn()
      const send = jest.fn().mockResolvedValue({ pin })
      const channelsCreate = jest.fn().mockResolvedValue({ send })
      const { interaction, reply } = buildInteraction({
        gamesystem: 'cthulhu',
        guildChannelsCreate: channelsCreate
      })

      // Act
      await orchestrator.execute(interaction)

      // Assert: HELP_MESSAGE 送信・pin・完了 reply の副作用を検証
      expect(send).toHaveBeenCalledWith('クトゥルフのヘルプ')
      expect(pin).toHaveBeenCalledTimes(1)
      expect(reply).toHaveBeenCalledWith(expect.stringContaining('ダイスロールチャンネルを作成しました'))
      expect(reply).toHaveBeenCalledWith(expect.stringContaining('ゲームシステム: クトゥルフ'))
    })

    it('作成チャンネルのtopicにNAMEとIDが埋め込まれる', async () => {
      // Arrange
      mockedGetCategory.mockReturnValue({ id: 'cat-1' } as any)
      const send = jest.fn().mockResolvedValue({ pin: jest.fn() })
      const channelsCreate = jest.fn().mockResolvedValue({ send })
      const { interaction } = buildInteraction({
        gamesystem: 'cthulhu',
        guildChannelsCreate: channelsCreate
      })

      // Act
      await orchestrator.execute(interaction)

      // Assert
      const createArg = channelsCreate.mock.calls[0][0] as { topic: string }
      expect(createArg.topic).toContain('「クトゥルフ」')
      expect(createArg.topic).toContain('ID:cthulhu')
    })
  })
})

describe('module load validation', () => {
  afterAll(() => {
    jest.dontMock('../../../utils/file.util')
    jest.resetModules()
  })

  it('loadJsonFile が配列でない値を返す場合は module import 時に throw する', () => {
    jest.resetModules()
    jest.doMock('../../../utils/file.util', () => ({
      ...jest.requireActual('../../../utils/file.util'),
      loadJsonFile: jest.fn(() => ({}))
    }))

    expect(() => {
      jest.isolateModules(() => {
        jest.requireActual('./select-game-system.orchestrator')
      })
    }).toThrow(/構造が不正/)
  })
})
