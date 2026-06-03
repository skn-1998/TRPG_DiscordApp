import { Injectable } from '@nestjs/common'
import { ModalBuilder, ModalSubmitInteraction, CacheType, ChannelType } from 'discord.js'
import { discordModalType } from 'src/discord/discord.type'
import { CharacterService } from 'src/domains/character/character.service'
import { Character } from 'src/domains/character/models/character.model'
import { ErrorHandler } from 'src/core/http/error-handler'
import { DiceOrchestratorService } from 'src/discord/services/dice/dice-orchestrator.service'

@Injectable()
export class CustomDiceModalService implements discordModalType {
  // モーダルの定義（実際にはボタンからshowModalで表示されるため、ここではダミーのインスタンスを提供）
  public data = new ModalBuilder().setCustomId('custom-dice-modal').setTitle('柔軟ダイスロール')

  constructor(
    private readonly characterService: CharacterService,
    private readonly diceOrchestratorService: DiceOrchestratorService
  ) {}

  /**
   * モーダルが送信されたときの処理（拡張版）
   */
  async execute(interaction: ModalSubmitInteraction<CacheType>): Promise<void> {
    try {
      // CustomIdからcharacterIdを抽出
      const characterId = this.extractCharacterIdFromCustomId(interaction.customId)

      // パラメータベースモーダルかカスタムモーダルかを判定
      const isParameterBased = interaction.customId.startsWith('param-dice-modal*')

      // 入力値を取得（フィールド名が異なる可能性を考慮）
      let diceCommand: string
      if (isParameterBased) {
        diceCommand = interaction.fields.getTextInputValue('dice-formula')
      } else {
        diceCommand = interaction.fields.getTextInputValue('dice-command')
      }

      const comment = interaction.fields.getTextInputValue('dice-comment') || ''

      // パラメータベースかカスタムかで処理分岐
      let multiplier = 1
      let modifier = 0

      if (isParameterBased) {
        // パラメータベースの場合は乗数・修正値フィールドがある
        const multiplierText = interaction.fields.getTextInputValue('multiplier') || ''
        const modifierText = interaction.fields.getTextInputValue('modifier') || ''
        multiplier = this.parseNumberInput(multiplierText, 1)
        modifier = this.parseNumberInput(modifierText, 0)
      }

      // キャラクター情報を取得（必要に応じて）
      let character: Character | undefined = undefined
      if (characterId) {
        try {
          const foundCharacter = await this.characterService.findOne(characterId)
          character = foundCharacter || undefined
        } catch (error) {
          console.warn(`Character not found: ${characterId}`, error)
        }
      }

      // 統一ハンドラーで計算実行
      let resultMessage: string
      let characterName = 'プレイヤー'
      if (character) {
        characterName = character.characterName || characterName
      }

      try {
        let calculationResult: any

        if (isParameterBased) {
          // パラメータベースダイス（キャラクターデータ使用）
          calculationResult = await this.diceOrchestratorService.calculateAndRoll(
            diceCommand,
            multiplier,
            modifier,
            character
          )
        } else {
          // カスタムダイス（ダイス記法専用）
          calculationResult = await this.diceOrchestratorService.executeBasicNotation(diceCommand, characterName)
        }

        if (calculationResult.success && calculationResult.diceResult) {
          const rollResult = calculationResult.diceResult.rands.reduce(
            (acc: number, curr: number[]) => acc + curr[0],
            0
          )
          const resultEmoji = isParameterBased
            ? this.diceOrchestratorService.getResultEmoji(calculationResult.diceResult, rollResult)
            : this.diceOrchestratorService.getBasicResultEmoji(calculationResult.diceResult, rollResult)

          // 結果メッセージを構築
          const rollType = isParameterBased ? '柔軟ダイスロール' : 'カスタムダイスロール'
          resultMessage = `${resultEmoji} **${calculationResult.characterName}** の${rollType}\n`
          if (comment) {
            resultMessage = `【${comment}】\n${resultMessage}`
          }
          resultMessage += `**計算式**: ${calculationResult.description}\n`
          resultMessage += `**ダイスロール**: ${calculationResult.diceResult.text}`
        } else {
          const rollType = isParameterBased ? '柔軟ダイスロール' : 'カスタムダイスロール'
          resultMessage = `🎲 **${calculationResult.characterName}** の${rollType}\n`
          if (comment) {
            resultMessage = `【${comment}】\n${resultMessage}`
          }
          resultMessage += `**計算式**: ${calculationResult.description}\n`
          resultMessage += `**結果**: エラーが発生しました`
        }

        // character-threadの場合は親チャンネルのみに送信
        if (interaction.channel?.type === ChannelType.PublicThread) {
          if (isParameterBased) {
            await this.diceOrchestratorService.sendToParentChannel(interaction, resultMessage)
          } else {
            await this.diceOrchestratorService.sendToParentChannelBasic(interaction, resultMessage)
          }
          // Thread内には応答しない（親チャンネルのみに送信）
          await interaction.reply({ content: '親チャンネルにダイスロール結果を送信しました。', ephemeral: true })
        } else {
          // 通常のチャンネルの場合は直接返信
          await interaction.reply({ content: resultMessage })
        }
      } catch (calculationError) {
        // 統一ハンドラーでもエラーの場合
        console.error('統一ダイス計算ハンドラーでエラー:', calculationError)

        resultMessage = `🎲 **${characterName}** の柔軟ダイスロール\n`
        if (comment) {
          resultMessage = `【${comment}】\n${resultMessage}`
        }
        resultMessage += `**計算式**: ${diceCommand}\n`
        resultMessage += `**結果**: 計算エラーが発生しました`

        // エラーの場合は通常通りThread内に返信
        await interaction.reply({ content: resultMessage })
      }
    } catch (error) {
      await ErrorHandler.handleDiscordError(
        error,
        interaction,
        {
          action: 'flexible-dice-modal',
          channelId: interaction.channel?.id
        },
        'エラーが発生しました。もう一度お試しください。'
      )
    }
  }

  /**
   * CustomIdからcharacterIdを抽出
   */
  private extractCharacterIdFromCustomId(customId: string): string | null {
    try {
      const parts = customId.split('*')
      if (parts.length >= 2) {
        // 'custom-dice-modal*characterId' または 'param-dice-modal*characterId' の形式に対応
        if (parts[0] === 'custom-dice-modal' || parts[0] === 'param-dice-modal') {
          return parts[1]
        }
      }
      return null
    } catch (error) {
      console.warn(`CustomIdの解析に失敗: ${customId}`, error)
      return null
    }
  }

  /**
   * 数値入力をパース
   */
  private parseNumberInput(input: string, defaultValue: number): number {
    if (!input || input.trim() === '') {
      return defaultValue
    }

    // +や-記号を含む場合の処理
    const cleaned = input.trim().replace(/^\+/, '')
    const parsed = parseFloat(cleaned)

    if (isNaN(parsed) || !isFinite(parsed)) {
      return defaultValue
    }

    return parsed
  }
}
