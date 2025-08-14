import { StateCreator } from 'zustand'
import { RootState } from '.'

export interface CharacterSlice {}

export const createTestSlice: StateCreator<
  RootState,
  [['zustand/immer', never], ['zustand/persist', unknown]],
  [],
  CharacterSlice
> = (set) => ({
  abc: '',
  setA: () =>
    set((state) => {
      state.abc = 'a'
    }),
  setB: () =>
    set((state) => {
      state.abc = 'b'
    })
})
