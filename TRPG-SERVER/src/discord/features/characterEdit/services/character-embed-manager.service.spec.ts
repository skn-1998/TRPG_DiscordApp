// グローバル jest-setup の discord.js モックを無効化し、
// 実際の EmbedBuilder / StringSelectMenuBuilder 挙動（.toJSON() 等）を検証する。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test, TestingModule } from '@nestjs/testing'
import { CharacterEmbedManagerService, EmbedSectionType } from './character-embed-manager.service'
import { TypedEventService } from 'src/core/events/typed-event.service'
import { Character } from 'src/domains/character/models/character.model'
import { AttributeSection } from 'src/core/types/attribute.types'

/**
 * Characterization tests for CharacterEmbedManagerService.
 *
 * 目的: 分割リファクタ前の embed 生成挙動（タイトル / フィールド名 / 値 / 個数 /
 * 24件超の分割挙動 等）を「現状のまま」固定する安全網。
 * 内部実装には密結合せず、公開メソッドの出力（EmbedBuilder.toJSON() 等）を検証する。
 */
describe('CharacterEmbedManagerService (characterization)', () => {
  let service: CharacterEmbedManagerService
  let module: TestingModule

  const mockTypedEventService = {
    emit: jest.fn(),
    waitForEvent: jest.fn()
  }

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        CharacterEmbedManagerService,
        {
          provide: TypedEventService,
          useValue: mockTypedEventService
        }
      ]
    }).compile()

    service = module.get<CharacterEmbedManagerService>(CharacterEmbedManagerService)
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await module.close()
  })

  /** 各セクションに代表的な AttributeValue を持つ character を生成 */
  const buildCharacter = (overrides: Partial<Character> = {}): Character => {
    const section = (): AttributeSection => ({
      力: {
        name: 'STR',
        values: { base: 10, buff: 5, other: 0 },
        dice: '1d100',
        description: '筋力'
      },
      器用: {
        values: { base: 8 }
      }
    })

    return {
      characterId: 'char-1234',
      characterName: 'テスト太郎',
      gameSystemId: 'cthulhu',
      discordUserId: 'user-999',
      discordChannelId: 'channel-1',
      status: section(),
      parameter: section(),
      skill: section(),
      item: section(),
      ...overrides
    } as Character
  }

  describe('createSectionedEmbeds', () => {
    it('5つのembed（基本/ステータス/パラメータ/スキル/アイテム）を順番通りに生成する', async () => {
      const character = buildCharacter()
      const { embeds, components } = await service.createSectionedEmbeds(character)

      expect(embeds).toHaveLength(5)
      const titles = embeds.map((e) => e.toJSON().title)
      expect(titles).toEqual([
        '🏷️ テスト太郎 - 基本情報',
        '📊 テスト太郎 - ステータス',
        '⚙️ テスト太郎 - パラメータ',
        '⚔️ テスト太郎 - スキル',
        '🎒 テスト太郎 - アイテム'
      ])

      // components: セクション選択メニュー行 + 操作ボタン行（ダイスロールボタンは現状空）
      expect(components).toHaveLength(2)
    })

    it('基本情報embedは色・ゲームシステム・ID・プレイヤーを含む', async () => {
      const character = buildCharacter()
      const { embeds } = await service.createSectionedEmbeds(character)
      const basic = embeds[0].toJSON()

      expect(basic.color).toBe(0x3498db)
      expect(basic.fields).toEqual([
        { name: '🎲 ゲームシステム', value: 'cthulhu', inline: true },
        { name: '🆔 キャラクターID', value: 'char-1234', inline: true },
        { name: '👤 プレイヤー', value: '<@user-999>', inline: true }
      ])
    })

    it('gameSystemId が無い場合、基本情報のゲームシステムフィールドを省く', async () => {
      const character = buildCharacter({ gameSystemId: '' })
      const { embeds } = await service.createSectionedEmbeds(character)
      const basic = embeds[0].toJSON()

      expect(basic.fields).toEqual([
        { name: '🆔 キャラクターID', value: 'char-1234', inline: true },
        { name: '👤 プレイヤー', value: '<@user-999>', inline: true }
      ])
    })

    it('ステータスembedは AttributeValue を合計・内訳・ダイス・説明付きで整形する', async () => {
      const character = buildCharacter()
      const { embeds } = await service.createSectionedEmbeds(character)
      const status = embeds[1].toJSON()

      expect(status.color).toBe(0xe74c3c)
      expect(status.fields).toEqual([
        {
          name: 'STR',
          value: '**合計:** 15\n(base: +10, buff: +5)\n🎲 **ダイス:** 1d100\n💬 筋力',
          inline: true
        },
        {
          name: '器用',
          value: '**合計:** 8\n(base: +8)',
          inline: true
        }
      ])
    })

    it('セクションが空の場合は説明文を出す（フィールドなし）', async () => {
      const character = buildCharacter({ status: {}, skill: {}, parameter: {}, item: {} })
      const { embeds } = await service.createSectionedEmbeds(character)

      expect(embeds[1].toJSON().description).toBe('ステータス情報がありません。\n編集ボタンから追加してください。')
      expect(embeds[1].toJSON().fields ?? []).toHaveLength(0)
      expect(embeds[2].toJSON().description).toBe('パラメータ情報がありません。\n編集ボタンから追加してください。')
      expect(embeds[3].toJSON().description).toBe('スキル情報がありません。\n編集ボタンから追加してください。')
      expect(embeds[4].toJSON().description).toBe('アイテム情報がありません。\n編集ボタンから追加してください。')
    })

    it('フィールドが24件を超える場合、24件に切り詰めて footer で省略数を示す', async () => {
      const bigSection: AttributeSection = {}
      for (let i = 0; i < 30; i++) {
        bigSection[`attr${i}`] = { values: { base: i + 1 } }
      }
      const character = buildCharacter({ status: bigSection })
      const { embeds } = await service.createSectionedEmbeds(character)
      const status = embeds[1].toJSON()

      expect(status.fields).toHaveLength(24)
      expect(status.footer?.text).toBe('6個のステータスが省略されています')
    })
  })

  describe('createFieldSelectMenu', () => {
    it('データがある場合、追加オプション + 既存フィールドの編集オプションを返す', () => {
      const character = buildCharacter()
      const menu = service.createFieldSelectMenu(character, 'status', character.characterId)

      expect(menu).not.toBeNull()
      const data = menu!.toJSON()
      expect(data.custom_id).toBe('character-field-edit-status-char-1234')
      expect(data.placeholder).toBe('編集するステータスを選択')
      // 追加オプション + 2件の既存フィールド
      expect(data.options).toHaveLength(3)
      expect(data.options[0]).toMatchObject({ label: '➕ 新しいステータスを追加', value: 'add_new' })
      expect(data.options[1]).toMatchObject({
        label: '✏️ STR',
        value: '力',
        description: '合計: 15 | ダイス: 1d100 | 筋力'
      })
      expect(data.options[2]).toMatchObject({ label: '✏️ 器用', value: '器用', description: '合計: 8' })
    })

    it('データが空の場合、追加専用メニューを返す', () => {
      const character = buildCharacter({ status: {} })
      const menu = service.createFieldSelectMenu(character, 'status', character.characterId)

      const data = menu!.toJSON()
      expect(data.custom_id).toBe('character-field-add-status-char-1234')
      expect(data.placeholder).toBe('ステータスを追加')
      expect(data.options).toHaveLength(1)
      expect(data.options[0]).toMatchObject({ label: '➕ 新しいステータスを追加', value: 'add_new' })
    })

    it('未知のセクションタイプは null を返す', () => {
      const character = buildCharacter()
      const menu = service.createFieldSelectMenu(character, 'basic' as EmbedSectionType, character.characterId)
      expect(menu).toBeNull()
    })
  })

  describe('createNewCharacterEmbed', () => {
    it('作成案内embedと作成/キャンセルボタンを生成する', () => {
      const { embeds, components } = service.createNewCharacterEmbed('channel-1', 'user-999')

      expect(embeds).toHaveLength(1)
      const embed = embeds[0].toJSON()
      expect(embed.title).toBe('🆕 新しいキャラクターを作成')
      expect(embed.color).toBe(0x2ecc71)
      expect(embed.fields).toHaveLength(1)
      expect(embed.fields![0].name).toBe('📝 作成手順')

      expect(components).toHaveLength(1)
      const row = components[0].toJSON() as { components: { custom_id: string; label: string }[] }
      expect(row.components[0]).toMatchObject({
        custom_id: 'character-create-basic-channel-1-user-999',
        label: '📝 基本情報入力'
      })
      expect(row.components[1]).toMatchObject({
        custom_id: 'character-create-cancel-channel-1-user-999',
        label: '❌ キャンセル'
      })
    })
  })

  describe('createCharacterCreatedEmbed', () => {
    it('作成完了embedを生成する', () => {
      const character = buildCharacter()
      const embed = service.createCharacterCreatedEmbed(character).toJSON()

      expect(embed.title).toBe('✅ キャラクター作成完了')
      expect(embed.color).toBe(0x27ae60)
      expect(embed.fields).toEqual([
        { name: '🎲 ゲームシステム', value: 'cthulhu', inline: true },
        { name: '🆔 キャラクターID', value: 'char-1234', inline: true },
        { name: '👤 作成者', value: '<@user-999>', inline: true }
      ])
    })

    it('gameSystemId が空でも「未設定」で生成する', () => {
      const character = buildCharacter({ gameSystemId: '' })
      const embed = service.createCharacterCreatedEmbed(character).toJSON()
      expect(embed.fields![0]).toEqual({ name: '🎲 ゲームシステム', value: '未設定', inline: true })
    })
  })
})
