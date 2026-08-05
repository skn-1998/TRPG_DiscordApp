// Discord Interactions 型定義
export type interactionType = { customId: string }
export type interactionSelectType = interactionType & { placeholder: string }
export type interactionButtonType = interactionType & { label: string }
export type interactionSelectButtonType = interactionSelectType & interactionButtonType

// 型互換性のためのエイリアス（既存コードとの互換性維持）
export type eventType = interactionType
export type eventSelectButtonType = interactionSelectButtonType

// characterThread関連のIDはfeatures/characterThread/eventsへ移行
// dice関連のID定義はfeatures/diceRoll/adapters内へ移行済み
