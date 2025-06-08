/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { MongooseModule } from '@nestjs/mongoose'
import { CharacterService } from './character.service'
import { CharacterRepository } from './repositories/character.repository'
import { CHARACTER_MODEL, CharacterSchema } from './models/character.model'
import { cthulhuTestCharacter } from './dto/test-data'
import * as mongoose from 'mongoose'

describe('CharacterService MongoDB Connection Test', () => {
  let service: CharacterService
  let repository: CharacterRepository
  let moduleRef: TestingModule

  beforeAll(async () => {
    // MongoDB接続文字列
    const MONGODB_URI = 'mongodb://localhost:27017/trpg-test'

    // テスト用にMongooseを直接接続
    await mongoose.connect(MONGODB_URI)

    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(MONGODB_URI),
        MongooseModule.forFeature([{ name: CHARACTER_MODEL, schema: CharacterSchema }])
      ],
      providers: [CharacterService, CharacterRepository]
    }).compile()

    service = moduleRef.get<CharacterService>(CharacterService)
    repository = moduleRef.get<CharacterRepository>(CharacterRepository)
  })

  afterAll(async () => {
    // テスト後にテストデータを削除
    if (repository && cthulhuTestCharacter.discordChannelId) {
      await repository.removeByChannelId(cthulhuTestCharacter.discordChannelId)
    }

    // MongoDB接続を閉じる
    await moduleRef.close()
    await mongoose.disconnect()
  })

  it('should connect to MongoDB and save test character data', async () => {
    // テストデータをMongoDBに保存
    const createdCharacter = await service.create(cthulhuTestCharacter)

    // 保存したデータを取得して検証
    if (cthulhuTestCharacter.discordChannelId) {
      const foundCharacter = await service.findByChannelId(cthulhuTestCharacter.discordChannelId)

      // 検証
      expect(foundCharacter).toBeDefined()
      if (foundCharacter) {
        expect(foundCharacter.characterId).toEqual(cthulhuTestCharacter.characterId)
        expect(foundCharacter.characterName).toEqual(cthulhuTestCharacter.characterName)
        expect(foundCharacter.gameSystemId).toEqual(cthulhuTestCharacter.gameSystemId)
        expect(foundCharacter.discordUserId).toEqual(cthulhuTestCharacter.discordUserId)
        expect(foundCharacter.discordChannelId).toEqual(cthulhuTestCharacter.discordChannelId)

        // ステータス、スキル、パラメータ、アイテムの検証
        expect(foundCharacter.status).toEqual(expect.objectContaining(cthulhuTestCharacter.status))
        expect(foundCharacter.skill).toEqual(expect.objectContaining(cthulhuTestCharacter.skill))
        expect(foundCharacter.parameter).toEqual(expect.objectContaining(cthulhuTestCharacter.parameter))
        expect(foundCharacter.item).toEqual(expect.objectContaining(cthulhuTestCharacter.item))

        // 説明の検証
        expect(foundCharacter.description).toEqual(expect.objectContaining(cthulhuTestCharacter.description))

        console.log('MongoDB connection test successful!')
        console.log('Character saved and retrieved successfully:', foundCharacter.characterName)
      }
    }
  })
})
