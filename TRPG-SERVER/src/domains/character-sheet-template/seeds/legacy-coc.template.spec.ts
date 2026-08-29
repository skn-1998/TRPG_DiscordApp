import {
  evaluateAnnotationRuntime,
  evaluateConstraint,
  evaluateTemplate,
  validatePublishTemplate
} from '@trpg/sheet-engine'
import StaticLoader from 'bcdice/lib/loader/static_loader'
import { SYSTEM_TEMPLATE_AUTHOR } from '../character-sheet-template.constants'
import { LEGACY_COC_TEMPLATE } from './legacy-coc.template'

// document/character-sheet-proposals/legacy-coc-v3-skills.md の表を正本として転記する。
// 実装の LEGACY_COC_SKILLS から生成すると、実装側の誤りまで期待値に取り込んでしまう。
const EXPECTED_LEGACY_COC_SKILL_ROSTER = [
  { id: 'dodge', label: '回避', initial: { formula: 'floor({parameter.dex} * 2 / 5)' } },
  { id: 'kick', label: 'キック', initial: 25 },
  { id: 'grapple', label: '組み付き', initial: 25 },
  { id: 'punch', label: 'こぶし（パンチ）', initial: 50 },
  { id: 'headbutt', label: '頭突き', initial: 10 },
  { id: 'throw', label: '投擲', initial: 25 },
  { id: 'martial_arts', label: 'マーシャルアーツ', initial: 1 },
  { id: 'handgun', label: '拳銃', initial: 20 },
  { id: 'smg', label: 'サブマシンガン', initial: 15 },
  { id: 'shotgun', label: 'ショットガン', initial: 30 },
  { id: 'machinegun', label: 'マシンガン', initial: 15 },
  { id: 'rifle', label: 'ライフル', initial: 25 },
  { id: 'first_aid', label: '応急手当', initial: 30 },
  { id: 'locksmith', label: '鍵開け', initial: 1 },
  { id: 'conceal', label: '隠す', initial: 15 },
  { id: 'hide', label: '隠れる', initial: 10 },
  { id: 'listen', label: '聞き耳', initial: 25 },
  { id: 'sneak', label: '忍び歩き', initial: 10 },
  { id: 'photography', label: '写真術', initial: 10 },
  { id: 'psychoanalysis', label: '精神分析', initial: 1 },
  { id: 'track', label: '追跡', initial: 10 },
  { id: 'climb', label: '登攀', initial: 40 },
  { id: 'library', label: '図書館', initial: 25 },
  { id: 'spot_hidden', label: '目星', initial: 25 },
  { id: 'drive', label: '運転（自動車）', initial: 20 },
  { id: 'mech_repair', label: '機械修理', initial: 20 },
  { id: 'operate_heavy_machine', label: '重機械操作', initial: 1 },
  { id: 'ride', label: '乗馬', initial: 5 },
  { id: 'swim', label: '水泳', initial: 25 },
  { id: 'craft', label: '製作', initial: 5 },
  { id: 'pilot', label: '操縦', initial: 1 },
  { id: 'jump', label: '跳躍', initial: 25 },
  { id: 'electr_repair', label: '電気修理', initial: 10 },
  { id: 'navigate', label: 'ナビゲート', initial: 10 },
  { id: 'disguise', label: '変装', initial: 1 },
  { id: 'fast_talk', label: '言いくるめ', initial: 5 },
  { id: 'credit_rating', label: '信用', initial: 15 },
  { id: 'persuade', label: '説得', initial: 15 },
  { id: 'bargain', label: '値切り', initial: 5 },
  { id: 'own_language', label: '母国語', initial: { formula: '{parameter.edu}' } },
  { id: 'other_language_1', label: '他の言語 1', initial: 1 },
  { id: 'other_language_2', label: '他の言語 2', initial: 1 },
  { id: 'other_language_3', label: '他の言語 3', initial: 1 },
  { id: 'medicine', label: '医学', initial: 5 },
  { id: 'occult', label: 'オカルト', initial: 5 },
  { id: 'chemistry', label: '化学', initial: 1 },
  { id: 'cthulhu_mythos', label: 'クトゥルフ神話', initial: 0 },
  { id: 'art', label: '芸術', initial: 5 },
  { id: 'accounting', label: '経理', initial: 10 },
  { id: 'archaeology', label: '考古学', initial: 1 },
  { id: 'computer', label: 'コンピューター', initial: 1 },
  { id: 'psychology', label: '心理学', initial: 5 },
  { id: 'anthropology', label: '人類学', initial: 1 },
  { id: 'biology', label: '生物学', initial: 1 },
  { id: 'geology', label: '地質学', initial: 1 },
  { id: 'electronics', label: '電子工学', initial: 1 },
  { id: 'astronomy', label: '天文学', initial: 1 },
  { id: 'natural_history', label: '博物学', initial: 10 },
  { id: 'physics', label: '物理学', initial: 1 },
  { id: 'law', label: '法律', initial: 5 },
  { id: 'pharmacy', label: '薬学', initial: 1 },
  { id: 'history', label: '歴史', initial: 20 }
] as const

