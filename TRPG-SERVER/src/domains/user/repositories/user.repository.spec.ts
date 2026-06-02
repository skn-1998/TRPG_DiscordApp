import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { UserRepository } from './user.repository'
import { User, USER_MODEL } from '../models/user.model'

describe('UserRepository', () => {
  let repository: UserRepository
  let saveMock: jest.Mock
  let modelMock: jest.Mock & {
    findOne: jest.Mock
    find: jest.Mock
    findOneAndUpdate: jest.Mock
    findOneAndDelete: jest.Mock
  }

  const mockUser: User = {
    discordUserId: 'discord-user-1',
    name: 'Test User',
    characterIds: []
  }

  // findOne().exec() のような Mongoose チェーンを再現するヘルパー
  const chain = (resolved: unknown) => ({
    exec: jest.fn().mockResolvedValue(resolved)
  })

  beforeEach(async () => {
    // `new this.userModel(entity)` 用にコンストラクタ関数としてのモックを作る
    saveMock = jest.fn()
    modelMock = jest.fn().mockImplementation(() => ({
      save: saveMock
    })) as unknown as typeof modelMock
    modelMock.findOne = jest.fn()
    modelMock.find = jest.fn()
    modelMock.findOneAndUpdate = jest.fn()
    modelMock.findOneAndDelete = jest.fn()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        {
          provide: getModelToken(USER_MODEL),
          useValue: modelMock
        }
      ]
    }).compile()

    repository = module.get<UserRepository>(UserRepository)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should be defined', () => {
    expect(repository).toBeDefined()
  })

  describe('create', () => {
    it('エンティティから新規ドキュメントを生成し save の結果を返す', async () => {
      // Arrange
      saveMock.mockResolvedValue(mockUser)

      // Act
      const result = await repository.create(mockUser)

      // Assert
      expect(modelMock).toHaveBeenCalledWith(mockUser)
      expect(saveMock).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockUser)
    })
  })

  describe('findById', () => {
    it('discordUserId 条件で findOne し結果を返す', async () => {
      // Arrange
      modelMock.findOne.mockReturnValue(chain(mockUser))

      // Act
      const result = await repository.findById('discord-user-1')

      // Assert
      expect(modelMock.findOne).toHaveBeenCalledWith({ discordUserId: 'discord-user-1' })
      expect(result).toEqual(mockUser)
    })

    it('該当ユーザーが居ない場合は null を返す', async () => {
      // Arrange
      modelMock.findOne.mockReturnValue(chain(null))

      // Act
      const result = await repository.findById('absent-id')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('findByDiscordId', () => {
    it('discordUserId 条件で findOne し結果を返す', async () => {
      // Arrange
      modelMock.findOne.mockReturnValue(chain(mockUser))

      // Act
      const result = await repository.findByDiscordId('discord-user-1')

      // Assert
      expect(modelMock.findOne).toHaveBeenCalledWith({ discordUserId: 'discord-user-1' })
      expect(result).toEqual(mockUser)
    })

    it('該当ユーザーが居ない場合は null を返す', async () => {
      // Arrange
      modelMock.findOne.mockReturnValue(chain(null))

      // Act
      const result = await repository.findByDiscordId('absent-id')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('findAll', () => {
    it('フィルタを指定した場合はそのフィルタで find する', async () => {
      // Arrange
      const filter = { name: 'Test User' }
      modelMock.find.mockReturnValue(chain([mockUser]))

      // Act
      const result = await repository.findAll(filter)

      // Assert
      expect(modelMock.find).toHaveBeenCalledWith(filter)
      expect(result).toEqual([mockUser])
    })

    it('フィルタ未指定の場合は空オブジェクトで find する', async () => {
      // Arrange
      modelMock.find.mockReturnValue(chain([mockUser]))

      // Act
      const result = await repository.findAll()

      // Assert
      expect(modelMock.find).toHaveBeenCalledWith({})
      expect(result).toEqual([mockUser])
    })
  })

  describe('update', () => {
    it('discordUserId 条件で findOneAndUpdate し new:true で更新後を返す', async () => {
      // Arrange
      const updateData = { name: 'Updated Name' }
      const updated = { ...mockUser, name: 'Updated Name' }
      modelMock.findOneAndUpdate.mockReturnValue(chain(updated))

      // Act
      const result = await repository.update('discord-user-1', updateData)

      // Assert
      expect(modelMock.findOneAndUpdate).toHaveBeenCalledWith({ discordUserId: 'discord-user-1' }, updateData, {
        new: true
      })
      expect(result).toEqual(updated)
    })

    it('該当ユーザーが居ない場合は null を返す', async () => {
      // Arrange
      modelMock.findOneAndUpdate.mockReturnValue(chain(null))

      // Act
      const result = await repository.update('absent-id', { name: 'x' })

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('remove', () => {
    it('discordUserId 条件で findOneAndDelete し削除結果を返す', async () => {
      // Arrange
      modelMock.findOneAndDelete.mockReturnValue(chain(mockUser))

      // Act
      const result = await repository.remove('discord-user-1')

      // Assert
      expect(modelMock.findOneAndDelete).toHaveBeenCalledWith({ discordUserId: 'discord-user-1' })
      expect(result).toEqual(mockUser)
    })

    it('該当ユーザーが居ない場合は null を返す', async () => {
      // Arrange
      modelMock.findOneAndDelete.mockReturnValue(chain(null))

      // Act
      const result = await repository.remove('absent-id')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('addCharacterId', () => {
    it('$addToSet でキャラクターIDを追加し new:true で更新後を返す', async () => {
      // Arrange
      const updated = { ...mockUser, characterIds: ['char-1'] }
      modelMock.findOneAndUpdate.mockReturnValue(chain(updated))

      // Act
      const result = await repository.addCharacterId('discord-user-1', 'char-1')

      // Assert
      expect(modelMock.findOneAndUpdate).toHaveBeenCalledWith(
        { discordUserId: 'discord-user-1' },
        { $addToSet: { characterIds: 'char-1' } },
        { new: true }
      )
      expect(result).toEqual(updated)
    })

    it('該当ユーザーが居ない場合は null を返す', async () => {
      // Arrange
      modelMock.findOneAndUpdate.mockReturnValue(chain(null))

      // Act
      const result = await repository.addCharacterId('absent-id', 'char-1')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('removeCharacterId', () => {
    it('$pull でキャラクターIDを削除し new:true で更新後を返す', async () => {
      // Arrange
      const updated = { ...mockUser, characterIds: [] }
      modelMock.findOneAndUpdate.mockReturnValue(chain(updated))

      // Act
      const result = await repository.removeCharacterId('discord-user-1', 'char-1')

      // Assert
      expect(modelMock.findOneAndUpdate).toHaveBeenCalledWith(
        { discordUserId: 'discord-user-1' },
        { $pull: { characterIds: 'char-1' } },
        { new: true }
      )
      expect(result).toEqual(updated)
    })

    it('該当ユーザーが居ない場合は null を返す', async () => {
      // Arrange
      modelMock.findOneAndUpdate.mockReturnValue(chain(null))

      // Act
      const result = await repository.removeCharacterId('absent-id', 'char-1')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('updateDiscordTokens', () => {
    it('トークン4フィールドを findOneAndUpdate で更新し new:true で更新後を返す', async () => {
      // Arrange
      const expiresAt = new Date('2026-01-01T00:00:00.000Z')
      const tokenData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt,
        scope: 'identify guilds'
      }
      const updated = {
        ...mockUser,
        discordAccessToken: 'access-token',
        discordRefreshToken: 'refresh-token',
        discordTokenExpiresAt: expiresAt,
        discordTokenScope: 'identify guilds'
      }
      modelMock.findOneAndUpdate.mockReturnValue(chain(updated))

      // Act
      const result = await repository.updateDiscordTokens('discord-user-1', tokenData)

      // Assert
      expect(modelMock.findOneAndUpdate).toHaveBeenCalledWith(
        { discordUserId: 'discord-user-1' },
        {
          discordAccessToken: 'access-token',
          discordRefreshToken: 'refresh-token',
          discordTokenExpiresAt: expiresAt,
          discordTokenScope: 'identify guilds'
        },
        { new: true }
      )
      expect(result).toEqual(updated)
    })

    it('該当ユーザーが居ない場合は null を返す', async () => {
      // Arrange
      modelMock.findOneAndUpdate.mockReturnValue(chain(null))

      // Act
      const result = await repository.updateDiscordTokens('absent-id', {
        accessToken: 'a',
        refreshToken: 'r',
        expiresAt: new Date(),
        scope: 's'
      })

      // Assert
      expect(result).toBeNull()
    })
  })
})
