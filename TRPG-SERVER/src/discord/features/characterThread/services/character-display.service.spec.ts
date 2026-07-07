// 本サービスは EmbedBuilder / ButtonBuilder / ActionRowBuilder を実 new するため、
// グローバル jest-setup の discord.js モックを無効化し実挙動を使う。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test } from '@nestjs/testing'
import { CharacterDisplayService } from './character-display.service'
import { CharacterService } from '../../../../domains/character/character.service'

/**
 * CharacterDisplayService はチャンネルIDからキャラクターを検索し Embed を構築する統合サービス。
 * CharacterService（検索の DI 直呼び・E-2a）のみを注入する。
 * E-6c: TypedEventService 注入とゴースト購読（旧 display.requested 契約）を撤去済み。
 * イベントバス非依存になったこと自体が旧イベント RPC（E-2a）への回帰ガードとなる。
 * 純ロジック（isValidTabType / buildCharacterEmbed）を
 * 最優先で実 discord.js により検証し、createCharacterEmbed は CharacterService.findByChannelId を
 * mock で固定して分岐を見る。
 */
describe('CharacterDisplayService', () => {
  let service: CharacterDisplayService
  let characterService: jest.Mocked<Pick<CharacterService, 'findByChannelId'>>

  const buildCharacter = (overrides: Record<string, unknown> = {}) =>
    ({
      characterId: 'char-1',
      characterName: 'テスト探索者',
      gameSystemId: 'coc7',
      ...overrides
    }) as never

  beforeEach(async () => {
    characterService = {
      findByChannelId: jest.fn()
    }

    const moduleRef = await Test.createTestingModule({
      providers: [CharacterDisplayService, { provide: CharacterService, useValue: characterService }]
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

  describe('createCharacterEmbed', () => {
    it('キャラクターが見つかった場合はタブに応じた Embed を返す', async () => {
      // Arrange: CharacterService の直呼びでキャラクターを返す（E-2a: イベント RPC 廃止）
      characterService.findByChannelId.mockResolvedValue(buildCharacter({ characterId: 'found-1' }))

      // Act
      const embed = await service.createCharacterEmbed('channel-1', 'basic')
      const json = embed!.toJSON()

      // Assert: channelId で検索し、Embed にタブタイトルとIDが入る
      expect(characterService.findByChannelId).toHaveBeenCalledWith('channel-1')
      expect(json.title).toContain('基本情報')
      expect(json.fields).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'キャラクターID', value: 'found-1' })])
      )
      // E-2a の回帰ガード（旧イベント RPC への逆行防止）は、E-6c で TypedEventService の
      // 注入自体を撤去したことで DI レベルで保証される（emit/waitForEvent アサーションは不要化）
    })

    it('findByChannelId が null を返す場合は null を返す', async () => {
      // Arrange
      characterService.findByChannelId.mockResolvedValue(null)

      // Act & Assert
      expect(await service.createCharacterEmbed('channel-1', 'basic')).toBeNull()
    })

    it('検索が失敗した場合は ErrorHandler 経由で HttpException を再スローする', async () => {
      // Arrange: 本体は catch 内で handleServiceError を呼び例外を再スローする
      characterService.findByChannelId.mockRejectedValue(new Error('DB error'))

      // Act & Assert
      await expect(service.createCharacterEmbed('channel-1', 'status')).rejects.toThrow(
        'サービス処理中にエラーが発生しました'
      )
    })

    it('status タブでは parameter 情報を含む Embed を構築する', async () => {
      // Arrange
      characterService.findByChannelId.mockResolvedValue(buildCharacter({ parameter: { STR: 13, DEX: 12 } }))

      // Act
      const embed = await service.createCharacterEmbed('channel-1', 'status')
      const json = embed!.toJSON()

      // Assert
      expect(json.title).toContain('ステータス')
      expect(json.fields).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'STR', value: '13' })]))
    })
  })

  describe('updateCharacterEmbed', () => {
    it('Embed を構築して例外なく完了する（E-3d/E-6c: イベント発行なし・バス非依存）', async () => {
      // Arrange
      const character = buildCharacter()

      // Act & Assert: 例外なく完了する（emit しないことは TypedEventService 非注入で DI レベル保証）
      await expect(service.updateCharacterEmbed(character, 'channel-9', 'basic')).resolves.toBeUndefined()
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
