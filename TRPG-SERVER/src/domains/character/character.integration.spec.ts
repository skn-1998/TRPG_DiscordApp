import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken, MongooseModule } from '@nestjs/mongoose'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { Model } from 'mongoose'
import { CharacterService } from './character.service'
import { CharacterRepository } from './repositories/character.repository'
import { TypedEventService } from '../../core/events/typed-event.service'
import { Character, CharacterDocument, CharacterSchema, CHARACTER_MODEL } from './models/character.model'
import { CharacterInputDto } from './dto/create-character.dto'
import { v4 as uuidv4 } from 'uuid'
import { requireIsolatedMongoUri } from 'test/testcontainers/mongo-uri'

/**
 * Character CRUD 結合テスト（実 MongoDB 使用）
 *
 * 現行 CharacterService の挙動に追従:
 * - create は characterId 必須・直接 DB へ永続化し、作成完了イベントは発行しない
 *   （character.creation.completed は File-based Event Handlers が character.creation.requested を
 *    受けて発行する責務であり、create() 自体は発行しない）
 * - update / updateByChannelId は DB を更新する（過去形 character.updated は廃止済みで emit しない）
 * - remove / removeByChannelId は DB から削除する（過去形 character.deleted は廃止済みで emit しない）
 *
 * よって本テストは「サービス経由の直接 CRUD が DB に正しく反映されること」と
 * 「廃止済みの過去形デッドイベント（character.updated / character.deleted）を emit しないこと」を検証する。
 * findByChannelId.completed / update.completed といった完了イベントの検証は
 * File-based Event Handlers 側の spec が担うため、ここでは扱わない。
 */
