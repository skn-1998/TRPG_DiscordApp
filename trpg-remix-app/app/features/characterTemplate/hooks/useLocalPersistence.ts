import { useCallback } from 'react'
import type { Template, TemplateMapping } from '../types'

const TEMPLATES_KEY = 'ct.templates.v2' // schemaVersion: 2
const MAPPING_KEY = 'ct.mappings.v2'

export const useLocalPersistence = () => {
  const saveTemplate = useCallback((template: Template) => {
    try {
      const raw = localStorage.getItem(TEMPLATES_KEY)
      const list: Template[] = raw ? JSON.parse(raw) : []
      const idx = list.findIndex((t) => t.id === template.id)
      if (idx >= 0) list[idx] = template
      else list.push(template)
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list))
    } catch (error) {
      console.error('Failed to save template:', error)
    }
  }, [])

  const loadTemplates = useCallback((): Template[] => {
    try {
      const raw = localStorage.getItem(TEMPLATES_KEY)
      return raw ? (JSON.parse(raw) as Template[]) : []
    } catch (error) {
      console.error('Failed to load templates:', error)
      return []
    }
  }, [])

  const loadTemplate = useCallback((id: string): Template | undefined => {
    try {
      const list = loadTemplates()
      return list.find((t) => t.id === id)
    } catch (error) {
      console.error('Failed to load template:', error)
      return undefined
    }
  }, [])

  const deleteTemplate = useCallback((id: string) => {
    try {
      const raw = localStorage.getItem(TEMPLATES_KEY)
      const list: Template[] = raw ? JSON.parse(raw) : []
      const filtered = list.filter((t) => t.id !== id)
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(filtered))
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
  }, [])

  const exportTemplate = useCallback((template: Template): string => {
    return JSON.stringify(template, null, 2)
  }, [])

  const importTemplate = useCallback((json: string): Template | null => {
    try {
      const template = JSON.parse(json) as Template
      // 基本的なバリデーション
      if (!template.id || !template.name || !template.fields) {
        throw new Error('Invalid template format')
      }
      return template
    } catch (error) {
      console.error('Failed to import template:', error)
      return null
    }
  }, [])

  const saveMapping = useCallback((mapping: TemplateMapping) => {
    try {
      const raw = localStorage.getItem(MAPPING_KEY)
      const list: TemplateMapping[] = raw ? JSON.parse(raw) : []
      const idx = list.findIndex((m) => m.templateId === mapping.templateId)
      if (idx >= 0) list[idx] = mapping
      else list.push(mapping)
      localStorage.setItem(MAPPING_KEY, JSON.stringify(list))
    } catch (error) {
      console.error('Failed to save mapping:', error)
    }
  }, [])

  const loadMapping = useCallback((templateId: string): TemplateMapping | undefined => {
    try {
      const raw = localStorage.getItem(MAPPING_KEY)
      const list: TemplateMapping[] = raw ? JSON.parse(raw) : []
      return list.find((m) => m.templateId === templateId)
    } catch (error) {
      console.error('Failed to load mapping:', error)
      return undefined
    }
  }, [])

  return {
    saveTemplate,
    loadTemplates,
    loadTemplate,
    deleteTemplate,
    exportTemplate,
    importTemplate,
    saveMapping,
    loadMapping
  }
}
