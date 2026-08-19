import { HttpException, Injectable, UnprocessableEntityException } from '@nestjs/common'
import { CharacterIdService } from '../../../domains/character/services/character-id.service'
import { CharacterRepository } from '../../../domains/character/repositories/character.repository'
import type { MaterializedCharacterEntity } from '../../../domains/character/models/character.entity'
import { CharacterSheetTemplateService } from '../../../domains/character-sheet-template/character-sheet-template.service'
import { DiceExecutionService } from '../../../domains/dice-roll/services/dice-execution.service'
import { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { rollOnCreateSpec, type RollOnCreateSpec, type SheetField } from '@trpg/sheet-engine'
import {
  InstantiateCharacterInput,
  InstantiateCharacterResult,
  RollOnCreateResult
} from '../types/character-sheet.types'
import { creationRollValue } from './creation-roll-value.util'
import { SheetMaterializerService } from './sheet-materializer.service'
import { allowsParts, isPartsValue } from './sheet-values.util'

/**
 * 作成時ロールの出目が提出値を捨てるか（= 提出と衝突するか）を判定する。
 *
 * 分岐は creationRollValue の書き込み規則から導いたもので、独立した規則ではない。
 * あちらが「提出値をどう畳むか」、ここが「畳んだ結果 提出値が残らないか」を見ており、
 * 両者がずれると「422 にならずに黙って捨てられる提出値」か「捨てられないのに 422」が生まれる。
 * 既定の行き先を base にする `?? 'base'` も同じ理由で creationRollValue と同じ値を置いている
 * （既定を決めているのは書き込み側で、engine の述語は行き先未指定を undefined のまま返す）。
 */
function creationRollDiscardsSubmittedValue(field: SheetField, submitted: unknown, partsKey?: string): boolean {
  // 内訳を持てない field へは出目が生の数値で入り、提出値は丸ごと置き換えられる。
  if (!allowsParts(field)) return true
  // 内訳形でない提出値は creationRollValue が parts を作り直す時点で失われる。
  if (!isPartsValue(submitted)) return true
  return Object.prototype.hasOwnProperty.call(submitted.parts, partsKey ?? 'base')
}

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
      const spec = rollOnCreateSpec(field)
      if (Object.prototype.hasOwnProperty.call(inputValues, field.uid)) {
        this.assertSubmittedValueSurvivesCreationRoll(field, spec, inputValues[field.uid])
      }
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

  /**
   * 作成時ロールを宣言している field へ提出された値を、出目に潰されるなら 422 で拒否する。
   *
   * 出目に潰される提出を黙って受けると、依頼者は自分が送った値が保存されたと思い込む。
   * 無言で握り潰さず fail-noisy にするのが裁定
   * （正本 = document/character-sheet-proposals/track-roll-on-create-promotion-draft.md 裁定 5）。
   *
   * track と scalar で拒否の範囲が違うのは、出目の行き先の広さが違うため。
   * scalar は内訳（parts）を宣言でき、出目はそのうち 1 キーにしか書かない。だから
   * 「職業ボーナスを other へ入れつつ base は振る」のように、出目と両立する提出が原理的に成立する。
   * track は partsKeys を宣言できず（publish の validateNumericAnnotationTarget が拒否する）、
   * 出目は常に現在値そのものを置き換えるので、両立する提出が存在しない。
   *
   * 分かれる軸はもう 1 本ある。契約外形（publish を経ずに保存された `rollOnCreate: true` 等）の扱いで、
   * track は宣言の有無を直に見て拒否し、scalar は rollOnCreateSpec に従うので発火しない宣言では受理する。
   * 理由は track 側の分岐に書いてある。
   */
  private assertSubmittedValueSurvivesCreationRoll(
    field: SheetField,
    spec: RollOnCreateSpec | undefined,
    submitted: unknown
  ): void {
    if (field.type === 'track') {
      // 契約外形（boolean 等）が DB に残存していると rollOnCreateSpec は宣言なしとして undefined を返すが、
      // 提出の拒否はその外側で宣言の有無だけを見る。発火しない宣言の下で提出値だけが通ると、
      // 「作成時に振られる項目」として著者が宣言したはずの項目へクライアントの値が入る。
      if (field.rollOnCreate === undefined) return
      throw new UnprocessableEntityException({
        message: `track field ${field.uid} declares rollOnCreate and cannot accept an explicit creation value`,
        fieldUid: field.uid
      })
    }

    // roll 型は常に作成時ロールの対象だが、その提出は先行する validateInputValues が既に 422 にしている
    // （value-input.ts が roll に入力 schema を返さない）。ここでも弾くと同じ提出に対する拒否が 2 箇所に分かれる。
    // この分岐は今日どの経路からも観測されない。行ごと削除して本 service の spec を走らせても
    // 21 passed / 21 のまま赤くなるテストが 1 本も無いことを確認済み（validateInputValues が先に落とすため）。
    // 「いつ効くのか」を探して読者が時間を使わないよう、到達不能である事実を測定結果として残す。
    if (field.type === 'roll') return

    // 作成時ロールの対象でない field への提出は自由。対象集合の判定は rollOnCreateSpec 1 本に任せる。
    if (spec === undefined) return
    if (!creationRollDiscardsSubmittedValue(field, submitted, spec.partsKey)) return

    throw new UnprocessableEntityException({
      message: `field ${field.uid} declares rollOnCreate and cannot accept a creation value that the roll would overwrite`,
      fieldUid: field.uid
    })
  }

  private collectTopLevelFields(template: CharacterSheetTemplateEntity): SheetField[] {
    return template.sections.flatMap((section) => {
      const fields = section.fields
      return Array.isArray(fields) ? (fields as SheetField[]) : []
    })
  }
}
