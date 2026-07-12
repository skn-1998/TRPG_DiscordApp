import { Injectable } from '@nestjs/common'
import { createDiscordProjectionViewModel, type DiscordProjectionViewModel } from '@trpg/sheet-projection'
import type { CharacterEntity } from '../../../../domains/character/models/character.entity'

@Injectable()
export class HubProjectionService {
  create(character: CharacterEntity): DiscordProjectionViewModel {
    if (character.sheet === undefined) {
      throw new Error('hub projection requires a materialized character')
    }

    return createDiscordProjectionViewModel({
      characterName: character.characterName,
      templateVersion: character.sheet.templateVersion,
      channelId: character.discordChannelId,
      palette: character.palette ?? [],
      resourceValues: character.sheet.values,
      opId: character.hub?.opId
    })
  }
}
