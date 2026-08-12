import { HttpException, Injectable, UnprocessableEntityException } from '@nestjs/common'
import { CharacterIdService } from '../../../domains/character/services/character-id.service'
import { CharacterRepository } from '../../../domains/character/repositories/character.repository'
import type { MaterializedCharacterEntity } from '../../../domains/character/models/character.entity'
import { CharacterSheetTemplateService } from '../../../domains/character-sheet-template/character-sheet-template.service'
import { DiceExecutionService } from '../../../domains/dice-roll/services/dice-execution.service'
import { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { toEngineTemplate } from '../../../domains/character-sheet-template/validation/sheet-engine-template.mapper'
import type { SheetField } from '@trpg/sheet-engine'
import {
  InstantiateCharacterInput,
  InstantiateCharacterResult,
  RollOnCreateResult
} from '../types/character-sheet.types'
import { SheetMaterializerService } from './sheet-materializer.service'
import { TrackRangePolicy } from './track-range.policy'

@Injectable()
export class CharacterInstantiationService {
  constructor(
    private readonly templateService: CharacterSheetTemplateService,
    private readonly characterRepository: CharacterRepository,
    private readonly characterIdService: CharacterIdService,
    private readonly diceExecutionService: DiceExecutionService,
    private readonly sheetMaterializer: SheetMaterializerService
  ) {}

  async instantiate(input: InstantiateCharacterInput): Promise<InstantiateCharacterResult> {
    const template = await this.templateService.resolveForCreate(
      input.templateId,
      input.templateVersion,
      input.requesterDiscordUserId
    )
    const submittedValues = this.sheetMaterializer.validateInputValues(template, input.values ?? {})
    const { values, rollOnCreateResults } = await this.applyRollOnCreate(template, submittedValues)
    new TrackRangePolicy(toEngineTemplate(template)).assertCreationValuesWithinBounds(values)
    const materialized = this.materializeOrThrow(template, values)
    const characterId = await this.characterIdService.generateUniqueCharacterId()
    const entity: MaterializedCharacterEntity = {
      characterId,
      characterName: input.characterName,
      gameSystemId: template.gameSystemId ?? '',
      discordUserId: input.discordUserId,
      discordChannelId: input.discordChannelId,
      ...(input.discordThreadId === undefined ? {} : { discordThreadId: input.discordThreadId }),
      sheet: materialized.sheet,
      computedCache: materialized.computedCache,
      palette: materialized.palette,
      status: materialized.projection.status,
      parameter: materialized.projection.parameter,
      skill: materialized.projection.skill,
      item: materialized.projection.item,
      description: materialized.projection.description,
      hub: { status: 'none' },
      appliedInteractionIds: []
    }
    const character = await this.characterRepository.createMaterializedCharacter(entity)

    return { character, materialized, rollOnCreateResults }
  }

  private materializeOrThrow(
    template: CharacterSheetTemplateEntity,
    values: Record<string, unknown>
  ): ReturnType<SheetMaterializerService['materialize']> {
    try {
      return this.sheetMaterializer.materialize({
        template,
        sheet: {
          templateId: template.templateId,
          templateVersion: template.version,
          revision: 1,
          visibility: 'private',
          values
        }
      })
    } catch (error) {
      if (error instanceof HttpException) throw error
      throw new UnprocessableEntityException({
        message: 'sheet evaluation or projection failed',
        detail: error instanceof Error ? error.message : String(error)
      })
    }
  }

  private async applyRollOnCreate(
    template: CharacterSheetTemplateEntity,
    inputValues: Record<string, unknown>
  ): Promise<{ values: Record<string, unknown>; rollOnCreateResults: RollOnCreateResult[] }> {
    const values = { ...inputValues }
    const rollOnCreateResults: RollOnCreateResult[] = []

    for (const field of this.collectTopLevelFields(template)) {
      const notation = this.rollOnCreateNotation(field)
      if (!notation) {
        continue
      }

      const result = await this.diceExecutionService.executeEvaluatedDiceRoll(notation, template.gameSystemId)
      values[field.uid] = result.total
      rollOnCreateResults.push({
        uid: field.uid,
        notation,
        total: result.total,
        details: result.details
      })
    }

    return { values, rollOnCreateResults }
  }

  private rollOnCreateNotation(field: SheetField): string | undefined {
    const candidate = field as SheetField & { rollOnCreate?: boolean | string; notation?: string }
    if (!candidate.rollOnCreate) {
      return undefined
    }
    if (typeof candidate.rollOnCreate === 'string') {
      return candidate.rollOnCreate
    }
    return candidate.notation
  }

  private collectTopLevelFields(template: CharacterSheetTemplateEntity): SheetField[] {
    return template.sections.flatMap((section) => {
      const fields = section.fields
      return Array.isArray(fields) ? (fields as SheetField[]) : []
    })
  }
}
