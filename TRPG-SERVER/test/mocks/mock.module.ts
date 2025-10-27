import { Module } from '@nestjs/common'
import { getRepositoryToken } from '@nestjs/typeorm'
import { getModelToken } from '@nestjs/mongoose'
import { Character, CHARACTER_MODEL } from '../../src/domains/character/models/character.model'
import { UserService } from '../../src/domains/user/user.service'

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
class MockCharacterMongooseModel {
  private data: any
  constructor(entity: any) {
    this.data = entity
  }
  async save(): Promise<any> {
    const character = {
      ...this.data,
      characterId: this.data.characterId || 'test-id-123',
      _id: this.data._id || 'test-mongo-id',
      createdAt: this.data.createdAt || new Date(),
      updatedAt: this.data.updatedAt || new Date()
    }
    const index = mockCharacters.findIndex((c) => c.characterId === character.characterId)
    if (index >= 0) mockCharacters[index] = character
    else mockCharacters.push(character)
    return character
  }
  static find(filter: any = {}) {
    const filtered = mockCharacters.filter((c) => {
      return Object.entries(filter).every(([k, v]) => c[k] === v)
    })
    return {
      exec: () => Promise.resolve(filtered)
    }
  }
  static findOne(filter: any = {}) {
    const result =
      mockCharacters.find((c) => {
        return Object.entries(filter).every(([k, v]) => c[k] === v)
      }) || null
    const chain: any = {
      select: (_: string) => chain,
      lean: () => chain,
      exec: () => Promise.resolve(result)
    }
    return chain
  }
  static findOneAndUpdate(filter: any, update: any, opts: any) {
    const index = mockCharacters.findIndex((c) => {
      return Object.entries(filter).every(([k, v]) => c[k] === v)
    })
    if (index >= 0) {
      mockCharacters[index] = { ...mockCharacters[index], ...update, updatedAt: new Date() }
      const result = opts?.new ? mockCharacters[index] : null
      return { exec: () => Promise.resolve(result) }
    }
    return { exec: () => Promise.resolve(null) }
  }
  static deleteOne(filter: any) {
    const before = mockCharacters.length
    for (let i = mockCharacters.length - 1; i >= 0; i--) {
      if (Object.entries(filter).every(([k, v]) => mockCharacters[i][k] === v)) {
        mockCharacters.splice(i, 1)
      }
    }
    const affected = before - mockCharacters.length
    return { exec: () => Promise.resolve({ deletedCount: affected }) }
  }
}

// モックがアプリケーション全体で使えるようにするためのモジュール
@Module({
  providers: [
    {
      provide: getRepositoryToken(Character),
      useValue: mockCharacterRepository
    },
    {
      provide: getModelToken(CHARACTER_MODEL),
      useValue: MockCharacterMongooseModel
    },
    // UserService のモック（E2Eで外部副作用を避ける）
    {
      provide: UserService,
      useValue: {
        addCharacterId: jest.fn(async () => ({})),
        removeCharacterId: jest.fn(async () => ({})),
        findByDiscordId: jest.fn(async () => ({ discordUserId: '123456789012345678' })),
        update: jest.fn(async () => ({}))
      }
    }
  ],
  exports: [
    {
      provide: getRepositoryToken(Character),
      useValue: mockCharacterRepository
    },
    {
      provide: getModelToken(CHARACTER_MODEL),
      useValue: MockCharacterMongooseModel
    },
    {
      provide: UserService,
      useValue: {
        addCharacterId: jest.fn(async () => ({})),
        removeCharacterId: jest.fn(async () => ({})),
        findByDiscordId: jest.fn(async () => ({ discordUserId: '123456789012345678' })),
        update: jest.fn(async () => ({}))
      }
    }
  ]
})
export class MockModule {}
