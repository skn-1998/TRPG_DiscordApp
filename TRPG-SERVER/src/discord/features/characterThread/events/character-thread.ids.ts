export const characterThreadIds = {
  characterTabButtons: {
    customId: 'character-tab*',
    label: 'キャラクタータブ'
  },
  selectCharacterChannel: {
    customId: 'thread-create-character',
    placeholder: 'キャラクターを選択'
  }
} as const

export type CharacterThreadIds = typeof characterThreadIds
