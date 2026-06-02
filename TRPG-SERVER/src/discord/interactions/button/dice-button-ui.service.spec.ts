// このサービスは discord.js の builder 構造（customId / label / style / fields 等）を
// 検証対象とするため、global jest-setup の discord.js スタブモックを解除し実体を使う。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { ButtonStyle, Colors } from 'discord.js'
import { DiceButtonUIService } from './dice-button-ui.service'

// discord.js の toJSON() は判別ユニオン（ボタン種別ごとのバリアント）を返すため、
// プロパティ参照のたびに型を絞るのを避ける目的で any キャストを集約するヘルパー。

const toJson = (builder: { toJSON: () => unknown }): any => builder.toJSON()

describe('DiceButtonUIService', () => {
  let service: DiceButtonUIService

  beforeEach(() => {
    service = new DiceButtonUIService()
  })

  describe('data（デフォルトボタン）', () => {
    it('customId / label / style が 1D100 用に設定される', () => {
      // Act
      const json = toJson(service.data)

      // Assert
      expect(json.custom_id).toBe('roll-1d100')
      expect(json.label).toBe('1D100')
      expect(json.style).toBe(ButtonStyle.Danger)
    })
  })

  describe('createCustomDiceModal', () => {
    it('モーダルの customId / title が設定される', () => {
      // Act
      const json = toJson(service.createCustomDiceModal())

      // Assert
      expect(json.custom_id).toBe('custom-dice-modal')
      expect(json.title).toBe('カスタムダイスロール')
    })

    it('2 行の入力（ダイス式・理由）を含む', () => {
      // Act
      const json = toJson(service.createCustomDiceModal())

      // Assert
      expect(json.components).toHaveLength(2)
    })

    it('ダイス式入力は必須で文字数制約を持つ', () => {
      // Act
      const json = toJson(service.createCustomDiceModal())
      const diceInput = json.components[0].components[0]

      // Assert
      expect(diceInput.custom_id).toBe('dice-expression')
      expect(diceInput.label).toBe('ダイス式を入力してください')
      expect(diceInput.required).toBe(true)
      expect(diceInput.min_length).toBe(1)
      expect(diceInput.max_length).toBe(50)
    })

    it('理由入力は任意で最大長のみ持つ', () => {
      // Act
      const json = toJson(service.createCustomDiceModal())
      const reasonInput = json.components[1].components[0]

      // Assert
      expect(reasonInput.custom_id).toBe('roll-reason')
      expect(reasonInput.label).toBe('ロール理由（オプション）')
      expect(reasonInput.required).toBe(false)
      expect(reasonInput.max_length).toBe(100)
    })
  })

  describe('createDiceRollButtons', () => {
    it('各ダイスに customId・label・絵文字を設定する', () => {
      // Act
      const rows = service.createDiceRollButtons('ch1', [{ label: '1D100', dice: '1d100' }])
      const button = toJson(rows[0]).components[0]

      // Assert
      expect(button.custom_id).toBe('roll*1d100*ch1')
      expect(button.label).toBe('1D100')
      expect(button.emoji).toEqual(expect.objectContaining({ name: '🎲' }))
    })

    it('style 未指定は Secondary になる', () => {
      // Act
      const rows = service.createDiceRollButtons('ch1', [{ label: '1D6', dice: '1d6' }])

      // Assert
      expect(toJson(rows[0]).components[0].style).toBe(ButtonStyle.Secondary)
    })

    it('style 指定時はその style を使う', () => {
      // Act
      const rows = service.createDiceRollButtons('ch1', [{ label: '1D6', dice: '1d6', style: ButtonStyle.Success }])

      // Assert
      expect(toJson(rows[0]).components[0].style).toBe(ButtonStyle.Success)
    })

    it('5 個以下は 1 行にまとまる', () => {
      // Arrange
      const dice = Array.from({ length: 5 }, (_, i) => ({ label: `D${i}`, dice: `1d${i}` }))

      // Act
      const rows = service.createDiceRollButtons('ch1', dice)

      // Assert
      expect(rows).toHaveLength(1)
      expect(toJson(rows[0]).components).toHaveLength(5)
    })

    it('6 個は 2 行に分割される（5 + 1）', () => {
      // Arrange
      const dice = Array.from({ length: 6 }, (_, i) => ({ label: `D${i}`, dice: `1d${i}` }))

      // Act
      const rows = service.createDiceRollButtons('ch1', dice)

      // Assert
      expect(rows).toHaveLength(2)
      expect(toJson(rows[0]).components).toHaveLength(5)
      expect(toJson(rows[1]).components).toHaveLength(1)
    })

    it('空配列なら行を作らない', () => {
      // Act & Assert
      expect(service.createDiceRollButtons('ch1', [])).toHaveLength(0)
    })
  })

  describe('createSkillRollButtons', () => {
    it('customId にスキル customId と channelId を埋め込み、label に値を付与する', () => {
      // Act
      const rows = service.createSkillRollButtons('ch9', [{ name: '目星', value: 60, customId: 'spot' }])
      const button = toJson(rows[0]).components[0]

      // Assert
      expect(button.custom_id).toBe('skill*spot*ch9')
      expect(button.label).toBe('目星 (60)')
      expect(button.style).toBe(ButtonStyle.Primary)
      expect(button.emoji).toEqual(expect.objectContaining({ name: '🎯' }))
    })

    it('6 個は 2 行に分割される（5 + 1）', () => {
      // Arrange
      const skills = Array.from({ length: 6 }, (_, i) => ({ name: `S${i}`, value: i, customId: `s${i}` }))

      // Act
      const rows = service.createSkillRollButtons('ch1', skills)

      // Assert
      expect(rows).toHaveLength(2)
      expect(toJson(rows[0]).components).toHaveLength(5)
      expect(toJson(rows[1]).components).toHaveLength(1)
    })

    it('空配列なら行を作らない', () => {
      // Act & Assert
      expect(service.createSkillRollButtons('ch1', [])).toHaveLength(0)
    })
  })

  describe('createDiceResultEmbed', () => {
    it('タイトルと基本 4 フィールドを設定する', () => {
      // Act
      const json = toJson(service.createDiceResultEmbed('キャラA', '1d100', 45, '詳細text'))

      // Assert
      expect(json.title).toBe('🎲 ダイスロール結果')
      expect(json.fields).toEqual([
        { name: 'キャラクター', value: 'キャラA', inline: true },
        { name: 'ダイス', value: '1d100', inline: true },
        { name: '結果', value: '**45**', inline: true },
        { name: '詳細', value: '詳細text', inline: false }
      ])
    })

    it('color 未指定時は Blue になる', () => {
      // Act
      const json = toJson(service.createDiceResultEmbed('キャラA', '1d100', 45, '詳細'))

      // Assert
      expect(json.color).toBe(Colors.Blue)
    })

    it('color 指定時はその色を使う', () => {
      // Act
      const json = toJson(service.createDiceResultEmbed('キャラA', '1d100', 45, '詳細', undefined, Colors.Green))

      // Assert
      expect(json.color).toBe(Colors.Green)
    })

    it('reason あり時は理由フィールドを追加する', () => {
      // Act
      const json = toJson(service.createDiceResultEmbed('キャラA', '1d100', 45, '詳細', '技能判定'))

      // Assert
      expect(json.fields).toContainEqual({ name: '理由', value: '技能判定', inline: false })
    })

    it('reason なし時は理由フィールドを追加しない', () => {
      // Act
      const json = toJson(service.createDiceResultEmbed('キャラA', '1d100', 45, '詳細'))

      // Assert
      expect(json.fields?.some((f: { name: string }) => f.name === '理由')).toBe(false)
    })
  })

  describe('createErrorEmbed', () => {
    it('タイトル・色・説明を設定する', () => {
      // Act
      const json = toJson(service.createErrorEmbed('失敗しました'))

      // Assert
      expect(json.title).toBe('❌ エラー')
      expect(json.color).toBe(Colors.Red)
      expect(json.description).toBe('失敗しました')
    })

    it('details あり時は詳細フィールドを追加する', () => {
      // Act
      const json = toJson(service.createErrorEmbed('失敗', 'stack trace'))

      // Assert
      expect(json.fields).toContainEqual({ name: '詳細', value: 'stack trace', inline: false })
    })

    it('details なし時は詳細フィールドを追加しない', () => {
      // Act
      const json = toJson(service.createErrorEmbed('失敗'))

      // Assert
      expect(json.fields ?? []).toHaveLength(0)
    })
  })

  describe('createPaginationButtons', () => {
    it('メイン行に 5 ボタン（最初・前・情報・次・最後）を持つ', () => {
      // Act
      const json = toJson(service.createPaginationButtons('ch1', 2, 5, false, false))

      // Assert
      expect(json.components).toHaveLength(5)
      expect(json.components.map((b: { custom_id: string }) => b.custom_id)).toEqual([
        'dice_page_first_ch1',
        'dice_page_prev_ch1',
        'dice_page_info_ch1',
        'dice_page_next_ch1',
        'dice_page_last_ch1'
      ])
    })

    it('ページ情報ボタンは現在/総ページを表示し無効化される', () => {
      // Act
      const json = toJson(service.createPaginationButtons('ch1', 2, 5, false, false))
      const info = json.components[2]

      // Assert
      expect(info.label).toBe('2/5')
      expect(info.disabled).toBe(true)
    })

    it('isFirst で「最初」「前」ボタンが無効化される', () => {
      // Act
      const json = toJson(service.createPaginationButtons('ch1', 1, 5, true, false))

      // Assert
      expect(json.components[0].disabled).toBe(true) // 最初
      expect(json.components[1].disabled).toBe(true) // 前
      expect(json.components[3].disabled).toBe(false) // 次
      expect(json.components[4].disabled).toBe(false) // 最後
    })

    it('isLast で「次」「最後」ボタンが無効化される', () => {
      // Act
      const json = toJson(service.createPaginationButtons('ch1', 5, 5, false, true))

      // Assert
      expect(json.components[0].disabled).toBe(false) // 最初
      expect(json.components[1].disabled).toBe(false) // 前
      expect(json.components[3].disabled).toBe(true) // 次
      expect(json.components[4].disabled).toBe(true) // 最後
    })
  })

  describe('createCancelButtonRow', () => {
    it('閉じるボタン 1 つの行を返す', () => {
      // Act
      const json = toJson(service.createCancelButtonRow('ch1'))

      // Assert
      expect(json.components).toHaveLength(1)
      const cancel = json.components[0]
      expect(cancel.custom_id).toBe('dice_page_cancel_ch1')
      expect(cancel.label).toBe('閉じる')
      expect(cancel.style).toBe(ButtonStyle.Danger)
    })
  })

  describe('execute（ボタンインタラクション初期処理）', () => {
    // ButtonInteraction は外部 I/O の境界。ここでは customId だけで分岐する execute の
    // ルーティングを検証するため、必要なメソッドだけを持つスタブを注入する。
    const makeInteraction = (overrides: Partial<Record<string, any>> = {}): any => ({
      customId: 'roll-1d100',
      replied: false,
      deferred: false,
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      showModal: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      ...overrides
    })

    it('customId が roll*custom のときカスタムダイスモーダルを表示する', async () => {
      // Arrange
      const interaction = makeInteraction({ customId: 'roll*custom' })

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.showModal).toHaveBeenCalledTimes(1)
      expect(interaction.deferUpdate).not.toHaveBeenCalled()
    })

    it('その他の customId のときは deferUpdate に委譲する', async () => {
      // Arrange
      const interaction = makeInteraction({ customId: 'roll-1d100' })

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
      expect(interaction.showModal).not.toHaveBeenCalled()
    })

    it('処理失敗かつ未応答のときはエラーメッセージで reply する', async () => {
      // Arrange
      const interaction = makeInteraction({
        customId: 'roll-1d100',
        deferUpdate: jest.fn().mockRejectedValue(new Error('boom'))
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'ボタン処理中にエラーが発生しました。', ephemeral: true })
      )
    })

    it('処理失敗でも既に応答済みのときは reply しない', async () => {
      // Arrange
      const interaction = makeInteraction({
        customId: 'roll-1d100',
        replied: true,
        deferUpdate: jest.fn().mockRejectedValue(new Error('boom'))
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.reply).not.toHaveBeenCalled()
    })
  })
})