/** section を id で取得する。存在しなければ呼び出し元の宣言形 pin が意味を失うので、取得時点で落とす。 */
function sectionById(sectionId: string) {
  const section = LEGACY_COC_TEMPLATE.sections.find((candidate) => candidate.id === sectionId)
  if (section === undefined) {
    throw new Error(`legacy-coc template does not contain section ${sectionId}`)
  }
  return section
}

/** 技能セクション。存在しなければ以降の技能 it はすべて意味を失うので、取得できない時点で落とす。 */
function skillSection() {
  return sectionById('skill')
}

/** v3 から形を変えずに引き継ぐ標準 62 技能。v4 で追加した custom_skills だけを除外する。 */
function standardSkillFields() {
  return skillSection().fields.filter((field) => field.id !== 'custom_skills')
}

/** section 末尾へ標準搭載するカスタム欄。list でなければ宣言形 pin の前提が崩れているので即座に落とす。 */
function listField(sectionId: string, fieldId: string) {
  const field = sectionById(sectionId).fields.find((candidate) => candidate.id === fieldId)
  if (field?.type !== 'list') {
    throw new Error(`legacy-coc template does not contain list field ${sectionId}.${fieldId}`)
  }
  return field
}

function poolById(poolId: string, values: Record<string, unknown>) {
  const runtime = evaluateAnnotationRuntime(LEGACY_COC_TEMPLATE, values)
  const pool = runtime.sections
    .find((section) => section.sectionId === 'skill')
    ?.pools.find((candidate) => candidate.poolId === poolId)
  if (pool === undefined) {
    throw new Error(`legacy-coc template does not contain pool runtime skill.${poolId}`)
  }
  return { pool, warnings: runtime.warnings }
}

