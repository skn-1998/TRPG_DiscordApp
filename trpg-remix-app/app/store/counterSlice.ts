import { StateCreator } from 'zustand'
import { RootState } from '.'

export interface CounterSlice {
  count: number
  increment: () => void
  decrement: () => void
}

export const createCounterSlice: StateCreator<
  RootState,
  [['zustand/immer', never], ['zustand/persist', unknown]],
  [],
  CounterSlice
> = (set) => ({
  count: 0,
  increment: () =>
    set((state) => {
      state.count += 1
    }),
  decrement: () =>
    set((state) => {
      state.count -= 1
    })
})
