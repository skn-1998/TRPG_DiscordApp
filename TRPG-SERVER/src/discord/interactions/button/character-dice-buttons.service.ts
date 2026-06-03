import { Injectable } from '@nestjs/common'
import {
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  TextChannel
} from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { TypedEventEmitter } from 'src/core/events/typed-event.service'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'
import { isNull } from 'lodash'
import dice from 'src/discord/utils/dice'
import { DiceRollPaginationService } from 'src/discord/components/pagination/dice-roll-pagination.service'
import { DiceRollRequest, DiceRollResult } from 'src/discord/utils/dice-roll.interface'
import { OnEvent } from '@nestjs/event-emitter'
import { v4 as uuidv4 } from 'uuid'
import { ErrorHandler } from 'src/core/http/error-handler'
import { CharacterService } from 'src/domains/character/character.service'
import { DicePresetService } from 'src/discord/services/dice/dice-preset.service'
import { CharacterDiceHistoryService } from './character-dice-history.service'
import {
  getResultEmoji,
  formatResultText as formatResultTextUtil,
  getSuccessText as getSuccessTextUtil,
  formatDiceRollResultAsText as formatDiceRollResultAsTextUtil
} from './character-dice-format.util'

/**
 * キャラクターダイスボタンのオーケストレーター。
 *
 * 公開 API（data / execute / handleDiceRoll / コンストラクタ）は不変。
 * 純粋な整形ロジックは character-dice-format.util へ、履歴・保存・ページネーション表示は
 * CharacterDiceHistoryService へ委譲し、本クラスは Discord interaction の取り回しに専念する。
 */
@Injectable()
export class CharacterDiceButtonsService implements discordButtonType {
  // 履歴・保存・ページネーション表示を担う focused service。
  // コンストラクタ（公開 API）を変えないため、注入済み依存から内部生成して再利用する。
  private readonly historyService: CharacterDiceHistoryService

  constructor(
    private readonly typedEventEmitter: TypedEventEmitter,
    private readonly diceRollService: DiceRollService,
    private readonly paginationService: DiceRollPaginationService,
    private readonly characterService: CharacterService,
    private readonly dicePresetService: DicePresetService
  ) {
    this.historyService = new CharacterDiceHistoryService(
      this.diceRollService,
      this.paginationService,
      this.characterService
    )
  }

  // ButtonBuilderのインスタンスはdiscordButtonTypeのdataフィールドとして必要ですが、
  // 実際には動的に生成されるためここでは最小限のものを提供
  public data = new ButtonBuilder().setCustomId('roll-1d100').setLabel('1D100').setStyle(ButtonStyle.Danger)

  /**
   * ボタンが押されたときの処理
   */
  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      // ボタンのカスタムIDを解析して、どのダイスロールが選択されたかを特定
      const customId = interaction.customId

      // カスタムダイスロールの場合
      if (customId === 'roll*custom') {
        await this.handleCustomDiceRoll(interaction)
        return
      }

      // プリセットダイスロールの場合
      if (customId.startsWith('preset-dice*')) {
        // PresetDiceHandlerServiceに処理を委譲（ImportとConstructorは既に追加済み）
        await this.dicePresetService.handlePresetDiceRoll(interaction, customId)
        return
      }

      // 操作中を示す
      await interaction.deferUpdate()

      // 通常のスキルロールまたはダイスロールの処理
      const rollInfo = customId.replace('roll*', '')

      // diceRollのフォーマットを判断
      let diceCommand: string
      let skillName: string | null = null
      let skillValue: number | null = null

      // スキルロールか通常のダイスロールかを判断
      if (rollInfo.includes('_')) {
        // スキルロール
        const parts = rollInfo.replace('_', '').split('-')
        skillName = parts[0]
        skillValue = Number(parts[1])
        diceCommand = '1d100' + '<' + skillValue
      } else {
        diceCommand = rollInfo
      }

      // ダイスロールを実行
      const diceResult = await dice(diceCommand, 'Cthulhu')
      if (isNull(diceResult)) {
        await interaction.followUp({ content: 'ダイスロールに失敗しました', ephemeral: true })
        return
      }

      // スキルロールの場合は成功/失敗判定を行う
      const result = diceResult.rands.reduce((acc, curr) => acc + curr[0], 0)
      // ダイス目を数値として抽出

