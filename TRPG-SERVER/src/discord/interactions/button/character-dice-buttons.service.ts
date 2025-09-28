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
  EmbedBuilder,
  ColorResolvable,
  Colors,
  TextChannel
} from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { TypedEventEmitter } from 'src/shared/application/typed-event.service'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'
import { isNull } from 'lodash'
import dice from 'src/discord/utils/dice'
import { DiceRollTextInputDto } from 'src/domains/dice-roll/dto/create-dice-roll-text.dto'
import { DiceRollPaginationService } from 'src/discord/components/pagination/dice-roll-pagination.service'
import { DiceRollRequest, DiceRollResult } from 'src/discord/utils/dice-roll.interface'
import { OnEvent } from '@nestjs/event-emitter'
import { v4 as uuidv4 } from 'uuid'
import { ErrorHandler, BackgroundTaskErrorHandler } from 'src/utils/error-handler'
import { CharacterService } from 'src/domains/character/character.service'
import { DicePresetService } from 'src/discord/services/dice/dice-preset.service'

@Injectable()
export class CharacterDiceButtonsService implements discordButtonType {
  // 最小更新間隔（ミリ秒）
  private readonly MIN_UPDATE_INTERVAL = 2000

  // 最後のEmbed更新時間を記録するMap
  private readonly lastEmbedUpdateTime = new Map<string, number>()

  // ページネーション処理のロック管理（型安全）
  private readonly locks = new Map<string, boolean>()

  constructor(
    private readonly typedEventEmitter: TypedEventEmitter,
    private readonly diceRollService: DiceRollService,
    private readonly paginationService: DiceRollPaginationService,
    private readonly characterService: CharacterService,
    private readonly dicePresetService: DicePresetService
  ) {}

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

              this.saveRollResult(characterName, resultText, result, diceCommand, parentChannelId)
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
   * ダイスロール結果に応じた色と絵文字を取得
   */
  private getResultStyle(
    diceResult: { critical?: boolean; fumble?: boolean; success?: boolean; failure?: boolean },
    result: number
  ): { resultEmoji: string } {
    let resultEmoji: string
    let embedColor: ColorResolvable = Colors.White

    if (diceResult.critical || result < 5) {
      resultEmoji = '🌟 ' // クリティカル
      embedColor = Colors.Gold
    } else if (diceResult.fumble || result > 95) {
      resultEmoji = '💥' // ファンブル
      embedColor = Colors.Red
    } else if (diceResult.success) {
      resultEmoji = '✅' // 成功
      embedColor = Colors.Green
    } else if (diceResult.failure) {
      resultEmoji = '❌' // 失敗
      embedColor = Colors.Grey
    } else {
      resultEmoji = '🎲' // 普通のロール
      embedColor = Colors.Blue
    }

    return { resultEmoji }
  }

  /**
   * 結果テキストをフォーマット
   */
  private formatResultText(
    resultEmoji: string,
    characterName: string,
    skillName: string | null,
    diceText: string
  ): string {
    if (skillName) {
      return `${resultEmoji}**${characterName}** の **${skillName}** ロール：${diceText}`
    } else {
      return `${resultEmoji}**${characterName}**：${diceText}`
    }
  }

  /**
   * ダイスロール結果を保存（復活版）
   */
  private async saveRollResult(
    characterName: string,
    resultText: string,
    result: number,
    diceCommand: string,
    discordChannelId: string
  ): Promise<void> {
    try {
      // スレッドチャンネルIDでキャラクターを検索
      const character = await this.characterService.findByChannelId(discordChannelId)

      if (!character) {
        console.log(`[INFO] Character not found for channel ${discordChannelId}, skipping save`)
        return
      }

      console.log(`[INFO] Saving dice roll for character: ${character.characterId}`)

      // ダイスロール結果をDBに保存
      const text: DiceRollTextInputDto = {
        textId: uuidv4(),
        channelId: discordChannelId,
        userId: 'system', // 古いサービスから移行中
        diceExpression: diceCommand,
        result: result,
        resultDetails: resultText,
        characterId: character.characterId,
        characterName: character.characterName,
        // 後方互換性
        text: resultText,
        diceRoll: diceCommand,
        discordChannelId: discordChannelId
      }

      // バックグラウンドで保存処理（非同期）
      this.diceRollService
        .createText(text)
        .then(() => {
          // キャッシュ無効化も非同期に実行
          this.paginationService.invalidateCache(discordChannelId)
          console.log(`[INFO] Dice roll saved successfully for character: ${character.characterId}`)
        })
        .catch((error) => {
          BackgroundTaskErrorHandler.handleBackgroundError(error, 'save-dice-roll-result', {
            characterId: character.characterId,
            channelId: discordChannelId
          })
        })
    } catch (error) {
      BackgroundTaskErrorHandler.handleBackgroundError(error, 'save-roll-result-main', {
        characterId: characterName,
        channelId: discordChannelId
      })
    }
  }

