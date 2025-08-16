import { StateCreator } from 'zustand'
import { RootState } from '.'
import { status } from '~/static/status'
import { skill, skillTemplate } from '~/static/skill'
// import { findKey } from 'lodash'
import pkg from 'lodash'
const { findKey, cloneDeep, map } = pkg
import Hashids from 'hashids'
const hashids = new Hashids('hogehogesolty')

export interface Status {
  [key: string]: {
    index: number | string
    name: string
    values: {
      [key: string]: string
    }
  }
}

export interface CharacterSlice {
  status: Status
  skill: Status
  updateStatus: (index: number | string, valuesKey: string, value: string) => void
  updateSkill: (index: number | string, valuesKey: string, value: string) => void
  createSkill: () => void
}

export const createCharacterSlice: StateCreator<
  RootState,
  [['zustand/immer', never], ['zustand/persist', unknown]],
  [],
  CharacterSlice
> = (set) => ({
  status: status,
  skill: skill,
  updateStatus: (index: number | string, valuesKey: string, value: string) =>
    set((state) => {
      const key = findKey(state.status, (o) => o.index === index)
      if (!key) {
        console.log('not find key')
        return
      }
      state.status[key].values[valuesKey] = value
    }),
  createSkill: () => {
    set((state) => {
      const uid = hashids.encode([...new Array(6)].map(() => Math.floor(Math.random() * 100)))
      console.log(uid)
      const largestIndex = Math.max(...map(state.skill, (v) => Number(v.index)))
      state.skill[uid] = {
        index: largestIndex + 1,
        ...cloneDeep(skillTemplate)
      }
    })
  },
  updateSkill: (index: number | string, valuesKey: string, value: string) =>
    set((state) => {
      const key = findKey(state.skill, (o) => o.index === index)
      if (!key) {
        console.log('not find key')
        return
      }
      state.skill[key].values[valuesKey] = value
    })
})
