import { HttpException, Injectable, UnprocessableEntityException } from '@nestjs/common'
import { CharacterIdService } from '../../../domains/character/services/character-id.service'
import { CharacterRepository } from '../../../domains/character/repositories/character.repository'
import type { MaterializedCharacterEntity } from '../../../domains/character/models/character.entity'
import { CharacterSheetTemplateService } from '../../../domains/character-sheet-template/character-sheet-template.service'
import { DiceExecutionService } from '../../../domains/dice-roll/services/dice-execution.service'
import { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { rollOnCreateSpec, type SheetField } from '@trpg/sheet-engine'
import {
  InstantiateCharacterInput,
  InstantiateCharacterResult,
  RollOnCreateResult
} from '../types/character-sheet.types'
import { creationRollValue } from './creation-roll-value.util'
import { SheetMaterializerService } from './sheet-materializer.service'

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

    // rollOnCreate の走査は top-level のみ。itemFields 内 track の宣言は save/publish 共通の validatePublishTemplate 経路で拒否される（正本 = track-roll-on-create-promotion-draft.md 裁定 4）。
    for (const field of this.collectTopLevelFields(template)) {
      // 出目は canonical な現在値で提出値と両立しないため、無言で握り潰さず fail-noisy にする（正本 = track-roll-on-create-promotion-draft.md 裁定 5）。roll 型への提出値は先行する validateInputValues が既に 422 にする。発火述語と notation の読み述語は同じ rollOnCreate 契約を指し、契約外形（boolean 等）が DB に残存した場合は提出も発火も成立しない。
      if (
        field.type === 'track' &&
        field.rollOnCreate !== undefined &&
        Object.prototype.hasOwnProperty.call(inputValues, field.uid)
      ) {
        throw new UnprocessableEntityException({
          message: `track field ${field.uid} declares rollOnCreate and cannot accept an explicit creation value`,
          fieldUid: field.uid
        })
      }

      const spec = rollOnCreateSpec(field)
      if (spec === undefined) {
        continue
      }

      const result = await this.diceExecutionService.executeEvaluatedDiceRoll(spec.notation, template.gameSystemId)
      // 出目は field 全体ではなく内訳の行き先キーへ書く（内訳を持てる field のとき）。
      // 全体を生の数値で上書きすると他の内訳が消えるため、書き込み規則は振り直しと共有する。
      values[field.uid] = creationRollValue(field, values[field.uid], result.total, spec.partsKey)
      rollOnCreateResults.push({
        uid: field.uid,
        label: field.label,
        notation: spec.notation,
        total: result.total,
        details: result.details
      })
    }

    return { values, rollOnCreateResults }
  }

  private collectTopLevelFields(template: CharacterSheetTemplateEntity): SheetField[] {
    return template.sections.flatMap((section) => {
      const fields = section.fields
      return Array.isArray(fields) ? (fields as SheetField[]) : []
    })
  }
}
