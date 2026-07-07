import { MessageFlags } from 'discord.js'
import { createMockSelectMenuInteraction } from '@discord-test-utils'
import { CharacterThreadSelectService } from './character-thread-select.service'
import { CharacterThreadOrchestrator } from './character-thread.orchestrator'
import { TypedEventService } from 'src/core/events/typed-event.service'
import { CharacterService } from 'src/domains/character/character.service'

// キャラクタースレッド選択メニューのルーター。
// execute は isStringSelectMenu ガード → customId による分岐振り分け（legacy/create/enhanced/flexible-dice）
// を行い、例外時は followUp フォールバックする。副作用境界（orchestrator・typedEventService・
// characterService・interaction の各応答メソッド）はモックし、ルーティング・主要分岐・純 private を検証する。
// showModal/モーダル構築は discord.js Builder を実体で組むため、構築内容の深掘りは避け
// 「showModal が呼ばれること」までに留める（mock 地獄回避）。
type OrchestratorMock = { handleSelection: jest.Mock }
type TypedEventMock = { emit: jest.Mock }
type CharacterServiceMock = { findOne: jest.Mock }

describe('CharacterThreadSelectService', () => {
  let orchestrator: OrchestratorMock
  let typedEventService: TypedEventMock
  let characterService: CharacterServiceMock
  let service: CharacterThreadSelectService

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    orchestrator = { handleSelection: jest.fn().mockResolvedValue(undefined) }
    typedEventService = { emit: jest.fn().mockResolvedValue(undefined) }
    characterService = { findOne: jest.fn().mockResolvedValue(null) }
    service = new CharacterThreadSelectService(
      orchestrator as unknown as CharacterThreadOrchestrator,
      typedEventService as unknown as TypedEventService,
      characterService as unknown as CharacterService
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('execute - ガードとルーティング', () => {
    it('StringSelectMenu でない場合は即 return し何もしない', async () => {
      // Arrange
      const interaction = createMockSelectMenuInteraction({
        customId: 'character-thread-select',
        values: ['char-1']
      })
      ;(interaction.isStringSelectMenu as unknown as jest.Mock).mockReturnValue(false)

      // Act
      await service.execute(interaction)

      // Assert
      expect(orchestrator.handleSelection).not.toHaveBeenCalled()
      expect(typedEventService.emit).not.toHaveBeenCalled()
      expect(interaction.deferUpdate).not.toHaveBeenCalled()
    })

    it('対象外の customId のときは何も処理せず return する', async () => {
      // Arrange
      const interaction = createMockSelectMenuInteraction({
        customId: 'unrelated-select',
        values: ['char-1']
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(orchestrator.handleSelection).not.toHaveBeenCalled()
      expect(typedEventService.emit).not.toHaveBeenCalled()
      expect(interaction.showModal).not.toHaveBeenCalled()
      expect(interaction.update).not.toHaveBeenCalled()
    })

    it('legacy(character-thread-select) は orchestrator.handleSelection に委譲する', async () => {
      // Arrange
      const interaction = createMockSelectMenuInteraction({
        customId: 'character-thread-select',
        values: ['char-1']
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(orchestrator.handleSelection).toHaveBeenCalledWith(interaction, 'char-1')
    })

    it('-with-thread は enhanced 分岐として orchestrator.handleSelection に委譲する', async () => {
      // Arrange
      const interaction = createMockSelectMenuInteraction({
        customId: 'character-thread-select-with-thread',
        values: ['char-2']
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(orchestrator.handleSelection).toHaveBeenCalledWith(interaction, 'char-2')
    })

    it('-current は enhanced 分岐として update で現在チャンネル表示する', async () => {
      // Arrange
      const interaction = createMockSelectMenuInteraction({
        customId: 'character-thread-select-current',
        values: ['char-3']
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(orchestrator.handleSelection).not.toHaveBeenCalled()
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('char-3'), components: [] })
      )
    })

    it('flexible-dice-param* は showModal を呼ぶ（モーダル表示系へ振り分ける）', async () => {
      // Arrange: section が custom 以外 → パラメータ用モーダル
      const interaction = createMockSelectMenuInteraction({
        customId: 'flexible-dice-param*char-9',
        values: ['status:HP:10']
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.showModal).toHaveBeenCalledTimes(1)
      expect(orchestrator.handleSelection).not.toHaveBeenCalled()
    })

    it('例外発生時は followUp でフォールバック通知する', async () => {
      // Arrange: legacy 分岐で orchestrator が投げる
      orchestrator.handleSelection.mockRejectedValueOnce(new Error('boom'))
      const interaction = createMockSelectMenuInteraction({
        customId: 'character-thread-select',
        values: ['char-1']
      })

      // Act & Assert: 握り潰して reject しない
      await expect(service.execute(interaction)).resolves.toBeUndefined()
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('エラー'), flags: MessageFlags.Ephemeral })
      )
    })
  })

  describe('execute - スレッド作成系(character-thread-create-select)', () => {
    const buildInteraction = () =>
      createMockSelectMenuInteraction({
        customId: 'character-thread-create-select',
        values: ['char-100']
      })

    it('character が見つからない場合は editReply でエラー通知し emit しない', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue(null)
      const interaction = buildInteraction()

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('見つかりませんでした'), components: [] })
      )
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('所有者が異なる場合は editReply で拒否し emit しない', async () => {
      // Arrange: discordUserId が interaction.user.id と不一致
      const interaction = buildInteraction()
      characterService.findOne.mockResolvedValue({
        characterName: 'Hero',
        discordUserId: 'someone-else'
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('他のユーザー'), components: [] })
      )
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('正常時は emit("discord.thread.create.requested") を所定ペイロードで呼ぶ', async () => {
      // Arrange: 所有者一致
      const interaction = buildInteraction()
      const ownerId = interaction.user.id
      characterService.findOne.mockResolvedValue({
        characterName: 'Hero',
        discordUserId: ownerId
      })

      // Act
      await service.execute(interaction)

      // Assert: 作成中メッセージ → emit の順
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('作成中') })
      )
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'discord.thread.create.requested',
        expect.objectContaining({
          character: expect.objectContaining({ characterName: 'Hero' }),
          channelId: interaction.channel!.id,
          guildId: interaction.guild!.id,
          creatorId: ownerId,
          displayType: 'enhanced',
          source: 'character-thread-select'
        })
      )
    })

    it('findOne が投げても catch して editReply でエラー応答し、execute は reject しない', async () => {
      // Arrange
      characterService.findOne.mockRejectedValueOnce(new Error('db down'))
      const interaction = buildInteraction()

      // Act & Assert
      await expect(service.execute(interaction)).resolves.toBeUndefined()
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('エラー'), components: [] })
      )
      // 内側 catch で握るため外側 followUp フォールバックには到達しない
      expect(interaction.followUp).not.toHaveBeenCalled()
    })
  })

  describe('extractCharacterIdFromCustomId (純 private)', () => {
    it('flexible-dice-param*<id> から id を抽出する', () => {
      const result = service['extractCharacterIdFromCustomId']('flexible-dice-param*abc-123')
      expect(result).toBe('abc-123')
    })

    it('プレフィックスが一致しない customId は null を返す', () => {
      const result = service['extractCharacterIdFromCustomId']('other-prefix*abc-123')
      expect(result).toBeNull()
    })

    it('* 区切りが無い customId は null を返す', () => {
      const result = service['extractCharacterIdFromCustomId']('flexible-dice-param')
      expect(result).toBeNull()
    })
  })

  describe('getSectionEmoji (純 private)', () => {
    it('status は 📊 を返す', () => {
      expect(service['getSectionEmoji']('status')).toBe('📊')
    })

    it('skill は ⚔️ を返す', () => {
      expect(service['getSectionEmoji']('skill')).toBe('⚔️')
    })

    it('parameter は ⚙️ を返す', () => {
      expect(service['getSectionEmoji']('parameter')).toBe('⚙️')
    })

    it('未知のセクションは既定の 🎲 を返す', () => {
      expect(service['getSectionEmoji']('unknown')).toBe('🎲')
    })
  })
})
