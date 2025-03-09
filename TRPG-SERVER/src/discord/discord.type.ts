import {
  ButtonBuilder,
  CommandInteraction,
  ModalBuilder,
  SelectMenuBuilder,
  SlashCommandBuilder,
  AutocompleteInteraction,
  ContextMenuCommandBuilder,
  AnySelectMenuInteraction,
  ButtonInteraction,
  ModalSubmitInteraction
} from 'discord.js'
import { eventSelectButtonType, eventType } from './events/events.list'

export interface discordInteractionType {
  // eslint-disable-next-line no-unused-vars
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
  execute(interaction: any, config?: eventType): Promise<void>
}

export interface discordCommandType extends discordInteractionType {
  // eslint-disable-next-line no-unused-vars
  execute(interaction: CommandInteraction): Promise<void>
  data: Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>
}

export interface discordContextMenuType extends discordInteractionType {
  // eslint-disable-next-line no-unused-vars
  execute(interaction: CommandInteraction): Promise<void>
  data: ContextMenuCommandBuilder
}

export interface discordSelectMenuType extends discordInteractionType {
  // eslint-disable-next-line no-unused-vars
  execute(
    interaction: AnySelectMenuInteraction,
    config?: eventSelectButtonType
  ): Promise<void>
  data: SelectMenuBuilder
}

export interface discordButtonType extends discordInteractionType {
  // eslint-disable-next-line no-unused-vars
  execute(interaction: ButtonInteraction): Promise<void>
  data: ButtonBuilder
}

export interface discordModalType extends discordInteractionType {
  // eslint-disable-next-line no-unused-vars
  execute(interaction: ModalSubmitInteraction): Promise<void>
  data: ModalBuilder
}
