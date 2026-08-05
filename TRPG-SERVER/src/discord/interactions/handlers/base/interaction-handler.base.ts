import { Logger } from '@nestjs/common'
import {
  Interaction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction
} from 'discord.js'

/**
 * インタラクションハンドラーの基底クラス
 *
 * 全てのインタラクションハンドラーはこのクラスを継承します。
 * Events方式と同様に、ファイル名 = customIdパターンで管理します。
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class DicePagePrevHandler extends ButtonInteractionHandler {
 *   getCustomIdPattern(): string {
 *     return 'dice-page-prev'
 *   }
 *
 *   async execute(interaction: ButtonInteraction): Promise<void> {
 *     // ボタン処理
 *   }
 * }
 * ```
 */
export abstract class InteractionHandler<T extends Interaction = Interaction> {
  protected readonly logger: Logger

  constructor() {
    this.logger = new Logger(this.constructor.name)
  }

  /**
   * このハンドラーが処理するcustomIdパターンを返します
   *
   * @returns 文字列（完全一致または前方一致）または正規表現
   *
   * @example
   * // 完全一致
   * return 'dice-page-prev'
   *
   * // 前方一致（startsWith）
   * return 'character-refresh-'
   *
   * // 正規表現
   * return /^roll\*.*_/
   */
  abstract getCustomIdPattern(): string | RegExp

  /**
   * インタラクションタイプを返します
   *
   * @returns 'button' | 'select' | 'modal'
   */
  abstract getInteractionType(): 'button' | 'select' | 'modal'

  /**
   * インタラクション処理を実行します
   *
   * @param interaction Discord.js インタラクションオブジェクト
   */
  abstract execute(interaction: T): Promise<void>

  /**
   * マッチングの優先度スコアを返します
   * スコアが高いほど優先度が高い
   *
   * @param customId マッチ対象のcustomId
   * @returns 優先度スコア（0-100）
   */
  getMatchScore(customId: string): number {
    const pattern = this.getCustomIdPattern()

    if (typeof pattern === 'string') {
      // 完全一致: 最高優先度
      if (customId === pattern) {
        return 100
      }
      // 前方一致: パターンの長さに応じた優先度
      if (customId.startsWith(pattern)) {
        return 50 + Math.min(pattern.length, 49)
      }
      return 0
    }

    // 正規表現: 低い優先度（ただしマッチする場合）
    if (pattern.test(customId)) {
      return 30
    }
    return 0
  }

  /**
   * ハンドラーの説明を返します（デバッグ用）
   */
  getDescription(): string {
    const pattern = this.getCustomIdPattern()
    const patternStr = typeof pattern === 'string' ? pattern : pattern.source
    return `${this.constructor.name} [${this.getInteractionType()}] → ${patternStr}`
  }
}

/**
 * ボタンインタラクション用の基底クラス
 */
export abstract class ButtonInteractionHandler extends InteractionHandler<ButtonInteraction> {
  getInteractionType(): 'button' {
    return 'button'
  }
}

/**
 * セレクトメニューインタラクション用の基底クラス
 */
export abstract class SelectMenuInteractionHandler extends InteractionHandler<
  StringSelectMenuInteraction | AnySelectMenuInteraction
> {
  getInteractionType(): 'select' {
    return 'select'
  }
}

/**
 * モーダルインタラクション用の基底クラス
 */
export abstract class ModalInteractionHandler extends InteractionHandler<ModalSubmitInteraction> {
  getInteractionType(): 'modal' {
    return 'modal'
  }
}
