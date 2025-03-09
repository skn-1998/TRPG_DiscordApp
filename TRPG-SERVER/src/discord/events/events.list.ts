export type eventType = {
  customId: string
}
export type eventSelectType = eventType & {
  placeholder: string
}
export type eventButtonType = eventType & {
  label: string
}

export type eventSelectButtonType = eventSelectType & eventButtonType

export const selectCharacterChannelConfig: eventSelectType = {
  customId: 'thread-create-character',
  placeholder: 'キャラクターを選択'
}

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
export const characterModalConfig: eventType = {
  customId: 'character-modal'
}

export const diceButtonConfig: eventButtonType = {
  customId: 'dice_button',
  label: '1d100'
}
