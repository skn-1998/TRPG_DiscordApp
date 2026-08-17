import { Type } from 'class-transformer'
import {
  Allow,
  IsArray,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from 'class-validator'

export class SheetChangePathDto {
  @IsString()
  @IsNotEmpty()
  readonly fieldUid: string

  @IsOptional()
  @IsString()
  readonly partsKey?: string
}

export class SheetChangeDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => SheetChangePathDto)
  readonly path: SheetChangePathDto

  // 未存在 path の初回書込では、省略を「現在値なし」と期待する CAS として service へ渡す。
  @Allow()
  readonly baseValue?: unknown

  @IsDefined()
  @Allow()
  readonly newValue: unknown
}

/**
 * Web シート保存の HTTP 外形。
 * change.path と各 value のテンプレート整合検査は CharacterSheetOperationService が担う。
 */
export class SaveCharacterSheetDto {
  @IsInt()
  @Min(0)
  readonly baseRevision: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SheetChangeDto)
  readonly changes: SheetChangeDto[]
}

/**
 * 作成時ロール振り直しの HTTP 外形。
 *
 * 値のフィールドを持たないのは意図的である。クライアントが言えるのは「どの項目を振り直すか」だけで、
 * 出目はサーバの実行結果しか採らない。未知プロパティは APP_PIPE の whitelist が除去するため、
 * 値を混ぜた要求でも service へは fieldUid と baseRevision しか届かない。
 * 対象項目が作成時ロールを宣言しているかの検査は CharacterSheetOperationService が担う。
 */
export class RerollSheetFieldDto {
  @IsString()
  @IsNotEmpty()
  readonly fieldUid: string

  @IsInt()
  @Min(0)
  readonly baseRevision: number
}

/** whitelist 通過だけを担当し、値検証は 422 を返す CharacterService 境界へ委ねる。 */
export class UpdateCharacterSheetVisibilityDto {
  @Allow()
  readonly visibility: unknown
}

/**
 * published テンプレートから materialized キャラクターを作る HTTP 外形。
 * values のキー・型検査は CharacterInstantiationService / materializer が担う。
 */
export class CreateCharacterFromTemplateDto {
  @IsString()
  @IsNotEmpty()
  readonly templateId: string

  @IsString()
  @IsNotEmpty()
  readonly templateVersion: string

  @IsString()
  @IsNotEmpty()
  readonly characterName: string

  @IsOptional()
  @IsObject()
  readonly values?: Record<string, unknown>
}