      const rollValue = result
      if (rollValue > 0) {
        // チャンネルの存在確認と型チェック
        if (!interaction.channel) {
          console.error('インタラクションのチャンネルが存在しません')
          return
        }

        // スレッドチャンネルでない場合は処理をスキップ
        if (interaction.channel.type !== ChannelType.PublicThread) {
          console.error('パブリックスレッド以外での操作はサポートされていません')
          return
        }

        const characterName = interaction.channel.name
        const { resultEmoji } = this.getResultStyle(diceResult, result)
        const resultText = this.formatResultText(resultEmoji, characterName, skillName, diceResult.text)

        // スレッドのチャンネルタイプ確認（上記でチェック済みだが、型安全性のため再確認）
        if (interaction.channel.type === ChannelType.PublicThread) {
          // 親チャンネルにもメッセージを送信
          const parentChannelId = interaction.channel.parentId
          if (parentChannelId) {
            const parentChannel = (await interaction.client.channels.fetch(parentChannelId)) as TextChannel
            if (parentChannel && parentChannel.isTextBased()) {
              // テキストメッセージでダイスロール結果を送信
              await parentChannel.send({ content: resultText })

              // 履歴保存の完了は待たない fire-and-forget
              void this.saveRollResult(characterName, resultText, result, diceCommand, parentChannelId)
            }
          }
        }

        // ボタンの応答を完了させる（deferUpdateの後なので、何もしない）
        // interaction.deferUpdate()は既に呼ばれているので追加の応答は不要
        return
      }
    } catch (error) {
      await ErrorHandler.handleDiscordError(
        error,
        interaction,
        {
          action: 'dice-button-roll',
          channelId: interaction.channel?.id,
          additionalData: { customId: interaction.customId }
        },
        'ダイスロール処理中にエラーが発生しました。もう一度お試しください。'
      )
    }
  }

  /**
   * カスタムダイスロールのモーダルを表示
   */
  private async handleCustomDiceRoll(interaction: ButtonInteraction): Promise<void> {
    try {
      // モーダルを作成
      const modal = new ModalBuilder().setCustomId('custom-dice-modal').setTitle('カスタムダイスロール')

      // ダイスコマンド入力フィールド
      const diceCommandInput = new TextInputBuilder()
        .setCustomId('dice-command')
        .setLabel('ダイスコマンド')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('例: 2d6+3, 1d100')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(20)

      // コメント入力フィールド
      const commentInput = new TextInputBuilder()
        .setCustomId('dice-comment')
        .setLabel('コメント（任意）')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('例: 攻撃ロール、調査判定など')
        .setRequired(false)
        .setMaxLength(50)

      // アクションロウにフィールドを追加
      const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(diceCommandInput)
      const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput)

      // モーダルにアクションロウを追加
      modal.addComponents(firstActionRow, secondActionRow)

      // モーダルを表示
      await interaction.showModal(modal)
    } catch (error) {
      await ErrorHandler.handleDiscordError(
        error,
        interaction,
        {
          action: 'custom-dice-modal',
          channelId: interaction.channel?.id
        },
        'カスタムダイスモーダルの表示中にエラーが発生しました。もう一度お試しください。'
      )
    }
  }

  /**
   * ダイスロール結果に応じた絵文字を取得（純粋関数へ委譲）
   */
  private getResultStyle(
    diceResult: { critical?: boolean; fumble?: boolean; success?: boolean; failure?: boolean },
    result: number
  ): { resultEmoji: string } {
    return { resultEmoji: getResultEmoji(diceResult, result) }
  }

  /**
   * 結果テキストをフォーマット（純粋関数へ委譲）
   */
  private formatResultText(
    resultEmoji: string,
    characterName: string,
    skillName: string | null,
    diceText: string
  ): string {
    return formatResultTextUtil(resultEmoji, characterName, skillName, diceText)
  }

  /**
   * ダイスロール結果を保存（CharacterDiceHistoryService へ委譲）
   */
  private async saveRollResult(
    characterName: string,
    resultText: string,
    result: number,
    diceCommand: string,
    discordChannelId: string
  ): Promise<void> {
    return this.historyService.saveRollResult(characterName, resultText, result, diceCommand, discordChannelId)
  }

  @OnEvent('diceRoll')
  public async handleDiceRoll(interaction: ButtonInteraction, req: DiceRollRequest): Promise<void> {
    try {
      const { channel } = interaction
      if (!channel?.isTextBased()) return

      // テキストチャンネルを確認
      const parentChannel = channel as TextChannel
      const channelId = parentChannel.id

      // ユーザーとキャラクター情報を取得
      const characterId = req.characterId

      // 即時応答用の一時リプライを送信
      await interaction.deferReply({ ephemeral: false })

      // ダイスロールを実行
      const diceResult = await dice(req.notation || '1d100', 'Cthulhu')
      if (!diceResult) {
        await interaction.editReply('ダイスロールに失敗しました。')
        return
      }

      // 結果を計算
      const result = diceResult.rands.reduce((acc, curr) => acc + curr[0], 0)

      // シンプルなテキストメッセージとして結果を表示
      const rollResultText = this.formatDiceRollResultAsText(
        {
          result,
          success: undefined
        },
        req
      )
      await interaction.editReply(rollResultText)

      // ダイスロール結果をデータベースに保存
      await this.diceRollService.createText({
        textId: uuidv4(),
        channelId: channelId,
        userId: 'system', // 古いサービスから移行中
        diceExpression: req.notation || '1d100',
        result: result,
        resultDetails: `${req.characterName ? `${req.characterName}の` : ''}${req.skillName ? `${req.skillName}` : ''}ロール結果: ${result}`,
        characterId: characterId,
        characterName: req.characterName,
        // 後方互換性
        discordChannelId: channelId,
        diceRoll: req.notation || '1d100',
        text: `${req.characterName ? `${req.characterName}の` : ''}${req.skillName ? `${req.skillName}` : ''}ロール結果: ${result}`
      })

      // ページネーションのキャッシュを無効化して最新データを反映
      this.paginationService.invalidateCache(channelId)

      // ダイスロール履歴を非同期で更新（バックグラウンド処理・完了を待たない fire-and-forget）
      void this.historyService.updateDiceRollHistoryAsync(interaction, parentChannel, channelId)
    } catch (error) {
      console.error('ダイスロール処理エラー:', error)
      await interaction.editReply('ダイスロールの処理中にエラーが発生しました。')
    }
  }

  // ダイスロール結果をテキスト形式でフォーマットする関数（純粋関数へ委譲）
  private formatDiceRollResultAsText(result: DiceRollResult, req: DiceRollRequest): string {
    return formatDiceRollResultAsTextUtil(result, req)
  }

  // 成功度をテキストに変換（純粋関数へ委譲）
  private getSuccessText(success: boolean | number): string {
    return getSuccessTextUtil(success)
  }
}
