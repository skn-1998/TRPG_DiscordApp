import type { SheetField, SheetTemplate } from '@trpg/sheet-engine'
import { SYSTEM_TEMPLATE_AUTHOR } from '../character-sheet-template.constants'

type LegacyAbilityDefinition = {
  id: string
  uid: string
  label: string
  rollNotation: string
}

const LEGACY_COC_ABILITIES: LegacyAbilityDefinition[] = [
  { id: 'str', uid: 'lgc_str', label: 'STR', rollNotation: '3d6*5' },
  { id: 'con', uid: 'lgc_con', label: 'CON', rollNotation: '3d6*5' },
  { id: 'pow', uid: 'lgc_pow', label: 'POW', rollNotation: '3d6*5' },
  { id: 'dex', uid: 'lgc_dex', label: 'DEX', rollNotation: '3d6*5' },
  { id: 'app', uid: 'lgc_app', label: 'APP', rollNotation: '3d6*5' },
  { id: 'siz', uid: 'lgc_siz', label: 'SIZ', rollNotation: '(2d6+6)*5' },
  { id: 'int', uid: 'lgc_int', label: 'INT', rollNotation: '(2d6+6)*5' },
  { id: 'edu', uid: 'lgc_edu', label: 'EDU', rollNotation: '(2d6+6)*5' }
]

/**
 * 能力値 1 つにつき scalar を 1 本だけ作り、作成時ロールをその scalar 自身に宣言する。
 *
 * 出目は宣言した field の uid にしか書かれない（character-instantiation.service.ts の
 * applyRollOnCreate）。かつて能力値は scalar と `*_roll`（roll 型）の 2 本に分かれており、
 * 出目は roll 側へ入る一方で HP / MP / SAN の式は scalar 側を参照していた。
 * 未入力の数値 scalar は評価時に 0 へ畳まれる（evaluator.ts の numberOrZero）ため、
 * 作成直後の HP / MP / SAN が例外も警告も無いまま 0 になっていた。
 *
 * parts と role は作成時ロールとは別の関心なので残す。parts は Discord の ± が積む内訳の器で、
 * role は技能判定（1d100 以下）のパレット項目。
 */
function buildLegacyAbilityFields(): SheetField[] {
  return LEGACY_COC_ABILITIES.map((ability): SheetField => ({
    type: 'scalar',
    id: ability.id,
    uid: ability.uid,
    label: ability.label,
    valueType: 'number',
    parts: true,
    rollOnCreate: { notation: ability.rollNotation },
    role: { kind: 'rollable', notation: '1d100<={value}', group: 'ability' }
  }))
}

export const LEGACY_COC_TEMPLATE: SheetTemplate = {
  // 旧 `legacy-coc` の行は残したまま、別 id で出し直す。
  // seeder（src/scripts/seed-legacy-coc-template.ts の decideSeedAction）は insert しか持たず、
  // 同 templateId の既存行に対しては skip / conflict を報告するだけで上書きしない。
  // さらに作成済みキャラは templateId と templateVersion を sheet へ固定保存する
  // （character-instantiation.service.ts）ため、旧行を消すと既存キャラの template 解決が壊れる。
  templateId: 'legacy-coc-v2',
  name: 'Legacy Call of Cthulhu（能力値ロール修正版）',
  version: '1.0.0',
  schemaVersion: 3,
  // BCDice StaticLoader requires an existing system ID; an unknown ID makes creation-time rolls fail.
  gameSystemId: 'Cthulhu',
  tags: ['legacy', 'coc'],
  visibility: 'private',
  authorDiscordUserId: SYSTEM_TEMPLATE_AUTHOR,
  settings: { rounding: 'floor' },
  sections: [
    {
      id: 'parameter',
      label: 'Parameter',
      fields: buildLegacyAbilityFields()
    },
    {
      id: 'status',
      label: 'Status',
      fields: [
        {
          type: 'computed',
          id: 'hp',
          uid: 'lgc_hp',
          label: 'HP',
          resultType: 'number',
          formula: 'floor(({parameter.con} + {parameter.siz}) / 10)'
        },
        {
          type: 'computed',
          id: 'mp',
          uid: 'lgc_mp',
          label: 'MP',
          resultType: 'number',
          formula: 'floor({parameter.pow} / 5)'
        },
        {
          type: 'computed',
          id: 'san',
          uid: 'lgc_san',
          label: 'SAN',
          resultType: 'number',
          formula: '{parameter.pow}'
        },
        {
          type: 'computed',
          id: 'db',
          uid: 'lgc_db',
          label: 'DB',
          resultType: 'dice',
          formula: 'lookup({parameter.str} + {parameter.siz}, damage_bonus)'
        }
      ]
    },
    {
      id: 'description',
      label: 'Description',
      fields: [
        { type: 'scalar', id: 'occupation', uid: 'lgc_occupation', label: 'Occupation', valueType: 'text' },
        { type: 'scalar', id: 'personality', uid: 'lgc_personality', label: 'Personality', valueType: 'text' },
        { type: 'scalar', id: 'background', uid: 'lgc_background', label: 'Background', valueType: 'text' },
        { type: 'scalar', id: 'hobby', uid: 'lgc_hobby', label: 'Hobby', valueType: 'text' },
        { type: 'scalar', id: 'note', uid: 'lgc_note', label: 'Note', valueType: 'text' }
      ]
    }
  ],
  tables: [
    {
      id: 'damage_bonus',
      resultType: 'dice',
      // LookupRow ranges require min and max, so open-ended bounds cannot be expressed.
      // A lookup miss aborts the entire template evaluation, so sentinel bounds cover the numeric domain.
      // This guarantees a row for missing inputs (evaluated as 0) and extreme manual values.
      rows: [
        { min: -999999, max: 64, result: '-2' },
        { min: 65, max: 84, result: '-1' },
        { min: 85, max: 124, result: '0' },
        { min: 125, max: 164, result: '+1d4' },
        { min: 165, max: 999999, result: '+1d6' }
      ]
    }
  ]
}

// Skills use arbitrary legacy keys, so this template does not include a skill section
// until Phase 3 introduces list fields. Legacy character skills remain authoritative
// through the compatibility projection described in design-v1 section 3.