  /**
   * 親チャンネルへのメッセージ送信処理
   */
  private async handleParentChannelMessage(
    interaction: ButtonInteraction,
    parentChannelId: string,
    embed: EmbedBuilder,
    characterName: string,
    resultText: string,
    result: number,
    diceCommand: string
  ): Promise<void> {
    // 処理のタイムアウト設定（10秒）
    const timeout = setTimeout(() => {
      BackgroundTaskErrorHandler.handleBackgroundError(
        new Error(`インタラクション処理がタイムアウトしました: ${interaction.id}`),
        'interaction-timeout',
        { discordUserId: interaction.user.id, channelId: parentChannelId }
      )
    }, 10000)

    try {
      // 親チャンネルを取得
      const parentChannel = (await interaction.client.channels.fetch(parentChannelId)) as TextChannel
      if (!parentChannel || !parentChannel.isTextBased()) {
        BackgroundTaskErrorHandler.handleBackgroundError(
          new Error('親チャンネルが見つからないか、テキストチャンネルではありません'),
          'fetch-parent-channel',
          { channelId: parentChannelId, discordUserId: interaction.user.id }
        )
        clearTimeout(timeout)
        return
      }

      // 並列処理で効率化
      const [channelData] = await Promise.all([
        // チャンネルデータを取得
        this.diceRollService.findChannelByChannelId(parentChannelId),
        // ダイスロール結果を保存（バックグラウンドで非同期実行）
        this.saveRollResult(characterName, resultText, result, diceCommand, parentChannelId)
      ])

      // 前回の更新からの経過時間をチェック
      const now = Date.now()
      const lastUpdate = this.lastEmbedUpdateTime.get(parentChannelId) || 0
      const timeSinceLastUpdate = now - lastUpdate

      // 前回の更新から一定時間経っていない場合はスキップ
      if (timeSinceLastUpdate < this.MIN_UPDATE_INTERVAL) {
        BackgroundTaskErrorHandler.handleBackgroundError(
          new Error(`直近のEmbed更新からまだ${timeSinceLastUpdate}ms経過 - 更新をスキップします`),
          'embed-update-throttle',
          { channelId: parentChannelId, discordUserId: interaction.user.id }
        )
        clearTimeout(timeout)
        return
      }

      // 更新時間を記録
      this.lastEmbedUpdateTime.set(parentChannelId, now)

      // ページネーション表示を作成（非同期で開始して結果を待たない）
      console.log('ページネーション表示を作成します')
      this.createPaginatedDiceRoll(interaction, parentChannel, parentChannelId)
        .catch((error) => {
          console.error('ページネーション表示の作成に失敗しました:', error)
        })
        .finally(() => {
          clearTimeout(timeout)
        })
    } catch (error) {
      console.error('親チャンネルへのメッセージ送信中にエラーが発生しました:', error)
      clearTimeout(timeout)
    }
  }

