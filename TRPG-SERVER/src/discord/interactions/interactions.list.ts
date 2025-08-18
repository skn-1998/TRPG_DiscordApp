// Discord Interactions 型定義
export type interactionType = { customId: string }
export type interactionSelectType = interactionType & { placeholder: string }
export type interactionButtonType = interactionType & { label: string }
export type interactionSelectButtonType = interactionSelectType & interactionButtonType

// 型互換性のためのエイリアス（既存コードとの互換性維持）
export type eventType = interactionType
export type eventSelectType = interactionSelectType
export type eventButtonType = interactionType
export type eventSelectButtonType = interactionSelectButtonType

// 互換のための最小ダミー定義（featuresへ移行済み）
export const addCharacterInfoConfig: interactionSelectButtonType = {
  customId: 'add-chara-info',
  label: '追加',
  placeholder: '追加する項目を選択'
}

export const changeCharacterInfoConfig: interactionSelectButtonType = {
  customId: 'change-chara-info',
  label: '変更・削除',
  placeholder: '変更する項目を選択'
}

export const characterModalConfig: interactionType = { customId: 'character-modal' }

// characterThread関連のIDはfeatures/characterThread/eventsへ移行
// dice関連のID定義はfeatures/diceRoll/adapters内へ移行済み
