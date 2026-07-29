import { characterEntitySchema } from '@trpg/api-contract'

export type JsonObject = Record<string, unknown>

const characterRuntimeKeys = new Set([...Object.keys(characterEntitySchema.shape), '_id', '__v'])
export const requiredCharacterRuntimeKeys: readonly string[] = Object.entries(characterEntitySchema.shape)
  .filter(([, fieldSchema]) => !fieldSchema.safeParse(undefined).success)
  .map(([key]) => key)

// 出典: src/domains/character/repositories/character.repository.ts の summary mapper が返す公開形。
export const characterSummaryRuntimeKeys = ['characterId', 'characterName', 'gameSystemId', 'templateVersion', 'hub']

export const expectSuccessEnvelope = (body: JsonObject, message: string, additionalKeys: string[] = []): void => {
  expect(Object.keys(body).sort()).toEqual(
    ['success', 'message', 'timestamp', 'requestId', 'data', ...additionalKeys].sort()
  )
  expect(body).toEqual(
    expect.objectContaining({
      success: true,
      message,
      timestamp: expect.any(Number),
      requestId: expect.any(String)
    })
  )
}

export const expectOnlyCharacterRuntimeKeys = (data: JsonObject): void => {
  const unexpectedKeys = Object.keys(data).filter((key) => !characterRuntimeKeys.has(key))
  expect(unexpectedKeys).toEqual([])
}

// 現 schema の必須 top-level は6キー。この sentinel で必須キー導出の fail-open を防ぐ。
export const expectRequiredCharacterRuntimeKeyCount = (): void => {
  expect(requiredCharacterRuntimeKeys).toHaveLength(6)
}

export const expectAllRequiredCharacterRuntimeKeys = (data: JsonObject, allowedMissingKeys: string[] = []): void => {
  expectRequiredCharacterRuntimeKeyCount()
  const allowedMissingKeySet = new Set(allowedMissingKeys)
  const missingKeys = requiredCharacterRuntimeKeys.filter(
    (key) => !allowedMissingKeySet.has(key) && !Object.prototype.hasOwnProperty.call(data, key)
  )
  expect(missingKeys).toEqual([])
}

export const expectOnlyCharacterSummaryRuntimeKeys = (summary: JsonObject): void => {
  const allowedKeys = new Set(characterSummaryRuntimeKeys)
  const unexpectedKeys = Object.keys(summary).filter((key) => !allowedKeys.has(key))
  expect(unexpectedKeys).toEqual([])
}

export const expectIsoDateString = (value: unknown): void => {
  expect(typeof value).toBe('string')
  if (typeof value === 'string') {
    expect(new Date(value).toISOString()).toBe(value)
  }
}

const restoreDate = (value: unknown): unknown => (typeof value === 'string' ? new Date(value) : value)

export const expectCharacterEntitySchemaWireData = (data: JsonObject): void => {
  const schemaData = { ...data }
  delete schemaData._id
  delete schemaData.__v
  const restoredData: JsonObject = {
    ...schemaData,
    ...(schemaData.createdAt === undefined ? {} : { createdAt: restoreDate(schemaData.createdAt) }),
    ...(schemaData.updatedAt === undefined ? {} : { updatedAt: restoreDate(schemaData.updatedAt) })
  }

  if (typeof restoredData.hub === 'object' && restoredData.hub !== null && !Array.isArray(restoredData.hub)) {
    const hub = restoredData.hub as JsonObject
    restoredData.hub = {
      ...hub,
      ...(hub.retryAt === undefined ? {} : { retryAt: restoreDate(hub.retryAt) })
    }
  }

  const result = characterEntitySchema.safeParse(restoredData)
  expect({
    success: result.success,
    issues: result.success ? [] : result.error.issues
  }).toEqual({
    success: true,
    issues: []
  })
}
