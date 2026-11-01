import type { SheetTemplate } from '@trpg/sheet-engine'

export const rendererShowcaseTemplate: SheetTemplate = {
  templateId: 'renderer-component-showcase',
  name: 'Renderer component showcase',
  version: '1.0.0',
  schemaVersion: 3,
  tags: ['sample'],
  visibility: 'private',
  authorDiscordUserId: 'local-sample',
  sections: [
    {
      id: 'field-dispatch',
      label: 'P6・P8 基本フィールドとグリッド',
      layout: { preset: 'grid', columns: 3 },
      fields: [
        {
          id: 'name',
          uid: 'showcase_name',
          label: 'キャラクター名',
          description: 'text scalar',
          type: 'scalar',
          valueType: 'text',
          layout: { span: 2 }
        },
        {
          id: 'level',
          uid: 'showcase_level',
          label: 'レベル',
          description: 'number scalar',
          type: 'scalar',
          valueType: 'number'
        },
        {
          id: 'role',
          uid: 'showcase_role',
          label: '役割',
          type: 'scalar',
          valueType: 'select',
          options: [
            { label: '探索役', value: 'investigator' },
            { label: '交渉役', value: 'negotiator' },
            { label: '戦闘役', value: 'fighter' }
          ]
        },
        {
          id: 'active',
          uid: 'showcase_active',
          label: 'セッション参加中',
          type: 'scalar',
          valueType: 'boolean'
        },
        {
          id: 'derived',
          uid: 'showcase_derived',
          label: '算出値',
          description: 'computed field',
          type: 'computed',
          resultType: 'number',
          formula: '12'
        },
        {
          id: 'check',
          uid: 'showcase_roll',
          label: '汎用判定',
          description: 'roll field と振り直し導線',
          type: 'roll',
          notation: '1d100',
          layout: { span: 'full' }
        },
        {
          id: 'relation',
          uid: 'showcase_relation',
          label: '関係',
          type: 'relation'
        },
        {
          id: 'tags',
          uid: 'showcase_tags',
          label: 'タグ',
          type: 'tag'
        }
      ]
    },
    {
      id: 'parts',
      label: 'P1・P2 内訳値と Popover',
      layout: { preset: 'grid', columns: 2 },
      fields: [
        {
          id: 'skill',
          uid: 'showcase_skill',
          label: '技能値',
          description: 'ボタンを押すと宣言済みの内訳を編集できます',
          type: 'scalar',
          valueType: 'number',
          partsKeys: [
            { id: 'occupation', label: '職業' },
            { id: 'interest', label: '興味' }
          ]
        },
        {
          id: 'free-parts',
          uid: 'showcase_free_parts',
          label: '自由内訳',
          description: '保存値に存在する任意キーを表示します',
          type: 'scalar',
          valueType: 'number',
          parts: true
        }
      ]
    },
    {
      id: 'tracks',
      label: 'P5 トラック表示',
      layout: { preset: 'grid', columns: 3 },
      fields: [
        {
          id: 'hp',
          uid: 'showcase_hp',
          label: '耐久力',
          description: 'gauge style',
          type: 'track',
          max: 12,
          style: 'gauge'
        },
        {
          id: 'sanity',
          uid: 'showcase_sanity',
          label: '正気度',
          description: 'checkboxes style',
          type: 'track',
          max: 10,
          style: 'checkboxes'
        },
        {
          id: 'large-track',
          uid: 'showcase_large_track',
          label: '大規模トラック',
          description: '30 個超では数値表示へ退避します',
          type: 'track',
          max: 40,
          style: 'checkboxes'
        }
      ]
    },
    {
      id: 'list',
      label: 'P3・P4 リスト行編集',
      layout: { preset: 'stack' },
      fields: [
        {
          id: 'skills',
          uid: 'showcase_list',
          label: 'カスタム技能',
          description: '追加・削除・各セル・行内訳を操作できます',
          type: 'list',
          itemFields: [
            {
              id: 'name',
              uid: 'showcase_list_name',
              label: '技能名',
              type: 'scalar',
              valueType: 'text'
            },
            {
              id: 'score',
              uid: 'showcase_list_score',
              label: '技能値',
              type: 'scalar',
              valueType: 'number',
              partsKeys: [
                { id: 'occupation', label: '職業' },
                { id: 'interest', label: '興味' }
              ]
            },
            {
              id: 'category',
              uid: 'showcase_list_category',
              label: '分類',
              type: 'scalar',
              valueType: 'select',
              options: [
                { label: '探索', value: 'investigation' },
                { label: '戦闘', value: 'combat' }
              ]
            },
            {
              id: 'trained',
              uid: 'showcase_list_trained',
              label: '訓練済み',
              type: 'scalar',
              valueType: 'boolean'
            },
            {
              id: 'uses',
              uid: 'showcase_list_uses',
              label: '使用回数',
              type: 'track',
              max: 5,
              style: 'gauge'
            }
          ]
        }
      ]
    },
    {
      id: 'table',
      label: 'P7 テーブルレイアウト',
      layout: { preset: 'table' },
      fields: [
        {
          id: 'strength',
          uid: 'showcase_strength',
          label: '筋力',
          type: 'scalar',
          valueType: 'number',
          partsKeys: [
            { id: 'initial', label: '初期値' },
            { id: 'growth', label: '成長' }
          ]
        },
        {
          id: 'dexterity',
          uid: 'showcase_dexterity',
          label: '敏捷',
          type: 'scalar',
          valueType: 'number',
          partsKeys: [
            { id: 'initial', label: '初期値' },
            { id: 'growth', label: '成長' }
          ]
        },
        {
          id: 'memo',
          uid: 'showcase_table_memo',
          label: 'メモ',
          type: 'scalar',
          valueType: 'text'
        },
        {
          id: 'resource',
          uid: 'showcase_table_resource',
          label: 'テーブル内トラック',
          type: 'track',
          max: 8,
          style: 'gauge'
        }
      ]
    }
  ],
  tables: [],
  settings: { rounding: 'floor' }
}

export function createRendererShowcaseValues(): Record<string, unknown> {
  return {
    showcase_name: '霧島 アキラ',
    showcase_level: 4,
    showcase_role: 'investigator',
    showcase_active: true,
    showcase_derived: 12,
    showcase_roll: 43,
    showcase_skill: {
      parts: { base: 20, occupation: 35, interest: 15, other: 5 }
    },
    showcase_free_parts: {
      parts: { base: 10, equipment: 8, circumstance: 4 }
    },
    showcase_hp: 8,
    showcase_sanity: 6,
    showcase_large_track: 27,
    showcase_list: [
      {
        rowId: 'row_showcase_1',
        showcase_list_name: '目星',
        showcase_list_score: { parts: { occupation: 40, interest: 25 } },
        showcase_list_category: 'investigation',
        showcase_list_trained: true,
        showcase_list_uses: 3
      },
      {
        rowId: 'row_showcase_2',
        showcase_list_name: '回避',
        showcase_list_score: { parts: { occupation: 20, interest: 15 } },
        showcase_list_category: 'combat',
        showcase_list_trained: false,
        showcase_list_uses: 1
      }
    ],
    showcase_strength: { parts: { base: 10, initial: 45, growth: 5 } },
    showcase_dexterity: { parts: { base: 10, initial: 50, growth: 10 } },
    showcase_table_memo: '同じ列定義で複数行を表示',
    showcase_table_resource: 5
  }
}
