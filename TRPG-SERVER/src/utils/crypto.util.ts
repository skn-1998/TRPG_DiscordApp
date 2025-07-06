import * as crypto from 'crypto'

/**
 * トークン暗号化ユーティリティ
 */
export class CryptoUtil {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly IV_LENGTH = 16
  private static readonly TAG_LENGTH = 16

  /**
   * 暗号化キーを取得
   */
  private static getEncryptionKey(): Buffer {
    const key = process.env.DISCORD_TOKEN_ENCRYPTION_KEY
    if (!key) {
      throw new Error('DISCORD_TOKEN_ENCRYPTION_KEY environment variable is required')
    }
    return crypto.scryptSync(key, 'salt', 32)
  }

  /**
   * テキストを暗号化
   * @param text 暗号化するテキスト
   * @returns 暗号化されたテキスト（IV + Tag + 暗号化データ）
   */
  static encrypt(text: string): string {
    if (!text) return ''

    const key = this.getEncryptionKey()
    const iv = crypto.randomBytes(this.IV_LENGTH)
    const cipher = crypto.createCipher(this.ALGORITHM, key)
    cipher.setAutoPadding(true)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const tag = cipher.getAuthTag()

    // IV + Tag + 暗号化データを結合
    return iv.toString('hex') + tag.toString('hex') + encrypted
  }

  /**
   * 暗号化されたテキストを復号化
   * @param encryptedText 暗号化されたテキスト
   * @returns 復号化されたテキスト
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText) return ''

    const key = this.getEncryptionKey()

    // IV, Tag, 暗号化データを分離
    const iv = Buffer.from(encryptedText.slice(0, this.IV_LENGTH * 2), 'hex')
    const tag = Buffer.from(encryptedText.slice(this.IV_LENGTH * 2, (this.IV_LENGTH + this.TAG_LENGTH) * 2), 'hex')
    const encrypted = encryptedText.slice((this.IV_LENGTH + this.TAG_LENGTH) * 2)

    const decipher = crypto.createDecipher(this.ALGORITHM, key)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * 暗号化されたトークンが有効かチェック
   * @param encryptedToken 暗号化されたトークン
   * @returns 有効な場合はtrue
   */
  static isValidEncryptedToken(encryptedToken: string): boolean {
    if (!encryptedToken) return false

    try {
      this.decrypt(encryptedToken)
      return true
    } catch {
      return false
    }
  }
}
