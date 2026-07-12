import { Injectable } from '@nestjs/common'
import type {
  DiscordButtonModel,
  DiscordButtonRowModel,
  DiscordProjectionViewModel,
  EphemeralPanelViewModel,
  GroupBrowserViewModel
} from '@trpg/sheet-projection'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type MessageActionRowComponentBuilder,
  type MessageCreateOptions,
  type MessageEditOptions
} from 'discord.js'

@Injectable()
export class HubDiscordViewBuilder {
  buildHubMessage(view: DiscordProjectionViewModel): MessageCreateOptions & MessageEditOptions {
    const embed = new EmbedBuilder().setTitle(view.hub.embed.title)
    if (view.hub.embed.description) embed.setDescription(view.hub.embed.description)
    if (view.hub.embed.fields.length > 0) {
      embed.addFields(
        view.hub.embed.fields.map((field, index) => ({
          ...field,
          name: this.labelOrFallback(field.name, `Field ${index + 1}`)
        }))
      )
    }
    if (view.hub.embed.footer) embed.setFooter(view.hub.embed.footer)

    const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = view.hub.pinnedButtonRows.map((row) =>
      this.buttonRow(row)
    )
    if (view.hub.groupSelect) {
      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(view.hub.groupSelect.menuCustomId)
            .setPlaceholder(view.hub.groupSelect.placeholder)
            .addOptions(
              view.hub.groupSelect.options.map((option) => ({
                ...option,
                label: this.labelOrFallback(option.label, option.value)
              }))
            )
        )
      )
    }
    return { embeds: [embed], components }
  }

  buildPanel(view: EphemeralPanelViewModel): MessageCreateOptions & MessageEditOptions {
    const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = view.actionRows.map((row) =>
      this.buttonRow(row)
    )
    const navigation = [view.page.previous, view.page.next].filter(
      (button): button is DiscordButtonModel => button !== undefined
    )
    if (navigation.length > 0) components.push(this.buttonRow(navigation))
    return { content: this.labelOrFallback(view.title, view.groupId), components }
  }

  buildGroupBrowser(view: GroupBrowserViewModel): MessageCreateOptions & MessageEditOptions {
    if (view.menuCustomId.length === 0 || view.options.length === 0) {
      return { content: `${view.title}\n表示できるグループがありません。`, components: [] }
    }
    const select = new StringSelectMenuBuilder()
      .setCustomId(view.menuCustomId)
      .setPlaceholder(this.labelOrFallback(view.title, 'Group'))
      .addOptions(
        view.options.map((option) => ({
          ...option,
          label: this.labelOrFallback(option.label, option.value)
        }))
      )
    const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)
    ]
    const navigation = [view.page.previous, view.page.next].filter(
      (button): button is DiscordButtonModel => button !== undefined
    )
    if (navigation.length > 0) components.push(this.buttonRow(navigation))
    return { content: this.labelOrFallback(view.title, 'Group'), components }
  }

  private buttonRow(row: DiscordButtonRowModel): ActionRowBuilder<MessageActionRowComponentBuilder> {
    return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      row.map((button) => this.button(button))
    )
  }

  private button(model: DiscordButtonModel): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(model.customId)
      .setLabel(this.labelOrFallback(model.label, model.paletteKey ?? model.customId))
      .setStyle(this.buttonStyle(model.style))
  }

  private labelOrFallback(label: string, fallback: string): string {
    return label.trim().length > 0 ? label : fallback
  }

  private buttonStyle(style: DiscordButtonModel['style']): ButtonStyle {
    switch (style) {
      case 'primary':
        return ButtonStyle.Primary
      case 'success':
        return ButtonStyle.Success
      case 'danger':
        return ButtonStyle.Danger
      default:
        return ButtonStyle.Secondary
    }
  }
}
