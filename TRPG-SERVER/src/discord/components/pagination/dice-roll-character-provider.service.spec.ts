import { DiceRollCharacterProviderService } from './dice-roll-character-provider.service'

describe('DiceRollCharacterProviderService', () => {
  it('waits for character lookup result before emitting each request', async () => {
    const characters = new Map([
      ['char-1', { characterId: 'char-1', characterName: '探索者A' }],
      ['char-2', { characterId: 'char-2', characterName: '探索者B' }]
    ])

    const completedResolvers: Array<(value: any) => void> = []

    const diceRollService = {
      findChannelByChannelId: jest.fn().mockResolvedValue({
        discordChannelId: 'channel-1',
        characterIds: ['char-1', 'char-2']
      })
    }

    const typedEventService = {
      waitForEvent: jest.fn((event: string) => {
        if (event === 'character.findById.completed') {
          return new Promise((resolve) => completedResolvers.push(resolve))
        }

        return new Promise(() => undefined)
      }),
      emit: jest.fn(async (_event: string, payload: { characterId: string }) => {
        const resolve = completedResolvers.shift()
        resolve?.({
          characterId: payload.characterId,
          character: characters.get(payload.characterId),
          source: 'test',
          timestamp: new Date()
        })
      })
    }

    const provider = new DiceRollCharacterProviderService(diceRollService as any, typedEventService as any)

    await expect(provider.findCharactersByChannelId('channel-1')).resolves.toEqual([
      { characterId: 'char-1', characterName: '探索者A' },
      { characterId: 'char-2', characterName: '探索者B' }
    ])

    expect(diceRollService.findChannelByChannelId).toHaveBeenCalledWith('channel-1')
    expect(typedEventService.waitForEvent).toHaveBeenCalledWith('character.findById.completed', 5000)
    expect(typedEventService.emit).toHaveBeenNthCalledWith(1, 'character.findById.requested', {
      characterId: 'char-1',
      source: 'discord',
      timestamp: expect.any(Date)
    })
    expect(typedEventService.emit).toHaveBeenNthCalledWith(2, 'character.findById.requested', {
      characterId: 'char-2',
      source: 'discord',
      timestamp: expect.any(Date)
    })
  })

  it('returns empty array when dice roll channel has no characterIds', async () => {
    const diceRollService = {
      findChannelByChannelId: jest.fn().mockResolvedValue({
        discordChannelId: 'channel-1',
        characterIds: []
      })
    }
    const typedEventService = {
      waitForEvent: jest.fn(),
      emit: jest.fn()
    }

    const provider = new DiceRollCharacterProviderService(diceRollService as any, typedEventService as any)

    await expect(provider.findCharactersByChannelId('channel-1')).resolves.toEqual([])
    expect(typedEventService.waitForEvent).not.toHaveBeenCalled()
    expect(typedEventService.emit).not.toHaveBeenCalled()
  })
})
