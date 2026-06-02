import { Test, TestingModule } from '@nestjs/testing'
import { TextChannel } from 'discord.js'
import { ChannelDetectionService } from './channel-detection.service'
import { AppConfigService } from 'src/config/config.service'
import { getChannelIdByName } from '../../../utils/searchChannelID'

// Mock dependencies
jest.mock('../../../utils/searchChannelID')

const mockGetChannelIdByName = getChannelIdByName as jest.MockedFunction<typeof getChannelIdByName>

describe('ChannelDetectionService', () => {
  let service: ChannelDetectionService
  let module: TestingModule

  const mockAppConfigService = {
    get: jest.fn()
  }

  const mockTextChannel = {
    id: 'test-channel-id',
    name: 'test-character',
    guild: {
      id: 'test-guild-id',
      fetchAuditLogs: jest.fn()
    },
    parentId: 'test-category-id'
  } as unknown as TextChannel

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChannelDetectionService,
        {
          provide: AppConfigService,
          useValue: mockAppConfigService
        }
      ]
    }).compile()

    service = moduleRef.get<ChannelDetectionService>(ChannelDetectionService)
    module = moduleRef

    // Reset mocks
    jest.clearAllMocks()
    mockAppConfigService.get.mockReturnValue('character-category')
    mockGetChannelIdByName.mockReturnValue('test-category-id')
  })

  afterEach(async () => {
    await module.close()
  })

  describe('detectCharacterChannel', () => {
    it('should detect character channel correctly', async () => {
      // 実 discord.js の fetchAuditLogs().entries は Collection で .find() を持つ。
      // 素の Map には .find() が無いため Collection 互換の find を備えたオブジェクトで模す。
      const auditEntries = [
        {
          target: { id: 'test-channel-id' },
          executor: { id: 'test-user-id' }
        }
      ]
      const mockAuditLogs = {
        entries: {
          find: (predicate: (entry: any) => boolean) => auditEntries.find(predicate)
        }
      }

      mockTextChannel.guild.fetchAuditLogs = jest.fn().mockResolvedValue(mockAuditLogs)

      const result = await service.detectCharacterChannel(mockTextChannel)

      expect(result.success).toBe(true)
      expect(result.shouldCreateCharacter).toBe(true)
      expect(result.context).toEqual({
        channel: mockTextChannel,
        categoryId: 'test-category-id',
        creatorId: 'test-user-id'
      })
    })

    it('should return false when channel is not in character category', async () => {
      const differentChannel = {
        ...mockTextChannel,
        parentId: 'different-category-id'
      } as unknown as TextChannel

      const result = await service.detectCharacterChannel(differentChannel)

      expect(result.success).toBe(true)
      expect(result.shouldCreateCharacter).toBe(false)
      expect(result.context).toBeUndefined()
    })

    it('should handle audit log errors gracefully', async () => {
      mockTextChannel.guild.fetchAuditLogs = jest.fn().mockRejectedValue(new Error('Audit log error'))

      const result = await service.detectCharacterChannel(mockTextChannel)

      expect(result.success).toBe(true)
      expect(result.shouldCreateCharacter).toBe(true)
      expect(result.context?.creatorId).toBeNull()
    })

    it('should handle missing executor in audit log', async () => {
      const auditEntries = [
        {
          target: { id: 'test-channel-id' },
          executor: null
        }
      ]
      const mockAuditLogs = {
        entries: {
          find: (predicate: (entry: any) => boolean) => auditEntries.find(predicate)
        }
      }

      mockTextChannel.guild.fetchAuditLogs = jest.fn().mockResolvedValue(mockAuditLogs)

      const result = await service.detectCharacterChannel(mockTextChannel)

      expect(result.success).toBe(true)
      expect(result.shouldCreateCharacter).toBe(true)
      expect(result.context?.creatorId).toBeNull()
    })

    it('should handle getChannelIdByName errors', async () => {
      mockGetChannelIdByName.mockImplementation(() => {
        throw new Error('Channel ID not found')
      })

      const result = await service.detectCharacterChannel(mockTextChannel)

      expect(result.success).toBe(false)
      expect(result.shouldCreateCharacter).toBe(false)
      expect(result.error).toBe('Channel ID not found')
    })
  })
})
