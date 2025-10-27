import { create } from 'zustand'
import type { Template, ValidationError, TabType, EvaluationContext } from '../types'

interface TemplateState {
  current?: Template
  activeTab: TabType
  validationErrors: ValidationError[]
  calculationCache: EvaluationContext

  setTemplate: (template: Template) => void
  setActiveTab: (tab: TabType) => void
  setValidationErrors: (errors: ValidationError[]) => void
  setCalculationCache: (cache: EvaluationContext) => void
  updateCalculationCache: (fieldId: string, value: number | string | boolean | undefined) => void
  clear: () => void
}

export const useTemplateStore = create<TemplateState>((set) => ({
  current: undefined,
  activeTab: 'basic',
  validationErrors: [],
  calculationCache: {},

  setTemplate: (template) => set({ current: template }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setValidationErrors: (errors) => set({ validationErrors: errors }),
  setCalculationCache: (cache) => set({ calculationCache: cache }),
  updateCalculationCache: (fieldId, value) =>
    set((state) => ({
      calculationCache: { ...state.calculationCache, [fieldId]: value }
    })),
  clear: () =>
    set({
      current: undefined,
      activeTab: 'basic',
      validationErrors: [],
      calculationCache: {}
    })
}))
