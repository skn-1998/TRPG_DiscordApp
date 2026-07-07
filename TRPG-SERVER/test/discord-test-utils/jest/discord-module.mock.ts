/**
 * discord.js モジュール全体のモック定義
 *
 * 使い方 (各spec.tsの先頭に1行追加するだけ):
 * ```typescript
 * import { setupDiscordModuleMock } from '@discord-test-utils/jest/discord-module.mock'
 * setupDiscordModuleMock()
 * ```
 *
 * または jest.config.js の moduleNameMapper で自動適用も可能。
 *
 * @note
 * jest-setup.ts にある global な jest.mock('discord.js', ...) と競合する場合、
 * 各spec.tsでこの関数を呼ぶことでそのファイル専用のモックを上書きできる。
 */

/**
 * discord.js の Builder 系クラスのモックオブジェクトを返す
 *
 * jest.mock('discord.js', ...) の中で使用するために
 * 各クラスのモック実装を提供する。
 */
export const discordModuleMockFactory = () => ({
  // ━━━ Builders ━━━
  EmbedBuilder: jest.fn().mockImplementation(() => {
    const embedData = {
      title: null as string | null,
      description: null as string | null,
      color: null as number | null,
      fields: [] as unknown[],
      timestamp: null as string | null,
      footer: null as unknown,
      author: null as unknown,
      image: null as unknown,
      thumbnail: null as unknown
    }
    const builder = {
      setTitle: jest.fn().mockImplementation((v: string) => {
        embedData.title = v
        return builder
      }),
      setDescription: jest.fn().mockImplementation((v: string) => {
        embedData.description = v
        return builder
      }),
      setColor: jest.fn().mockImplementation((v: number) => {
        embedData.color = v
        return builder
      }),
      addFields: jest.fn().mockImplementation((...fields: unknown[]) => {
        embedData.fields.push(...fields.flat())
        return builder
      }),
      setTimestamp: jest.fn().mockImplementation(() => {
        embedData.timestamp = new Date().toISOString()
        return builder
      }),
      setFooter: jest.fn().mockImplementation((v: unknown) => {
        embedData.footer = v
        return builder
      }),
      setAuthor: jest.fn().mockImplementation((v: unknown) => {
        embedData.author = v
        return builder
      }),
      setImage: jest.fn().mockImplementation((v: unknown) => {
        embedData.image = v
        return builder
      }),
      setThumbnail: jest.fn().mockImplementation((v: unknown) => {
        embedData.thumbnail = v
        return builder
      }),
      get data() {
        return embedData
      },
      toJSON: jest.fn().mockImplementation(() => ({ ...embedData }))
    }
    return builder
  }),

  ButtonBuilder: jest.fn().mockImplementation(() => {
    const builder = {
      setCustomId: jest.fn().mockReturnThis(),
      setLabel: jest.fn().mockReturnThis(),
      setStyle: jest.fn().mockReturnThis(),
      setEmoji: jest.fn().mockReturnThis(),
      setDisabled: jest.fn().mockReturnThis(),
      setURL: jest.fn().mockReturnThis(),
      toJSON: jest.fn().mockReturnValue({ type: 2, style: 1, label: 'Button' })
    }
    return builder
  }),

  ActionRowBuilder: jest.fn().mockImplementation(() => ({
    addComponents: jest.fn().mockReturnThis(),
    setComponents: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({ type: 1, components: [] })
  })),

  ModalBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    addComponents: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({ title: 'Modal', custom_id: 'modal' })
  })),

  TextInputBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setPlaceholder: jest.fn().mockReturnThis(),
    setRequired: jest.fn().mockReturnThis(),
    setMinLength: jest.fn().mockReturnThis(),
    setMaxLength: jest.fn().mockReturnThis(),
    setValue: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({ type: 4, label: 'Input' })
  })),

  StringSelectMenuBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setPlaceholder: jest.fn().mockReturnThis(),
    setMinValues: jest.fn().mockReturnThis(),
    setMaxValues: jest.fn().mockReturnThis(),
    addOptions: jest.fn().mockReturnThis(),
    setOptions: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({ type: 3, custom_id: 'select' })
  })),

  SlashCommandBuilder: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setDefaultMemberPermissions: jest.fn().mockReturnThis(),
    setDMPermission: jest.fn().mockReturnThis(),
    addStringOption: jest.fn().mockReturnThis(),
    addIntegerOption: jest.fn().mockReturnThis(),
    addNumberOption: jest.fn().mockReturnThis(),
    addBooleanOption: jest.fn().mockReturnThis(),
    addUserOption: jest.fn().mockReturnThis(),
    addChannelOption: jest.fn().mockReturnThis(),
    addRoleOption: jest.fn().mockReturnThis(),
    addAttachmentOption: jest.fn().mockReturnThis(),
    addSubcommand: jest.fn().mockReturnThis(),
    addSubcommandGroup: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({
      name: 'test-command',
      description: 'Test command',
      options: []
    })
  })),

  ContextMenuCommandBuilder: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setType: jest.fn().mockReturnThis(),
    setDefaultMemberPermissions: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({
      name: 'test-context-menu',
      type: 3
    })
  })),

  // ━━━ Client ━━━
  Client: jest.fn().mockImplementation(() => ({
    login: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    channels: {
      fetch: jest.fn().mockResolvedValue({
        id: '555666777888999000',
        name: 'test-channel',
        isTextBased: jest.fn().mockReturnValue(true),
        isThread: jest.fn().mockReturnValue(false),
        send: jest.fn().mockResolvedValue({ id: 'test-message-id' }),
        messages: {
          fetch: jest.fn().mockResolvedValue(new Map())
        },
        threads: {
          create: jest.fn().mockResolvedValue({ id: 'test-thread-id', name: 'test-thread' })
        }
      })
    },
    guilds: {
      fetch: jest.fn().mockResolvedValue({
        id: '987654321098765432',
        name: 'Test Server',
        channels: { create: jest.fn().mockResolvedValue({ id: 'new-channel-id' }) }
      })
    },
    users: {
      fetch: jest.fn().mockResolvedValue({
        id: '123456789012345678',
        username: 'TestUser'
      })
    },
    user: {
      id: 'bot-user-id',
      username: 'TestBot',
      tag: 'TestBot#0000'
    },
    application: {
      id: 'test-application-id'
    }
  })),

  // ━━━ Enums / Constants ━━━
  Events: {
    ClientReady: 'ready',
    InteractionCreate: 'interactionCreate',
    MessageCreate: 'messageCreate',
    GuildCreate: 'guildCreate',
    GuildDelete: 'guildDelete'
  },

  InteractionType: {
    ApplicationCommand: 2,
    MessageComponent: 3,
    ApplicationCommandAutocomplete: 4,
    ModalSubmit: 5,
    2: 'ApplicationCommand',
    3: 'MessageComponent',
    4: 'ApplicationCommandAutocomplete',
    5: 'ModalSubmit'
  },

  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 512,
    MessageContent: 32768,
    GuildMembers: 2
  },

  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
    Link: 5
  },

  TextInputStyle: {
    Short: 1,
    Paragraph: 2
  },

  ApplicationCommandType: {
    ChatInput: 1,
    User: 2,
    Message: 3
  },

  ChannelType: {
    GuildText: 0,
    PublicThread: 11,
    PrivateThread: 12,
    GuildVoice: 2
  },

  // メッセージフラグ（実 discord.js の数値に一致・主要分のみ）
  // C-6: 非推奨 ephemeral オプション → flags: MessageFlags.Ephemeral 置換に伴い必須
  MessageFlags: {
    SuppressEmbeds: 4,
    Ephemeral: 64,
    SuppressNotifications: 4096
  },

  ComponentType: {
    ActionRow: 1,
    Button: 2,
    StringSelect: 3,
    TextInput: 4,
    UserSelect: 5,
    RoleSelect: 6,
    MentionableSelect: 7,
    ChannelSelect: 8
  },

  Colors: {
    White: 0xffffff,
    Black: 0x000000,
    Gold: 0xffd700,
    Red: 0xff0000,
    Green: 0x008000,
    Blue: 0x0000ff,
    Grey: 0x808080,
    Orange: 0xffa500,
    Purple: 0x800080,
    Aqua: 0x00ffff
  },

  PermissionFlagsBits: {
    Administrator: BigInt(8),
    ManageChannels: BigInt(16),
    ManageGuild: BigInt(32),
    SendMessages: BigInt(2048)
  }
})

/**
 * 各spec.tsファイルで discord.js をモックするためのヘルパー
 *
 * jest-setup.ts のグローバルモックとは別に、
 * 個別のテストファイルで使用する場合に呼び出す。
 *
 * @example
 * ```typescript
 * // spec.ts の先頭
 * import { setupDiscordModuleMock } from '@discord-test-utils/jest/discord-module.mock'
 * setupDiscordModuleMock()
 *
 * describe('MyService', () => { ... })
 * ```
 */
export function setupDiscordModuleMock(): void {
  jest.mock('discord.js', () => discordModuleMockFactory())
}
