import { StateCreator } from 'zustand'
import { RootState } from '.'
import { status } from '~/static/status'
// import { findKey } from 'lodash'
import pkg from 'lodash'
const { findKey } = pkg

export interface Status {
  [key: string]: {
    index: number | string
    values: {
      [key: string]: string
    }
  }
}

export interface CharacterSlice {
  status: Status
  updateStatus: (index: number | string, valuesKey: string, value: string) => void
}

export const createCharacterSlice: StateCreator<
  RootState,
  [['zustand/immer', never], ['zustand/persist', unknown]],
  [],
  CharacterSlice
> = (set) => ({
  status: status,
  updateStatus: (index: number | string, valuesKey: string, value: string) =>
    set((state) => {
      const key = findKey(state.status, (o) => o.index === index)
      if (!key) {
        console.log('not find key')
        return
      }
      state.status[key].values[valuesKey] = value
    })
})
