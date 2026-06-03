import { Injectable } from '@nestjs/common'
import { ButtonInteraction, EmbedBuilder, TextChannel } from 'discord.js'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'
import { DiceRollPaginationService } from 'src/discord/components/pagination/dice-roll-pagination.service'
import { v4 as uuidv4 } from 'uuid'
import { BackgroundTaskErrorHandler } from 'src/core/http/error-handler'
import { CharacterService } from 'src/domains/character/character.service'
import {
  shouldUpdateEmbed,
  buildSaveTextDto,
  buildPaginationState,
  createFallbackControls
} from './character-dice-history.pure'

/**
 * キャラクターダイスロールの履歴・保存・ページネーション表示を担う focused service。
 *
 * 責務：
 * - ダイスロール結果の DB 保存（キャラクター解決込み）
 * - ページネーション付き履歴メッセージの生成・更新（Embed 更新スロットリング／ロック制御）
 *
 * 挙動は元 CharacterDiceButtonsService の該当メソッドと同一。CharacterDiceButtonsService
 * からは薄く委譲される。
 */
@Injectable()
export class CharacterDiceHistoryService {
  // 最小更新間隔（ミリ秒）
  private readonly MIN_UPDATE_INTERVAL = 2000

  // 最後のEmbed更新時間を記録するMap
  private readonly lastEmbedUpdateTime = new Map<string, number>()

  // ページネーション処理のロック管理（型安全）
  private readonly locks = new Map<string, boolean>()

  constructor(
    private readonly diceRollService: DiceRollService,
    private readonly paginationService: DiceRollPaginationService,
    private readonly characterService: CharacterService
  ) {}

  /**
   * 現在時刻の取得 seam（既定は Date.now）。テストで固定するために protected メソッド化。
   */
  protected now(): number {
    return Date.now()
  }

  /**
   * タイマー登録 seam（既定は setTimeout）。テストで fake timers / 差し替えするために protected 化。
   */
  protected setTimer(handler: () => void, ms: number): ReturnType<typeof setTimeout> {
    return setTimeout(handler, ms)
  }

  /**
   * タイマー解除 seam（既定は clearTimeout）。
   */
  protected clearTimer(timer: ReturnType<typeof setTimeout>): void {
    clearTimeout(timer)
  }

  /**
   * ダイスロール結果を保存（復活版）
   */
  async saveRollResult(
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

      // ダイスロール結果をDBに保存（DTO 組立は純関数へ委譲。uuid は seam で生成して注入）
      const text = buildSaveTextDto({
        textId: uuidv4(),
        channelId: discordChannelId,
        diceCommand,
        result,
        resultText,
        characterId: character.characterId,
        characterName: character.characterName
      })

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
  async handleParentChannelMessage(
    interaction: ButtonInteraction,
    parentChannelId: string,
    embed: EmbedBuilder,
    characterName: string,
    resultText: string,
    result: number,
    diceCommand: string
  ): Promise<void> {
    // 処理のタイムアウト設定（10秒）
    const timeout = this.setTimer(() => {
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
        this.clearTimer(timeout)
        return
      }

      // 並列処理で効率化
      await Promise.all([
        // チャンネルデータを取得
        this.diceRollService.findChannelByChannelId(parentChannelId),
        // ダイスロール結果を保存（バックグラウンドで非同期実行）
        this.saveRollResult(characterName, resultText, result, diceCommand, parentChannelId)
      ])

      // 前回の更新からの経過時間をチェック（throttle 判定は純関数へ委譲）
      const now = this.now()
      const lastUpdate = this.lastEmbedUpdateTime.get(parentChannelId) || 0
      const timeSinceLastUpdate = now - lastUpdate

      // 前回の更新から一定時間経っていない場合はスキップ
      if (!shouldUpdateEmbed(lastUpdate, now, this.MIN_UPDATE_INTERVAL)) {
        BackgroundTaskErrorHandler.handleBackgroundError(
          new Error(`直近のEmbed更新からまだ${timeSinceLastUpdate}ms経過 - 更新をスキップします`),
          'embed-update-throttle',
          { channelId: parentChannelId, discordUserId: interaction.user.id }
        )
        this.clearTimer(timeout)
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
          this.clearTimer(timeout)
        })
    } catch (error) {
      console.error('親チャンネルへのメッセージ送信中にエラーが発生しました:', error)
      this.clearTimer(timeout)
    }
  }

