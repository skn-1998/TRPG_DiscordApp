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
  ModalSubmitInteraction,
  SlashCommandOptionsOnlyBuilder,
  TextChannel
} from 'discord.js'
import { eventSelectButtonType, eventType } from './interactions/interactions.list'

export interface discordInteractionType {
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>
  execute(
    interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction,
    config?: eventType
  ): Promise<void>
}

export interface discordCommandType extends discordInteractionType {
  execute(interaction: CommandInteraction): Promise<void>
  data:
    | SlashCommandBuilder
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>
    | SlashCommandOptionsOnlyBuilder
}

export interface discordContextMenuType extends discordInteractionType {
  execute(interaction: CommandInteraction): Promise<void>
  data: ContextMenuCommandBuilder
}

export interface discordSelectMenuType extends discordInteractionType {
  execute(interaction: AnySelectMenuInteraction, config?: eventSelectButtonType): Promise<void>
  data: SelectMenuBuilder
}

export interface discordButtonType extends discordInteractionType {
  execute(interaction: ButtonInteraction): Promise<void>
  data: ButtonBuilder
}

export interface discordModalType extends discordInteractionType {
  execute(interaction: ModalSubmitInteraction): Promise<void>
  data: ModalBuilder
}

export interface discordChannelType {
  execute(interaction: TextChannel): Promise<void>
  data: TextChannel
}
