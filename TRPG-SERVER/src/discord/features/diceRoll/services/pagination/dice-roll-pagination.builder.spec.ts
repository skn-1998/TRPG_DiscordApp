// グローバル jest-setup の discord.js スタブモックを無効化し、
// 実際の EmbedBuilder / ButtonBuilder / StringSelectMenuBuilder 挙動（.data / .toJSON()）を検証する。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { ButtonStyle } from 'discord.js'
import { Character } from 'src/domains/character/models/character.model'
import { DiceRollText } from 'src/domains/dice-roll/models/dice-roll-text.model'
import {
  PAGE_LIMIT,
  buildCharacterSelectRow,
  buildHistoryPages,
  buildPageButtonRow,
  buildPageSelectRow,
  createEmptyEmbed,
  setPageFooters
} from './dice-roll-pagination.builder'

const makeRoll = (overrides: Partial<DiceRollText> = {}): DiceRollText =>
  ({
    characterId: 'char-1',
    text: '1d100 → 50',
    result: 50,
    diceRoll: '1d100',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    ...overrides
  }) as DiceRollText

const makeCharacter = (overrides: Partial<Character> = {}): Character =>
  ({
    characterId: 'char-1',
    characterName: '探索者A',
    ...overrides
  }) as Character

describe('dice-roll-pagination.builder', () => {
  describe('createEmptyEmbed', () => {
    it('タイトル・色・説明・タイムスタンプを持つ Embed を作成する', () => {
      const embed = createEmptyEmbed('カスタムタイトル')

      expect(embed.data.title).toBe('カスタムタイトル')
      expect(embed.data.color).toBe(0xff6b6b)
      expect(embed.data.description).toBe('ダイスロール履歴がありません。')
      expect(embed.data.timestamp).toBeDefined()
    })
  })

  describe('buildHistoryPages', () => {
    it('空のロール配列では空配列を返す', () => {
      const pages = buildHistoryPages([], undefined, null)

      expect(pages).toEqual([])
    })

    it('1 件のロールから 1 ページを作成しタイトルを設定する', () => {
      const rolls = [makeRoll({ text: 'テストロール' })]

      const pages = buildHistoryPages(rolls, undefined, null)

      expect(pages).toHaveLength(1)
      expect(pages[0].data.title).toBe('ダイスロール履歴')
      expect(pages[0].data.color).toBe(0x0099ff)
      expect(pages[0].data.description).toContain('テストロール')
    })

    it('特定キャラクター指定時はキャラクター名をタイトルに使う', () => {
      const rolls = [makeRoll()]
      const characters = [makeCharacter({ characterId: 'char-1', characterName: '探索者A' })]

      const pages = buildHistoryPages(rolls, 'char-1', characters)

      expect(pages[0].data.title).toBe('探索者Aのダイスロール履歴')
    })

    it('PAGE_LIMIT を超える場合は複数ページに分割する', () => {
      // 各ロールが十分に長くなるよう text を作り、合計が PAGE_LIMIT を確実に超えるようにする
      const longText = 'x'.repeat(200)
      const rolls = [makeRoll({ text: longText }), makeRoll({ text: longText }), makeRoll({ text: longText })]

      const pages = buildHistoryPages(rolls, undefined, null)

      // 200*3 = 600(+装飾) > PAGE_LIMIT(500) なので 2 ページ以上に分割される
      expect(pages.length).toBeGreaterThanOrEqual(2)
      // 各ページの description は PAGE_LIMIT 内に概ね収まる単位で分割されている
      pages.forEach((page) => {
        expect(page.data.description).toBeTruthy()
      })
    })

    it('PAGE_LIMIT を定数として 500 を公開している', () => {
      expect(PAGE_LIMIT).toBe(500)
    })
  })

  describe('setPageFooters', () => {
    it('各ページにページ番号フッターを設定する', () => {
      const pages = buildHistoryPages(
        [makeRoll({ text: 'x'.repeat(300) }), makeRoll({ text: 'y'.repeat(300) })],
        undefined,
        null
      )

      const result = setPageFooters(pages)

      expect(result).toHaveLength(pages.length)
      result.forEach((page, index) => {
        expect(page.data.footer?.text).toBe(`ページ ${index + 1}/${pages.length}`)
      })
    })

    it('空配列ではフッター付与なしで空配列を返す', () => {
      expect(setPageFooters([])).toEqual([])
    })
  })

  describe('buildPageButtonRow', () => {
    it('最初/前/次/最後/閉じる の 5 ボタンを customId 付きで作成する', () => {
      const row = buildPageButtonRow('msg-1', 'ch-1', 2, 5)
      const buttons = row.toJSON().components

      expect(buttons).toHaveLength(5)
      expect(buttons.map((b: any) => b.custom_id)).toEqual([
        'dice-page-first*msg-1*ch-1',
        'dice-page-prev*msg-1*ch-1',
        'dice-page-next*msg-1*ch-1',
        'dice-page-last*msg-1*ch-1',
        'dice-page-cancel*msg-1*ch-1'
      ])
    })

    it('ラベルとスタイルが期待どおりに設定される', () => {
      const buttons = buildPageButtonRow('msg-1', 'ch-1', 2, 5).toJSON().components

      expect(buttons.map((b: any) => b.label)).toEqual(['最初', '前', '次', '最後', '閉じる'])
      expect(buttons.map((b: any) => b.style)).toEqual([
        ButtonStyle.Secondary,
        ButtonStyle.Primary,
        ButtonStyle.Primary,
        ButtonStyle.Secondary,
        ButtonStyle.Danger
      ])
    })

    it('1 ページ目では「最初」「前」ボタンを無効化する', () => {
      const buttons = buildPageButtonRow('msg-1', 'ch-1', 1, 5).toJSON().components

      expect(buttons[0].disabled).toBe(true) // 最初
      expect(buttons[1].disabled).toBe(true) // 前
      expect(buttons[2].disabled).toBe(false) // 次
      expect(buttons[3].disabled).toBe(false) // 最後
    })

    it('最終ページでは「次」「最後」ボタンを無効化する', () => {
      const buttons = buildPageButtonRow('msg-1', 'ch-1', 5, 5).toJSON().components

      expect(buttons[0].disabled).toBe(false) // 最初
      expect(buttons[1].disabled).toBe(false) // 前
      expect(buttons[2].disabled).toBe(true) // 次
      expect(buttons[3].disabled).toBe(true) // 最後
    })
  })

  describe('buildPageSelectRow', () => {
    it('totalPages 分の選択肢を作成し現在ページを default にする', () => {
      const row = buildPageSelectRow('msg-1', 'ch-1', 2, 3)
      expect(row).not.toBeNull()

      const menu = row!.toJSON().components[0] as any
      expect(menu.custom_id).toBe('dice-page-select*msg-1*ch-1')
      expect(menu.options).toHaveLength(3)
      expect(menu.options.map((o: any) => o.value)).toEqual(['1', '2', '3'])
      expect(menu.options[1].default).toBe(true) // currentPage = 2
      expect(menu.options[0].default).toBe(false)
    })

    it('25 ページを超える場合は省略表示を加えるとオプションが 26 件となり discord.js の上限超過で null を返す（現状挙動）', () => {
      // 本体は 25 件 + 省略 1 件 = 26 件を addOptions するが、
      // 実 discord.js では StringSelectMenu のオプション上限が 25 件のため例外となり、
      // catch 節で null が返る。これを現状の挙動として固定する。
      const row = buildPageSelectRow('msg-1', 'ch-1', 1, 30)

      expect(row).toBeNull()
    })

    it('totalPages がちょうど 25 のときは省略表示を付けない', () => {
      const row = buildPageSelectRow('msg-1', 'ch-1', 1, 25)
      const menu = row!.toJSON().components[0] as any

      expect(menu.options).toHaveLength(25)
    })
  })

  describe('buildCharacterSelectRow', () => {
    it('キャラクターが 0 件のときは null を返す', () => {
      expect(buildCharacterSelectRow('msg-1', 'ch-1', [], undefined)).toBeNull()
    })

    it('先頭に「全て表示」を置きキャラクターを続けて並べる', () => {
      const characters = [
        makeCharacter({ characterId: 'char-1', characterName: '探索者A' }),
        makeCharacter({ characterId: 'char-2', characterName: '探索者B' })
      ]

      const row = buildCharacterSelectRow('msg-1', 'ch-1', characters, undefined)
      const menu = row!.toJSON().components[0] as any

      expect(menu.custom_id).toBe('dice-char-select*msg-1*ch-1')
      expect(menu.options).toHaveLength(3)
      expect(menu.options[0].value).toBe('all')
      expect(menu.options[0].label).toBe('全て表示')
      expect(menu.options[1].value).toBe('char-1')
      expect(menu.options[2].value).toBe('char-2')
    })

    it('未選択時は「全て表示」を default にする', () => {
      const characters = [makeCharacter()]

      const menu = buildCharacterSelectRow('msg-1', 'ch-1', characters, undefined)!.toJSON().components[0] as any

      expect(menu.options[0].default).toBe(true)
    })

    it('特定キャラクター選択時は該当オプションを default にする', () => {
      const characters = [
        makeCharacter({ characterId: 'char-1', characterName: '探索者A' }),
        makeCharacter({ characterId: 'char-2', characterName: '探索者B' })
      ]

      const menu = buildCharacterSelectRow('msg-1', 'ch-1', characters, 'char-2')!.toJSON().components[0] as any

      expect(menu.options[0].default).toBe(false) // 全て表示
      expect(menu.options[2].default).toBe(true) // char-2
    })

    it('characterName 未設定のときは連番ラベルにフォールバックする', () => {
      const characters = [makeCharacter({ characterId: 'char-1', characterName: '' })]

      const menu = buildCharacterSelectRow('msg-1', 'ch-1', characters, undefined)!.toJSON().components[0] as any

      expect(menu.options[1].label).toBe('キャラクター 1')
    })

    it('24 件を超えるキャラクターは 24 件 + 全て表示の計 25 件に制限する', () => {
      const characters = Array.from({ length: 30 }, (_, i) =>
        makeCharacter({ characterId: `char-${i}`, characterName: `探索者${i}` })
      )

      const menu = buildCharacterSelectRow('msg-1', 'ch-1', characters, undefined)!.toJSON().components[0] as any

      // 全て表示 1 + キャラクター 24 = 25 件（Discord 上限）
      expect(menu.options).toHaveLength(25)
    })
  })
})
