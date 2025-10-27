import { create } from 'zustand'
import type { TemplateMapping } from '../types'

interface MappingState {
  mapping?: TemplateMapping
  setMapping: (mapping: TemplateMapping) => void
  updateFieldPath: (fieldId: string, path: string) => void
}

export const useMappingStore = create<MappingState>((set, get) => ({
  mapping: undefined,
  setMapping: (mapping) => set({ mapping }),
  updateFieldPath: (fieldId, path) => {
    const current = get().mapping
    if (!current) return
    const next = {
      ...current,
      fields: current.fields.map((f) => (f.fieldId === fieldId ? { ...f, characterPath: path } : f))
    }
    set({ mapping: next })
  }
}))
