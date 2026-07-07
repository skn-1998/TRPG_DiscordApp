import { Test } from '@nestjs/testing'
import { DiceRollCharacterProviderService } from './dice-roll-character-provider.service'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'
import { CharacterService } from 'src/domains/character/character.service'
import { TypedEventService } from 'src/core/events/typed-event.service'

/**
 * DiceRollCharacterProviderService はチャンネルの characterIds を個別解決してキャラクター一覧を返す。
 * E-2b: キャラクター取得は CharacterService.findOne の DI 直呼び（イベント RPC 廃止）。
 * TypedEventService mock は注入されない前提だが、旧 RPC（emit + waitForEvent）へ戻った場合に
 * 検知できるよう TestingModule に残置している（E-2a と同型の回帰ガード）。
 */
describe('DiceRollCharacterProviderService', () => {
  let provider: DiceRollCharacterProviderService
  let diceRollService: { findChannelByChannelId: jest.Mock }
  let characterService: { findOne: jest.Mock }
  let typedEventService: { waitForEvent: jest.Mock; emit: jest.Mock }

  const buildModule = async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DiceRollCharacterProviderService,
        { provide: DiceRollService, useValue: diceRollService },
        { provide: CharacterService, useValue: characterService },
        { provide: TypedEventService, useValue: typedEventService }
      ]
    }).compile()

    provider = moduleRef.get(DiceRollCharacterProviderService)
  }

  beforeEach(() => {
    diceRollService = { findChannelByChannelId: jest.fn() }
    characterService = { findOne: jest.fn() }
    typedEventService = { waitForEvent: jest.fn(), emit: jest.fn() }
  })

  it('resolves each characterId via CharacterService.findOne (E-2b: イベント RPC 廃止)', async () => {
    const characters = new Map([
      ['char-1', { characterId: 'char-1', characterName: '探索者A' }],
      ['char-2', { characterId: 'char-2', characterName: '探索者B' }]
    ])

    diceRollService.findChannelByChannelId.mockResolvedValue({
      discordChannelId: 'channel-1',
      characterIds: ['char-1', 'char-2']
    })
    characterService.findOne.mockImplementation(async (characterId: string) => characters.get(characterId) ?? null)

    await buildModule()

    await expect(provider.findCharactersByChannelId('channel-1')).resolves.toEqual([
      { characterId: 'char-1', characterName: '探索者A' },
      { characterId: 'char-2', characterName: '探索者B' }
    ])

    expect(diceRollService.findChannelByChannelId).toHaveBeenCalledWith('channel-1')
    expect(characterService.findOne).toHaveBeenNthCalledWith(1, 'char-1')
    expect(characterService.findOne).toHaveBeenNthCalledWith(2, 'char-2')

    // 旧イベント RPC（emit + waitForEvent）へ戻っていないことを固定（E-2b の回帰ガード）
    expect(typedEventService.waitForEvent).not.toHaveBeenCalled()
    expect(typedEventService.emit).not.toHaveBeenCalledWith('character.findById.requested', expect.anything())
  })

  it('returns empty array when dice roll channel has no characterIds', async () => {
    diceRollService.findChannelByChannelId.mockResolvedValue({
      discordChannelId: 'channel-1',
      characterIds: []
    })

    await buildModule()

    await expect(provider.findCharactersByChannelId('channel-1')).resolves.toEqual([])
    expect(characterService.findOne).not.toHaveBeenCalled()
    expect(typedEventService.waitForEvent).not.toHaveBeenCalled()
    expect(typedEventService.emit).not.toHaveBeenCalled()
  })

  it('skips characterIds that resolve to null (null 契約維持)', async () => {
    diceRollService.findChannelByChannelId.mockResolvedValue({
      discordChannelId: 'channel-1',
      characterIds: ['char-missing', 'char-2']
    })
    characterService.findOne.mockImplementation(async (characterId: string) =>
      characterId === 'char-2' ? { characterId: 'char-2', characterName: '探索者B' } : null
    )

    await buildModule()

    await expect(provider.findCharactersByChannelId('channel-1')).resolves.toEqual([
      { characterId: 'char-2', characterName: '探索者B' }
    ])
  })

  it('skips characterIds whose lookup rejects (catch→null 契約維持)', async () => {
    diceRollService.findChannelByChannelId.mockResolvedValue({
      discordChannelId: 'channel-1',
      characterIds: ['char-broken', 'char-2']
    })
    characterService.findOne.mockImplementation(async (characterId: string) => {
      if (characterId === 'char-broken') {
        throw new Error('DB error')
      }
      return { characterId: 'char-2', characterName: '探索者B' }
    })

    await buildModule()

    await expect(provider.findCharactersByChannelId('channel-1')).resolves.toEqual([
      { characterId: 'char-2', characterName: '探索者B' }
    ])
  })
})
