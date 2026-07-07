import { Injectable } from '@nestjs/common'
import { Character } from 'src/domains/character/models/character.model'
import { CharacterService } from 'src/domains/character/character.service'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'

@Injectable()
export class DiceRollCharacterProviderService {
  constructor(
    private readonly diceRollService: DiceRollService,
    private readonly characterService: CharacterService
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
      // 同一プロセス内クエリのため CharacterService を直接呼び出す（E-2b: イベント RPC 廃止）
      return await this.characterService.findOne(characterId)
    } catch (error) {
      console.error(`[DiceRollCharacterProvider] キャラクター取得エラー (${characterId}):`, error)
      return null
    }
  }
}
