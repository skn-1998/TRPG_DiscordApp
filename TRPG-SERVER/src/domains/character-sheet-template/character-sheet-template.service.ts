import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { SYSTEM_TEMPLATE_AUTHOR } from './character-sheet-template.constants'
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

  async fork(templateId: string, requesterDiscordUserId: string): Promise<CharacterSheetTemplateEntity> {
    const source = await this.findExisting(templateId)

    // 自分所有は status を検査せず draft も許可する。
    // allowedStatuses 必須の resolveForCreate / resolvePinnedRevision を再利用すると、自分の draft が 409 になる。
    this.assertRevisionReadableBy(source, requesterDiscordUserId)
    // system 特例は複製元の読み取りだけで、mutation は所有者限定のまま。元は更新せず要求者名義で新規作成する。
    if (source.authorDiscordUserId !== requesterDiscordUserId && source.status !== 'published') {
      throw new ConflictException('only published system sheet templates can be forked')
    }

    // visibility は継承元を信用しない独立防御として payload から省き、
    // create() の既定値 dto.visibility ?? 'private' で private にする。
    // legacy-coc は published かつ private の seed 反例で、publish() は DB 全行の visibility を保証しない。
    return this.create(
      {
        name: `${source.name} のコピー`,
        version: source.version,
        schemaVersion: 3,
        gameSystemId: source.gameSystemId,
        tags: source.tags,
        forkedFrom: { templateId: source.templateId, version: source.version },
        license: source.license,
        sections: source.sections,
        tables: source.tables,
        settings: source.settings
      },
      requesterDiscordUserId
    )
  }

  async findSummaries(requesterDiscordUserId: string): Promise<CharacterSheetTemplateSummary[]> {
    return this.repository.findListedSummariesForRequester(requesterDiscordUserId)
  }

  async findOne(templateId: string, requesterDiscordUserId: string): Promise<CharacterSheetTemplateEntity> {
    const template = await this.findExisting(templateId)
    this.assertOwner(template, requesterDiscordUserId)
    return template
  }

  async resolveForCreate(
    templateId: string,
    version: string,
    requesterDiscordUserId: string
  ): Promise<CharacterSheetTemplateEntity> {
    return this.resolveReadableRevision(
      templateId,
      version,
      requesterDiscordUserId,
      ['published'],
      'sheet template for create must be published at the requested version'
    )
  }

  async resolvePinnedRevision(
    templateId: string,
    version: string,
    requesterDiscordUserId: string
  ): Promise<CharacterSheetTemplateEntity> {
    return this.resolveReadableRevision(
      templateId,
      version,
      requesterDiscordUserId,
      ['published', 'deprecated'],
      'pinned sheet template revision must be published or deprecated at the requested version'
    )
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

  private async resolveReadableRevision(
    templateId: string,
    version: string,
    requesterDiscordUserId: string,
    allowedStatuses: readonly CharacterSheetTemplateEntity['status'][],
    conflictMessage: string
  ): Promise<CharacterSheetTemplateEntity> {
    const template = await this.findExisting(templateId)
    this.assertRevisionReadableBy(template, requesterDiscordUserId)

    // Phase 2 は templateId ごとに単一バージョンのみを保持する。
    // 複数バージョン共存は Phase 4 の repository/schema 変更で扱う。
    if (!allowedStatuses.includes(template.status) || template.version !== version) {
      throw new ConflictException(conflictMessage)
    }

    return template
  }

  private assertRevisionReadableBy(template: CharacterSheetTemplateEntity, requesterDiscordUserId: string): void {
    // system 所有テンプレートの配布特例は版解決の読み取り限定。mutation は所有者限定のまま変更しない。
    if (
      template.authorDiscordUserId !== requesterDiscordUserId &&
      template.authorDiscordUserId !== SYSTEM_TEMPLATE_AUTHOR
    ) {
      throw new ForbiddenException('sheet template owner mismatch')
    }
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
      throw new BadRequestException(result.error.issues.map((issue) => issue.message))
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
