import * as crypto from 'crypto'

/**
 * トークン暗号化ユーティリティ（純粋関数）
 *
 * 鍵は呼び出し元から引数で受け取る。process.env への直接依存は持たない。
 */
export class CryptoUtil {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly IV_LENGTH = 16
  private static readonly TAG_LENGTH = 16

  /**
   * 暗号化キーを導出
   * @param key 暗号化キー文字列
   */
  private static deriveKey(key: string): Buffer {
    if (!key) {
      throw new Error('Encryption key is required')
    }
    return crypto.scryptSync(key, 'salt', 32)
  }

  /**
   * テキストを暗号化
   * @param text 暗号化するテキスト
   * @param key 暗号化キー文字列
   * @returns 暗号化されたテキスト（IV + Tag + 暗号化データ）
   */
  static encrypt(text: string, key: string): string {
    if (!text) return ''

    const derivedKey = this.deriveKey(key)
    const iv = crypto.randomBytes(this.IV_LENGTH)

    // createCipherivを使用してIVを明示的に指定
    const cipher = crypto.createCipheriv(this.ALGORITHM, derivedKey, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const tag = cipher.getAuthTag()

    // IV + Tag + 暗号化データを結合
    return iv.toString('hex') + tag.toString('hex') + encrypted
  }

  /**
   * 暗号化されたテキストを復号化
   * @param encryptedText 暗号化されたテキスト
   * @param key 暗号化キー文字列
   * @returns 復号化されたテキスト
   */
  static decrypt(encryptedText: string, key: string): string {
    if (!encryptedText) return ''

    const derivedKey = this.deriveKey(key)

    // IV, Tag, 暗号化データを分離
    const iv = Buffer.from(encryptedText.slice(0, this.IV_LENGTH * 2), 'hex')
    const tag = Buffer.from(encryptedText.slice(this.IV_LENGTH * 2, (this.IV_LENGTH + this.TAG_LENGTH) * 2), 'hex')
    const encrypted = encryptedText.slice((this.IV_LENGTH + this.TAG_LENGTH) * 2)

    // createDecipherivを使用してIVを明示的に指定
    const decipher = crypto.createDecipheriv(this.ALGORITHM, derivedKey, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * 暗号化されたトークンが有効かチェック
   * @param encryptedToken 暗号化されたトークン
   * @param key 暗号化キー文字列
   * @returns 有効な場合はtrue
   */
  static isValidEncryptedToken(encryptedToken: string, key: string): boolean {
    if (!encryptedToken) return false

    try {
      this.decrypt(encryptedToken, key)
      return true
    } catch {
      return false
    }
  }
}
