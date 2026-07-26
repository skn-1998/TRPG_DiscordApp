import { PartialType } from '@nestjs/mapped-types'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateUserProfileDto {
  @IsString()
  @IsNotEmpty()
  readonly name: string

  @IsOptional()
  @IsString()
  readonly avatarHash?: string
}

export class UpdateUserProfileDto extends PartialType(CreateUserProfileDto) {}
