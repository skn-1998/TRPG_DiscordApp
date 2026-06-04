// グローバル jest-setup の discord.js モックを無効化し、
// 実際の EmbedBuilder / ButtonBuilder / StringSelectMenuBuilder 等の挙動を検証する。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test, TestingModule } from '@nestjs/testing'
import { TextChannel, ThreadChannel } from 'discord.js'
import { ThreadCreationService, CreateThreadRequest } from './thread-creation.service'
import { DiscordClientService } from '../../../services/discord-client.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { CharacterService } from '../../../../domains/character/character.service'
import { ThreadInteractionService } from './thread-interaction.service'
import { Character } from '../../../../domains/character/models/character.model'

/**
 * Characterization tests for ThreadCreationService.
 *
 * 目的: 巨大サービス分割リファクタの「前後」で公開メソッド createCharacterThread の
 * 観測可能な挙動（成功/失敗の分岐・返り値・どの Discord API/依存メソッドがどの引数で呼ばれるか）を
 * 「現状のまま」固定する安全網。
 *
 * 注意: getGuild / getTextChannel は discord.js の guild.fetch + instanceof TextChannel に
 * 依存する重い I/O のため、本 characterization では private メソッドを spy で差し替え、
 * 公開メソッドのオーケストレーション挙動（分岐・送信・DB更新・返り値）を固定する。
 * 実 Discord fetch を伴う統合経路は E2E/手動推奨（characterization 困難な赤箇所）。
 */
