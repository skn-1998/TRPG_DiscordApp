import { Test } from '@nestjs/testing'
import { TextChannel } from 'discord.js'
import { DiceRollChannelCreateService } from './diceroll-channel-create.service'
import { AppConfigService } from 'src/config/config.service'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'
import { getChannelIdByName } from '../../utils/searchChannelID'

// 副作用の境界: チャンネル名→ID 解決ユーティリティをスタブ化する
jest.mock('../../utils/searchChannelID', () => ({
  getChannelIdByName: jest.fn()
}))

const getChannelIdByNameMock = getChannelIdByName as jest.MockedFunction<typeof getChannelIdByName>

describe('DiceRollChannelCreateService', () => {
  let appConfigService: jest.Mocked<Pick<AppConfigService, 'get'>>
  let diceRollService: jest.Mocked<Pick<DiceRollService, 'createOrGetChannel'>>
  let service: DiceRollChannelCreateService

  const DICE_ROLL_CATEGORY = 'dice-roll-category'
  const CATEGORY_ID = 'category-123'

  // channel は execute が参照する最小プロパティ（name/id/parentId/guild）だけを持つスタブで十分
  type ChannelStub = Pick<TextChannel, 'name' | 'id' | 'parentId' | 'guild'>
  const makeChannel = (overrides: Partial<ChannelStub> = {}): TextChannel =>
    ({
      name: 'dice-channel',
      id: 'channel-999',
      parentId: CATEGORY_ID,
      guild: {} as TextChannel['guild'],
      ...overrides
    }) as TextChannel

  beforeEach(async () => {
    appConfigService = { get: jest.fn() }
    diceRollService = { createOrGetChannel: jest.fn() }

    appConfigService.get.mockReturnValue(DICE_ROLL_CATEGORY as never)
    getChannelIdByNameMock.mockReturnValue(CATEGORY_ID)

    const moduleRef = await Test.createTestingModule({
      providers: [
        DiceRollChannelCreateService,
        { provide: AppConfigService, useValue: appConfigService },
        { provide: DiceRollService, useValue: diceRollService }
      ]
    }).compile()

    service = moduleRef.get(DiceRollChannelCreateService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('execute', () => {
    it('設定カテゴリ名から categoryId を解決する', async () => {
      // Arrange
      const channel = makeChannel({ guild: { id: 'guild-1' } as TextChannel['guild'] })

      // Act
      await service.execute(channel)

      // Assert
      expect(appConfigService.get).toHaveBeenCalledWith('discord.diceRollCategory')
      expect(getChannelIdByNameMock).toHaveBeenCalledWith(channel.guild, DICE_ROLL_CATEGORY)
    })

    it('parentId が categoryId と一致する場合は createOrGetChannel を1回呼ぶ', async () => {
      // Arrange
      const channel = makeChannel({ parentId: CATEGORY_ID, id: 'channel-999' })

      // Act
      await service.execute(channel)

      // Assert: 戻り値はなく、副作用（DTO 付きの呼び出し）を検証する
      expect(diceRollService.createOrGetChannel).toHaveBeenCalledTimes(1)
      expect(diceRollService.createOrGetChannel).toHaveBeenCalledWith({
        discordChannelId: 'channel-999',
        characterIds: [],
        textIds: []
      })
    })

    it('parentId が categoryId と一致しない場合は createOrGetChannel を呼ばず即 return する', async () => {
      // Arrange
      const channel = makeChannel({ parentId: 'other-category' })

      // Act
      await service.execute(channel)

      // Assert: 副作用が起きないことを検証する
      expect(diceRollService.createOrGetChannel).not.toHaveBeenCalled()
    })

    it('parentId が null（カテゴリ未所属）の場合は createOrGetChannel を呼ばない', async () => {
      // Arrange: 境界値として parentId が null のケース
      const channel = makeChannel({ parentId: null })

      // Act
      await service.execute(channel)

      // Assert
      expect(diceRollService.createOrGetChannel).not.toHaveBeenCalled()
    })
  })
})