describe('LEGACY_COC_TEMPLATE', () => {
  it('配布 id・版・schemaVersion を固定する', () => {
    expect(LEGACY_COC_TEMPLATE.templateId).toBe('legacy-coc-v4')
    expect(LEGACY_COC_TEMPLATE.version).toBe('1.0.0')
    expect(LEGACY_COC_TEMPLATE.schemaVersion).toBe(3)
  })

  it('uses the domain-pinned system template author', () => {
    expect(SYSTEM_TEMPLATE_AUTHOR).toBe('system')
    expect(LEGACY_COC_TEMPLATE.authorDiscordUserId).toBe(SYSTEM_TEMPLATE_AUTHOR)
  })

  it('passes sheet-engine publish validation', () => {
    const result = validatePublishTemplate(LEGACY_COC_TEMPLATE)

    expect(result.issues).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('uses a game system ID that BCDice StaticLoader can load', async () => {
    await expect(new StaticLoader().dynamicLoad(LEGACY_COC_TEMPLATE.gameSystemId!)).resolves.toBeDefined()
  })

  it('evaluates HP, MP, and DB for sample legacy CoC values', () => {
    const evaluated = evaluateTemplate(LEGACY_COC_TEMPLATE, {
      values: {
        lgc_str: 50,
        lgc_siz: 60,
        lgc_con: 55,
        lgc_pow: 60
      }
    })

    expect(evaluated.values.lgc_hp).toEqual({ type: 'number', value: 11 })
    expect(evaluated.values.lgc_mp).toEqual({ type: 'number', value: 12 })
    expect(evaluated.values.lgc_db).toEqual({ type: 'dice', value: '0' })
  })

  it('evaluates DB as -2 when values are empty', () => {
    const evaluated = evaluateTemplate(LEGACY_COC_TEMPLATE, { values: {} })

    expect(evaluated.values.lgc_db).toEqual({ type: 'dice', value: '-2' })
  })

  it('covers damage bonus values outside the original table bounds', () => {
    const belowOriginalRange = evaluateTemplate(LEGACY_COC_TEMPLATE, {
      values: {
        lgc_str: 0,
        lgc_siz: 0
      }
    })
    const aboveOriginalRange = evaluateTemplate(LEGACY_COC_TEMPLATE, {
      values: {
        lgc_str: 999,
        lgc_siz: 0
      }
    })

    expect(belowOriginalRange.values.lgc_db).toEqual({ type: 'dice', value: '-2' })
    expect(aboveOriginalRange.values.lgc_db).toEqual({ type: 'dice', value: '+1d6' })
  })

  it('evaluates damage bonus boundary values at STR plus SIZ 124 and 125', () => {
    const belowBoundary = evaluateTemplate(LEGACY_COC_TEMPLATE, {
      values: {
        lgc_str: 64,
        lgc_siz: 60
      }
    })
    const atBoundary = evaluateTemplate(LEGACY_COC_TEMPLATE, {
      values: {
        lgc_str: 65,
        lgc_siz: 60
      }
    })

    expect(belowBoundary.values.lgc_db).toEqual({ type: 'dice', value: '0' })
    expect(atBoundary.values.lgc_db).toEqual({ type: 'dice', value: '+1d4' })
  })

  /**
   * Test intent: 技能セクションが投影先の名前 `skill` で在り、CoC6 標準 62 本が揃っていることを固定する。
   * section id が変わると projectionTarget が description へ寄せて技能が skill 投影から消える。
   * 本数が変わるのは正本（document/character-sheet-proposals/legacy-coc-v3-skills.md）からの逸脱。
   */
  it('技能セクションが id skill で存在し 62 技能を持つ', () => {
    expect(standardSkillFields()).toHaveLength(62)
  })

  /**
   * Test intent: published 後のテンプレート構造は不変で、技能 roster の誤りは次の id での出し直しでしか直せない。
   * そのため配布前に、id・label・初期値・宣言順が正本の表と一致することを単一配列で固定する。
   */
  it('技能 roster の id・label・初期値・宣言順が配布前の正本と一致する', () => {
    const roster = standardSkillFields().map((field) => {
      if (field.type !== 'scalar') {
        throw new Error(`skill ${field.id} is not a scalar field`)
      }
      return {
        id: field.id,
        label: field.label,
        initial: field.partsKeys?.find((partsKey) => partsKey.id === 'initial')?.default
      }
    })

    expect(roster).toEqual(EXPECTED_LEGACY_COC_SKILL_ROSTER)
  })

  /**
   * Test intent: 全技能が「section 直下の number scalar ＋ 内訳キー 3 種」であることを固定する。
   * これは作成時の既定値の焼き込み（applyPartsDefaults）と、partsKey を section 直下 field の宣言で充足する
   * プールの publish 資格の適用条件そのもので、
   * 崩れると回避・母国語の初期値が焼き込まれず 0 になり、職業・興味ポイントの振り先も消える。
   */
  it('全技能が section 直下の number scalar で内訳キー initial/occupation/interest を持つ', () => {
    for (const field of standardSkillFields()) {
      expect(field.type).toBe('scalar')
      if (field.type !== 'scalar') continue
      expect(field.valueType).toBe('number')
      expect(field.partsKeys?.map((partsKey) => partsKey.id)).toEqual(['initial', 'occupation', 'interest'])
    }
  })

  /**
   * Test intent: 職業・興味キーへ default を書くと作成時に焼き込まれ、ユーザーが振る前から
   * consumed / remaining が消費済みになる。作成時に焼き込んでよいのは initial だけなので、
   * 全 62 技能の allocation key が default プロパティ自体を持たないことを固定する。
   */
  it('全技能の職業・興味キーは default を持たない', () => {
    const allocationKeyStates = standardSkillFields().flatMap((field) => {
      if (field.type !== 'scalar') {
        throw new Error(`skill ${field.id} is not a scalar field`)
      }
      return (field.partsKeys ?? [])
        .filter((partsKey) => partsKey.id === 'occupation' || partsKey.id === 'interest')
        .map((partsKey) => ({
          fieldId: field.id,
          partsKey: partsKey.id,
          hasDefault: Object.prototype.hasOwnProperty.call(partsKey, 'default')
        }))
    })
    const expectedStates = standardSkillFields().flatMap((field) => [
      { fieldId: field.id, partsKey: 'occupation', hasDefault: false },
      { fieldId: field.id, partsKey: 'interest', hasDefault: false }
    ])

    expect(allocationKeyStates).toEqual(expectedStates)
  })

  /**
   * Test intent: 技能判定を手入力ダイスへ退行させないため、クトゥルフ神話を含む全 62 技能が
   * 同じ rollable role を持つことを固定する。`{value}` は初期・職業・興味・other の内訳合計へ解決される。
   */
  it('全技能が技能判定用の rollable role を持つ', () => {
    for (const field of standardSkillFields()) {
      expect(field.role).toEqual({ kind: 'rollable', notation: '1d100<={value}', group: 'skill' })
    }
  })

  /**
   * Test intent: 行投影の値出所と pool 集計を同じ value item に固定する。
   * partsKeys の default はプロパティ不在まで検査し、行追加前から予算が消費される宣言を許さない。
   */
  it('カスタム技能 list が itemFields・partsKeys・rowRole の v4 契約を宣言する', () => {
    const field = listField('skill', 'custom_skills')

    expect(skillSection().fields[skillSection().fields.length - 1]).toBe(field)
    expect(field).toEqual({
      type: 'list',
      id: 'custom_skills',
      uid: 'lgc_custom_skills',
      label: 'カスタム技能',
      itemFields: [
        {
          type: 'scalar',
          id: 'name',
          uid: 'lgc_custom_skill_name',
          label: '技能名',
          valueType: 'text'
        },
        {
          type: 'scalar',
          id: 'value',
          uid: 'lgc_custom_skill_value',
          label: '技能値',
          valueType: 'number',
          partsKeys: [
            { id: 'initial', label: '初期値' },
            { id: 'occupation', label: '職業' },
            { id: 'interest', label: '興味' }
          ]
        }
      ],
      rowRole: {
        kind: 'rollable',
        notation: '1d100<={row.value}',
        group: 'skill',
        labelSubFieldId: 'name'
      }
    })

    const valueField = field.itemFields.find((itemField) => itemField.id === 'value')
    if (valueField?.type !== 'scalar') {
      throw new Error('custom skill value is not a scalar item field')
    }
    for (const partsKey of valueField.partsKeys ?? []) {
      expect(Object.prototype.hasOwnProperty.call(partsKey, 'default')).toBe(false)
    }
  })

  /**
   * Test intent: カスタムステータスは advisory な現在値・上限の列だけを持ち、
   * palette / 投影へ参加させる rowRole を宣言しないことを固定する。
   */
  it('カスタムステータス list が 3 itemFields を持ち rowRole を宣言しない', () => {
    const field = listField('status', 'custom_status')
    const statusSection = sectionById('status')

    expect(statusSection.fields[statusSection.fields.length - 1]).toBe(field)
    expect(field).toEqual({
      type: 'list',
      id: 'custom_status',
      uid: 'lgc_custom_status',
      label: 'カスタムステータス',
      itemFields: [
        { type: 'scalar', id: 'name', uid: 'lgc_custom_status_name', label: '名称', valueType: 'text' },
        { type: 'scalar', id: 'value', uid: 'lgc_custom_status_value', label: '現在値', valueType: 'number' },
        {
          type: 'scalar',
          id: 'limit',
          uid: 'lgc_custom_status_limit',
          label: '上限（目安）',
          valueType: 'number'
        }
      ]
    })
    expect(Object.prototype.hasOwnProperty.call(field, 'rowRole')).toBe(false)
  })

  /**
   * Test intent: プール 2 本の振り先キーと予算式を固定する。partsKey が技能の内訳キーから外れると
   * publish が `pool partsKey must be declared by a field in scope` で落ちる。
   * 係数（EDU × 4 / INT × 2）は能力値がパーセンタイル（原典 raw × 5）であることに依存する。
   */
  it('プール 2 本が職業 EDU*4・興味 INT*2 の予算を宣言する', () => {
    expect(skillSection().pools).toEqual([
      { id: 'occupation', label: '職業ポイント', total: { formula: '{parameter.edu} * 4' }, partsKey: 'occupation' },
      { id: 'interest', label: '興味ポイント', total: { formula: '{parameter.int} * 2' }, partsKey: 'interest' }
    ])
  })

  /**
   * Test intent: 式で書いた初期値と予算が、能力値から具体的な数値へ解決されることを固定する。
   * 参照先の綴りやスケール換算（/5・*4・*2）を間違えると indeterminate / error になり、
   * applyPartsDefaults が何も焼き込まないまま作成が通る（＝初期値 0 のキャラが配布される）。
   *
   * 注釈式（partsKeys[].default と pool.total）は evaluateTemplate の対象外で、
   * engine では evaluateConstraint が評価する。よってここも同じ関数で測る。
   * 期待値: EDU 65 → 母国語 65・職業 260、INT 60 → 興味 120、DEX 65 → 回避 floor(65*2/5) = 26。
   */
  it('回避・母国語の初期値とプール予算が能力値から数値に解決される', () => {
    const section = skillSection()
    const values = { lgc_dex: 65, lgc_int: 60, lgc_edu: 65 }
    const defaultOf = (skillId: string) => {
      const field = section.fields.find((candidate) => candidate.id === skillId)
      if (field?.type !== 'scalar') {
        throw new Error(`skill ${skillId} is not a scalar field`)
      }
      return field.partsKeys?.find((partsKey) => partsKey.id === 'initial')?.default
    }

    expect(evaluateConstraint(defaultOf('dodge'), LEGACY_COC_TEMPLATE, values)).toEqual({ status: 'ok', value: 26 })
    expect(evaluateConstraint(defaultOf('own_language'), LEGACY_COC_TEMPLATE, values)).toEqual({
      status: 'ok',
      value: 65
    })
    expect(evaluateConstraint(section.pools?.[0].total, LEGACY_COC_TEMPLATE, values)).toEqual({
      status: 'ok',
      value: 260
    })
    expect(evaluateConstraint(section.pools?.[1].total, LEGACY_COC_TEMPLATE, values)).toEqual({
      status: 'ok',
      value: 120
    })
  })

  /**
   * Test intent: evaluateConstraint が測る式解決とは別に、配布テンプレートのプール集計を実値で固定する。
   * 職業キーへ default が紛れ込むと作成直後から consumed が増えるため、未配分・配分後・超過の 3 状態を測り、
   * 超過時に UI が危険表示へ使う `pool-over` warning まで出ることを検証する。
   */
  it('配布テンプレートの職業プールが未配分・配分後・超過を実値から集計する', () => {
    const creationValues = {
      lgc_edu: { parts: { base: 65 } },
      lgc_skill_spot_hidden: { parts: { initial: 25 } }
    }
    expect(poolById('occupation', creationValues).pool).toEqual({
      sectionId: 'skill',
      poolId: 'occupation',
      consumed: 0,
      status: 'ok',
      total: 260,
      remaining: 260,
      over: false
    })

    const allocated = poolById('occupation', {
      ...creationValues,
      lgc_skill_spot_hidden: { parts: { initial: 25, occupation: 40 } },
      lgc_skill_library: { parts: { initial: 25, occupation: 20 } }
    })
    expect(allocated.pool).toEqual({
      sectionId: 'skill',
      poolId: 'occupation',
      consumed: 60,
      status: 'ok',
      total: 260,
      remaining: 200,
      over: false
    })

    const over = poolById('occupation', {
      ...creationValues,
      lgc_skill_spot_hidden: { parts: { initial: 25, occupation: 261 } }
    })
    expect(over.pool).toEqual({
      sectionId: 'skill',
      poolId: 'occupation',
      consumed: 261,
      status: 'ok',
      total: 260,
      remaining: -1,
      over: true
    })
    expect(over.warnings).toContainEqual({ code: 'pool-over', sectionId: 'skill', poolId: 'occupation' })
  })

  /**
   * Test intent: list 行の number parts が section 直下技能と同じ occupation / interest pool へ参加することを、
   * itemField uid キーの実値で固定する。id キーは保存境界が拒否するため期待値には使わない。
   */
  it('カスタム技能行の occupation / interest 配分を各プールの consumed に加算する', () => {
    const occupationValues = {
      lgc_edu: { parts: { base: 65 } },
      lgc_custom_skills: [
        {
          rowId: 'row_test1',
          lgc_custom_skill_name: '古文書解読',
          lgc_custom_skill_value: { parts: { occupation: 30 } }
        }
      ]
    }

    expect(poolById('occupation', occupationValues).pool).toEqual({
      sectionId: 'skill',
      poolId: 'occupation',
      consumed: 30,
      status: 'ok',
      total: 260,
      remaining: 230,
      over: false
    })

    const interestValues = {
      lgc_int: { parts: { base: 60 } },
      lgc_custom_skills: [
        {
          rowId: 'row_test2',
          lgc_custom_skill_name: '夢見',
          lgc_custom_skill_value: { parts: { interest: 15 } }
        }
      ]
    }

    expect(poolById('interest', interestValues).pool).toEqual({
      sectionId: 'skill',
      poolId: 'interest',
      consumed: 15,
      status: 'ok',
      total: 120,
      remaining: 105,
      over: false
    })
  })
})
