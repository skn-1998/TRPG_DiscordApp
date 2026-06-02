// グローバル jest-setup の discord.js モックを無効化し、
// 実際の ActionRowBuilder / ButtonBuilder / StringSelectMenuBuilder 等の挙動を検証する。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test, TestingModule } from '@nestjs/testing'
import { ThreadChannel } from 'discord.js'
import { ThreadInteractionService } from './thread-interaction.service'
import { Character } from '../../../../domains/character/models/character.model'

/**
 * Unit tests for ThreadInteractionService.
 *
 * 本サービスは DI 依存を持たず、各メソッドは discord.js の UI（ボタン/セレクトメニュー）を
 * 純ロジックで構築し、唯一の I/O である thread.send で送信する。
 * → UI 構築（customId / label / style、ゲームシステム別プリセット、行分割）を中心に検証し、
 *   thread は { send: jest.fn() } でモックして「正しい components / content / embeds 引数で
 *   呼ばれる」ことを確認する。
 *
 * components の中身は discord.js Builder の生インスタンスのため `.toJSON()` で平坦化して検証する。
 */
describe('ThreadInteractionService', () => {
  let service: ThreadInteractionService
  let module: TestingModule

  // thread.send を観測するモックスレッド
  const buildMockThread = () =>
    ({
      id: 'thread-xyz',
      send: jest.fn().mockResolvedValue({ id: 'msg-1' })
    }) as unknown as ThreadChannel

  const buildCharacter = (overrides: Partial<Character> = {}): Character =>
    ({
      characterId: 'char-123',
      characterName: 'テストキャラ',
      gameSystemId: 'coc7',
      discordUserId: 'user-1',
      discordChannelId: 'channel-1',
      skill: {},
      ...overrides
    }) as unknown as Character

  // 送信された components から全ボタンを JSON で取り出すヘルパー
  const collectButtons = (sendArg: any): Array<{ custom_id: string; label: string; style: number }> =>
    (sendArg.components ?? []).flatMap((row: any) => row.toJSON().components)

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [ThreadInteractionService]
    }).compile()

    service = module.get(ThreadInteractionService)
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await module.close()
  })

  // ==========================================================================
  // postActionButtons
  // ==========================================================================
  describe('postActionButtons', () => {
    it('編集・ダイスロール・詳細情報の3ボタンを channelId 付き customId で送信する', async () => {
      const thread = buildMockThread()

      await service.postActionButtons(thread, 'ch-42')

      const sendArg = (thread.send as jest.Mock).mock.calls[0][0]
      expect(sendArg.content).toBe('**🎮 アクション**')

      const buttons = collectButtons(sendArg)
      expect(buttons.map((b) => b.custom_id)).toEqual([
        'character_edit_ch-42',
        'dice_roll_ch-42',
        'character_info_ch-42'
      ])
      expect(buttons.map((b) => b.label)).toEqual(['キャラクター編集', 'ダイスロール', '詳細情報'])
    })

    it('thread.send が失敗した場合はエラーを再throwする', async () => {
      const thread = buildMockThread()
      ;(thread.send as jest.Mock).mockRejectedValue(new Error('boom'))

      await expect(service.postActionButtons(thread, 'ch-1')).rejects.toThrow('boom')
    })
  })

  // ==========================================================================
  // postFlexibleDiceMenu
  // ==========================================================================
  describe('postFlexibleDiceMenu', () => {
    it('discordChannelId 付き customId のセレクトメニューで6ダイスオプションを送信する', async () => {
      const thread = buildMockThread()
      const character = buildCharacter({ discordChannelId: 'ch-flex' })

      await service.postFlexibleDiceMenu(thread, character)

      const sendArg = (thread.send as jest.Mock).mock.calls[0][0]
      expect(sendArg.content).toContain('🎲 フレキシブルダイス')

      const menu = sendArg.components[0].toJSON().components[0]
      expect(menu.custom_id).toBe('flexible_dice_ch-flex')
      expect(menu.placeholder).toBe('ダイスタイプを選択してください')
      expect(menu.options.map((o: any) => o.value)).toEqual(['1d6', '2d6', '1d10', '1d20', '1d100', 'custom_dice'])
    })

    it('thread.send が失敗した場合はエラーを再throwする', async () => {
      const thread = buildMockThread()
      ;(thread.send as jest.Mock).mockRejectedValue(new Error('boom'))

      await expect(service.postFlexibleDiceMenu(thread, buildCharacter())).rejects.toThrow('boom')
    })
  })

  // ==========================================================================
  // postPresetDiceButtons - ゲームシステム別プリセット
  // ==========================================================================
  describe('postPresetDiceButtons', () => {
    it('coc7: CoC7用5ボタン（技能判定/SAN値判定/アイデア/幸運/ダメージ）を送信する', async () => {
      const thread = buildMockThread()
      const character = buildCharacter({ gameSystemId: 'coc7', discordChannelId: 'ch-coc' })

      await service.postPresetDiceButtons(thread, character)

      const sendArg = (thread.send as jest.Mock).mock.calls[0][0]
      expect(sendArg.content).toContain('プリセットダイス')

      const buttons = collectButtons(sendArg)
      expect(buttons.map((b) => b.custom_id)).toEqual([
        'dice_coc7_1d100_ch-coc',
        'dice_coc7_sanity_ch-coc',
        'dice_coc7_idea_ch-coc',
        'dice_coc7_luck_ch-coc',
        'dice_coc7_damage_ch-coc'
      ])
      expect(buttons.map((b) => b.label)).toEqual(['技能判定', 'SAN値判定', 'アイデア', '幸運', 'ダメージ'])
    })

    it('call_of_cthulhu エイリアスも coc7 と同じプリセットになる', async () => {
      const thread = buildMockThread()
      const character = buildCharacter({ gameSystemId: 'call_of_cthulhu', discordChannelId: 'ch-coc' })

      await service.postPresetDiceButtons(thread, character)

      const buttons = collectButtons((thread.send as jest.Mock).mock.calls[0][0])
      expect(buttons[0].custom_id).toBe('dice_coc7_1d100_ch-coc')
    })

    it('dnd5e: D&D5e用4ボタンを送信する', async () => {
      const thread = buildMockThread()
      const character = buildCharacter({ gameSystemId: 'dnd5e', discordChannelId: 'ch-dnd' })

      await service.postPresetDiceButtons(thread, character)

      const buttons = collectButtons((thread.send as jest.Mock).mock.calls[0][0])
      expect(buttons.map((b) => b.custom_id)).toEqual([
        'dice_dnd5e_1d20_ch-dnd',
        'dice_dnd5e_save_ch-dnd',
        'dice_dnd5e_ability_ch-dnd',
        'dice_dnd5e_damage_ch-dnd'
      ])
    })

    it('sw2.5: ソード・ワールド2.5用4ボタンを送信する', async () => {
      const thread = buildMockThread()
      const character = buildCharacter({ gameSystemId: 'sw2.5', discordChannelId: 'ch-sw' })

      await service.postPresetDiceButtons(thread, character)

      const buttons = collectButtons((thread.send as jest.Mock).mock.calls[0][0])
      expect(buttons.map((b) => b.custom_id)).toEqual([
        'dice_sw25_2d6_ch-sw',
        'dice_sw25_attack_ch-sw',
        'dice_sw25_damage_ch-sw',
        'dice_sw25_magic_ch-sw'
      ])
    })

    it('未知のゲームシステムは汎用ボタン（1d6/2d6/1d20/1d100）を送信する', async () => {
      const thread = buildMockThread()
      const character = buildCharacter({ gameSystemId: 'unknown_system', discordChannelId: 'ch-g' })

      await service.postPresetDiceButtons(thread, character)

      const buttons = collectButtons((thread.send as jest.Mock).mock.calls[0][0])
      expect(buttons.map((b) => b.custom_id)).toEqual([
        'dice_generic_1d6_ch-g',
        'dice_generic_2d6_ch-g',
        'dice_generic_1d20_ch-g',
        'dice_generic_1d100_ch-g'
      ])
    })

    it('gameSystemId 未設定（undefined）でも generic にフォールバックする', async () => {
      const thread = buildMockThread()
      const character = buildCharacter({ gameSystemId: undefined as any, discordChannelId: 'ch-g' })

      await service.postPresetDiceButtons(thread, character)

      const buttons = collectButtons((thread.send as jest.Mock).mock.calls[0][0])
      expect(buttons[0].custom_id).toBe('dice_generic_1d6_ch-g')
    })

    it('gameSystemId は大文字小文字を区別せず判定する（COC7 → coc7プリセット）', async () => {
      const thread = buildMockThread()
      const character = buildCharacter({ gameSystemId: 'COC7', discordChannelId: 'ch-coc' })

      await service.postPresetDiceButtons(thread, character)

      const buttons = collectButtons((thread.send as jest.Mock).mock.calls[0][0])
      expect(buttons[0].custom_id).toBe('dice_coc7_1d100_ch-coc')
    })

    it('discordChannelId が無い場合は customId に characterId を用いる', async () => {
      const thread = buildMockThread()
      const character = buildCharacter({
        gameSystemId: 'coc7',
        discordChannelId: undefined as any,
        characterId: 'char-fallback'
      })

      await service.postPresetDiceButtons(thread, character)

      const buttons = collectButtons((thread.send as jest.Mock).mock.calls[0][0])
      expect(buttons[0].custom_id).toBe('dice_coc7_1d100_char-fallback')
    })

    it('thread.send が失敗した場合はエラーを再throwする', async () => {
      const thread = buildMockThread()
      ;(thread.send as jest.Mock).mockRejectedValue(new Error('boom'))

      await expect(service.postPresetDiceButtons(thread, buildCharacter())).rejects.toThrow('boom')
    })
  })

  // ==========================================================================
  // postSkillRollButtons
  // ==========================================================================
  describe('postSkillRollButtons', () => {
    it('スキルが無い場合は何も送信しない', async () => {
      const thread = buildMockThread()
      const character = buildCharacter({ skill: {} })

      await service.postSkillRollButtons(thread, character)

      expect(thread.send).not.toHaveBeenCalled()
    })

    it('skill が undefined の場合も何も送信しない', async () => {
      const thread = buildMockThread()
      const character = buildCharacter({ skill: undefined })

      await service.postSkillRollButtons(thread, character)

      expect(thread.send).not.toHaveBeenCalled()
    })

    it('各スキルを customId に skillKey を含むボタンで送信する', async () => {
      const thread = buildMockThread()
      const character = buildCharacter({
        discordChannelId: 'ch-skill',
        skill: {
          dodge: { name: '回避', values: { level: 40 } } as any
        }
      })

      await service.postSkillRollButtons(thread, character)

      const sendArg = (thread.send as jest.Mock).mock.calls[0][0]
      expect(sendArg.content).toContain('スキルロール')

      const buttons = collectButtons(sendArg)
      expect(buttons[0].custom_id).toBe('skill_ch-skill_dodge')
      // name + extractSkillLevel(values.level) がラベルに反映される
      expect(buttons[0].label).toBe('回避 (40)')
    })

    it('name が無いスキルは skillKey をラベルに使う', async () => {
      const thread = buildMockThread()
      const character = buildCharacter({
        skill: { stealth: 60 as any }
      })

      await service.postSkillRollButtons(thread, character)

      const buttons = collectButtons((thread.send as jest.Mock).mock.calls[0][0])
      // 数値スキル → name 無し、extractSkillLevel(number)=60
      expect(buttons[0].label).toBe('stealth (60)')
    })

    it('レベルが抽出できないスキルはラベルに括弧を付けない', async () => {
      const thread = buildMockThread()
      const character = buildCharacter({
        skill: { listen: { name: '聞き耳' } as any }
      })

      await service.postSkillRollButtons(thread, character)

      const buttons = collectButtons((thread.send as jest.Mock).mock.calls[0][0])
      expect(buttons[0].label).toBe('聞き耳')
    })

    it('スキルは最大20個まで、5個ずつの行に分割される', async () => {
      const thread = buildMockThread()
      const skill: Record<string, any> = {}
      for (let i = 0; i < 25; i++) {
        skill[`skill${i}`] = { name: `スキル${i}` }
      }
      const character = buildCharacter({ skill })

      await service.postSkillRollButtons(thread, character)

      const sendArg = (thread.send as jest.Mock).mock.calls[0][0]
      // 20個 → 5個ずつ4行
      expect(sendArg.components).toHaveLength(4)
      const buttons = collectButtons(sendArg)
      expect(buttons).toHaveLength(20)
    })

    it('thread.send が失敗した場合はエラーを再throwする', async () => {
      const thread = buildMockThread()
      ;(thread.send as jest.Mock).mockRejectedValue(new Error('boom'))
      const character = buildCharacter({ skill: { dodge: { name: '回避' } as any } })

      await expect(service.postSkillRollButtons(thread, character)).rejects.toThrow('boom')
    })
  })

  // ==========================================================================
  // extractSkillLevel の分岐（postSkillRollButtons 経由で観測）
  // ==========================================================================
  describe('スキルレベル抽出（ラベル経由で検証）', () => {
    const labelFor = async (skillValue: any): Promise<string> => {
      const thread = buildMockThread()
      const character = buildCharacter({ skill: { s: skillValue } })
      await service.postSkillRollButtons(thread, character)
      return collectButtons((thread.send as jest.Mock).mock.calls[0][0])[0].label
    }

    it('values.level を優先して採用する', async () => {
      expect(await labelFor({ name: 'A', values: { level: 70, value: 10 } })).toBe('A (70)')
    })

    it('values.level が無ければ values.value を採用する', async () => {
      expect(await labelFor({ name: 'A', values: { value: 55 } })).toBe('A (55)')
    })

    it('values.value も無ければ values.base を採用する', async () => {
      expect(await labelFor({ name: 'A', values: { base: 30 } })).toBe('A (30)')
    })

    it('数値スキルはその値をレベルにする', async () => {
      expect(await labelFor(45)).toBe('s (45)')
    })

    it('文字列スキルは最初の数字を抽出する', async () => {
      expect(await labelFor('技能75%')).toBe('s (75)')
    })

    it('数字を含まない文字列はレベル無しになる', async () => {
      expect(await labelFor('なし')).toBe('s')
    })
  })
})
