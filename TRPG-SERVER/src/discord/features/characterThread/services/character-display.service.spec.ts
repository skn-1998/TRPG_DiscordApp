// 本サービスは EmbedBuilder / ButtonBuilder / ActionRowBuilder を実 new するため、
// グローバル jest-setup の discord.js モックを無効化し実挙動を使う。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test } from '@nestjs/testing'
import { CharacterDisplayService } from './character-display.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'

/**
 * CharacterDisplayService はチャンネルIDからキャラクターを検索し Embed を構築する統合サービス。
 * TypedEventService（イベント発行・待機）のみを注入する。
 * 純ロジック（isValidTabType / createSkillRollButtons / createBasicDiceButtons / buildCharacterEmbed）を
 * 最優先で実 discord.js により検証し、createCharacterEmbed は waitForEvent を mock で固定して分岐を見る。
 */
describe('CharacterDisplayService', () => {
  let service: CharacterDisplayService
  let eventService: jest.Mocked<Pick<TypedEventService, 'emit' | 'on' | 'once' | 'waitForEvent'>>

  const buildCharacter = (overrides: Record<string, unknown> = {}) =>
    ({
      characterId: 'char-1',
      characterName: 'テスト探索者',
      gameSystemId: 'coc7',
      ...overrides
    }) as never

  beforeEach(async () => {
    eventService = {
      emit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      once: jest.fn(),
      waitForEvent: jest.fn()
    }

    const moduleRef = await Test.createTestingModule({
      providers: [CharacterDisplayService, { provide: TypedEventService, useValue: eventService }]
    }).compile()

    service = moduleRef.get(CharacterDisplayService)
  })

  describe('isValidTabType', () => {
    it.each(['basic', 'status', 'skills', 'items', 'desc'])('有効なタブ "%s" は true を返す', (tab) => {
      expect(service.isValidTabType(tab)).toBe(true)
    })

    it('未定義のタブ文字列は false を返す', () => {
      expect(service.isValidTabType('unknown')).toBe(false)
    })
  })

  describe('createBasicDiceButtons', () => {
    it('1D100 / 1D6 / 2D6 / カスタム の 4 ボタンを 1 行で生成する', () => {
      // Arrange
      const character = buildCharacter()

      // Act
      const row = service.createBasicDiceButtons(character)
      const json = row.toJSON()

      // Assert
      expect(json.components).toHaveLength(4)
      const labels = json.components.map((c: any) => c.label)
      expect(labels).toEqual(['1D100', '1D6', '2D6', 'カスタム'])
    })

    it('customId にキャラクターIDが埋め込まれる', () => {
      // Arrange
      const character = buildCharacter({ characterId: 'abc' })

      // Act
      const row = service.createBasicDiceButtons(character)
      const json = row.toJSON()

      // Assert
      expect((json.components[0] as any).custom_id).toBe('roll*1d100*abc')
    })
  })

  describe('createSkillRollButtons', () => {
    it('スキルが空の場合は空配列を返す', () => {
      // Arrange
      const character = buildCharacter({ skill: {} })

      // Act & Assert
      expect(service.createSkillRollButtons(character)).toEqual([])
    })

    it('skill が undefined の場合も空配列を返す', () => {
      // Arrange
      const character = buildCharacter({ skill: undefined })

      // Act & Assert
      expect(service.createSkillRollButtons(character)).toEqual([])
    })

    it('スキル値が0以下のスキルはボタン化されない', () => {
      // Arrange
      const character = buildCharacter({ skill: { 目星: 0, 聞き耳: -5 } })

      // Act & Assert
      expect(service.createSkillRollButtons(character)).toEqual([])
    })

    it('name/value 形式のスキルから skillName(value) ラベルのボタンを生成する', () => {
      // Arrange
      const character = buildCharacter({ skill: { spot: { name: '目星', value: 70 } } })

      // Act
      const rows = service.createSkillRollButtons(character)
      const button = rows[0].toJSON().components[0] as any

      // Assert
      expect(button.label).toBe('目星(70)')
      expect(button.custom_id).toBe('roll*_目星-70*char-1')
    })

    it('6個のスキルは5個ごとに行分割され2行になる', () => {
      // Arrange: 6 個の有効スキル
      const skill: Record<string, number> = {}
      for (let i = 1; i <= 6; i++) skill[`skill${i}`] = 50
      const character = buildCharacter({ skill })

      // Act
      const rows = service.createSkillRollButtons(character)

      // Assert: 5 + 1 で 2 行
      expect(rows).toHaveLength(2)
      expect(rows[0].toJSON().components).toHaveLength(5)
      expect(rows[1].toJSON().components).toHaveLength(1)
    })
  })

  describe('createCharacterEmbed', () => {
    it('キャラクターが見つかった場合はタブに応じた Embed を返す', async () => {
      // Arrange: 検索完了イベントでキャラクターを返す
      eventService.waitForEvent.mockResolvedValue({
        character: buildCharacter({ characterId: 'found-1' })
      } as never)

      // Act
      const embed = await service.createCharacterEmbed('channel-1', 'basic')
      const json = embed!.toJSON()

      // Assert: 検索リクエストイベントを発行し、Embed にタブタイトルとIDが入る
      expect(eventService.emit).toHaveBeenCalledWith(
        'character.findByChannelId.requested',
        expect.objectContaining({ channelId: 'channel-1', tabType: 'basic' })
      )
      expect(json.title).toContain('基本情報')
      expect(json.fields).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'キャラクターID', value: 'found-1' })])
      )
    })

    it('検索結果に character が無い場合は null を返す', async () => {
      // Arrange
      eventService.waitForEvent.mockResolvedValue({} as never)

      // Act & Assert
      expect(await service.createCharacterEmbed('channel-1', 'basic')).toBeNull()
    })

    it('待機が失敗した場合は ErrorHandler 経由で HttpException を再スローする', async () => {
      // Arrange: 本体は catch 内で handleServiceError を呼び例外を再スローする
      eventService.waitForEvent.mockRejectedValue(new Error('Event timeout'))

      // Act & Assert
      await expect(service.createCharacterEmbed('channel-1', 'status')).rejects.toThrow(
        'サービス処理中にエラーが発生しました'
      )
    })

    it('status タブでは parameter 情報を含む Embed を構築する', async () => {
      // Arrange
      eventService.waitForEvent.mockResolvedValue({
        character: buildCharacter({ parameter: { STR: 13, DEX: 12 } })
      } as never)

      // Act
      const embed = await service.createCharacterEmbed('channel-1', 'status')
      const json = embed!.toJSON()

      // Assert
      expect(json.title).toContain('ステータス')
      expect(json.fields).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'STR', value: '13' })]))
    })
  })

  describe('updateCharacterEmbed', () => {
    it('Embed を構築し discord.message.embed.update イベントを発行する', async () => {
      // Arrange
      const character = buildCharacter()

      // Act
      await service.updateCharacterEmbed(character, 'channel-9', 'basic')

      // Assert
      expect(eventService.emit).toHaveBeenCalledWith(
        'discord.message.embed.update',
        expect.objectContaining({ channelId: 'channel-9', source: 'character-display-direct' })
      )
    })
  })

  describe('findExistingCharacterEmbed', () => {
    it('キャラクターIDフィールドを持つ Embed メッセージを返す', async () => {
      // Arrange: 該当 Embed を持つメッセージを含む fetch 結果
      const targetMessage = {
        embeds: [{ fields: [{ name: 'キャラクターID', value: 'char-1' }] }]
      }
      const channel = {
        messages: { fetch: jest.fn().mockResolvedValue(new Map([['m1', targetMessage]])) }
      } as never

      // Act
      const result = await service.findExistingCharacterEmbed(channel, 'char-1')

      // Assert
      expect(result).toBe(targetMessage)
    })

    it('該当する Embed が無ければ null を返す', async () => {
      // Arrange
      const channel = {
        messages: { fetch: jest.fn().mockResolvedValue(new Map()) }
      } as never

      // Act & Assert
      expect(await service.findExistingCharacterEmbed(channel, 'char-1')).toBeNull()
    })

    it('fetch が例外を投げた場合は null を返す', async () => {
      // Arrange
      const channel = {
        messages: { fetch: jest.fn().mockRejectedValue(new Error('fetch failed')) }
      } as never

      // Act & Assert
      expect(await service.findExistingCharacterEmbed(channel, 'char-1')).toBeNull()
    })
  })
})
