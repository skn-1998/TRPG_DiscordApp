import { Injectable } from '@nestjs/common'
import { createDiscordProjectionViewModel, type DiscordProjectionViewModel } from '@trpg/sheet-projection'
import type { HubProjectionCharacter } from '../../../../features/character-sheet/services/character-sheet-operation.service'

@Injectable()
export class HubProjectionService {
  create(character: HubProjectionCharacter): DiscordProjectionViewModel {
    if (character.sheet === undefined) {
      throw new Error('hub projection requires a materialized character')
    }
    if (character.resolvedResourceValues === undefined) {
      throw new Error('hub projection requires resolved resource values')
    }

    return createDiscordProjectionViewModel({
      characterName: character.characterName,
      templateVersion: character.sheet.templateVersion,
      channelId: character.discordChannelId,
      palette: character.palette ?? [],
      resourceValues: character.resolvedResourceValues,
      opId: character.hub?.opId
    })
  }
}
