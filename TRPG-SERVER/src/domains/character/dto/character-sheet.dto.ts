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

  @IsDefined()
  @Allow()
  readonly baseValue: unknown

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
