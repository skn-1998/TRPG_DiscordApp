import { HttpException, Injectable, UnprocessableEntityException } from '@nestjs/common'
import { CharacterIdService } from '../../../domains/character/services/character-id.service'
import { CharacterRepository } from '../../../domains/character/repositories/character.repository'
import type { MaterializedCharacterEntity } from '../../../domains/character/models/character.entity'
import { CharacterSheetTemplateService } from '../../../domains/character-sheet-template/character-sheet-template.service'
import { DiceExecutionService } from '../../../domains/dice-roll/services/dice-execution.service'
import { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { evaluateConstraint, rollOnCreateSpec, type RollOnCreateSpec, type SheetField } from '@trpg/sheet-engine'
import { toEngineTemplate } from '../../../domains/character-sheet-template/validation/sheet-engine-template.mapper'
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
    // 既定値の焼き込みは作成時ロールの後・materialize の前でなければならない（理由は applyPartsDefaults）。
    const valuesWithDefaults = this.applyPartsDefaults(template, values)
    const materialized = this.materializeOrThrow(template, valuesWithDefaults)
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
   * 内訳キーの既定値（`partsKeys[].default`）をシートの値へ焼き込む。
   *
   * 適用時点を作成時に固定するのは D-17 の裁定
   * （正本 = document/character-sheet-proposals/roll-lane-framing.md の「確定した裁定」）。
   * 評価時に既定値を動的に返す形にはしない。焼き込んでしまえば内訳はシートの値だけで完結し、
   * テンプレート側の既定値を後から直しても既存キャラには波及しない（pinned revision と同じ考え方）。
   *
   * 呼ぶ位置は applyRollOnCreate の後・materialize の前でなければならない。既定値の式は能力値を
   * 参照でき（`{parameter.dex} * 2`）、その能力値は作成時ロールで決まる。ロールの前に評価すると
   * 参照先が生入力欠落のまま evaluateConstraint に入り indeterminate になって、既定値が 1 つも入らない。
   * この順序は spec の「式の既定値は作成時ロールで決まった値を参照して焼き込まれる」が固定している。
   *
   * 評価は全ての既定値について「ロール適用後の同一スナップショット」に対して行う。よって既定値どうしの
   * 依存は解決しない（ある既定値が別 field の既定値由来の値を参照しても、その値は見えない）。
   * 焼き込んだ端から次の評価へ渡す逐次適用にすると、宣言順を変えただけで結果が変わる形になるため、
   * 依存の解決（トポロジカルソート）が要るならそれを設計してから入れること。本スライスの範囲外。
   */
  private applyPartsDefaults(
    template: CharacterSheetTemplateEntity,
    rolledValues: Record<string, unknown>
  ): Record<string, unknown> {
    const engineTemplate = toEngineTemplate(template)
    const values = { ...rolledValues }

    for (const field of this.collectTopLevelFields(template)) {
      // 既定値を宣言できるのは section 直下 number scalar の partsKeys だけで、それ以外の型・階層への
      // partsKeys は publish の validateNumericAnnotationTarget が拒否している。
      if (field.type !== 'scalar' || field.partsKeys === undefined) continue
      // 内訳を持てない field には書き込み先が無い。partsKeys を宣言しつつ allowsParts が false になるのは
      // valueType が number でない契約外形（publish を経ずに DB へ入った形）だけで、そこへ内訳形を書くと
      // value-input.ts の `isPartsValue && !allowsParts` 拒否に引っかかり以後提出し直せない値になる。
      if (!allowsParts(field)) continue

      const currentValue = values[field.uid]
      // 生の数値には適用しない。生値をどの内訳に属すると解釈するかは同じ feature の中でも規則が割れており
      // （creationRollValue は捨てて作り直す／CharacterSheetOperationService の seedParts は base に残す。
      // creation-roll-value.util.ts に食い違いとして明記されている）、既定値のためにその裁定を先取りしない。
      if (currentValue !== undefined && !isPartsValue(currentValue)) continue

      const parts = isPartsValue(currentValue) ? { ...currentValue.parts } : {}
      let applied = false
      for (const partsKey of field.partsKeys) {
        if (partsKey.default === undefined) continue
        // 提出値と作成時ロールが既に書いたキーには触らない。
        if (Object.prototype.hasOwnProperty.call(parts, partsKey.id)) continue
        // 評価対象は values ではなく rolledValues。values を渡すと先に焼き込んだ既定値が後続の評価から
        // 見えるようになり、上の JSDoc が禁じている宣言順依存が入り込む。
        const evaluated = evaluateConstraint(partsKey.default, engineTemplate, rolledValues)
        // ok 以外（indeterminate / error）では何も書かない。ここで 0 を書かないことが本経路の要点で、
        // 「宣言は正しいのに値が静かに 0 になる」不具合をこの焼き込み自体が塞いでいる。未確定を 0 として
        // 焼き込むと、テンプレートを直しても波及しない保存値としてその 0 が恒久化する。
        if (evaluated.status !== 'ok') continue
        parts[partsKey.id] = evaluated.value
        applied = true
      }

      // 1 つも入らなかった field には触らない。値の無い field へ空の内訳（`{ parts: {} }`）を書くと
      // 「値がある」状態になり、その field を参照する式の生入力欠落判定
      // （constraint-evaluator の isRawNumberDependencyMissing）が成立しなくなって、未入力が 0 として評価される。
      if (applied) values[field.uid] = { parts }
    }

    return values
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
