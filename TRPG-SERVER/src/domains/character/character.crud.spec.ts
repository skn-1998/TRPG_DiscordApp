import { Test, TestingModule } from '@nestjs/testing'
import { MongooseModule } from '@nestjs/mongoose'
import { v4 as uuidv4 } from 'uuid'
import { CharacterService } from './character.service'
import { CharacterRepository } from './repositories/character.repository'
import { Character, CharacterSchema, CHARACTER_MODEL } from './models/character.model'
import { CharacterInputDto } from './dto/create-character.dto'
import { UserService } from '../user/user.service'
import { AppConfigService } from '../../config/config.service'
import { TypedEventEmitter, TypedEventService } from '../../shared/application/typed-event.service'

/**
 * Character Simple CRUD Test
 * MongoDB Atlas を使用してシンプルなCRUD操作を検証
 */
describe('Character Simple CRUD Test', () => {
  let module: TestingModule
  let characterService: CharacterService
  let characterRepository: CharacterRepository

  // テスト用のMongoDB URI (MongoDB Atlas with test database)
  const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
  const mongoUri = baseUri.includes('mongodb+srv://')
    ? baseUri.replace('/?', '/trpg_crud_test_db?')
    : 'mongodb://localhost:27017/trpg_crud_test_db'

  // モックサービス
  const mockUserService = {
    findUserById: jest.fn().mockResolvedValue({ discordUserId: 'test-user', username: 'test' }),
    findOrCreateUser: jest.fn(),
    addCharacterId: jest.fn().mockResolvedValue(undefined)
  }

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'prototype.eventDriven') return false // 直接DB操作
      return null
    })
  }

  const mockTypedEventService = {
    emit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn()
  }

  const mockTypedEventEmitter = {
    requestCharacterByChannelId: jest.fn().mockResolvedValue(undefined),
    requestCharacterUpdate: jest.fn().mockResolvedValue(undefined)
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: CHARACTER_MODEL, schema: CharacterSchema }])
      ],
      providers: [
        CharacterService,
        CharacterRepository,
        { provide: UserService, useValue: mockUserService },
        { provide: AppConfigService, useValue: mockConfigService },
        { provide: TypedEventService, useValue: mockTypedEventService },
        { provide: TypedEventEmitter, useValue: mockTypedEventEmitter }
      ]
    }).compile()

    characterService = module.get<CharacterService>(CharacterService)
    characterRepository = module.get<CharacterRepository>(CharacterRepository)
  })

  afterAll(async () => {
    await module.close()
  })

  beforeEach(async () => {
    // テスト前にデータベースをクリア
    await clearTestDatabase()
  })

  afterEach(async () => {
    // テスト後にデータベースをクリア
    await clearTestDatabase()
  })

  /**
   * テスト用データベースクリア
   */
  async function clearTestDatabase(): Promise<void> {
    try {
      const characters = await characterRepository.findAll()
      for (const char of characters) {
        await characterRepository.remove(char.characterId)
      }
    } catch (error) {
      // エラーは無視（初回実行時等）
    }
  }

  /**
   * テスト用データ作成
   */
  function createTestCharacterData(name: string = 'Test Character'): CharacterInputDto {
    return {
      characterId: uuidv4(),
      characterName: name,
      gameSystemId: 'coc',
      discordUserId: 'test-user-123',
      discordChannelId: `test-channel-${Date.now()}`,
      status: {
        HP: {
          name: 'HP',
          index: 1,
          values: { base: 50, other: 0 },
          description: 'ヒットポイント',
          isVisible: true
        },
        MP: {
          name: 'MP',
          index: 2,
          values: { base: 25, other: 5 },
          description: 'マジックポイント',
          isVisible: true
        }
      },
      parameter: {
        STR: {
          name: 'STR',
          index: 1,
          values: { base: 13, other: 0 },
          description: '筋力',
          isVisible: true
        },
        DEX: {
          name: 'DEX',
          index: 2,
          values: { base: 14, fluctuation: -2, other: 1 },
          description: '敏捷性',
          isVisible: true
        }
      },
      skill: {
        回避: {
          name: '回避',
          index: 1,
          values: { base: 20, experience: 15, other: 0 },
          description: '攻撃を回避する技能',
          isVisible: true
        }
      }
    }
  }

  /**
   * CREATE操作のテスト
   */
  describe('Create Operation', () => {
    it('should create and save character to database', async () => {
      // Arrange
      const testData = createTestCharacterData('Create Test Character')

      // Act
      const result = await characterService.create(testData)

      // Assert - サービス戻り値確認
      expect(result).toBeDefined()
      expect(result.characterId).toBe(testData.characterId)
      expect(result.characterName).toBe(testData.characterName)
      expect(result.gameSystemId).toBe(testData.gameSystemId)
      expect(result.discordUserId).toBe(testData.discordUserId)
      expect(result.discordChannelId).toBe(testData.discordChannelId)

      // Assert - データベース保存確認
      const saved = await characterRepository.findById(testData.characterId!)
      expect(saved).not.toBeNull()
      expect(saved!.characterName).toBe(testData.characterName)

      // 新しいAttributeValue形式での保存確認
      expect(saved!.status).toBeDefined()
      expect((saved!.status as any).HP.values.base).toBe(50)
      expect((saved!.status as any).HP.values.other).toBe(0)
      expect((saved!.status as any).MP.values.base).toBe(25)
      expect((saved!.status as any).MP.values.other).toBe(5)

      expect(saved!.parameter).toBeDefined()
      expect((saved!.parameter as any).STR.values.base).toBe(13)
      expect((saved!.parameter as any).DEX.values.base).toBe(14)
      expect((saved!.parameter as any).DEX.values.fluctuation).toBe(-2)
      expect((saved!.parameter as any).DEX.values.other).toBe(1)

      expect(saved!.skill).toBeDefined()
      expect((saved!.skill as any)['回避'].values.base).toBe(20)
      expect((saved!.skill as any)['回避'].values.experience).toBe(15)
      expect((saved!.skill as any)['回避'].values.other).toBe(0)
    })

    it('should handle duplicate characterId creation', async () => {
      // Arrange
      const testData = createTestCharacterData('Duplicate Test')

      // Act & Assert - 最初の作成は成功
      const first = await characterService.create(testData)
      expect(first.characterId).toBe(testData.characterId)

      // 同じIDで再作成は失敗するはず
      await expect(characterService.create(testData)).rejects.toThrow()
    })
  })

  /**
   * READ操作のテスト
   */
  describe('Read Operation', () => {
    let testCharacter: Character

    beforeEach(async () => {
      // テスト用キャラクター作成
      const testData = createTestCharacterData('Read Test Character')
      testCharacter = await characterService.create(testData)
    })

    it('should find character by ID', async () => {
      // Act
      const found = await characterRepository.findById(testCharacter.characterId)

      // Assert
      expect(found).not.toBeNull()
      expect(found!.characterId).toBe(testCharacter.characterId)
      expect(found!.characterName).toBe(testCharacter.characterName)
      expect(found!.gameSystemId).toBe(testCharacter.gameSystemId)
    })

    it('should find character by channelId', async () => {
      // Act
      const found = await characterService.findByChannelId(testCharacter.discordChannelId)

      // Assert
      expect(found).not.toBeNull()
      expect(found!.characterId).toBe(testCharacter.characterId)
      expect(found!.discordChannelId).toBe(testCharacter.discordChannelId)
    })

    it('should return null for non-existent character', async () => {
      // Act
      const found = await characterRepository.findById('non-existent-id')

      // Assert
      expect(found).toBeNull()
    })
  })

  /**
   * UPDATE操作のテスト
   */
  describe('Update Operation', () => {
    let testCharacter: Character

    beforeEach(async () => {
      const testData = createTestCharacterData('Update Test Character')
      testCharacter = await characterService.create(testData)
    })

    it('should update character data', async () => {
      // Arrange
      const updateData = {
        characterName: 'Updated Character Name',
        status: {
          HP: {
            name: 'HP',
            index: 1,
            values: { base: 40, damage: -10, other: 5 },
            description: 'ヒットポイント（更新）',
            isVisible: true
          },
          SAN: {
            name: 'SAN',
            index: 3,
            values: { base: 60, other: -5 },
            description: '正気度',
            isVisible: true
          }
        }
      }

      // Act
      const updated = await characterService.update(testCharacter.characterId, updateData)

      // Assert - サービス戻り値確認
      expect(updated).not.toBeNull()
      expect(updated!.characterName).toBe(updateData.characterName)

      // Assert - データベース更新確認
      const saved = await characterRepository.findById(testCharacter.characterId)
      expect(saved).not.toBeNull()
      expect(saved!.characterName).toBe(updateData.characterName)

      // 属性値の更新確認
      expect((saved!.status as any).HP.values.base).toBe(40)
      expect((saved!.status as any).HP.values.damage).toBe(-10)
      expect((saved!.status as any).HP.values.other).toBe(5)
      expect((saved!.status as any).HP.description).toBe('ヒットポイント（更新）')

      // 新規追加属性の確認
      expect((saved!.status as any).SAN.values.base).toBe(60)
      expect((saved!.status as any).SAN.values.other).toBe(-5)
    })

    it('should update character by channelId', async () => {
      // Arrange
      const updateData = {
        characterName: 'Updated via Channel',
        parameter: {
          STR: {
            name: 'STR',
            index: 1,
            values: { base: 15, training: 2, other: 0 },
            description: '筋力（更新）',
            isVisible: true
          }
        }
      }

      // Act
      const updated = await characterService.updateByChannelId(testCharacter.discordChannelId, updateData)

      // Assert
      expect(updated).not.toBeNull()
      expect(updated!.characterName).toBe(updateData.characterName)
      expect((updated!.parameter as any).STR.values.base).toBe(15)
      expect((updated!.parameter as any).STR.values.training).toBe(2)
    })
  })

  /**
   * DELETE操作のテスト
   */
  describe('Delete Operation', () => {
    let testCharacter: Character

    beforeEach(async () => {
      const testData = createTestCharacterData('Delete Test Character')
      testCharacter = await characterService.create(testData)
    })

    it('should delete character from database', async () => {
      // Act
      await characterRepository.remove(testCharacter.characterId)

      // Assert
      const found = await characterRepository.findById(testCharacter.characterId)
      expect(found).toBeNull()
    })
  })

  /**
   * エンドツーエンドCRUDフローテスト
   */
  describe('End-to-End CRUD Flow', () => {
    it('should handle complete CRUD lifecycle', async () => {
      const characterId = uuidv4()
      const channelId = `e2e-test-${Date.now()}`

      // 1. CREATE
      const createData: CharacterInputDto = {
        characterId,
        characterName: 'E2E Test Character',
        gameSystemId: 'coc',
        discordUserId: 'e2e-user',
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
      const found = await characterRepository.findById(characterId)
      expect(found).not.toBeNull()
      expect(found!.characterName).toBe('E2E Test Character')

      // 3. UPDATE
      const updateData = {
        characterName: 'E2E Updated Character',
        status: {
          HP: {
            name: 'HP',
            index: 1,
            values: { base: 80, damage: -15, heal: 5, other: 0 },
            description: 'ヒットポイント（更新）',
            isVisible: true
          }
        }
      }

      const updated = await characterService.update(characterId, updateData)
      expect(updated!.characterName).toBe('E2E Updated Character')
      expect((updated!.status as any).HP.values.base).toBe(80)
      expect((updated!.status as any).HP.values.damage).toBe(-15)
      expect((updated!.status as any).HP.values.heal).toBe(5)

      // 4. DELETE
      await characterRepository.remove(characterId)
      const deleted = await characterRepository.findById(characterId)
      expect(deleted).toBeNull()
    })
  })
})
