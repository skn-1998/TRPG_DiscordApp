import { Injectable } from '@nestjs/common'
import { AppConfigService } from '../../../config/config.service'
import { CryptoUtil } from '../../../utils/crypto.util'

/**
 * トークン暗号化サービス
 *
 * 暗号化キーを AppConfigService（config 集約）から取得し、
 * 純粋関数 CryptoUtil に委譲する。
 */
@Injectable()
export class CryptoService {
  constructor(private readonly appConfigService: AppConfigService) {}

  /**
   * 暗号化キーを取得（未設定なら明確なエラー）
   */
  private getEncryptionKey(): string {
    const key = this.appConfigService.get('security.discordTokenEncryptionKey')
    if (!key) {
      throw new Error('DISCORD_TOKEN_ENCRYPTION_KEY environment variable is required')
    }
    return key
  }

  /**
   * テキストを暗号化
   */
  encrypt(text: string): string {
    return CryptoUtil.encrypt(text, this.getEncryptionKey())
  }

  /**
   * 暗号化されたテキストを復号化
   */
  decrypt(text: string): string {
    return CryptoUtil.decrypt(text, this.getEncryptionKey())
  }

  /**
   * 暗号化されたトークンが有効かチェック
   */
  isValidEncryptedToken(text: string): boolean {
    return CryptoUtil.isValidEncryptedToken(text, this.getEncryptionKey())
  }
}
