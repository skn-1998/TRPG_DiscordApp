/**
 * イベントバリデーションユーティリティ
 *
 * 🎯 責務:
 * - 共通バリデーションロジック
 * - スキーマベースの検証
 * - エラーメッセージの標準化
 */

/**
 * 必須フィールドの検証
 */
export function validateRequired<T>(obj: T, fields: (keyof T)[]): void {
  const missingFields: string[] = []

  fields.forEach((field) => {
    const value = obj[field]
    if (value === undefined || value === null || value === '') {
      missingFields.push(String(field))
    }
  })

  if (missingFields.length > 0) {
    throw new ValidationError(`Required fields missing: ${missingFields.join(', ')}`)
  }
}

/**
 * 文字列長の検証
 */
export function validateStringLength(value: string, fieldName: string, min?: number, max?: number): void {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`)
  }

  if (min !== undefined && value.length < min) {
    throw new ValidationError(`${fieldName} must be at least ${min} characters`)
  }

  if (max !== undefined && value.length > max) {
    throw new ValidationError(`${fieldName} must not exceed ${max} characters`)
  }
}

/**
 * パターンマッチング検証
 */
export function validatePattern(value: string, fieldName: string, pattern: RegExp, errorMessage?: string): void {
  if (!pattern.test(value)) {
    throw new ValidationError(errorMessage || `${fieldName} does not match required pattern`)
  }
}

/**
 * 列挙値の検証
 */
export function validateEnum<T>(value: T, fieldName: string, allowedValues: T[]): void {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(`${fieldName} must be one of: ${allowedValues.join(', ')}`)
  }
}

/**
 * Discord ID形式の検証
 */
export function validateDiscordId(value: string, fieldName: string): void {
  validatePattern(value, fieldName, /^\d{17,19}$/, `${fieldName} must be a valid Discord ID (17-19 digits)`)
}

/**
 * キャラクターID形式の検証
 */
export function validateCharacterId(value: string, fieldName: string): void {
  validatePattern(
    value,
    fieldName,
    /^[a-z0-9]{8,12}$/,
    `${fieldName} must be a valid character ID (8-12 lowercase alphanumeric)`
  )
}

/**
 * ゲームシステムID形式の検証
 */
export function validateGameSystemId(value: string, fieldName: string): void {
  const allowedGameSystems = ['coc', 'dnd5e', 'sw2.5', 'generic']
  validateEnum(value, fieldName, allowedGameSystems)
}

/**
 * オブジェクト型の検証
 */
export function validateObject(value: any, fieldName: string, allowEmpty = true): void {
  if (value === null || value === undefined) {
    if (!allowEmpty) {
      throw new ValidationError(`${fieldName} cannot be null or undefined`)
    }
    return
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an object`)
  }

  if (!allowEmpty && Object.keys(value).length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`)
  }
}

/**
 * 配列型の検証
 */
export function validateArray(value: any, fieldName: string, minLength?: number, maxLength?: number): void {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`)
  }

  if (minLength !== undefined && value.length < minLength) {
    throw new ValidationError(`${fieldName} must have at least ${minLength} items`)
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new ValidationError(`${fieldName} must not exceed ${maxLength} items`)
  }
}

/**
 * 日付の検証
 */
export function validateDate(value: any, fieldName: string): void {
  if (!(value instanceof Date) && typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a Date or date string`)
  }

  const date = value instanceof Date ? value : new Date(value)

  if (isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid date`)
  }
}

/**
 * URL形式の検証
 */
export function validateUrl(value: string, fieldName: string): void {
  try {
    new URL(value)
  } catch {
    throw new ValidationError(`${fieldName} must be a valid URL`)
  }
}

/**
 * JSON文字列の検証
 */
export function validateJsonString(value: string, fieldName: string): void {
  try {
    JSON.parse(value)
  } catch {
    throw new ValidationError(`${fieldName} must be valid JSON`)
  }
}

/**
 * 範囲の検証
 */
export function validateRange(value: number, fieldName: string, min?: number, max?: number): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a number`)
  }

  if (min !== undefined && value < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`)
  }

  if (max !== undefined && value > max) {
    throw new ValidationError(`${fieldName} must not exceed ${max}`)
  }
}

/**
 * 複雑なオブジェクトの検証
 */
export function validateEventPayload<T>(payload: any, schema: ValidationSchema<T>): void {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Event payload must be an object')
  }

  // 必須フィールドの検証
  if (schema.required) {
    validateRequired(payload, schema.required)
  }

  // フィールド別の検証
  if (schema.fields) {
    Object.entries(schema.fields).forEach(([fieldName, validator]) => {
      const value = payload[fieldName]
      if (value !== undefined && validator && typeof validator === 'function') {
        validator(value, fieldName)
      }
    })
  }

  // カスタムバリデーション
  if (schema.custom) {
    schema.custom(payload)
  }
}

/**
 * バリデーションスキーマ型定義
 */
export interface ValidationSchema<T> {
  required?: (keyof T)[]
  fields?: {
    [K in keyof T]?: ((value: T[K], fieldName: string) => void) | undefined
  }
  custom?: (payload: T) => void
}

/**
 * バリデーションエラー
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * 複数のバリデーションエラー
 */
export class MultipleValidationError extends Error {
  constructor(public readonly errors: ValidationError[]) {
    super(`Multiple validation errors: ${errors.map((e) => e.message).join(', ')}`)
    this.name = 'MultipleValidationError'
  }
}

/**
 * バリデーション結果の集約
 */
export function collectValidationErrors<T>(payload: T, validators: Array<() => void>): void {
  const errors: ValidationError[] = []

  validators.forEach((validator) => {
    try {
      validator()
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error)
      } else {
        errors.push(new ValidationError(String(error)))
      }
    }
  })

  if (errors.length > 0) {
    throw new MultipleValidationError(errors)
  }
}
