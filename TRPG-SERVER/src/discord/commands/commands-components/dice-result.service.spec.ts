// DiceResultService は BaseCommandService を継承した薄い委譲。
// execute() は preExecute → isChatInputCommand → orchestrator.execute → postExecute の順で、
// 例外時は handleInteractionError に委譲する。
// 検証対象は委譲経路と早期 return 分岐。BaseCommandService の protected メソッドは
// prototype 上を spy して挙動を固定する（純ロジックの再検証はしない）。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test } from '@nestjs/testing'
import { type CommandInteraction } from 'discord.js'
import { TypedEventService } from 'src/core/events/typed-event.service'
import { DiceResultOrchestrator } from 'src/discord/features/diceRoll'
import { createMockChatInputInteraction } from '@discord-test-utils'
import { BaseCommandService } from '../base-command.service'
import { DiceResultService } from './dice-result.service'

describe('DiceResultService', () => {
  let service: DiceResultService
  let orchestrator: jest.Mocked<Pick<DiceResultOrchestrator, 'execute'>>
  let preExecuteSpy: jest.SpyInstance
  let postExecuteSpy: jest.SpyInstance
  let handleErrorSpy: jest.SpyInstance

  beforeEach(async () => {
    orchestrator = { execute: jest.fn().mockResolvedValue(undefined) }
    const typedEventService = {} as TypedEventService

    const moduleRef = await Test.createTestingModule({
      providers: [
        DiceResultService,
        { provide: DiceResultOrchestrator, useValue: orchestrator },
        { provide: TypedEventService, useValue: typedEventService }
      ]
    }).compile()

    service = moduleRef.get(DiceResultService)

    // BaseCommandService の protected メソッドを固定（既定は正常系）
    preExecuteSpy = jest.spyOn(BaseCommandService.prototype as never, 'preExecute').mockResolvedValue(true as never)
    postExecuteSpy = jest
      .spyOn(BaseCommandService.prototype as never, 'postExecute')
      .mockResolvedValue(undefined as never)
    handleErrorSpy = jest
      .spyOn(BaseCommandService.prototype as never, 'handleInteractionError')
      .mockResolvedValue(undefined as never)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  function buildChatInput(): CommandInteraction {
    return createMockChatInputInteraction({ commandName: 'dice-result' }) as unknown as CommandInteraction
  }

  describe('execute', () => {
    it('preExecute が false なら orchestrator を呼ばず早期 return する', async () => {
      // Arrange
      preExecuteSpy.mockResolvedValue(false as never)
      const interaction = buildChatInput()

      // Act
      await service.execute(interaction)

      // Assert
      expect(orchestrator.execute).not.toHaveBeenCalled()
      expect(postExecuteSpy).not.toHaveBeenCalled()
    })

    it('isChatInputCommand が false なら orchestrator を呼ばず早期 return する', async () => {
      // Arrange
      const interaction = buildChatInput()
      ;(interaction.isChatInputCommand as unknown as jest.Mock).mockReturnValue(false)

      // Act
      await service.execute(interaction)

      // Assert
      expect(orchestrator.execute).not.toHaveBeenCalled()
      expect(postExecuteSpy).not.toHaveBeenCalled()
    })

    it('正常系では orchestrator.execute と postExecute を順に呼ぶ', async () => {
      // Arrange
      const interaction = buildChatInput()

      // Act
      await service.execute(interaction)

      // Assert
      expect(orchestrator.execute).toHaveBeenCalledWith(interaction)
      expect(postExecuteSpy).toHaveBeenCalledWith(interaction)
      expect(handleErrorSpy).not.toHaveBeenCalled()
    })

    it('orchestrator.execute が例外を投げたら handleInteractionError に委譲する', async () => {
      // Arrange
      const error = new Error('orchestrator failed')
      orchestrator.execute.mockRejectedValue(error)
      const interaction = buildChatInput()

      // Act
      await service.execute(interaction)

      // Assert
      expect(handleErrorSpy).toHaveBeenCalledWith(interaction, error, 'ダイスロール履歴取得')
      expect(postExecuteSpy).not.toHaveBeenCalled()
    })
  })
})
