import { StateCreator } from 'zustand'
import { RootState } from '.'
import { status } from '~/static/status'
import { skill, skillTemplate } from '~/static/skill'
import pkg from 'lodash'
const { cloneDeep, map } = pkg
import Hashids from 'hashids'
const hashids = new Hashids('hogehogesolty')

export interface Status {
  [key: string]: {
    index: number | string
    name: string
    values: {
      [key: string]: string
      other: string
    }
    deletable?: boolean
    nameEditable?: boolean
    diceRoll?: string
    amount?: string
    description?: string
  }
}

export interface CharacterSlice {
  status: Status
  skill: Status
  updateStatus: (key: string, valuesKey: string, value: string) => void
  updateSkill: (key: string, valuesKey: string, value: string) => void
  createSkill: () => void
  deleteSkill: (key: string) => void
  updateSkillName: (key: string, value: string) => void
}

export const createCharacterSlice: StateCreator<
  RootState,
  [['zustand/immer', never], ['zustand/persist', unknown]],
  [],
  CharacterSlice
> = (set) => ({
  status: status,
  skill: skill,
  updateStatus: (key: string, valuesKey: string, value: string) =>
    set((state) => {
      state.status[key].values[valuesKey] = value
    }),
  createSkill: () =>
    set((state) => {
      const uid = hashids.encode([...new Array(6)].map(() => Math.floor(Math.random() * 100)))
      const largestIndex = Math.max(...map(state.skill, (v) => Number(v.index)))
      state.skill[uid] = {
        index: largestIndex + 1,
        ...cloneDeep(skillTemplate)
      }
    }),
  updateSkill: (key: string, valuesKey: string, value: string) =>
    set((state) => {
      state.skill[key].values[valuesKey] = value
    }),
  deleteSkill: (key: string) =>
    set((state) => {
      delete state.skill[key]
    }),
  updateSkillName: (key: string, value: string) =>
    set((state) => {
      state.skill[key].name = value
    })
})