describe('Character CRUD Integration Test', () => {
  let module: TestingModule
  let characterService: CharacterService
  let characterRepository: CharacterRepository
  let typedEventService: TypedEventService
  let characterModel: Model<CharacterDocument>

  const mongoUri = requireIsolatedMongoUri()

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: CHARACTER_MODEL, schema: CharacterSchema }]),
        EventEmitterModule.forRoot({
          wildcard: false,
          delimiter: '.',
          maxListeners: 10,
          ignoreErrors: false
        })
      ],
      providers: [
        CharacterService,
        CharacterRepository,
        TypedEventService,
        {
          provide: 'TYPED_EVENT_EMITTER',
          useFactory: () =>
            new (require('@nestjs/event-emitter').EventEmitter2)({
              wildcard: false,
              delimiter: '.',
              maxListeners: 10,
              ignoreErrors: false
            })
        }
      ]
    }).compile()

    characterService = module.get<CharacterService>(CharacterService)
    characterRepository = module.get<CharacterRepository>(CharacterRepository)
    typedEventService = module.get<TypedEventService>(TypedEventService)
    characterModel = module.get<Model<CharacterDocument>>(getModelToken(CHARACTER_MODEL))

    await clearTestDatabase()
  })

  afterEach(async () => {
    await clearTestDatabase()

    if (typedEventService) {
      // 契約外の dead イベント名（E-4a で削除済み）の後始末のため as any で通す
      typedEventService.removeAllListeners('character.updated' as any)
      typedEventService.removeAllListeners('character.deleted' as any)
    }

    await module.close()
  })

  async function clearTestDatabase(): Promise<void> {
    const characters = await characterRepository.findAll()
    for (const char of characters) {
      await characterRepository.remove(char.characterId)
    }
  }

  describe('Character Creation', () => {
    it('should create character and persist it to the database', async () => {
      // Arrange
      const createData: CharacterInputDto = {
        characterId: uuidv4(),
        characterName: 'Test Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-123',
        discordChannelId: 'test-channel-456',
        status: {
          HP: {
            name: 'HP',
            index: 1,
            values: { base: 50, other: 0 },
            description: 'ヒットポイント',
            dice: '1d6',
            isVisible: true
          }
        },
        parameter: {
          STR: {
            name: 'STR',
            index: 1,
            values: { base: 13, other: 0 },
            description: '筋力',
            dice: '3d6',
            isVisible: true
          }
        }
      }

      // Act
      const result = await characterService.create(createData)

      // Assert - サービス戻り値
      expect(result).toBeDefined()
      expect(result.characterId).toBe(createData.characterId)
      expect(result.characterName).toBe(createData.characterName)
      expect(result.gameSystemId).toBe(createData.gameSystemId)
      expect(result.discordUserId).toBe(createData.discordUserId)
      expect(result.discordChannelId).toBe(createData.discordChannelId)

      // Assert - DB 永続化
      const savedCharacter = await characterRepository.findById(createData.characterId!)
      expect(savedCharacter).not.toBeNull()
      expect(savedCharacter!.characterName).toBe(createData.characterName)
      expect(savedCharacter!.status).toEqual(createData.status)
      expect(savedCharacter!.parameter).toEqual(createData.parameter)
    })

    it('legacy属性をread時に正規化し、同一セクションのupdateで正準形へ書き戻せる', async () => {
      const characterId = uuidv4()
      await characterModel.create({
        characterId,
        characterName: 'Legacy Character',
        gameSystemId: 'coc',
        discordUserId: 'legacy-user',
        discordChannelId: 'legacy-channel',
        status: {
          HP: { name: 'HP', index: null, values: { base: 10 }, description: null, dice: null },
          MP: 5
        }
      })
      const oldUpdatedAt = new Date('2000-01-01T00:00:00.000Z')
      await characterModel.collection.updateOne({ characterId }, { $set: { updatedAt: oldUpdatedAt } })

      const normalized = await characterRepository.findById(characterId)
      expect(normalized?.status).toEqual({
        HP: { name: 'HP', values: { base: 10 } },
        MP: { values: { base: 5 } }
      })

      const updated = await characterService.update(characterId, {
        status: {
          ...normalized!.status,
          HP: { ...normalized!.status.HP, values: { base: 12 }, dice: '1d6' }
        }
      })
      expect(updated?.status.HP.dice).toBe('1d6')

      const raw = await characterModel.collection.findOne({ characterId })
      expect(raw?.status).toEqual({
        HP: { name: 'HP', values: { base: 12 }, dice: '1d6' },
        MP: { values: { base: 5 } }
      })
      expect(raw?.updatedAt.getTime()).toBeGreaterThan(oldUpdatedAt.getTime())
    })

    it('should throw when characterId is not provided', async () => {
      const createData = {
        characterName: 'No-Id Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-123',
        discordChannelId: 'test-channel-456'
      } as CharacterInputDto

      await expect(characterService.create(createData)).rejects.toThrow('CharacterID is required')
    })
  })

  describe('Character Find', () => {
    let testCharacter: Character

    beforeEach(async () => {
      const createData: CharacterInputDto = {
        characterId: uuidv4(),
        characterName: 'Find Test Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-123',
        discordChannelId: 'find-test-channel-456'
      }
      testCharacter = await characterService.create(createData)
    })

    it('should find character directly by channelId', async () => {
      const found = await characterService.findByChannelId(testCharacter.discordChannelId)

      expect(found).not.toBeNull()
      expect(found!.characterId).toBe(testCharacter.characterId)
      expect(found!.characterName).toBe(testCharacter.characterName)
    })

    it('should return null for a non-existent channel', async () => {
      const found = await characterService.findByChannelId('non-existent-channel-id')
      expect(found).toBeNull()
    })
  })

  describe('Character Update', () => {
    let testCharacter: Character

    beforeEach(async () => {
      const createData: CharacterInputDto = {
        characterId: uuidv4(),
        characterName: 'Update Test Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-123',
        discordChannelId: 'update-test-channel-456',
        status: {
          HP: {
            name: 'HP',
            index: 1,
            values: { base: 50, other: 0 },
            description: 'ヒットポイント',
            isVisible: true
          }
        }
      }
      testCharacter = await characterService.create(createData)
    })

    it('should update character by channelId and persist changes', async () => {
      const updateData = {
        status: {
          HP: {
            name: 'HP',
            index: 1,
            values: { base: 30, other: 0 },
            description: 'ヒットポイント',
            dice: '1d6+1',
            isVisible: true
          },
          MP: {
            name: 'MP',
            index: 2,
            values: { base: 20, other: 5 },
            description: 'マジックポイント',
            dice: '2d6',
            isVisible: true
          }
        }
      }

      // Act
      const updated = await characterService.updateByChannelId(testCharacter.discordChannelId, updateData)

      // Assert - 戻り値
      expect(updated).not.toBeNull()
      expect(updated!.characterId).toBe(testCharacter.characterId)

      // Assert - DB 反映
      const savedCharacter = await characterRepository.findById(testCharacter.characterId)
      expect(savedCharacter).not.toBeNull()
      expect((savedCharacter!.status as any).HP.values.base).toBe(30)
      expect((savedCharacter!.status as any).MP.values.base).toBe(20)
      expect((savedCharacter!.status as any).MP.values.other).toBe(5)
      expect((savedCharacter!.status as any).HP.dice).toBe('1d6+1')
      expect((savedCharacter!.status as any).MP.dice).toBe('2d6')
    })

    it('should update by id in DB and NOT emit the retired character.updated event', async () => {
      // 注: character.updated は契約から削除済みの dead イベント名（E-4a）。
      //     「emit されないこと」の検証のため契約外名を as any で購読する。
      let emittedPayload: unknown = null
      typedEventService.once('character.updated' as any, (payload: unknown) => {
        emittedPayload = payload
      })

      const updated = await characterService.update(testCharacter.characterId, { characterName: 'Renamed Character' })
      await new Promise((resolve) => setTimeout(resolve, 50))

      // 過去形 character.updated は購読者ゼロのデッドイベントとして廃止済み（emit しない）
      expect(emittedPayload).toBeNull()

      // DB 更新自体は従来どおり行われる
      expect(updated).not.toBeNull()
      const savedCharacter = await characterRepository.findById(testCharacter.characterId)
      expect(savedCharacter!.characterName).toBe('Renamed Character')
    })

    it('should return null when updating a non-existent channel', async () => {
      const updated = await characterService.updateByChannelId('non-existent-channel-id', {
        characterName: 'Ghost'
      })
      expect(updated).toBeNull()
    })
  })

  describe('Character Delete', () => {
    let testCharacter: Character

    beforeEach(async () => {
      const createData: CharacterInputDto = {
        characterId: uuidv4(),
        characterName: 'Delete Test Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-123',
        discordChannelId: 'delete-test-channel-456'
      }
      testCharacter = await characterService.create(createData)
    })

    it('should remove character by channelId and clear DB without emitting the retired character.deleted event', async () => {
      // 注: character.deleted は契約から削除済みの dead イベント名（E-4a）。
      //     「emit されないこと」の検証のため契約外名を as any で購読する。
      let emittedPayload: unknown = null
      typedEventService.once('character.deleted' as any, (payload: unknown) => {
        emittedPayload = payload
      })

      // Act
      await characterService.removeByChannelId(testCharacter.discordChannelId, 'test-user-123')
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Assert - 過去形 character.deleted は購読者ゼロのデッドイベントとして廃止済み（emit しない）
      expect(emittedPayload).toBeNull()

      // Assert - DB から削除済み（削除挙動は従来どおり）
      const savedCharacter = await characterRepository.findById(testCharacter.characterId)
      expect(savedCharacter).toBeNull()
    })
  })

  describe('End-to-End CRUD Flow', () => {
    it('should handle complete create -> find -> update -> delete lifecycle', async () => {
      const characterId = uuidv4()
      const channelId = 'e2e-test-channel-789'

      // 1. CREATE
      const createData: CharacterInputDto = {
        characterId,
        characterName: 'E2E Test Character',
        gameSystemId: 'coc',
        discordUserId: 'test-user-123',
        discordChannelId: channelId,
        status: {
          HP: {
            name: 'HP',
            index: 1,
            values: { base: 100, other: 0 },
            description: 'ヒットポイント',
            isVisible: true
          }
        }
      }

      const created = await characterService.create(createData)
      expect(created.characterId).toBe(characterId)

      // 2. READ
      const found = await characterService.findByChannelId(channelId)
      expect(found).not.toBeNull()
      expect(found!.characterId).toBe(characterId)

      // 3. UPDATE
      const updateData = {
        status: {
          HP: {
            name: 'HP',
            index: 1,
            values: { base: 75, other: 0 },
            description: 'ヒットポイント',
            isVisible: true
          },
          MP: {
            name: 'MP',
            index: 2,
            values: { base: 50, other: 0 },
            description: 'マジックポイント',
            isVisible: true
          }
        }
      }

      const updated = await characterService.updateByChannelId(channelId, updateData)
      expect(updated).not.toBeNull()
      expect((updated!.status as any).HP.values.base).toBe(75)
      expect((updated!.status as any).MP.values.base).toBe(50)

      // 4. 最終検証
      const finalCharacter = await characterRepository.findById(characterId)
      expect(finalCharacter).not.toBeNull()
      expect((finalCharacter!.status as any).HP.values.base).toBe(75)
      expect((finalCharacter!.status as any).MP.values.base).toBe(50)

      // 5. DELETE
      await characterService.removeByChannelId(channelId, 'test-user-123')
      const deleted = await characterRepository.findById(characterId)
      expect(deleted).toBeNull()
    })
  })
})
