export const characterEditIds = {
  characterModal: {
    customId: 'character-modal'
  },
  characterThreadSelect: {
    customId: 'thread-create-character',
    placeholder: 'キャラクターを選択'
  }
} as const

export type CharacterEditId = typeof characterEditIds