  /**
   * ページネーション付きのダイスロール履歴メッセージを作成
   */
  private async createPaginatedDiceRoll(
    interaction: ButtonInteraction,
    parentChannel: TextChannel,
    channelId: string
  ): Promise<void> {
    // 競合を避けるためのロック機構
    const lockKey = `pagination_lock_${channelId}`
    if (this.locks.get(lockKey)) {
      console.log(`ページネーション処理が既に進行中です: ${channelId}`)
      return
    }

    // ロックを設定
    this.locks.set(lockKey, true)

    // 最大5秒後に強制的にロックを解除
    const lockTimeout = setTimeout(() => {
      this.locks.set(lockKey, false)
      console.log(`ページネーションロックを強制解除: ${channelId}`)
    }, 5000)

    // 処理開始時間
    const startTime = Date.now()
    console.log(`[Performance] ページネーション表示処理開始: channelId=${channelId}`)

    try {
      // チャンネルデータを取得
      const dbQueryStartTime = Date.now()
      const channelData = await this.diceRollService.findChannelByChannelId(channelId)
      const dbQueryTime = Date.now() - dbQueryStartTime
      console.log(`[Performance] チャンネルデータ取得完了: channelId=${channelId}, 所要時間=${dbQueryTime}ms`)

      // ページネーション生成開始時間
      const pageGenStartTime = Date.now()

      // ページネーションサービスを使用して履歴からEmbedを作成
      // 常に全キャラクターのデータを表示するため、characterIdはundefinedを渡す
      const pages = await this.paginationService.createPaginatedEmbeds(channelId, undefined)

      const pageGenTime = Date.now() - pageGenStartTime
      console.log(`[Performance] ページネーション生成完了: ページ数=${pages.length}, 所要時間=${pageGenTime}ms`)

      // channelData.embedIdが存在する場合は既存のメッセージを編集
      if (channelData?.embedId) {
        try {
          const fetchStartTime = Date.now()
          const existingMessage = await parentChannel.messages.fetch(channelData.embedId)
          const fetchTime = Date.now() - fetchStartTime
          console.log(`[Performance] 既存メッセージ取得: 所要時間=${fetchTime}ms`)

          if (existingMessage) {
            // ページネーション状態を保存
            const paginationState = {
              pages,
              totalPages: pages.length,
              currentPage: 0,
              characterId: undefined,
              messageId: existingMessage.id
            }

            this.paginationService.savePaginationState(channelId, existingMessage.id, paginationState)

            // ページネーションコントロール生成開始時間
            const controlsStartTime = Date.now()

            // ページネーションコントロールを作成
            const controls = await this.paginationService.createPaginationControls(
              existingMessage.id,
              channelId,
              pages.length
            )

            const controlsTime = Date.now() - controlsStartTime
            console.log(`[Performance] コントロール生成完了: 所要時間=${controlsTime}ms`)

            // メッセージ編集開始時間
            const editStartTime = Date.now()

            // メッセージを更新して即座に完了
            await existingMessage.edit({
              content: null,
              embeds: [pages[0]],
              components: controls
            })

            const editTime = Date.now() - editStartTime
            console.log(`[Performance] メッセージ編集完了: 所要時間=${editTime}ms`)

            const totalTime = Date.now() - startTime
            console.log(`[Performance] ページネーション表示処理完了(既存メッセージ編集): 総所要時間=${totalTime}ms`)

            // ロックを解除
            clearTimeout(lockTimeout)
            this.locks.set(lockKey, false)
            return
          }
        } catch (error) {
          console.error('既存メッセージの編集に失敗:', error)
        }
      }

      // 既存のメッセージがない場合や編集に失敗した場合は新しいメッセージを作成
      const sendStartTime = Date.now()
      const newMessage = await parentChannel.send({
        content: '🎲 ダイスロール履歴を読み込み中...'
      })
      const sendTime = Date.now() - sendStartTime
      console.log(`[Performance] 新規メッセージ送信: 所要時間=${sendTime}ms`)

      if (pages.length === 0) {
        // ダイスロール履歴がない場合は空の履歴ページを作成
        const emptyEmbed = new EmbedBuilder()
          .setTitle('ダイスロール履歴')
          .setDescription('ダイスロール履歴がありません。ダイスを振ってデータを記録しましょう。')
          .setColor('#0099ff')
          .setTimestamp()

        // ページネーション状態を保存
        const paginationState = {
          pages: [emptyEmbed],
          totalPages: 1,
          currentPage: 0,
          characterId: undefined,
          messageId: newMessage.id
        }

        this.paginationService.savePaginationState(channelId, newMessage.id, paginationState)

        // キャラクターセレクトメニューを含むコントロールを作成
        const controls = await this.paginationService.createPaginationControls(newMessage.id, channelId, 1)

        // 一度に全てのデータを編集
        await newMessage.edit({
          content: null,
          embeds: [emptyEmbed],
          components: controls
        })

        // 新しいEmbedIDをチャンネルに紐づける（バックグラウンド処理）
        this.diceRollService
          .updateEmbed(newMessage.id, {
            embedId: newMessage.id,
            discordChannelId: channelId
          })
          .catch((error) => {
            console.error('Embed IDの更新に失敗:', error)
          })

        const totalTime = Date.now() - startTime
        console.log(`[Performance] ページネーション表示処理完了(空ページ): 総所要時間=${totalTime}ms`)

        // ロックを解除
        clearTimeout(lockTimeout)
        this.locks.set(lockKey, false)
        return
      }

      // ページネーション状態を保存
      const paginationState = {
        pages,
        totalPages: pages.length,
        currentPage: 0,
        characterId: undefined,
        messageId: newMessage.id
      }

      this.paginationService.savePaginationState(channelId, newMessage.id, paginationState)

      // ページネーションコントロール生成開始時間
      const controlsStartTime = Date.now()

      // ページネーションコントロールを作成
      const controls = await this.paginationService.createPaginationControls(newMessage.id, channelId, pages.length)

      const controlsTime = Date.now() - controlsStartTime
      console.log(`[Performance] コントロール生成完了: 所要時間=${controlsTime}ms`)

      // コントロールが存在することを確認
      if (!controls || controls.length === 0) {
        console.error('ページネーションコントロールの作成に失敗しました')

        // コントロールを再作成（強制的にボタンだけでも表示）
        const fallbackControls = this.createFallbackControls(newMessage.id, channelId)

        // エラーの場合でもEmbedとナビゲーションボタンだけは表示
        const editStartTime = Date.now()
        await newMessage.edit({
          content: null,
          embeds: [pages[0]],
          components: fallbackControls
        })
        const editTime = Date.now() - editStartTime
        console.log(`[Performance] フォールバックコントロール編集完了: 所要時間=${editTime}ms`)
      } else {
        // メッセージを更新して履歴とコントロールを表示
        const editStartTime = Date.now()
        await newMessage.edit({
          content: null,
          embeds: [pages[0]],
          components: controls
        })
        const editTime = Date.now() - editStartTime
        console.log(`[Performance] メッセージ編集完了: 所要時間=${editTime}ms`)
      }

      // 新しいEmbedIDをチャンネルに紐づける（バックグラウンド処理）
      this.diceRollService
        .updateEmbed(newMessage.id, {
          embedId: newMessage.id,
          discordChannelId: channelId
        })
        .catch((error) => {
          console.error('Embed IDの更新に失敗:', error)
        })

      const totalTime = Date.now() - startTime
      console.log(
        `[Performance] ページネーション表示処理完了(新規メッセージ): 総所要時間=${totalTime}ms, ページ数=${pages.length}`
      )

      console.log(`ダイスロール履歴ページネーション作成: ${pages.length}ページ`)
    } catch (error) {
      console.error('ページネーション作成エラー:', error)
      // エラー時は親チャンネルに通知
      try {
        await parentChannel.send({
          content: '⚠️ ダイスロール履歴の表示中にエラーが発生しました。',
          components: []
        })
      } catch (sendError) {
        console.error('エラー通知の送信に失敗:', sendError)
      }
    } finally {
      // 最後に必ずロックを解除
      clearTimeout(lockTimeout)
      this.locks.set(lockKey, false)
    }
  }

