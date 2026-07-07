import { Module } from '@nestjs/common'
import { getModelToken } from '@nestjs/mongoose'
import { CHARACTER_MODEL } from '../../src/domains/character/models/character.model'
import { UserService } from '../../src/domains/user/user.service'

// モックリポジトリのストレージ
export const mockCharacters: any[] = []

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
