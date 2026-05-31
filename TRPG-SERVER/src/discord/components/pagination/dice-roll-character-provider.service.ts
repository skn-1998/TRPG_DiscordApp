import { Injectable } from '@nestjs/common'
import { Character } from 'src/domains/character/models/character.model'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'
import { TypedEventService } from 'src/shared/application/typed-event.service'

@Injectable()
export class DiceRollCharacterProviderService {
  constructor(
    private readonly diceRollService: DiceRollService,
    private readonly typedEventService: TypedEventService
  ) {}

  async findCharactersByChannelId(channelId: string): Promise<Character[]> {
    try {
      console.log(`[DiceRollCharacterProvider] キャラクター情報取得開始: ${channelId}`)

      const diceRollChannel = await this.diceRollService.findChannelByChannelId(channelId)
      if (!diceRollChannel || !diceRollChannel.characterIds || diceRollChannel.characterIds.length === 0) {
        console.log(`[DiceRollCharacterProvider] チャンネルまたはキャラクターIDが見つかりません`)
        return []
      }

      console.log(`[DiceRollCharacterProvider] キャラクターID取得: ${diceRollChannel.characterIds.length}件`)

      const characters: Character[] = []
      for (const characterId of diceRollChannel.characterIds) {
        const character = await this.findCharacterById(characterId)
        if (character) {
          characters.push(character)
        }
      }

      console.log(`[DiceRollCharacterProvider] キャラクター情報取得完了: ${characters.length}件`)
      return characters
    } catch (error) {
      console.error('[DiceRollCharacterProvider] キャラクター情報取得エラー:', error)
      return []
    }
  }

  private async findCharacterById(characterId: string): Promise<Character | null> {
    try {
      const resultPromise = Promise.race([
        this.typedEventService.waitForEvent('character.findById.completed', 5000),
        this.typedEventService.waitForEvent('character.findById.failed', 5000)
      ])

      await this.typedEventService.emit('character.findById.requested', {
        characterId,
        source: 'discord',
        timestamp: new Date()
      })

      const result = await resultPromise
      if ('character' in result && result.character) {
        return result.character as Character
      }

      return null
    } catch (error) {
      console.error(`[DiceRollCharacterProvider] キャラクター取得エラー (${characterId}):`, error)
      return null
    }
  }
}
