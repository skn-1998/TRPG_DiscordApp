import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { CreateCharacterSheetTemplateDto } from './dto/create-character-sheet-template.dto'
import { UpdateCharacterSheetTemplateDto } from './dto/update-character-sheet-template.dto'
import {
  CharacterSheetTemplateEntity,
  CharacterSheetTemplateSummary,
  SheetTemplateSettings
} from './models/character-sheet-template.entity'
import { CharacterSheetTemplateRepository } from './repositories/character-sheet-template.repository'
import { characterSheetTemplateEntitySchema } from './schemas/character-sheet-template.zod'
import { TEMPLATE_VALIDATION_PORT, TemplateValidationPort } from './validation/template-validation.port'

type DeleteCharacterSheetTemplateResult =
  { templateId: string; status: 'draft'; deleted: true } | CharacterSheetTemplateEntity

@Injectable()
export class CharacterSheetTemplateService {
  constructor(
    private readonly repository: CharacterSheetTemplateRepository,
    @Inject(TEMPLATE_VALIDATION_PORT)
    private readonly validationPort: TemplateValidationPort
  ) {}

  async create(
    dto: CreateCharacterSheetTemplateDto,
    authorDiscordUserId: string
  ): Promise<CharacterSheetTemplateEntity> {
    this.assertSchemaVersion(dto.schemaVersion)

    const entity: CharacterSheetTemplateEntity = {
      templateId: uuidv4(),
      status: 'draft',
      version: dto.version ?? '0.1.0',
      schemaVersion: 3,
      name: dto.name,
      gameSystemId: dto.gameSystemId,
      tags: dto.tags ?? [],
      visibility: dto.visibility ?? 'private',
      authorDiscordUserId,
      forkedFrom: dto.forkedFrom,
      license: dto.license,
      sections: dto.sections ?? [],
      tables: dto.tables ?? [],
      settings: this.normalizeSettings(dto.settings),
      draftRevision: 1
    }

    this.assertZodValid(entity)
    await this.validationPort.validateForSave(entity)
    return this.repository.create(entity)
  }

  async findSummaries(authorDiscordUserId: string): Promise<CharacterSheetTemplateSummary[]> {
    return this.repository.findSummariesByAuthor(authorDiscordUserId)
  }

  async findOne(templateId: string, requesterDiscordUserId: string): Promise<CharacterSheetTemplateEntity> {
    const template = await this.findExisting(templateId)
    this.assertOwner(template, requesterDiscordUserId)
    return template
  }

  async update(
    templateId: string,
    dto: UpdateCharacterSheetTemplateDto,
    requesterDiscordUserId: string
  ): Promise<CharacterSheetTemplateEntity> {
    const current = await this.findExisting(templateId)
    this.assertOwner(current, requesterDiscordUserId)
    this.assertSchemaVersion(dto.schemaVersion)

    if (current.status !== 'draft') {
      if (this.hasStructuralUpdate(dto)) {
        throw new ConflictException('published/deprecated template structure is immutable')
      }
      const metadataPatch = this.pickMetadataPatch(dto)
      const patched = await this.repository.patchMetadata(templateId, requesterDiscordUserId, metadataPatch)
      if (!patched) {
        throw new NotFoundException('sheet template not found')
      }
      return patched
    }

    if (dto.draftRevision === undefined) {
      throw new BadRequestException('draftRevision is required for draft autosave')
    }
    if (dto.draftRevision !== current.draftRevision) {
      throw new ConflictException('draftRevision conflict')
    }

    const updateData = this.pickDraftUpdate(dto)
    const merged: CharacterSheetTemplateEntity = {
      ...current,
      ...updateData,
      draftRevision: current.draftRevision
    }

    this.assertZodValid(merged)
    await this.validationPort.validateForSave(merged)

    const updated = await this.repository.updateDraft(templateId, requesterDiscordUserId, dto.draftRevision, updateData)
    if (!updated) {
      throw new ConflictException('draftRevision conflict')
    }
    return updated
  }

