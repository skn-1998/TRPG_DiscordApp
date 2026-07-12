import type { SheetField, SheetTemplate } from '@trpg/sheet-engine'

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

function buildLegacyAbilityFields(): SheetField[] {
  return LEGACY_COC_ABILITIES.flatMap((ability): SheetField[] => [
    {
      type: 'scalar',
      id: ability.id,
      uid: ability.uid,
      label: ability.label,
      valueType: 'number',
      parts: true,
      role: { kind: 'rollable', notation: '1d100<={value}', group: 'ability' }
    },
    {
      type: 'roll',
      id: `${ability.id}_roll`,
      uid: `${ability.uid}_roll`,
      label: `${ability.label} roll`,
      notation: ability.rollNotation,
      rerollable: true
    }
  ])
}

export const LEGACY_COC_TEMPLATE: SheetTemplate = {
  templateId: 'legacy-coc',
  name: 'Legacy Call of Cthulhu',
  version: '1.0.0',
  schemaVersion: 3,
  gameSystemId: 'coc',
  tags: ['legacy', 'coc'],
  visibility: 'private',
  authorDiscordUserId: 'system',
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
      rows: [
        { min: 2, max: 64, result: '-2' },
        { min: 65, max: 84, result: '-1' },
        { min: 85, max: 124, result: '0' },
        { min: 125, max: 164, result: '+1d4' },
        { min: 165, max: 204, result: '+1d6' }
      ]
    }
  ]
}

// Skills use arbitrary legacy keys, so this template does not include a skill section
// until Phase 3 introduces list fields. Legacy character skills remain authoritative
// through the compatibility projection described in design-v1 section 3.
