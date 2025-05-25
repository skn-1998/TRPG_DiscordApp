import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'

import { CounterSlice, createCounterSlice } from './counterSlice'
import { TestSlice, createTestSlice } from './testSlice'

export type RootState = CounterSlice & TestSlice

const useStore = create<RootState>()(
  persist(
    immer((...a) => ({
      ...createCounterSlice(...a),
      ...createTestSlice(...a)
    })),
    {
      name: 'zustandStore'
    }
  )
)

export default useStore
