import { Injectable, Logger } from '@nestjs/common'
import { StringSelectMenuInteraction } from 'discord.js'
import { ThreadCreationService, CreateThreadRequest } from './thread-creation.service'
import { CharacterService } from '../../../../domains/character/character.service'
import { ErrorContext, ErrorHandler } from '../../../../utils/error-handler'

@Injectable()
export class CharacterThreadOrchestrator {
  private readonly logger = new Logger(CharacterThreadOrchestrator.name)

  constructor(
    private readonly threadCreationService: ThreadCreationService,
    private readonly characterService: CharacterService
  ) {}

  async handleSelection(interaction: StringSelectMenuInteraction, selectedCharacterId: string): Promise<void> {
    try {
      this.logger.log(`Character selected for thread creation: ${selectedCharacterId}`)

      const character = await this.characterService.findOne(selectedCharacterId)

      if (!character) {
        await interaction.update({
          content: '❌ 選択されたキャラクターが見つかりませんでした。',
          components: []
        })
        return
      }

      if (character.discordUserId !== interaction.user.id) {
        await interaction.update({
          content: '❌ 他のユーザーのキャラクターでスレッドを作成することはできません。',
          components: []
        })
        return
      }

      await interaction.update({
        content: `🔄 ${character.characterName}のスレッドを作成中...`,
        components: []
      })

      if (!interaction.channel || !interaction.guild) {
        await interaction.editReply({
          content: '❌ チャンネルまたはサーバー情報が取得できませんでした。'
        })
        return
      }

      const createRequest: CreateThreadRequest = {
        characterId: character.characterId,
        characterName: character.characterName,
        channelId: interaction.channel.id,
        creatorId: interaction.user.id,
        guildId: interaction.guild.id
      }

      const result = await this.threadCreationService.createCharacterThread(createRequest, character)

      if (result.success) {
        await interaction.editReply({
          content: `✅ ${character.characterName}のスレッドが作成されました！\n🔗 ${result.threadUrl || 'スレッドリンクは後ほど利用可能になります'}`
        })
      } else {
        await interaction.editReply({
          content: `❌ スレッドの作成に失敗しました：${result.error}`
        })
      }
    } catch (error) {
      const context: ErrorContext = {
        characterId: selectedCharacterId,
        action: 'character-thread-selection'
      }

      ErrorHandler.handleServiceError(error, context, 'CharacterThreadOrchestrator')

      try {
        await interaction.editReply({
          content: '❌ スレッドの作成中にエラーが発生しました。しばらく時間をおいて再度お試しください。'
        })
      } catch (replyError) {
        this.logger.error(
          'Failed to send error reply:',
          replyError instanceof Error ? replyError.message : String(replyError)
        )
      }
    }
  }
}
