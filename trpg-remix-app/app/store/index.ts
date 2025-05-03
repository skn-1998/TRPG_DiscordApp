import { create } from 'zustand'
import { devtools, persist, combine } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

const useBoundStore = create(
  devtools(
    persist(
      immer(
        combine(
          {
            count: 0
          },
          (set) => ({
            incrementCount: () =>
              set((state) => {
                state.count += 1
              })
          })
        )
      ),
      { name: 'boundStore' }
    )
  )
)

export default useBoundStore
