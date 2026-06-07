/**
 * エラーヘルパー関数
 * エラー型の判定と安全な処理のためのユーティリティ
 */

/**
 * 未知のエラーがメッセージプロパティを持つかを判定する型述語
 * @param error 未知のエラー
 * @returns エラーがメッセージプロパティを持つ場合true
 */
export function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  )
}

/**
 * 未知のエラーがコードプロパティを持つかを判定する型述語
 * @param error 未知のエラー
 * @returns エラーがコードプロパティを持つ場合true
 */
export function isErrorWithCode(error: unknown): error is { code: string | number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (typeof (error as Record<string, unknown>).code === 'string' ||
      typeof (error as Record<string, unknown>).code === 'number')
  )
}

// MongoDBエラー型を定義
interface MongoDbError {
  name: string
  code?: number
  keyValue?: Record<string, any>
}

/**
 * MongoDB特有のエラーかを判定する型述語
 * @param error 未知のエラー
 * @returns MongoDBエラーの場合true
 */
export function isMongoError(error: unknown): error is MongoDbError {
  if (typeof error !== 'object' || error === null || !('name' in error)) {
    return false
  }

  const errorName = (error as { name: unknown }).name
  if (typeof errorName !== 'string') {
    return false
  }

  return errorName === 'MongoError' || errorName === 'MongoServerError' || errorName.startsWith('Mongo')
}

/**
 * エラーがMongoDBの重複キーエラーかを判定する型述語
 * @param error 未知のエラー
 * @returns 重複キーエラーの場合true
 */
export function isDuplicateKeyError(error: unknown): boolean {
  if (!isMongoError(error)) {
    return false
  }

  return error.code === 11000 && error.keyValue !== undefined
}

/**
 * エラーメッセージを安全に抽出する
 * @param error 未知のエラー
 * @returns エラーメッセージまたはフォールバックメッセージ
 */
export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message
  }

  if (isDuplicateKeyError(error) && isMongoError(error)) {
    const keyValueObj = error.keyValue || {}
    const duplicatedKey = Object.keys(keyValueObj)[0] || '不明なキー'
    const duplicatedValue = keyValueObj[duplicatedKey]
    return `重複エラー: ${duplicatedKey}=${duplicatedValue} は既に使用されています。`
  }

  if (isMongoError(error)) {
    return `データベースエラー: ${error.name} ${error.code || ''}`
  }

  return '不明なエラーが発生しました'
}

/**
 * エラーオブジェクトを安全に文字列化する
 * @param error 未知のエラー
 * @returns エラーの文字列表現
 */
export function formatError(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }

  if (isErrorWithMessage(error)) {
    return error.message
  }

  try {
    return JSON.stringify(error, null, 2)
  } catch {
    return String(error)
  }
}