  /**
   * フォールバック用の最小限のコントロールを作成
   */
  private createFallbackControls(messageId: string, channelId: string): ActionRowBuilder<ButtonBuilder>[] {
    // 基本的なナビゲーションボタン
    const prevButton = new ButtonBuilder()
      .setCustomId(`dice-prev*${messageId}*${channelId}`)
      .setLabel('◀ 前へ')
      .setStyle(ButtonStyle.Primary)

    const pageInfoButton = new ButtonBuilder()
      .setCustomId(`dice-page-info*${messageId}*${channelId}`)
      .setLabel('ページ 1')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)

    const nextButton = new ButtonBuilder()
      .setCustomId(`dice-next*${messageId}*${channelId}`)
      .setLabel('次へ ▶')
      .setStyle(ButtonStyle.Primary)

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, pageInfoButton, nextButton)

    return [buttonRow]
  }

  @OnEvent('diceRoll')
  public async handleDiceRoll(interaction: ButtonInteraction, req: DiceRollRequest): Promise<void> {
    try {
      const { user, channel } = interaction
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

      // ダイスロール履歴を非同期で更新（バックグラウンド処理）
      this.updateDiceRollHistoryAsync(interaction, parentChannel, channelId)
    } catch (error) {
      console.error('ダイスロール処理エラー:', error)
      await interaction.editReply('ダイスロールの処理中にエラーが発生しました。')
    }
  }

  // ダイスロール結果をテキスト形式でフォーマットする新しい関数
  private formatDiceRollResultAsText(result: DiceRollResult, req: DiceRollRequest): string {
    let text = '🎲 **ダイスロール結果**\n\n'

    // キャラクター情報
    if (req.characterName) {
      text += `**キャラクター**: ${req.characterName}\n`
    }

    // スキル名と目標値
    if (req.skillName) {
      text += `**スキル**: ${req.skillName}`
      if (req.targetValue) {
        text += ` (目標値: ${req.targetValue})`
      }
      text += '\n'
    }

    // ダイス記法と結果
    text += `**ダイス**: ${req.notation}\n`
    text += `**結果**: ${result.result}\n`

    // 成功判定の結果
    if (result.success !== undefined) {
      text += `**判定**: ${this.getSuccessText(result.success)}\n`
    }

    // タイムスタンプ
    text += `\n_${new Date().toLocaleTimeString()}_`

    return text
  }

  // 成功度をテキストに変換
  private getSuccessText(success: boolean | number): string {
    // boolean型の場合
    if (typeof success === 'boolean') {
      return success ? '成功' : '失敗'
    }

    // number型の場合
    switch (success) {
      case 1:
        return '成功'
      case 2:
        return 'ハード成功'
      case 3:
        return 'イクストリーム成功'
      case 4:
        return 'クリティカル'
      case -1:
        return '失敗'
      case -2:
        return 'ファンブル'
      default:
        return '不明'
    }
  }

  // 履歴更新をバックグラウンドで実行する関数
  private async updateDiceRollHistoryAsync(
    interaction: ButtonInteraction,
    parentChannel: TextChannel,
    channelId: string
  ): Promise<void> {
    try {
      // チャンネルデータを取得
      const channelData = await this.diceRollService.findChannelByChannelId(channelId)

      if (channelData?.embedId) {
        // 直近の更新から一定時間経過していたら更新
        const lastUpdate = this.lastEmbedUpdateTime.get(channelId) || 0
        const now = Date.now()
        const timeSinceLastUpdate = now - lastUpdate

        if (timeSinceLastUpdate >= this.MIN_UPDATE_INTERVAL) {
          this.lastEmbedUpdateTime.set(channelId, now)

          // 既存のページネーションメッセージを更新
          try {
            const existingMessage = await parentChannel.messages.fetch(channelData.embedId)
            if (existingMessage) {
              // 新しいページを生成
              const pages = await this.paginationService.createPaginatedEmbeds(channelId, undefined)

              // ページネーション状態を更新
              const paginationState = {
                pages,
                totalPages: pages.length,
                currentPage: 0,
                characterId: undefined,
                messageId: existingMessage.id
              }

              this.paginationService.savePaginationState(channelId, existingMessage.id, paginationState)

              // コントロールを再生成
              const controls = await this.paginationService.createPaginationControls(
                existingMessage.id,
                channelId,
                pages.length
              )

              // メッセージを更新
              await existingMessage.edit({
                content: null,
                embeds: pages.length > 0 ? [pages[0]] : [],
                components: controls
              })

              console.log(`ダイスロール履歴を更新しました: ${pages.length}ページ`)
            }
          } catch (error) {
            console.error('既存メッセージの更新に失敗:', error)
            // 失敗した場合は新しいページネーションを作成
            this.createPaginatedDiceRoll(interaction, parentChannel, channelId)
          }
        } else {
          console.log(`直近のEmbed更新からまだ${timeSinceLastUpdate}ms経過 - 更新をスキップします`)
        }
      } else {
        // embedIdがない場合は新しくページネーションを作成
        this.createPaginatedDiceRoll(interaction, parentChannel, channelId)
      }
    } catch (error) {
      console.error('履歴更新処理エラー:', error)
    }
  }
}
