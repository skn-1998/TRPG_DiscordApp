import { Injectable } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { DiceRollChannelRepository } from './repositories/dice-roll-channel.repository'
import { DiceRollTextRepository } from './repositories/dice-roll-text.repository'
import { PartialInputDiceRollChannelDto } from './dto/create-dice-roll-channel.dto'
import { PartialInputDiceRollTextDto } from './dto/create-dice-roll-text.dto'
import { UpdateDiceRollChannelDto } from './dto/update-dice-roll-channel.dto'
import { DiceRollChannel } from './models/dice-roll-channel.model'
import { DiceRollText } from './models/dice-roll-text.model'

/**
 * ダイスロールサービス
 * ダイスロール情報のCRUD操作を提供する
 */
@Injectable()
export class DiceRollService {
  constructor(
    private readonly diceRollChannelRepository: DiceRollChannelRepository,
    private readonly diceRollTextRepository: DiceRollTextRepository
  ) {}

  /**
   * ダイスロールチャンネルを作成または取得する
   * @param createDiceRollChannelDto ダイスロールチャンネル作成DTO
   */
  async createOrGetChannel(createDiceRollChannelDto: PartialInputDiceRollChannelDto): Promise<DiceRollChannel> {
    const { discordChannelId } = createDiceRollChannelDto

    // 既存のチャンネルを検索
    const existingChannel = await this.diceRollChannelRepository.findByChannelId(discordChannelId)
    if (existingChannel) {
      return existingChannel
    }

    // 新しいチャンネルを作成
    const channel: Partial<DiceRollChannel> = {
      discordChannelId,
      characterIds: createDiceRollChannelDto.characterIds || [],
      textIds: createDiceRollChannelDto.textIds || []
    }

    return this.diceRollChannelRepository.create(channel)
  }

  /**
   * ダイスロールテキストを作成する
   * @param createDiceRollTextDto ダイスロールテキスト作成DTO
   */
  async createText(createDiceRollTextDto: PartialInputDiceRollTextDto): Promise<DiceRollText> {
    // チャンネルを取得または作成
    const channel = await this.createOrGetChannel({
      discordChannelId: createDiceRollTextDto.discordChannelId
    })

    // テキストIDがない場合は生成
    const textId = createDiceRollTextDto.textId || uuidv4()

    // テキストを作成
    const text: Partial<DiceRollText> = {
      textId,
      discordChannelId: createDiceRollTextDto.discordChannelId,
      characterId: createDiceRollTextDto.characterId,
      result: createDiceRollTextDto.result,
      diceRoll: createDiceRollTextDto.diceRoll,
      text: createDiceRollTextDto.text,
      createdAt: new Date()
    }

    const createdText = await this.diceRollTextRepository.create(text)

    // チャンネルにテキストIDを追加
    await this.diceRollChannelRepository.addTextId(channel.discordChannelId, textId)

    // キャラクターIDがある場合、チャンネルにキャラクターIDを追加
    if (createDiceRollTextDto.characterId) {
      await this.diceRollChannelRepository.addCharacterId(channel.discordChannelId, createDiceRollTextDto.characterId)
    }

    return createdText
  }

  /**
   * チャンネルIDによってダイスロールチャンネルを取得する
   * @param channelId DiscordチャンネルID
   */
  async findChannelByChannelId(channelId: string): Promise<DiceRollChannel | null> {
    return this.diceRollChannelRepository.findByChannelId(channelId)
  }

  /**
   * テキストIDによってダイスロールテキストを取得する
   * @param textId テキストID
   */
  async findTextById(textId: string): Promise<DiceRollText | null> {
    return this.diceRollTextRepository.findById(textId)
  }

  /**
   * チャンネルIDによってダイスロールテキストを取得する
   * @param channelId DiscordチャンネルID
   */
  async findTextsByChannelId(channelId: string): Promise<DiceRollText[]> {
    return this.diceRollTextRepository.findByChannelId(channelId)
  }

  /**
   * キャラクターIDによってダイスロールテキストを取得する
   * @param characterId キャラクターID
   */
  async findTextsByCharacterId(characterId: string): Promise<DiceRollText[]> {
    return this.diceRollTextRepository.findByCharacterId(characterId)
  }

  /**
   * ダイスロールチャンネルを更新する
   * @param channelId DiscordチャンネルID
   * @param updateDiceRollChannelDto 更新データ
   */
  async updateChannel(
    channelId: string,
    updateDiceRollChannelDto: UpdateDiceRollChannelDto
  ): Promise<DiceRollChannel | null> {
    return this.diceRollChannelRepository.update(channelId, updateDiceRollChannelDto)
  }

  /**
   * ダイスロールチャンネルを削除する
   * @param channelId DiscordチャンネルID
   */
  async removeChannel(channelId: string): Promise<void> {
    // チャンネルに関連するテキストを削除
    await this.diceRollTextRepository.removeByChannelId(channelId)
    // チャンネルを削除
    await this.diceRollChannelRepository.remove(channelId)
  }

  /**
   * ダイスロールテキストを削除する
   * @param textId テキストID
   */
  async removeText(textId: string): Promise<void> {
    await this.diceRollTextRepository.remove(textId)
  }
}
