import { Type } from 'class-transformer'
import { IsArray, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { SheetTemplateForkedFromDto } from './create-character-sheet-template.dto'

export class UpdateCharacterSheetTemplateDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly draftRevision?: number

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  readonly name?: string

  @IsOptional()
  @IsString()
  readonly version?: string

  @IsOptional()
  @IsInt()
  readonly schemaVersion?: number

  @IsOptional()
  @IsString()
  readonly gameSystemId?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly tags?: string[]

  @IsOptional()
  @IsIn(['private', 'unlisted', 'public'])
  readonly visibility?: 'private' | 'unlisted' | 'public'

  @IsOptional()
  @ValidateNested()
  @Type(() => SheetTemplateForkedFromDto)
  readonly forkedFrom?: SheetTemplateForkedFromDto

  @IsOptional()
  @IsString()
  readonly license?: string

  @IsOptional()
  @IsArray()
  readonly sections?: Record<string, unknown>[]

  @IsOptional()
  @IsArray()
  readonly tables?: Record<string, unknown>[]

  @IsOptional()
  @IsObject()
  readonly settings?: Record<string, unknown>
}
