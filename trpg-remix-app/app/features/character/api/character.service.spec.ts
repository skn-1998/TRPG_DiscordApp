import { apiClient } from '~/lib/api-client'
import { createCharacterFromTemplate, getCharacter, saveCharacterSheet } from './character.service'

jest.mock(
  '~/lib/api-client',
  () => ({
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn()
    }
  }),
  { virtual: true }
)

jest.mock(
  '~/lib/api-response.util',
  () => ({
    ApiResponseUtil: {
      handleError: jest.fn()
    }
  }),
  { virtual: true }
)

jest.mock(
  '~/utils/customError',
  () => ({
    CustomError: jest.fn()
  }),
  { virtual: true }
)

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>
const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>
const mockPut = apiClient.put as jest.MockedFunction<typeof apiClient.put>

describe('getCharacter', () => {
  it('指定した characterId のエンドポイントから成功封筒の payload を返す', async () => {
    const payload = {
      characterId: 'character-1',
      characterName: '探索者'
    }
    mockGet.mockResolvedValue({
      data: {
        success: true,
        message: 'キャラクターを取得しました',
        timestamp: 1,
        requestId: 'request-get-character',
        data: payload
      },
      status: 200,
      statusText: 'OK'
    })

    const result = await getCharacter('character-1')

    expect(mockGet).toHaveBeenCalledWith('/character/character-1')
    expect(result).toBe(payload)
  })
})

describe('createCharacterFromTemplate', () => {
  const input = {
    templateId: 'template-1',
    templateVersion: '1',
    characterName: '探索者'
  }
  const payload = { characterId: 'character-1' }

  it('生 body では payload をそのまま返す', async () => {
    mockPost.mockResolvedValue({
      data: payload,
      status: 201,
      statusText: 'Created'
    })

    const result = await createCharacterFromTemplate(input)

    expect(result).toBe(payload)
    expect(mockPost).toHaveBeenCalledWith('/character/from-template', input)
  })

  it('成功封筒 body でも同じ payload を返す', async () => {
    mockPost.mockResolvedValue({
      data: {
        success: true,
        message: 'キャラクターを作成しました',
        timestamp: 1,
        requestId: 'request-1',
        data: payload
      },
      status: 201,
      statusText: 'Created'
    })

    const result = await createCharacterFromTemplate(input)

    expect(result).toBe(payload)
  })
})

describe('saveCharacterSheet', () => {
  const input = {
    characterId: 'character-1',
    baseRevision: 3,
    changes: [
      {
        path: { fieldUid: 'field-1' },
        baseValue: 10,
        newValue: 11
      }
    ]
  }
  const payload = {
    revision: 4,
    noOp: false,
    appliedChanges: 1
  }

  it('生 body では payload をそのまま返す', async () => {
    mockPut.mockResolvedValue({
      data: payload,
      status: 200,
      statusText: 'OK'
    })

    const result = await saveCharacterSheet(input)

    expect(result).toBe(payload)
    expect(mockPut).toHaveBeenCalledWith('/character/character-1/sheet', {
      baseRevision: 3,
      changes: input.changes
    })
  })

  it('成功封筒 body でも同じ payload を返す', async () => {
    mockPut.mockResolvedValue({
      data: {
        success: true,
        message: 'キャラクターシートを保存しました',
        timestamp: 1,
        requestId: 'request-2',
        data: payload
      },
      status: 200,
      statusText: 'OK'
    })

    const result = await saveCharacterSheet(input)

    expect(result).toBe(payload)
  })
})
