import { create } from 'zustand'
import type { TemplateSummary } from '../types'

interface GalleryState {
  items: TemplateSummary[]
  query: string
  setItems: (items: TemplateSummary[]) => void
  setQuery: (q: string) => void
}

export const useGalleryStore = create<GalleryState>((set) => ({
  items: [],
  query: '',
  setItems: (items) => set({ items }),
  setQuery: (q) => set({ query: q })
}))
