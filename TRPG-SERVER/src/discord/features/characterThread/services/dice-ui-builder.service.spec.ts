// グローバル jest-setup の discord.js モックを無効化し、
// 実際の ActionRowBuilder / ButtonBuilder / ButtonStyle の挙動を使う。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test, TestingModule } from '@nestjs/testing'
import { ButtonStyle } from 'discord.js'
import { DiceUIBuilderService } from './dice-ui-builder.service'
import { Character } from 'src/domains/character/models/character.model'
import { AttributeSection, AttributeValue } from 'src/core/types/attribute.types'

/**
 * Characterization / unit tests for DiceUIBuilderService.
 *
 * 目的: character.skill / parameter から Button / ActionRow を構築する純ロジックを固定する。
 * DI なし・Logger のみなので Test.createTestingModule で素直に実体化し、
 * 実 discord.js Builder を toJSON()/.data で検証する。
 */
describe('DiceUIBuilderService', () => {
  let service: DiceUIBuilderService
  let module: TestingModule

  /** 表示値 n を持つ AttributeValue を作る（getDisplayNumber は values の number 合算） */
  const attr = (n: number): AttributeValue => ({ values: { base: n } })

  /** skill/parameter セクションを {名前: 値} から作る */
  const section = (entries: Record<string, number>): AttributeSection =>
    Object.fromEntries(Object.entries(entries).map(([name, value]) => [name, attr(value)]))

  const buildCharacter = (overrides: Partial<Character> = {}): Character =>
    ({
      characterId: 'char-1',
      characterName: 'テスト太郎',
      discordUserId: 'user-1',
      ...overrides
    }) as unknown as Character

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [DiceUIBuilderService]
    }).compile()

    service = module.get<DiceUIBuilderService>(DiceUIBuilderService)
  })

  afterEach(async () => {
    await module.close()
  })

  describe('createGeneralDiceButtons (via createDiceButtons)', () => {
    it('一般ダイスロールは固定5件（1D100/1D20/1D6/2D6/カスタム）を Danger で生成する', async () => {
      const sends: any[] = []
      const thread = { send: jest.fn(async (payload: any) => sends.push(payload)) } as any

      await service.createDiceButtons(thread, buildCharacter())

      // 3メッセージ送信（技能/能力値/ダイス）の3番目がダイスロール行
      expect(thread.send).toHaveBeenCalledTimes(3)
      const diceMessage = sends[2]
      expect(diceMessage.content).toBe('**ダイスロール**')
      const row = diceMessage.components[0].toJSON()
      expect(row.components).toHaveLength(5)
      expect(row.components.map((c: any) => c.custom_id)).toEqual([
        'roll*1d100',
        'roll*1d20',
        'roll*1d6',
        'roll*2d6',
        'roll*custom'
      ])
      expect(row.components.map((c: any) => c.label)).toEqual(['1D100', '1D20', '1D6', '2D6', 'カスタム'])
      expect(row.components.every((c: any) => c.style === ButtonStyle.Danger)).toBe(true)
    })

    it('discordUserId が無い場合は何も送信しない', async () => {
      const thread = { send: jest.fn() } as any

      await service.createDiceButtons(thread, buildCharacter({ discordUserId: undefined as any }))

      expect(thread.send).not.toHaveBeenCalled()
    })

    it('thread.send が失敗した場合はエラーメッセージ送信後に再throwする', async () => {
      const error = new Error('send failed')
      const thread = { send: jest.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined) } as any

      await expect(service.createDiceButtons(thread, buildCharacter())).rejects.toThrow('send failed')
      // 最後の send はエラー通知
      expect(thread.send).toHaveBeenLastCalledWith({ content: 'ダイスボタンの作成中にエラーが発生しました' })
    })
  })

  describe('createDiceButtons - スキル/能力値ボタン', () => {
    it('技能ロールは値の大きい順・上位5件を Secondary で生成する', async () => {
      const sends: any[] = []
      const thread = { send: jest.fn(async (payload: any) => sends.push(payload)) } as any
      const character = buildCharacter({
        skill: section({ 目星: 60, 聞き耳: 80, 図書館: 40, 回避: 70, 応急手当: 30, 説得: 50 })
      })

      await service.createDiceButtons(thread, character)

      const skillRow = sends[0].components[0].toJSON()
      expect(sends[0].content).toBe('**技能ロール**')
      // 上位5件（80,70,60,50,40）。30はみ出し
      expect(skillRow.components.map((c: any) => c.label)).toEqual([
        '聞き耳(80%)',
        '回避(70%)',
        '目星(60%)',
        '説得(50%)',
        '図書館(40%)'
      ])
      expect((skillRow.components[0] as any).custom_id).toBe('roll*_聞き耳-80')
      expect(skillRow.components.every((c: any) => c.style === ButtonStyle.Secondary)).toBe(true)
    })

    it('能力値ロールは値の大きい順・上位5件を Success で生成する', async () => {
      const sends: any[] = []
      const thread = { send: jest.fn(async (payload: any) => sends.push(payload)) } as any
      const character = buildCharacter({
        parameter: section({ STR: 13, DEX: 15, INT: 11, POW: 14, CON: 12, SIZ: 10 })
      })

      await service.createDiceButtons(thread, character)

      const abilityRow = sends[1].components[0].toJSON()
      expect(sends[1].content).toBe('**能力値ロール**')
      expect(abilityRow.components.map((c: any) => c.label)).toEqual([
        'DEX(15)',
        'POW(14)',
        'STR(13)',
        'CON(12)',
        'INT(11)'
      ])
      expect((abilityRow.components[0] as any).custom_id).toBe('roll*_DEX-15')
      expect(abilityRow.components.every((c: any) => c.style === ButtonStyle.Success)).toBe(true)
    })

    it('skill/parameter が空なら技能・能力値行はボタン0件で生成する', async () => {
      const sends: any[] = []
      const thread = { send: jest.fn(async (payload: any) => sends.push(payload)) } as any

      await service.createDiceButtons(thread, buildCharacter())

      expect(sends[0].components[0].toJSON().components).toHaveLength(0)
      expect(sends[1].components[0].toJSON().components).toHaveLength(0)
    })
  })

  describe('createCustomDiceButtons', () => {
    it('指定した customId/label でボタンを生成し、style 未指定は Secondary になる', () => {
      const row = service
        .createCustomDiceButtons([
          { label: '攻撃', customId: 'roll*atk' },
          { label: '回復', customId: 'roll*heal', style: ButtonStyle.Success }
        ])
        .toJSON()

      expect(row.components).toHaveLength(2)
      expect(row.components[0]).toMatchObject({
        custom_id: 'roll*atk',
        label: '攻撃',
        style: ButtonStyle.Secondary
      })
      expect(row.components[1]).toMatchObject({
        custom_id: 'roll*heal',
        label: '回復',
        style: ButtonStyle.Success
      })
    })

    it('空配列ならボタン0件の行を返す', () => {
      const row = service.createCustomDiceButtons([]).toJSON()
      expect(row.components).toHaveLength(0)
    })
  })

  describe('createSkillSelectionButtons', () => {
    it('skill が無い/空なら空配列を返す', () => {
      expect(service.createSkillSelectionButtons(buildCharacter())).toEqual([])
      expect(service.createSkillSelectionButtons(buildCharacter({ skill: {} }))).toEqual([])
    })

    it('6件のスキルは 5件 + 1件の2行に分割される', () => {
      const character = buildCharacter({
        skill: section({ a: 10, b: 20, c: 30, d: 40, e: 50, f: 60 })
      })

      const rows = service.createSkillSelectionButtons(character)

      expect(rows).toHaveLength(2)
      expect(rows[0].toJSON().components).toHaveLength(5)
      expect(rows[1].toJSON().components).toHaveLength(1)
      // 値の大きい順ソート → 1行目先頭は最大値
      const firstButton = rows[0].toJSON().components[0] as any
      expect(firstButton.custom_id).toBe('skill_select_f_60')
      expect(firstButton.label).toBe('f(60)')
      expect(firstButton.style).toBe(ButtonStyle.Primary)
    })

    it('Discord制限により最大25件（5行）までに制限される', () => {
      const entries: Record<string, number> = {}
      for (let i = 0; i < 30; i++) entries[`s${i}`] = i
      const character = buildCharacter({ skill: section(entries) })

      const rows = service.createSkillSelectionButtons(character)

      expect(rows).toHaveLength(5)
      const total = rows.reduce((sum, r) => sum + r.toJSON().components.length, 0)
      expect(total).toBe(25)
    })
  })

  describe('parseDiceButtonCustomId', () => {
    it('roll*_ プレフィックスかつ数字を含む名前は ability として解析する', () => {
      expect(service.parseDiceButtonCustomId('roll*_DEX15-15')).toEqual({
        type: 'ability',
        name: 'DEX15',
        value: 15
      })
    })

    it('roll*_ プレフィックスで数字を含まない名前は skill として解析する', () => {
      expect(service.parseDiceButtonCustomId('roll*_目星-60')).toEqual({
        type: 'skill',
        name: '目星',
        value: 60
      })
    })

    it('値部分が数値でない場合は value=0 になる', () => {
      expect(service.parseDiceButtonCustomId('roll*_目星-')).toEqual({
        type: 'skill',
        name: '目星',
        value: 0
      })
    })

    it('roll*custom は custom type として解析する', () => {
      expect(service.parseDiceButtonCustomId('roll*custom')).toEqual({
        type: 'custom',
        diceExpression: 'custom'
      })
    })

    it('roll*1d100 は general type として解析する', () => {
      expect(service.parseDiceButtonCustomId('roll*1d100')).toEqual({
        type: 'general',
        diceExpression: '1d100'
      })
    })

    it('未知のプレフィックスは general を返す', () => {
      expect(service.parseDiceButtonCustomId('unknown')).toEqual({ type: 'general' })
    })
  })

  describe('getButtonStats', () => {
    it('skill/parameter の件数は5件で頭打ち、一般ボタンは固定5件', () => {
      const character = buildCharacter({
        skill: section({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }),
        parameter: section({ x: 1, y: 2 })
      })

      expect(service.getButtonStats(character)).toEqual({
        skillButtonCount: 5,
        abilityButtonCount: 2,
        totalButtons: 12
      })
    })

    it('skill/parameter が無ければ 0/0、一般ボタン5件のみ', () => {
      expect(service.getButtonStats(buildCharacter())).toEqual({
        skillButtonCount: 0,
        abilityButtonCount: 0,
        totalButtons: 5
      })
    })
  })
})
