import { PartialType, OmitType, PickType } from '@nestjs/mapped-types'

/**
 * ドメインDTO作成ユーティリティ
 */
export class DtoDomainFactory {
  /**
   * 作成DTO生成
   */
  static createDto<T>(baseClass: new () => T): new () => T {
    return baseClass
  }

  /**
   * 更新DTO生成
   */
  static updateDto<T>(baseClass: new () => T): new () => Partial<T> {
    return PartialType(baseClass)
  }

  /**
   * 入力DTO生成（特定フィールドを除外）
   */
  static inputDto<T, K extends keyof T>(baseClass: new () => T, omitKeys: K[]): new () => Omit<T, K> {
    return OmitType(baseClass, omitKeys)
  }

  /**
   * 出力DTO生成（特定フィールドのみ選択）
   */
  static outputDto<T, K extends keyof T>(baseClass: new () => T, pickKeys: K[]): new () => Pick<T, K> {
    return PickType(baseClass, pickKeys)
  }

  /**
   * 部分入力DTO生成
   */
  static partialInputDto<T>(baseClass: new () => T): new () => Partial<T> {
    return PartialType(baseClass)
  }
}

/**
 * 汎用的な属性オブジェクト型
 */
export type AttributeObject = {
  [key: string]: string | number | boolean | null | undefined
}

/**
 * ページネーション用DTO
 */
export class PaginationDto {
  readonly page?: number = 1
  readonly limit?: number = 10
  readonly offset?: number = 0
  readonly sortBy?: string
  readonly sortOrder?: 'asc' | 'desc' = 'asc'
}

/**
 * 検索用DTO
 */
export class SearchDto {
  readonly query?: string
  readonly filters?: Record<string, unknown>
}