describe('ThreadCreationService (characterization)', () => {
  let service: ThreadCreationService
  let module: TestingModule

  // モックスレッド（thread.send を観測）
  const buildMockThread = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'thread-xyz',
      guild: { id: 'guild-1' },
      send: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      ...overrides
    }) as unknown as ThreadChannel

  // モックテキストチャンネル（threads.create を観測）
  const buildMockChannel = (thread: ThreadChannel) =>
    ({
      id: 'channel-1',
      threads: {
        create: jest.fn().mockResolvedValue(thread)
      }
    }) as unknown as TextChannel

  const mockClient = {
    guilds: { fetch: jest.fn() },
    channels: { fetch: jest.fn() }
  }

  const mockDiscordClientService = {
    getClient: jest.fn().mockReturnValue(mockClient)
  }

  const mockTypedEventService = {
    emit: jest.fn().mockResolvedValue(undefined)
  }

  const mockCharacterService = {
    update: jest.fn().mockResolvedValue(undefined)
  }

  // S-4.3: ダイス系UI の生成は ThreadInteractionService に一元化。
  // ThreadCreationService は各 post メソッドへ委譲するだけなので mock で呼び出しを観測する。
  const mockThreadInteractionService = {
    postBasicDiceButtons: jest.fn().mockResolvedValue(undefined),
    postFlexibleDiceMenu: jest.fn().mockResolvedValue(undefined),
    postPresetDiceButtons: jest.fn().mockResolvedValue(undefined),
    postSkillRollButtons: jest.fn().mockResolvedValue(undefined),
    postAbilityRollButtons: jest.fn().mockResolvedValue(undefined)
  }

  const buildCharacter = (overrides: Partial<Character> = {}): Character =>
    ({
      characterId: 'char-123',
      characterName: 'テストキャラ',
      gameSystemId: 'coc7',
      discordUserId: 'user-1',
      discordChannelId: 'channel-edit-999',
      status: { hp: { name: 'HP', value: 12 } },
      parameter: { str: { name: 'STR', value: 50 } },
      skill: { dodge: { name: '回避', value: 40 } },
      item: { sword: { name: '剣', value: 1 } },
      ...overrides
    }) as unknown as Character

  const baseRequest: CreateThreadRequest = {
    characterId: 'char-123',
    characterName: 'テストキャラ',
    channelId: 'channel-1',
    creatorId: 'user-1',
    guildId: 'guild-1'
  }

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        ThreadCreationService,
        { provide: DiscordClientService, useValue: mockDiscordClientService },
        { provide: TypedEventService, useValue: mockTypedEventService },
        { provide: CharacterService, useValue: mockCharacterService },
        { provide: ThreadInteractionService, useValue: mockThreadInteractionService }
      ]
    }).compile()

    service = module.get(ThreadCreationService)
    jest.clearAllMocks()
    mockCharacterService.update.mockResolvedValue(undefined)
    mockThreadInteractionService.postBasicDiceButtons.mockResolvedValue(undefined)
    mockThreadInteractionService.postFlexibleDiceMenu.mockResolvedValue(undefined)
    mockThreadInteractionService.postPresetDiceButtons.mockResolvedValue(undefined)
    mockThreadInteractionService.postSkillRollButtons.mockResolvedValue(undefined)
    mockThreadInteractionService.postAbilityRollButtons.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    await module.close()
  })

  // ==========================================================================
  // 成功パス（basic 表示）
  // ==========================================================================
  describe('createCharacterThread - 成功パス', () => {
    it('guild/channel 取得 → thread 作成 → 表示投稿 → DB更新を経て success を返す', async () => {
      const thread = buildMockThread()
      const channel = buildMockChannel(thread)
      const guild = { id: 'guild-1' } as any
      const character = buildCharacter()

      // I/O 取得系は spy で差し替え（discord.js fetch/instanceof を回避）
      jest.spyOn(service as any, 'getGuild').mockResolvedValue(guild)
      jest.spyOn(service as any, 'getTextChannel').mockResolvedValue(channel)

      const result = await service.createCharacterThread(baseRequest, character)

      // 返り値の固定
      expect(result.success).toBe(true)
      expect(result.threadId).toBe('thread-xyz')
      expect(result.threadUrl).toBe('https://discord.com/channels/guild-1/channel-1/thread-xyz')

      // getGuild / getTextChannel が request 値で呼ばれる
      expect((service as any).getGuild).toHaveBeenCalledWith('guild-1')
      expect((service as any).getTextChannel).toHaveBeenCalledWith(guild, 'channel-1')

      // thread 作成の引数（スレッド名フォーマット）を固定
      const createArgs = (channel.threads.create as jest.Mock).mock.calls[0][0]
      expect(createArgs.name).toMatch(/^🎭 テストキャラ \[\d{4}-\d{2}-\d{2}\]$/)
      expect(createArgs.type).toBe(11) // PublicThread
      expect(createArgs.reason).toBe('Character thread for テストキャラ')

      // DB 更新: discordThreadId と threadId の 2 回 update
      expect(mockCharacterService.update).toHaveBeenCalledWith('char-123', { discordThreadId: 'thread-xyz' })
      expect(mockCharacterService.update).toHaveBeenCalledWith('char-123', { threadId: 'thread-xyz' })

      // thread.send が呼ばれている（embed + ボタン群）
      expect(thread.send).toHaveBeenCalled()
    })

    it('basic 表示: embed を送信し、ダイス系UI を ThreadInteractionService へ委譲する', async () => {
      const thread = buildMockThread()
      const channel = buildMockChannel(thread)
      const character = buildCharacter()

      jest.spyOn(service as any, 'getGuild').mockResolvedValue({ id: 'guild-1' })
      jest.spyOn(service as any, 'getTextChannel').mockResolvedValue(channel)

      await service.createCharacterThread(baseRequest, character)

      // 1) 基本Embed は ThreadCreationService 自身が送信する
      const sendCalls = (thread.send as jest.Mock).mock.calls
      expect(sendCalls[0][0]).toHaveProperty('embeds')

      // 2) ダイス系UI（基本/柔軟/プリセット/スキル/能力）は ThreadInteractionService へ委譲（S-4.3 converged）
      expect(mockThreadInteractionService.postBasicDiceButtons).toHaveBeenCalledWith(thread, character)
      expect(mockThreadInteractionService.postFlexibleDiceMenu).toHaveBeenCalledWith(thread, character)
      expect(mockThreadInteractionService.postPresetDiceButtons).toHaveBeenCalledWith(thread, character)
      expect(mockThreadInteractionService.postSkillRollButtons).toHaveBeenCalledWith(thread, character)
      expect(mockThreadInteractionService.postAbilityRollButtons).toHaveBeenCalledWith(thread, character)
    })
  })

  // ==========================================================================
  // enhanced 表示
  // ==========================================================================
  describe('createCharacterThread - enhanced 表示', () => {
    it('詳細情報Embedを送信し success を返す', async () => {
      const thread = buildMockThread()
      const channel = buildMockChannel(thread)
      const character = buildCharacter()

      jest.spyOn(service as any, 'getGuild').mockResolvedValue({ id: 'guild-1' })
      jest.spyOn(service as any, 'getTextChannel').mockResolvedValue(channel)

      const result = await service.createCharacterThread({ ...baseRequest, displayType: 'enhanced' }, character)

      expect(result.success).toBe(true)
      // 詳細情報Embed（タイトルに「詳細情報」を含む）
      const firstEmbed = (thread.send as jest.Mock).mock.calls[0][0].embeds[0]
      expect(firstEmbed.data.title).toBe('🎭 テストキャラ - 詳細情報')
    })
  })

  // ==========================================================================
  // 失敗パス
  // ==========================================================================
  describe('createCharacterThread - 失敗パス', () => {
    it('guild が見つからない場合 success:false とエラーメッセージを返す', async () => {
      jest.spyOn(service as any, 'getGuild').mockResolvedValue(null)
      const character = buildCharacter()

      const result = await service.createCharacterThread(baseRequest, character)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Guild not found: guild-1')
      expect(mockCharacterService.update).not.toHaveBeenCalled()
    })

    it('channel が見つからない場合 success:false とエラーメッセージを返す', async () => {
      jest.spyOn(service as any, 'getGuild').mockResolvedValue({ id: 'guild-1' })
      jest.spyOn(service as any, 'getTextChannel').mockResolvedValue(null)
      const character = buildCharacter()

      const result = await service.createCharacterThread(baseRequest, character)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Channel not found: channel-1')
    })

    it('thread 作成中に例外が発生した場合 ErrorHandler が HttpException を再throwする（現状挙動）', async () => {
      const channel = {
        id: 'channel-1',
        threads: { create: jest.fn().mockRejectedValue(new Error('boom')) }
      } as unknown as TextChannel
      jest.spyOn(service as any, 'getGuild').mockResolvedValue({ id: 'guild-1' })
      jest.spyOn(service as any, 'getTextChannel').mockResolvedValue(channel)
      const character = buildCharacter()

      // 現状: catch 内の ErrorHandler.handleServiceError が必ず throw するため
      // return { success:false } には到達せず、HttpException が伝播する。
      await expect(service.createCharacterThread(baseRequest, character)).rejects.toThrow(
        'サービス処理中にエラーが発生しました'
      )
    })

    it('表示投稿が失敗してもフォールバック（basic）で送信を継続し success を返す', async () => {
      const thread = buildMockThread()
      const channel = buildMockChannel(thread)
      const character = buildCharacter()

      jest.spyOn(service as any, 'getGuild').mockResolvedValue({ id: 'guild-1' })
      jest.spyOn(service as any, 'getTextChannel').mockResolvedValue(channel)
      // enhanced 表示の詳細投稿で1回だけ失敗 → フォールバックへ
      ;(thread.send as jest.Mock).mockRejectedValueOnce(new Error('display fail'))

      const result = await service.createCharacterThread({ ...baseRequest, displayType: 'enhanced' }, character)

      // フォールバックを経ても最終的に成功扱い
      expect(result.success).toBe(true)
      expect(thread.send).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // DB 更新失敗の握りつぶし（挙動固定）
  // ==========================================================================
  describe('createCharacterThread - DB更新失敗時', () => {
    it('characterService.update が失敗してもスレッド作成は success を返す', async () => {
      const thread = buildMockThread()
      const channel = buildMockChannel(thread)
      const character = buildCharacter()

      jest.spyOn(service as any, 'getGuild').mockResolvedValue({ id: 'guild-1' })
      jest.spyOn(service as any, 'getTextChannel').mockResolvedValue(channel)
      mockCharacterService.update.mockRejectedValue(new Error('db fail'))

      const result = await service.createCharacterThread(baseRequest, character)

      expect(result.success).toBe(true)
      expect(result.threadId).toBe('thread-xyz')
    })
  })
})
