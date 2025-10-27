import { useCallback } from 'react'
import type { Template, ValidationError } from '../types'
import { validateTemplate } from '../utils/validation'

export const useTemplateValidation = () => {
  const validate = useCallback((template: Template): ValidationError[] => {
    return validateTemplate(template)
  }, [])

  return { validate }
}
