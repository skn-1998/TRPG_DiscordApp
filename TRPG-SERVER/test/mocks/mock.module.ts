import { Module } from '@nestjs/common'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Character } from '../../src/domains/character/models/character.model'

// モックリポジトリのストレージ
export const mockCharacters: any[] = []

// モックリポジトリ
export const mockCharacterRepository = {
  find: jest.fn(() => Promise.resolve(mockCharacters)),
  findOne: jest.fn((options: any) => {
    const char = mockCharacters.find((c) => c.characterId === options.where.characterId)
    return Promise.resolve(char || null)
  }),
  save: jest.fn((entity: any) => {
    const character = { ...entity, characterId: entity.characterId || 'test-id-123' }

    const existingIndex = mockCharacters.findIndex((c) => c.characterId === character.characterId)
    if (existingIndex >= 0) {
      mockCharacters[existingIndex] = character
    } else {
      mockCharacters.push(character)
    }

    return Promise.resolve(character)
  }),
  delete: jest.fn((criteria: any) => {
    const initialLength = mockCharacters.length

    if (criteria.characterId) {
      const index = mockCharacters.findIndex((c) => c.characterId === criteria.characterId)
      if (index >= 0) {
        mockCharacters.splice(index, 1)
      }
    } else if (criteria.discordUserId) {
      for (let i = mockCharacters.length - 1; i >= 0; i--) {
        if (mockCharacters[i].discordUserId === criteria.discordUserId) {
          mockCharacters.splice(i, 1)
        }
      }
    }

    return Promise.resolve({ affected: initialLength - mockCharacters.length })
  })
}

// MongoDB用のモックモデル
export const mockCharacterModel = {
  find: jest.fn(() => ({
    exec: jest.fn(() => Promise.resolve(mockCharacters))
  })),
  findOne: jest.fn(() => ({
    exec: jest.fn(() => Promise.resolve(mockCharacters[0]))
  })),
  create: jest.fn((entity) => Promise.resolve({ ...entity, _id: 'test-mongo-id' })),
  findByIdAndUpdate: jest.fn((id, update) => ({
    exec: jest.fn(() => Promise.resolve({ ...update, _id: id }))
  })),
  findByIdAndDelete: jest.fn(() => ({
    exec: jest.fn(() => Promise.resolve(true))
  }))
}

// モックがアプリケーション全体で使えるようにするためのモジュール
@Module({
  providers: [
    {
      provide: getRepositoryToken(Character),
      useValue: mockCharacterRepository
    },
    {
      provide: 'CharacterModel',
      useValue: mockCharacterModel
    }
  ],
  exports: [
    {
      provide: getRepositoryToken(Character),
      useValue: mockCharacterRepository
    },
    {
      provide: 'CharacterModel',
      useValue: mockCharacterModel
    }
  ]
})
export class MockModule {}