  async publish(templateId: string, requesterDiscordUserId: string): Promise<CharacterSheetTemplateEntity> {
    const current = await this.findExisting(templateId)
    this.assertOwner(current, requesterDiscordUserId)

    if (current.status !== 'draft') {
      throw new ConflictException('only draft templates can be published')
    }

    await this.validationPort.validateForPublish(current)
    const published = await this.repository.publish(
      templateId,
      requesterDiscordUserId,
      current.draftRevision,
      new Date()
    )
    if (!published) {
      throw new ConflictException('draftRevision conflict')
    }
    return published
  }

  async remove(templateId: string, requesterDiscordUserId: string): Promise<DeleteCharacterSheetTemplateResult> {
    const current = await this.findExisting(templateId)
    this.assertOwner(current, requesterDiscordUserId)

    if (current.status === 'draft') {
      const removed = await this.repository.removeDraft(templateId, requesterDiscordUserId)
      if (!removed) {
        throw new NotFoundException('sheet template not found')
      }
      return { templateId, status: 'draft', deleted: true }
    }

    if (current.status === 'published') {
      const deprecated = await this.repository.deprecatePublished(templateId, requesterDiscordUserId)
      if (!deprecated) {
        throw new NotFoundException('sheet template not found')
      }
      return deprecated
    }

    return current
  }

  private async findExisting(templateId: string): Promise<CharacterSheetTemplateEntity> {
    const template = await this.repository.findById(templateId)
    if (!template) {
      throw new NotFoundException('sheet template not found')
    }
    return template
  }

  private assertOwner(template: CharacterSheetTemplateEntity, requesterDiscordUserId: string): void {
    if (template.authorDiscordUserId !== requesterDiscordUserId) {
      throw new ForbiddenException('sheet template owner mismatch')
    }
  }

  private normalizeSettings(settings?: Record<string, unknown>): SheetTemplateSettings {
    return { rounding: 'floor', ...(settings ?? {}) } as SheetTemplateSettings
  }

  private assertSchemaVersion(schemaVersion?: number): void {
    if (schemaVersion !== undefined && schemaVersion !== 3) {
      throw new BadRequestException('schemaVersion must be 3')
    }
  }

  private assertZodValid(template: CharacterSheetTemplateEntity): void {
    const result = characterSheetTemplateEntitySchema.safeParse(template)
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((issue) => issue.message).join('; '))
    }
  }

  private hasStructuralUpdate(dto: UpdateCharacterSheetTemplateDto): boolean {
    return (
      dto.version !== undefined ||
      dto.schemaVersion !== undefined ||
      dto.gameSystemId !== undefined ||
      dto.visibility !== undefined ||
      dto.forkedFrom !== undefined ||
      dto.license !== undefined ||
      dto.sections !== undefined ||
      dto.tables !== undefined ||
      dto.settings !== undefined
    )
  }

  private pickMetadataPatch(
    dto: UpdateCharacterSheetTemplateDto
  ): Pick<Partial<CharacterSheetTemplateEntity>, 'name' | 'tags'> {
    const patch: Pick<Partial<CharacterSheetTemplateEntity>, 'name' | 'tags'> = {}
    if (dto.name !== undefined) patch.name = dto.name
    if (dto.tags !== undefined) patch.tags = dto.tags
    return patch
  }

  private pickDraftUpdate(dto: UpdateCharacterSheetTemplateDto): Partial<CharacterSheetTemplateEntity> {
    const updateData: Partial<CharacterSheetTemplateEntity> = {}
    if (dto.name !== undefined) updateData.name = dto.name
    if (dto.version !== undefined) updateData.version = dto.version
    if (dto.schemaVersion !== undefined) updateData.schemaVersion = 3
    if (dto.gameSystemId !== undefined) updateData.gameSystemId = dto.gameSystemId
    if (dto.tags !== undefined) updateData.tags = dto.tags
    if (dto.visibility !== undefined) updateData.visibility = dto.visibility
    if (dto.forkedFrom !== undefined) updateData.forkedFrom = dto.forkedFrom
    if (dto.license !== undefined) updateData.license = dto.license
    if (dto.sections !== undefined) updateData.sections = dto.sections
    if (dto.tables !== undefined) updateData.tables = dto.tables
    if (dto.settings !== undefined) updateData.settings = this.normalizeSettings(dto.settings)
    return updateData
  }
}
