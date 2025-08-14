/**
 * Modal Session Manager Service
 *
 * CustomID長さ制限対応のためのセッション管理サービス
 * 循環依存を避けるため独立したサービスとして実装
 */

import { Injectable, Logger } from '@nestjs/common'
import { EmbedSectionType } from './character-embed-manager.service'

/**
 * モーダルセッションデータ
 */
export interface ModalSessionData {
  characterId: string
  sectionType: EmbedSectionType
  fieldKey: string
  timestamp: number
}

@Injectable()
export class ModalSessionManagerService {
  private readonly logger = new Logger(ModalSessionManagerService.name)
  private readonly modalSessions = new Map<string, ModalSessionData>()
  private sessionIdCounter = 0

  /**
   * 新しいセッションを作成
   */
  createSession(characterId: string, sectionType: EmbedSectionType, fieldKey: string): string {
    const sessionId = this.generateSessionId()
    const sessionData = {
      characterId,
      sectionType,
      fieldKey,
      timestamp: Date.now()
    }

    this.modalSessions.set(sessionId, sessionData)

    this.logger.log(
      `Created modal session: ${sessionId} for character: ${characterId}, section: ${sectionType}, field: ${fieldKey}`
    )
    this.logger.debug(`Session data: ${JSON.stringify(sessionData)}`)

    return sessionId
  }

  /**
   * セッションデータを取得
   */
  getSession(sessionId: string): ModalSessionData | undefined {
    this.cleanupOldSessions()
    const session = this.modalSessions.get(sessionId)

    if (session) {
      this.logger.log(`Retrieved modal session: ${sessionId}`)
      this.logger.debug(`Session data: ${JSON.stringify(session)}`)
    } else {
      this.logger.error(`Modal session not found: ${sessionId}`)
      this.logger.debug(`Available sessions: ${Array.from(this.modalSessions.keys()).join(', ')}`)
    }

    return session
  }

  /**
   * セッションを削除
   */
  removeSession(sessionId: string): void {
    const removed = this.modalSessions.delete(sessionId)
    if (removed) {
      this.logger.debug(`Removed session: ${sessionId}`)
    }
  }

  /**
   * セッションIDを生成
   */
  private generateSessionId(): string {
    this.sessionIdCounter = (this.sessionIdCounter + 1) % 10000
    return this.sessionIdCounter.toString().padStart(4, '0')
  }

  /**
   * 古いセッションをクリーンアップ（30分以上経過）
   */
  private cleanupOldSessions(): void {
    const cutoff = Date.now() - 30 * 60 * 1000 // 30分
    let cleanupCount = 0

    for (const [sessionId, session] of this.modalSessions.entries()) {
      if (session.timestamp < cutoff) {
        this.modalSessions.delete(sessionId)
        cleanupCount++
      }
    }

    if (cleanupCount > 0) {
      this.logger.debug(`Cleaned up ${cleanupCount} old sessions`)
    }
  }

  /**
   * セッション統計を取得（デバッグ用）
   */
  getSessionStats(): { total: number; oldestAge: number } {
    const now = Date.now()
    let oldestTimestamp = now

    for (const session of this.modalSessions.values()) {
      if (session.timestamp < oldestTimestamp) {
        oldestTimestamp = session.timestamp
      }
    }

    return {
      total: this.modalSessions.size,
      oldestAge: now - oldestTimestamp
    }
  }
}
