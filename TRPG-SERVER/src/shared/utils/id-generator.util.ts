import { randomBytes, randomUUID } from 'crypto'

/**
 * ID生成ユーティリティ
 *
 * 🎯 責務:
 * - 各種ID生成アルゴリズムの提供
 * - ユニーク性検証は呼び出し元で実施
 * - 純粋関数として実装
 */
export class IdGeneratorUtil {
  /**
   * 短いランダムID生成（ユニーク性検証なし）
   * @param prefix プレフィックス文字列
   * @param length ランダム部分の長さ（デフォルト: 8）
   * @returns 生成されたID
   */
  static generateShortId(prefix = '', length = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = prefix
    const bytes = randomBytes(length)

    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length]
    }

    return result
  }

  /**
   * UUID v4生成
   * @returns UUID v4文字列
   */
  static generateUuid(): string {
    return randomUUID()
  }

  /**
   * タイムスタンプベースID生成
   * より高いユニーク性を保証
   * @param prefix プレフィックス文字列
   * @returns タイムスタンプ + ランダム文字列のID
   */
  static generateTimestampId(prefix = ''): string {
    const timestamp = Date.now().toString(36)
    const random = this.generateShortId('', 4)
    return `${prefix}${timestamp}_${random}`
  }

  /**
   * 数値ベースの短いID生成
   * @param prefix プレフィックス文字列
   * @param length 数値部分の長さ（デフォルト: 6）
   * @returns 数値ベースのID
   */
  static generateNumericId(prefix = '', length = 6): string {
    const max = Math.pow(10, length) - 1
    const min = Math.pow(10, length - 1)
    const randomNum = Math.floor(Math.random() * (max - min + 1)) + min
    return `${prefix}${randomNum}`
  }

  /**
   * カスタム文字セットでのID生成
   * @param charset 使用する文字セット
   * @param prefix プレフィックス文字列
   * @param length ランダム部分の長さ
   * @returns カスタム文字セットを使用したID
   */
  static generateCustomId(charset: string, prefix = '', length = 8): string {
    let result = prefix
    const bytes = randomBytes(length)

    for (let i = 0; i < length; i++) {
      result += charset[bytes[i] % charset.length]
    }

    return result
  }

  /**
   * 人間が読みやすいID生成（数字の0とアルファベットのOを除外）
   * @param prefix プレフィックス文字列
   * @param length ランダム部分の長さ（デフォルト: 8）
   * @returns 読みやすいID
   */
  static generateReadableId(prefix = '', length = 8): string {
    // 紛らわしい文字を除外: 0, O, I, l, 1
    const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
    return this.generateCustomId(chars, prefix, length)
  }

  /**
   * セキュアなID生成（より長いランダム文字列）
   * @param prefix プレフィックス文字列
   * @param length ランダム部分の長さ（デフォルト: 16）
   * @returns セキュアなID
   */
  static generateSecureId(prefix = '', length = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    return this.generateCustomId(chars, prefix, length)
  }
}
