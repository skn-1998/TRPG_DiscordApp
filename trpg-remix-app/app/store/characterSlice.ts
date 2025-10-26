import { StateCreator } from 'zustand'
import { RootState } from '.'
import {
  CharacterAttributeValue,
  Character,
  CharacterBaseInfo,
  CharacterAttributeType,
  CharacterAttributeNumberParts
} from '~/types'
import { testCharacterData } from './testCharacterData'

export interface CharacterSlice {
  character: Character
  updateCharacterBaseInfo: <K extends keyof CharacterBaseInfo>(key: K, value: Character[K]) => void
  updateCharacterAttribute: <K extends keyof Omit<CharacterAttributeValue, 'values'>>(
    attributeType: CharacterAttributeType,
    attributeKey: string,
    attributeValueKey: K,
    value: CharacterAttributeValue[K]
  ) => void
  updateCharacterAttributeValue: (
    attributeType: CharacterAttributeType,
    attributeKey: string,
    valuesKey: string,
    value: number
  ) => void
  addCharacterAttributeValue: (attributeType: CharacterAttributeType, values: CharacterAttributeNumberParts) => void
  deleteCharacterAttributeValue: (attributeType: CharacterAttributeType, valueKey: string) => void
}

export const createCharacterSlice: StateCreator<
  RootState,
  [['zustand/immer', never], ['zustand/persist', unknown]],
  [],
  CharacterSlice
> = (set) => ({
  character: testCharacterData,
  updateCharacterBaseInfo: (key, value) =>
    set((state) => {
      state.character[key] = value
    }),
  updateCharacterAttribute: (attributeType, attributeKey, attributeValueKey, value) =>
    set((state) => {
      const attributeValue = state.character[attributeType]?.[attributeKey]
      if (!attributeValue) return
      attributeValue[attributeValueKey] = value
    }),
  updateCharacterAttributeValue: (attributeType, attributeKey, valuesKey, value) =>
    set((state) => {
      const attributeValue = state.character[attributeType]?.[attributeKey]
      if (!attributeValue) return
      if (!attributeValue.values?.[valuesKey]) return
      attributeValue.values[valuesKey] = value
    }),
  addCharacterAttributeValue: (attributeType, values) =>
    set((state) => {
      const indexes = Object.values(state.character[attributeType]).map((v) => v.index)
      const lastIndex = Math.max(...indexes)
      const attributeValue: CharacterAttributeValue = {
        name: '',
        index: lastIndex + 1,
        description: '',
        dice: '',
        isVisible: true,
        values
      }
      const valueKey = `${lastIndex + 1}`
      state.character[attributeType][valueKey] = attributeValue
    }),
  deleteCharacterAttributeValue: (attributeType, valueKey) =>
    set((state) => {
      delete state.character[attributeType][valueKey]
    })
})
