import { Injectable, Logger } from '@nestjs/common'
import { InteractionHandler } from '../handlers/base/interaction-handler.base'

/**
 * パターンマッチング結果
 */
export interface PatternMatchResult {
  /** マッチしたかどうか */
  matched: boolean
  /** マッチタイプ（exact: 完全一致, startsWith: 前方一致, regex: 正規表現） */
  type?: 'exact' | 'startsWith' | 'regex'
  /** 優先度スコア（0-100、高いほど優先） */
  score?: number
}

/**
 * パターンマッチングサービス
 *
 * customIdに基づいてハンドラーをマッチングする責務を持ちます。
 * 優先度: 完全一致 > 前方一致（長いパターン優先） > 正規表現
 */
@Injectable()
export class PatternMatcherService {
  private readonly logger = new Logger(PatternMatcherService.name)

  /**
   * 複数のハンドラーから最適なものを検索
   *
   * @param customId マッチ対象のcustomId
   * @param handlers ハンドラーのリスト
   * @returns 最もスコアの高いハンドラー、またはundefined
   */
  findBestMatch<T extends InteractionHandler>(customId: string, handlers: T[]): T | undefined {
    let bestHandler: T | undefined
    let bestScore = -1

    for (const handler of handlers) {
      const score = handler.getMatchScore(customId)

      if (score > bestScore) {
        bestScore = score
        bestHandler = handler
      }
    }

    if (bestHandler && bestScore > 0) {
      this.logger.debug(`Best match for "${customId}": ${bestHandler.constructor.name} (score: ${bestScore})`)
      return bestHandler
    }

    return undefined
  }

  /**
   * パターンの競合を検出
   *
   * @param handlers ハンドラーのリスト
   * @returns 競合しているパターンのペア
   */
  detectConflicts<T extends InteractionHandler>(
    handlers: T[]
  ): Array<{ handler1: T; handler2: T; conflictType: string }> {
    const conflicts: Array<{ handler1: T; handler2: T; conflictType: string }> = []

    for (let i = 0; i < handlers.length; i++) {
      for (let j = i + 1; j < handlers.length; j++) {
        const h1 = handlers[i]
        const h2 = handlers[j]

        // 同じインタラクションタイプの場合のみチェック
        if (h1.getInteractionType() !== h2.getInteractionType()) {
          continue
        }

        const pattern1 = h1.getCustomIdPattern()
        const pattern2 = h2.getCustomIdPattern()

        // 完全一致の重複
        if (typeof pattern1 === 'string' && typeof pattern2 === 'string') {
          if (pattern1 === pattern2) {
            conflicts.push({
              handler1: h1,
              handler2: h2,
              conflictType: 'duplicate'
            })
          }
          // 前方一致の重複（一方が他方を含む）
          else if (pattern1.startsWith(pattern2) || pattern2.startsWith(pattern1)) {
            conflicts.push({
              handler1: h1,
              handler2: h2,
              conflictType: 'overlap'
            })
          }
        }
      }
    }

    if (conflicts.length > 0) {
      this.logger.warn(`Detected ${conflicts.length} pattern conflict(s)`)
      conflicts.forEach((c) => {
        this.logger.warn(`  ${c.conflictType}: ${c.handler1.constructor.name} <-> ${c.handler2.constructor.name}`)
      })
    }

    return conflicts
  }

  /**
   * パターンを正規化（デバッグ表示用）
   */
  normalizePattern(pattern: string | RegExp): string {
    if (typeof pattern === 'string') {
      return pattern
    }
    return `/${pattern.source}/${pattern.flags}`
  }

  /**
   * ハンドラーリストのサマリーを生成
   */
  generateSummary<T extends InteractionHandler>(handlers: T[]): string {
    const byType: Record<string, T[]> = {
      button: [],
      select: [],
      modal: []
    }

    for (const handler of handlers) {
      const type = handler.getInteractionType()
      byType[type].push(handler)
    }

    const lines: string[] = ['Interaction Handlers Summary:', '']

    for (const [type, typeHandlers] of Object.entries(byType)) {
      if (typeHandlers.length === 0) continue

      lines.push(`[${type.toUpperCase()}] (${typeHandlers.length} handlers)`)
      for (const handler of typeHandlers) {
        const pattern = this.normalizePattern(handler.getCustomIdPattern())
        lines.push(`  - ${handler.constructor.name}: ${pattern}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }
}
