jest.mock('server-only', () => ({}))

jest.mock('../../../lib/api-client.server', () => ({
  apiClient: {
    post: jest.fn()
  }
}))

import { apiClient } from '../../../lib/api-client.server'
import { createCharacterFromTemplate } from './character.service.server'

const mockedApiPost = jest.mocked(apiClient.post)

const input = {
  templateId: 'template-1',
  templateVersion: '1.0.0',
  characterName: '探索者'
}

afterEach(() => mockedApiPost.mockReset())

describe('createCharacterFromTemplate', () => {
  it('旧 server 応答で rollOnCreateResults が欠落していれば空配列へ正規化する', async () => {
    mockedApiPost.mockResolvedValue({
      data: { data: { characterId: 'character-1' } }
    } as never)

    await expect(createCharacterFromTemplate(input)).resolves.toEqual({
      characterId: 'character-1',
      rollOnCreateResults: []
    })
    expect(mockedApiPost).toHaveBeenCalledWith('/character/from-template', input)
  })

  it('新 server 応答の rollOnCreateResults は内容を変えずに返す', async () => {
    const rollOnCreateResults = [
      {
        uid: 'uid-dex',
        label: 'DEX',
        notation: '3d6*5',
        total: 55,
        details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55'
      }
    ]
    const data = { characterId: 'character-1', rollOnCreateResults }
    mockedApiPost.mockResolvedValue({
      data: { data }
    } as never)

    const result = await createCharacterFromTemplate(input)

    expect(result).toBe(data)
  })
})
