/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { v4 as uuidv4 } from 'uuid'
import { DiceRollService } from './dice-roll.service'
import { DiceRollChannelRepository } from './repositories/dice-roll-channel.repository'
import { DiceRollTextRepository } from './repositories/dice-roll-text.repository'
import { DiceRollChannelInputDto } from './dto/create-dice-roll-channel.dto'
import { DiceRollTextInputDto } from './dto/create-dice-roll-text.dto'
import { DiceRollChannel } from './models/dice-roll-channel.model'
import { DiceRollText } from './models/dice-roll-text.model'

jest.mock('uuid')

describe('DiceRollService', () => {
  let service: DiceRollService
  let channelRepository: jest.Mocked<DiceRollChannelRepository>
  let textRepository: jest.Mocked<DiceRollTextRepository>

  const mockChannel = {
    discordChannelId: 'channel-1',
    characterIds: [],
    textIds: []
  } as unknown as DiceRollChannel

  const mockText = {
    textId: 'text-1',
    discordChannelId: 'channel-1'
  } as unknown as DiceRollText

  beforeEach(async () => {
    const mockChannelRepository = {
      create: jest.fn(),
      findByChannelId: jest.fn(),
      update: jest.fn(),
      addTextId: jest.fn(),
      addCharacterId: jest.fn(),
      addEmbedId: jest.fn(),
      remove: jest.fn()
    }

    const mockTextRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByChannelId: jest.fn(),
      findByCharacterId: jest.fn(),
      remove: jest.fn(),
      removeByChannelId: jest.fn(),
      deleteOldRolls: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiceRollService,
        { provide: DiceRollChannelRepository, useValue: mockChannelRepository },
        { provide: DiceRollTextRepository, useValue: mockTextRepository }
      ]
    }).compile()

    service = module.get<DiceRollService>(DiceRollService)
    channelRepository = module.get(DiceRollChannelRepository)
    textRepository = module.get(DiceRollTextRepository)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createOrGetChannel', () => {
    const inputDto: DiceRollChannelInputDto = {
      discordChannelId: 'channel-1'
    }

    it('既存チャンネルが存在する場合はそれを返し、作成しない', async () => {
      // Given
      channelRepository.findByChannelId.mockResolvedValue(mockChannel)

      // When
      const result = await service.createOrGetChannel(inputDto)

      // Then
      expect(result).toBe(mockChannel)
      expect(channelRepository.findByChannelId).toHaveBeenCalledWith('channel-1')
      expect(channelRepository.create).not.toHaveBeenCalled()
    })

    it('既存チャンネルが無い場合は新規作成し、未指定の配列は空配列で補完する', async () => {
      // Given
      channelRepository.findByChannelId.mockResolvedValue(null)
      channelRepository.create.mockResolvedValue(mockChannel)

      // When
      const result = await service.createOrGetChannel(inputDto)

      // Then
      expect(result).toBe(mockChannel)
      expect(channelRepository.create).toHaveBeenCalledWith({
        discordChannelId: 'channel-1',
        characterIds: [],
        textIds: []
      })
    })

    it('characterIds / textIds が指定されている場合はその値で作成する', async () => {
      // Given
      channelRepository.findByChannelId.mockResolvedValue(null)
      channelRepository.create.mockResolvedValue(mockChannel)

      // When
      await service.createOrGetChannel({
        discordChannelId: 'channel-1',
        characterIds: ['c1'],
        textIds: ['t1']
      })

      // Then
      expect(channelRepository.create).toHaveBeenCalledWith({
        discordChannelId: 'channel-1',
        characterIds: ['c1'],
        textIds: ['t1']
      })
    })
  })

  describe('createText', () => {
    beforeEach(() => {
      ;(uuidv4 as jest.Mock).mockReturnValue('generated-uuid')
      textRepository.create.mockResolvedValue(mockText)
    })

    it('textId 未指定時は uuid を生成して使用する', async () => {
      // Given
      const dto: DiceRollTextInputDto = {
        channelId: 'channel-1',
        userId: 'user-1',
        diceExpression: '1d6'
      }

      // When
      await service.createText(dto)

      // Then
      expect(uuidv4).toHaveBeenCalled()
      expect(textRepository.create).toHaveBeenCalledWith(expect.objectContaining({ textId: 'generated-uuid' }))
    })

    it('textId 指定時は uuid を生成せず指定値を使用する', async () => {
      // Given
      const dto: DiceRollTextInputDto = {
        textId: 'given-id',
        channelId: 'channel-1',
        userId: 'user-1',
        diceExpression: '1d6'
      }

      // When
      await service.createText(dto)

      // Then
      expect(uuidv4).not.toHaveBeenCalled()
      expect(textRepository.create).toHaveBeenCalledWith(expect.objectContaining({ textId: 'given-id' }))
    })

    it('新フィールド優先で整形する（diceExpression / resultDetails 等）', async () => {
      // Given
      const dto: DiceRollTextInputDto = {
        channelId: 'channel-1',
        userId: 'user-1',
        diceExpression: '2d6',
        resultDetails: '詳細',
        characterId: 'char-1',
        reason: '判定',
        characterName: 'キャラ',
        gameSystem: 'CoC'
      }

      // When
      await service.createText(dto)

      // Then
      expect(textRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          discordChannelId: 'channel-1',
          characterId: 'char-1',
          diceRoll: '2d6',
          text: '詳細',
          diceExpression: '2d6',
          resultDetails: '詳細',
          reason: '判定',
          characterName: 'キャラ',
          gameSystem: 'CoC',
          userId: 'user-1'
        })
      )
    })

    it('新フィールドが無い場合は旧フィールドにフォールバックする', async () => {
      // Given（channelId / diceExpression / resultDetails を未指定にして旧フィールドを使う）
      const dto = {
        userId: 'user-1',
        discordChannelId: 'legacy-channel',
        diceRoll: '1d100',
        text: '旧テキスト'
      } as unknown as DiceRollTextInputDto

      // When
      await service.createText(dto)

      // Then
      expect(textRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          discordChannelId: 'legacy-channel',
          diceRoll: '1d100',
          text: '旧テキスト'
        })
      )
    })

    it('diceExpression も diceRoll も無い場合は diceRoll が unknown になる', async () => {
      // Given
      const dto = {
        channelId: 'channel-1',
        userId: 'user-1'
      } as unknown as DiceRollTextInputDto

      // When
      await service.createText(dto)

      // Then
      expect(textRepository.create).toHaveBeenCalledWith(expect.objectContaining({ diceRoll: 'unknown', text: '' }))
    })

    it('result が文字列の場合は parseInt で数値化する', async () => {
      // Given
      const dto = {
        channelId: 'channel-1',
        userId: 'user-1',
        diceExpression: '1d6',
        result: '42'
      } as unknown as DiceRollTextInputDto

      // When
      await service.createText(dto)

      // Then
      expect(textRepository.create).toHaveBeenCalledWith(expect.objectContaining({ result: 42 }))
    })

    it('result が数値の場合はそのまま使用する', async () => {
      // Given
      const dto = {
        channelId: 'channel-1',
        userId: 'user-1',
        diceExpression: '1d6',
        result: 7
      } as unknown as DiceRollTextInputDto

      // When
      await service.createText(dto)

      // Then
      expect(textRepository.create).toHaveBeenCalledWith(expect.objectContaining({ result: 7 }))
    })

    it('result 未指定の場合は 0 になる', async () => {
      // Given
      const dto: DiceRollTextInputDto = {
        channelId: 'channel-1',
        userId: 'user-1',
        diceExpression: '1d6'
      }

      // When
      await service.createText(dto)

      // Then
      expect(textRepository.create).toHaveBeenCalledWith(expect.objectContaining({ result: 0 }))
    })

    it('channelId がある場合はチャンネルへ textId を追加する', async () => {
      // Given
      const dto: DiceRollTextInputDto = {
        textId: 'given-id',
        channelId: 'channel-1',
        userId: 'user-1',
        diceExpression: '1d6'
      }

      // When
      await service.createText(dto)

      // Then
      expect(channelRepository.addTextId).toHaveBeenCalledWith('channel-1', 'given-id')
    })

    it('channelId も discordChannelId も無い場合は textId 追加・characterId 追加を行わない', async () => {
      // Given
      const dto = {
        userId: 'user-1',
        diceExpression: '1d6',
        characterId: 'char-1'
      } as unknown as DiceRollTextInputDto

      // When
      await service.createText(dto)

      // Then
      expect(channelRepository.addTextId).not.toHaveBeenCalled()
      expect(channelRepository.addCharacterId).not.toHaveBeenCalled()
    })

    it('characterId と channelId がある場合はチャンネルへ characterId を追加する', async () => {
      // Given
      const dto: DiceRollTextInputDto = {
        channelId: 'channel-1',
        userId: 'user-1',
        diceExpression: '1d6',
        characterId: 'char-1'
      }

      // When
      await service.createText(dto)

      // Then
      expect(channelRepository.addCharacterId).toHaveBeenCalledWith('channel-1', 'char-1')
    })

    it('characterId が無い場合は characterId 追加を行わない', async () => {
      // Given
      const dto: DiceRollTextInputDto = {
        channelId: 'channel-1',
        userId: 'user-1',
        diceExpression: '1d6'
      }

      // When
      await service.createText(dto)

      // Then
      expect(channelRepository.addCharacterId).not.toHaveBeenCalled()
    })

    it('作成されたテキストを返す', async () => {
      // Given
      const dto: DiceRollTextInputDto = {
        channelId: 'channel-1',
        userId: 'user-1',
        diceExpression: '1d6'
      }

      // When
      const result = await service.createText(dto)

      // Then
      expect(result).toBe(mockText)
    })
  })

  describe('findChannelByChannelId', () => {
    it('リポジトリへ委譲して結果を返す', async () => {
      // Given
      channelRepository.findByChannelId.mockResolvedValue(mockChannel)

      // When
      const result = await service.findChannelByChannelId('channel-1')

      // Then
      expect(result).toBe(mockChannel)
      expect(channelRepository.findByChannelId).toHaveBeenCalledWith('channel-1')
    })
  })

  describe('findTextById', () => {
    it('リポジトリへ委譲して結果を返す', async () => {
      // Given
      textRepository.findById.mockResolvedValue(mockText)

      // When
      const result = await service.findTextById('text-1')

      // Then
      expect(result).toBe(mockText)
      expect(textRepository.findById).toHaveBeenCalledWith('text-1')
    })
  })

  describe('findTextsByChannelId', () => {
    it('リポジトリへ委譲して結果を返す', async () => {
      // Given
      const texts = [mockText]
      textRepository.findByChannelId.mockResolvedValue(texts)

      // When
      const result = await service.findTextsByChannelId('channel-1')

      // Then
      expect(result).toBe(texts)
      expect(textRepository.findByChannelId).toHaveBeenCalledWith('channel-1')
    })
  })

  describe('findTextsByCharacterId', () => {
    it('リポジトリへ委譲して結果を返す', async () => {
      // Given
      const texts = [mockText]
      textRepository.findByCharacterId.mockResolvedValue(texts)

      // When
      const result = await service.findTextsByCharacterId('char-1')

      // Then
      expect(result).toBe(texts)
      expect(textRepository.findByCharacterId).toHaveBeenCalledWith('char-1')
    })
  })

  describe('updateChannel', () => {
    it('リポジトリへ委譲して結果を返す', async () => {
      // Given
      const updateDto = { discordChannelId: 'channel-1' }
      channelRepository.update.mockResolvedValue(mockChannel)

      // When
      const result = await service.updateChannel('channel-1', updateDto)

      // Then
      expect(result).toBe(mockChannel)
      expect(channelRepository.update).toHaveBeenCalledWith('channel-1', updateDto)
    })
  })

  describe('updateEmbed', () => {
    it('discordChannelId が無い場合はエラーを投げる', async () => {
      // Given
      const updateDto = {}

      // When / Then
      await expect(service.updateEmbed('embed-1', updateDto)).rejects.toThrow('Discord channel ID is required')
      expect(channelRepository.addEmbedId).not.toHaveBeenCalled()
    })

    it('discordChannelId がある場合は addEmbedId へ委譲する', async () => {
      // Given
      const updateDto = { discordChannelId: 'channel-1' }
      channelRepository.addEmbedId.mockResolvedValue(mockChannel)

      // When
      const result = await service.updateEmbed('embed-1', updateDto)

      // Then
      expect(result).toBe(mockChannel)
      expect(channelRepository.addEmbedId).toHaveBeenCalledWith('channel-1', 'embed-1')
    })
  })

  describe('removeChannel', () => {
    it('テキストを先に削除してからチャンネルを削除する', async () => {
      // Given
      textRepository.removeByChannelId.mockResolvedValue(undefined)
      channelRepository.remove.mockResolvedValue(mockChannel)

      // When
      await service.removeChannel('channel-1')

      // Then
      expect(textRepository.removeByChannelId).toHaveBeenCalledWith('channel-1')
      expect(channelRepository.remove).toHaveBeenCalledWith('channel-1')
    })
  })

  describe('removeText', () => {
    it('リポジトリへ委譲する', async () => {
      // Given
      textRepository.remove.mockResolvedValue(mockText)

      // When
      await service.removeText('text-1')

      // Then
      expect(textRepository.remove).toHaveBeenCalledWith('text-1')
    })
  })

  describe('deleteOldRolls', () => {
    it('keepCount 指定時はその値で委譲し、削除件数を返す', async () => {
      // Given
      textRepository.deleteOldRolls.mockResolvedValue(5)

      // When
      const result = await service.deleteOldRolls('channel-1', 100)

      // Then
      expect(result).toBe(5)
      expect(textRepository.deleteOldRolls).toHaveBeenCalledWith('channel-1', 100)
    })

    it('keepCount 未指定時はデフォルト 1000 で委譲する', async () => {
      // Given
      textRepository.deleteOldRolls.mockResolvedValue(0)

      // When
      await service.deleteOldRolls('channel-1')

      // Then
      expect(textRepository.deleteOldRolls).toHaveBeenCalledWith('channel-1', 1000)
    })
  })
})
