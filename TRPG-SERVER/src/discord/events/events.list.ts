// 型定義専用
export type eventType = { customId: string }
export type eventSelectType = eventType & { placeholder: string }
export type eventButtonType = eventType & { label: string }
export type eventSelectButtonType = eventSelectType & eventButtonType

// 互換のための最小ダミー定義（featuresへ移行済み）
export const addCharacterInfoConfig: eventSelectButtonType = {
  customId: 'add-chara-info',
  label: '追加',
  placeholder: '追加する項目を選択'
}

export const changeCharacterInfoConfig: eventSelectButtonType = {
  customId: 'change-chara-info',
  label: '変更・削除',
  placeholder: '変更する項目を選択'
}

export const characterModalConfig: eventType = { customId: 'character-modal' }

// characterThread関連のIDはfeatures/characterThread/eventsへ移行

// dice関連のID定義はfeatures/diceRoll/adapters内へ移行済み