  /**
   * ページネーション付きのダイスロール履歴メッセージを作成
   */
  async createPaginatedDiceRoll(
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
    const lockTimeout = this.setTimer(() => {
      this.locks.set(lockKey, false)
      console.log(`ページネーションロックを強制解除: ${channelId}`)
    }, 5000)

    // 処理開始時間
    const startTime = this.now()
    console.log(`[Performance] ページネーション表示処理開始: channelId=${channelId}`)

    try {
      // チャンネルデータを取得
      const dbQueryStartTime = this.now()
      const channelData = await this.diceRollService.findChannelByChannelId(channelId)
      const dbQueryTime = this.now() - dbQueryStartTime
      console.log(`[Performance] チャンネルデータ取得完了: channelId=${channelId}, 所要時間=${dbQueryTime}ms`)

      // ページネーション生成開始時間
      const pageGenStartTime = this.now()

      // ページネーションサービスを使用して履歴からEmbedを作成
      // 常に全キャラクターのデータを表示するため、characterIdはundefinedを渡す
      const pages = await this.paginationService.createPaginatedEmbeds(channelId, undefined)

      const pageGenTime = this.now() - pageGenStartTime
      console.log(`[Performance] ページネーション生成完了: ページ数=${pages.length}, 所要時間=${pageGenTime}ms`)

      // channelData.embedIdが存在する場合は既存のメッセージを編集
      if (channelData?.embedId) {
        try {
          const fetchStartTime = this.now()
          const existingMessage = await parentChannel.messages.fetch(channelData.embedId)
          const fetchTime = this.now() - fetchStartTime
          console.log(`[Performance] 既存メッセージ取得: 所要時間=${fetchTime}ms`)

          if (existingMessage) {
            // ページネーション状態を保存（組立は純関数へ委譲）
            const paginationState = buildPaginationState(pages, existingMessage.id)

            this.paginationService.savePaginationState(channelId, existingMessage.id, paginationState)

            // ページネーションコントロール生成開始時間
            const controlsStartTime = this.now()

            // ページネーションコントロールを作成
            const controls = await this.paginationService.createPaginationControls(
              existingMessage.id,
              channelId,
              pages.length
            )

            const controlsTime = this.now() - controlsStartTime
            console.log(`[Performance] コントロール生成完了: 所要時間=${controlsTime}ms`)

            // メッセージ編集開始時間
            const editStartTime = this.now()

            // メッセージを更新して即座に完了
            await existingMessage.edit({
              content: null,
              embeds: [pages[0]],
              components: controls
            })

            const editTime = this.now() - editStartTime
            console.log(`[Performance] メッセージ編集完了: 所要時間=${editTime}ms`)

            const totalTime = this.now() - startTime
            console.log(`[Performance] ページネーション表示処理完了(既存メッセージ編集): 総所要時間=${totalTime}ms`)

            // ロックを解除
            this.clearTimer(lockTimeout)
            this.locks.set(lockKey, false)
            return
          }
        } catch (error) {
          console.error('既存メッセージの編集に失敗:', error)
        }
      }

      // 既存のメッセージがない場合や編集に失敗した場合は新しいメッセージを作成
      const sendStartTime = this.now()
      const newMessage = await parentChannel.send({
        content: '🎲 ダイスロール履歴を読み込み中...'
      })
      const sendTime = this.now() - sendStartTime
      console.log(`[Performance] 新規メッセージ送信: 所要時間=${sendTime}ms`)

      if (pages.length === 0) {
        // ダイスロール履歴がない場合は空の履歴ページを作成
        const emptyEmbed = new EmbedBuilder()
          .setTitle('ダイスロール履歴')
          .setDescription('ダイスロール履歴がありません。ダイスを振ってデータを記録しましょう。')
          .setColor('#0099ff')
          .setTimestamp()

        // ページネーション状態を保存（組立は純関数へ委譲。pages=[emptyEmbed] のため totalPages=1）
        const paginationState = buildPaginationState([emptyEmbed], newMessage.id)

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

        const totalTime = this.now() - startTime
        console.log(`[Performance] ページネーション表示処理完了(空ページ): 総所要時間=${totalTime}ms`)

        // ロックを解除
        this.clearTimer(lockTimeout)
        this.locks.set(lockKey, false)
        return
      }

      // ページネーション状態を保存（組立は純関数へ委譲）
      const paginationState = buildPaginationState(pages, newMessage.id)

      this.paginationService.savePaginationState(channelId, newMessage.id, paginationState)

      // ページネーションコントロール生成開始時間
      const controlsStartTime = this.now()

      // ページネーションコントロールを作成
      const controls = await this.paginationService.createPaginationControls(newMessage.id, channelId, pages.length)

      const controlsTime = this.now() - controlsStartTime
      console.log(`[Performance] コントロール生成完了: 所要時間=${controlsTime}ms`)

      // コントロールが存在することを確認
      if (!controls || controls.length === 0) {
        console.error('ページネーションコントロールの作成に失敗しました')

        // コントロールを再作成（強制的にボタンだけでも表示。純関数へ委譲）
        const fallbackControls = createFallbackControls(newMessage.id, channelId)

        // エラーの場合でもEmbedとナビゲーションボタンだけは表示
        const editStartTime = this.now()
        await newMessage.edit({
          content: null,
          embeds: [pages[0]],
          components: fallbackControls
        })
        const editTime = this.now() - editStartTime
        console.log(`[Performance] フォールバックコントロール編集完了: 所要時間=${editTime}ms`)
      } else {
        // メッセージを更新して履歴とコントロールを表示
        const editStartTime = this.now()
        await newMessage.edit({
          content: null,
          embeds: [pages[0]],
          components: controls
        })
        const editTime = this.now() - editStartTime
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

      const totalTime = this.now() - startTime
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
      this.clearTimer(lockTimeout)
      this.locks.set(lockKey, false)
    }
  }

  /**
   * 履歴更新をバックグラウンドで実行する関数
   */
  async updateDiceRollHistoryAsync(
    interaction: ButtonInteraction,
    parentChannel: TextChannel,
    channelId: string
  ): Promise<void> {
    try {
      // チャンネルデータを取得
      const channelData = await this.diceRollService.findChannelByChannelId(channelId)

      if (channelData?.embedId) {
        // 直近の更新から一定時間経過していたら更新（throttle 判定は純関数へ委譲）
        const lastUpdate = this.lastEmbedUpdateTime.get(channelId) || 0
        const now = this.now()
        const timeSinceLastUpdate = now - lastUpdate

        if (shouldUpdateEmbed(lastUpdate, now, this.MIN_UPDATE_INTERVAL)) {
          this.lastEmbedUpdateTime.set(channelId, now)

          // 既存のページネーションメッセージを更新
          try {
            const existingMessage = await parentChannel.messages.fetch(channelData.embedId)
            if (existingMessage) {
              // 新しいページを生成
              const pages = await this.paginationService.createPaginatedEmbeds(channelId, undefined)

              // ページネーション状態を更新（組立は純関数へ委譲）
              const paginationState = buildPaginationState(pages, existingMessage.id)

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
            // 失敗した場合は新しいページネーションを作成（完了を待たない fire-and-forget）
            void this.createPaginatedDiceRoll(interaction, parentChannel, channelId)
          }
        } else {
          console.log(`直近のEmbed更新からまだ${timeSinceLastUpdate}ms経過 - 更新をスキップします`)
        }
      } else {
        // embedIdがない場合は新しくページネーションを作成（完了を待たない fire-and-forget）
        void this.createPaginatedDiceRoll(interaction, parentChannel, channelId)
      }
    } catch (error) {
      console.error('履歴更新処理エラー:', error)
    }
  }
}
