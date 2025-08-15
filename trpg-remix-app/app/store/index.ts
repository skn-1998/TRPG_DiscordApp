import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'

import { CounterSlice, createCounterSlice } from './counterSlice'
import { TestSlice, createTestSlice } from './testSlice'
import { CharacterSlice, createCharacterSlice } from './characterSlice'

export type RootState = CounterSlice & TestSlice & CharacterSlice

const useStore = create<RootState>()(
  persist(
    immer((...a) => ({
      ...createCounterSlice(...a),
      ...createTestSlice(...a),
      ...createCharacterSlice(...a)
    })),
    {
      name: 'zustandStore'
    }
  )
)

export default useStore
