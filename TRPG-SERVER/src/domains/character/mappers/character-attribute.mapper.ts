import {
  AttributeSection,
  AttributeValue,
  isAttributeNumberParts,
  isAttributeSection,
  isAttributeValue
} from '../../../core/types/attribute.types'
import { CharacterEntity } from '../models/character.entity'

const ATTRIBUTE_VALUE_KEYS = new Set(['name', 'index', 'values', 'description', 'dice', 'isVisible', 'value'])
const SECTION_NAMES = ['status', 'parameter', 'skill', 'item', 'description'] as const

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const persistedAttributeError = (path: string, reason: string): TypeError =>
  new TypeError(`Invalid persisted AttributeValue at ${path}: ${reason}`)

const copyOptionalString = (
  source: Record<string, unknown>,
  target: AttributeValue,
  property: 'name' | 'description' | 'dice',
  path: string
): void => {
  const value = source[property]
  if (value === undefined || value === null) return
  if (typeof value !== 'string') throw persistedAttributeError(path, `${property} must be a string or null`)
  target[property] = value
}

const normalizePersistedAttributeValue = (value: unknown, path: string): AttributeValue => {
  if (isAttributeValue(value)) return value

  if (typeof value === 'number' && Number.isFinite(value)) {
    return { values: { base: value } }
  }
  if (typeof value === 'string') {
    return { description: value }
  }
  if (!isPlainRecord(value)) {
    throw persistedAttributeError(path, 'expected a known legacy or canonical object')
  }

  const unknownKey = Object.keys(value).find((key) => !ATTRIBUTE_VALUE_KEYS.has(key))
  if (unknownKey) throw persistedAttributeError(path, `unknown property ${unknownKey}`)

  const normalized: AttributeValue = {}
  copyOptionalString(value, normalized, 'name', path)
  copyOptionalString(value, normalized, 'description', path)
  copyOptionalString(value, normalized, 'dice', path)

  if (value.index !== undefined && value.index !== null) {
    if (typeof value.index !== 'number' || !Number.isFinite(value.index)) {
      throw persistedAttributeError(path, 'index must be a finite number or null')
    }
    normalized.index = value.index
  }

  if (value.values !== undefined && value.values !== null) {
    if (!isAttributeNumberParts(value.values)) {
      throw persistedAttributeError(path, 'values must contain only finite numbers')
    }
    normalized.values = { ...value.values }
  }

  if (value.isVisible !== undefined && value.isVisible !== null) {
    if (typeof value.isVisible !== 'boolean') {
      throw persistedAttributeError(path, 'isVisible must be a boolean or null')
    }
    normalized.isVisible = value.isVisible
  }

  if (value.value !== undefined && value.value !== null) {
    if (normalized.values !== undefined || normalized.description !== undefined) {
      throw persistedAttributeError(path, 'legacy value conflicts with values or description')
    }
    if (typeof value.value === 'number' && Number.isFinite(value.value)) {
      normalized.values = { base: value.value }
    } else if (typeof value.value === 'string') {
      normalized.description = value.value
    } else {
      throw persistedAttributeError(path, 'legacy value must be a finite number or string')
    }
  }

  if (!isAttributeValue(normalized)) {
    throw persistedAttributeError(path, 'normalization did not produce the canonical form')
  }
  return normalized
}

/**
 * 自システムが過去に保存した既知のlegacy形だけを、読出境界で正準形へ変換する。
 * 外部入力の緩和には使用しない。
 */
export const normalizePersistedAttributeSection = (value: unknown, sectionName: string): AttributeSection => {
  if (isAttributeSection(value)) return value
  if (!isPlainRecord(value)) {
    throw new TypeError(`Invalid persisted AttributeSection at ${sectionName}: expected an object`)
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, attribute]) => [
      key,
      normalizePersistedAttributeValue(attribute, `${sectionName}.${key}`)
    ])
  )
}

/**
 * repositoryが公開するCharacterEntityについて、存在する5セクションだけを非破壊で正準化する。
 */
export const normalizePersistedCharacterAttributes = (character: CharacterEntity): CharacterEntity => {
  let normalized = character

  for (const sectionName of SECTION_NAMES) {
    if (!Object.prototype.hasOwnProperty.call(character, sectionName)) continue
    const section = character[sectionName]
    if (section === undefined) continue

    const normalizedSection = normalizePersistedAttributeSection(section, sectionName)
    if (normalizedSection !== section) {
      normalized = { ...normalized, [sectionName]: normalizedSection }
    }
  }

  return normalized
}
