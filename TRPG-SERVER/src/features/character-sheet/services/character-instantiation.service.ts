import { Injectable } from '@nestjs/common'
import { CharacterIdService } from '../../../domains/character/services/character-id.service'
import { CharacterService } from '../../../domains/character/character.service'
import { CharacterSheetTemplateService } from '../../../domains/character-sheet-template/character-sheet-template.service'
import { DiceExecutionService } from '../../../domains/dice-roll/services/dice-execution.service'
import { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import type { SheetField } from '@trpg/sheet-engine'
import {
  InstantiateCharacterInput,
  InstantiateCharacterResult,
  RollOnCreateResult
} from '../types/character-sheet.types'
import { SheetMaterializerService } from './sheet-materializer.service'

@Injectable()
export class CharacterInstantiationService {
  constructor(
    private readonly templateService: CharacterSheetTemplateService,
    private readonly characterService: CharacterService,
    private readonly characterIdService: CharacterIdService,
    private readonly diceExecutionService: DiceExecutionService,
    private readonly sheetMaterializer: SheetMaterializerService
  ) {}

  async instantiate(input: InstantiateCharacterInput): Promise<InstantiateCharacterResult> {
    const template = await this.templateService.findOne(input.templateId, input.requesterDiscordUserId)
    const { values, rollOnCreateResults } = await this.applyRollOnCreate(template, input.values ?? {})
    const materialized = this.sheetMaterializer.materialize({
      template,
      sheet: {
        templateId: template.templateId,
        templateVersion: template.version,
        revision: 1,
        values
      }
    })
    const characterId = await this.characterIdService.generateUniqueCharacterId()
    const character = await this.characterService.create({
      characterId,
      characterName: input.characterName,
      gameSystemId: template.gameSystemId ?? '',
      discordUserId: input.discordUserId,
      discordChannelId: input.discordChannelId,
      discordThreadId: input.discordThreadId,
      status: materialized.projection.status,
      parameter: materialized.projection.parameter,
      skill: materialized.projection.skill,
      item: materialized.projection.item,
      description: materialized.projection.description
    })

    return { character, materialized, rollOnCreateResults }
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
