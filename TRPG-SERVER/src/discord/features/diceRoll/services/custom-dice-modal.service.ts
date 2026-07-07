import { Injectable, Logger } from '@nestjs/common'
import { ModalBuilder, ModalSubmitInteraction, CacheType, ChannelType, MessageFlags } from 'discord.js'
import { discordModalType } from 'src/discord/discord.type'
import { CharacterService } from 'src/domains/character/character.service'
import { Character } from 'src/domains/character/models/character.model'
import { ErrorHandler } from 'src/core/http/error-handler'
import { DiceOrchestratorService } from 'src/discord/services/dice/dice-orchestrator.service'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'
import { DiceRollTextInputDto } from 'src/domains/dice-roll/dto/create-dice-roll-text.dto'

@Injectable()
export class CustomDiceModalService implements discordModalType {
  private readonly logger = new Logger(CustomDiceModalService.name)

  // モーダルの定義（実際にはボタンからshowModalで表示されるため、ここではダミーのインスタンスを提供）
  public data = new ModalBuilder().setCustomId('custom-dice-modal').setTitle('柔軟ダイスロール')

  constructor(
    private readonly characterService: CharacterService,
    private readonly diceOrchestratorService: DiceOrchestratorService,
    private readonly diceRollService: DiceRollService
  ) {}

  /**
   * モーダルが送信されたときの処理（拡張版）
   */
  async execute(interaction: ModalSubmitInteraction<CacheType>): Promise<void> {
    try {
      // CustomIdから第2要素（channelId または characterId）を抽出
      const extractedId = this.extractIdFromCustomId(interaction.customId)

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
      const character = await this.resolveCharacter(extractedId)

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
          // ロール成功時は他のダイスボタン（DiceRollLogicService 系）と同様に履歴へ保存する
          await this.saveRollHistory(interaction, {
            extractedId,
            character,
            diceExpression: calculationResult.description || diceCommand,
            result: rollResult,
            resultDetails: calculationResult.diceResult.text,
            reason: comment || undefined
          })

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
          await interaction.reply({
            content: '親チャンネルにダイスロール結果を送信しました。',
            flags: MessageFlags.Ephemeral
          })
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
   * CustomIdから第2要素を抽出
   *
   * 送出元により意味が異なる（歴史的経緯）:
   * - live 送出元 FlexibleDiceSelectHandler: `custom-dice-modal*{channelId}`（channelId = character.discordChannelId）
   * - 旧 param 系 CharacterThreadSelectService: `param-dice-modal*{characterId}` / `custom-dice-modal*{characterId}`
   *   （flexible-dice-param* メニューの生成元は現存しないが、投稿済みメッセージからの interaction は届き得る）
   */
  private extractIdFromCustomId(customId: string): string | null {
    try {
      const parts = customId.split('*')
      if (parts.length >= 2) {
        if (parts[0] === 'custom-dice-modal' || parts[0] === 'param-dice-modal') {
          return parts[1]
        }
      }
      return null
    } catch (error) {
      this.logger.warn(`CustomIdの解析に失敗: ${customId}`, error)
      return null
    }
  }

  /**
   * customId 由来の ID からキャラクターを解決する
   *
   * live 送出元は channelId を埋め込むため findByChannelId を優先し、
   * 旧 param 系（characterId 埋め込み）からの interaction は findOne へフォールバックする。
   */
  private async resolveCharacter(id: string | null): Promise<Character | undefined> {
    if (!id) return undefined
    try {
      const byChannel = await this.characterService.findByChannelId(id)
      if (byChannel) return byChannel
      const byId = await this.characterService.findOne(id)
      return byId || undefined
    } catch (error) {
      this.logger.warn(`Character not found for id: ${id}`, error)
      return undefined
    }
  }

  /**
   * ロール結果を dice-roll 履歴へ保存する（dice_generic_ 等の他ダイスボタンと同じ保存系へ統一）
   *
   * 保存 channelId は「スレッドの実親チャンネル」を最優先とする（結果メッセージの投稿先・
   * /dice-result の検索キーと一致させる。DiceRollLogicService.resolveSaveChannelId と同方針）。
   * スレッド外はキャラクターの discordChannelId → customId 由来の値 → 現在チャンネルの順でフォールバック。
   * 履歴保存の失敗はロール結果の返信を妨げない（ログのみ）。
   */
  private async saveRollHistory(
    interaction: ModalSubmitInteraction<CacheType>,
    params: {
      extractedId: string | null
      character: Character | undefined
      diceExpression: string
      result: number
      resultDetails: string
      reason?: string
    }
  ): Promise<void> {
    const channelId =
      this.threadParentChannelId(interaction) ||
      params.character?.discordChannelId ||
      params.extractedId ||
      interaction.channelId ||
      null
    if (!channelId) {
      this.logger.warn(`Skip dice roll history save: channelId unresolved (customId: ${interaction.customId})`)
      return
    }

    try {
      const diceRollData: DiceRollTextInputDto = {
        channelId,
        userId: interaction.user.id,
        diceExpression: params.diceExpression,
        result: params.result,
        resultDetails: params.resultDetails,
        reason: params.reason,
        characterName: params.character?.characterName,
        gameSystem: params.character?.gameSystemId || 'custom'
      }
      await this.diceRollService.createText(diceRollData)
    } catch (error) {
      this.logger.error(`Failed to save dice roll history (channelId: ${channelId})`, error)
    }
  }

  /**
   * スレッド内の interaction なら実親チャンネル ID を返す（スレッド外は null）
   */
  private threadParentChannelId(interaction: ModalSubmitInteraction<CacheType>): string | null {
    const channel = interaction.channel
    if (channel && (channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread)) {
      return channel.parentId ?? null
    }
    return null
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
