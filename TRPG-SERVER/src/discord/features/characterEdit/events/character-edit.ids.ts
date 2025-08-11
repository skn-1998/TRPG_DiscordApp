export const characterEditIds = {
  addCharacterInfo: {
    customId: 'add-chara-info',
    label: '追加',
    placeholder: '追加する項目を選択'
  },
  changeCharacterInfo: {
    customId: 'change-chara-info',
    label: '変更・削除',
    placeholder: '変更する項目を選択'
  },
  characterModal: {
    customId: 'character-modal'
  },
  characterThreadSelect: {
    customId: 'thread-create-character',
    placeholder: 'キャラクターを選択'
  }
} as const

export type CharacterEditId = typeof characterEditIds
