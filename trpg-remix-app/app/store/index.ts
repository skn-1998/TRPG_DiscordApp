import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'

import { TestSlice, createTestSlice } from './testSlice'
import { CharacterSlice, createCharacterSlice } from './characterSlice'

export type RootState = TestSlice & CharacterSlice

const useStore = create<RootState>()(
  persist(
    immer((...a) => ({
      ...createTestSlice(...a),
      ...createCharacterSlice(...a)
    })),
    {
      name: 'zustandStore'
    }
  )
)

export default useStore
