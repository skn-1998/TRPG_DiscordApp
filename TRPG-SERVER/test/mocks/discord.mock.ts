import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  Guild,
  Channel,
  User,
  Message,
  GuildMember
} from 'discord.js'

// Discord テストデータ
export const mockDiscordData = {
  user: {
    id: '123456789',
    username: 'TestUser',
    discriminator: '0001',
    avatar: 'test-avatar-hash',
    bot: false,
    system: false,
    mfaEnabled: false,
    verified: true,
    email: 'test@example.com'
  },
  guild: {
    id: '987654321',
    name: 'テストサーバー',
    icon: 'test-guild-icon',
    ownerId: '123456789'
  },
  channel: {
    id: '555666777',
    name: 'テストチャンネル',
    type: 0, // TEXT_CHANNEL
    position: 0,
    topic: 'テスト用チャンネル',
    nsfw: false,
    lastMessageId: '888999000'
  },
  message: {
    id: '888999000',
    content: 'テストメッセージ',
    author: {
      id: '123456789',
      username: 'TestUser',
      discriminator: '0001',
      avatar: 'test-avatar-hash'
    },
    timestamp: new Date(),
    editedTimestamp: null
  }
}

// Discord Client モック
export const mockDiscordClient = {
  login: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  channels: {
    fetch: jest.fn().mockResolvedValue({
      id: mockDiscordData.channel.id,
      name: mockDiscordData.channel.name,
      send: jest.fn().mockResolvedValue(mockDiscordData.message),
      isTextBased: jest.fn().mockReturnValue(true),
      threads: {
        create: jest.fn().mockResolvedValue({
          id: 'test-thread-id',
          name: 'テストスレッド',
          send: jest.fn().mockResolvedValue(mockDiscordData.message)
        })
      }
    })
  },
  guilds: {
    fetch: jest.fn().mockResolvedValue({
      id: mockDiscordData.guild.id,
      name: mockDiscordData.guild.name,
      channels: {
        create: jest.fn().mockResolvedValue(mockDiscordData.channel)
      }
    })
  },
  users: {
    fetch: jest.fn().mockResolvedValue(mockDiscordData.user)
  },
  user: {
    id: 'bot-user-id',
    username: 'TestBot',
    discriminator: '0000'
  }
}

// Discord Interaction モック
export const createMockInteraction = (type: 'button' | 'command' | 'modal' | 'select') => {
  const baseInteraction = {
    id: 'test-interaction-id',
    applicationId: 'test-app-id',
    type: type === 'button' ? 3 : type === 'command' ? 2 : type === 'modal' ? 5 : 3,
    guild: mockDiscordData.guild,
    channel: mockDiscordData.channel,
    user: mockDiscordData.user,
    member: {
      id: mockDiscordData.user.id,
      user: mockDiscordData.user,
      nickname: null,
      roles: [],
      joinedAt: new Date(),
      premiumSince: null,
      permissions: '8' // Administrator
    },
    token: 'test-interaction-token',
    version: 1,
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
    fetchReply: jest.fn().mockResolvedValue(mockDiscordData.message),
    showModal: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined)
  }

  switch (type) {
    case 'button':
      return {
        ...baseInteraction,
        customId: 'test-button',
        componentType: 2,
        message: mockDiscordData.message
      }
    case 'command':
      return {
        ...baseInteraction,
        commandName: 'test-command',
        options: {
          getString: jest.fn().mockReturnValue('test-string'),
          getInteger: jest.fn().mockReturnValue(42),
          getBoolean: jest.fn().mockReturnValue(true),
          getUser: jest.fn().mockReturnValue(mockDiscordData.user),
          getChannel: jest.fn().mockReturnValue(mockDiscordData.channel)
        }
      }
    case 'modal':
      return {
        ...baseInteraction,
        customId: 'test-modal',
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('test-input-value')
        }
      }
    case 'select':
      return {
        ...baseInteraction,
        customId: 'test-select',
        values: ['test-value-1', 'test-value-2'],
        componentType: 3
      }
    default:
      return baseInteraction
  }
}

// Discord Message モック
export const createMockMessage = (content = 'テストメッセージ') => ({
  id: 'test-message-id',
  content,
  author: mockDiscordData.user,
  channel: mockDiscordData.channel,
  guild: mockDiscordData.guild,
  timestamp: new Date(),
  editedTimestamp: null,
  reactions: {
    cache: new Map()
  },
  reply: jest.fn().mockResolvedValue(undefined),
  edit: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  react: jest.fn().mockResolvedValue(undefined)
})

// Discord Embed モック
export const createMockEmbed = (title = 'テストEmbed', description = 'テスト説明') => ({
  title,
  description,
  color: 0x00ff00,
  fields: [],
  timestamp: new Date(),
  footer: {
    text: 'テストフッター',
    iconURL: 'test-icon-url'
  }
})

// Discord エラーモック
export const mockDiscordErrors = {
  missingPermissions: new Error('Missing Permissions'),
  unknownChannel: new Error('Unknown Channel'),
  unknownGuild: new Error('Unknown Guild'),
  unknownUser: new Error('Unknown User'),
  unknownMessage: new Error('Unknown Message'),
  interactionAlreadyReplied: new Error('Interaction has already been replied to')
}

// Discord サービス用のモック
export const mockDiscordService = {
  sendMessage: jest.fn().mockResolvedValue(mockDiscordData.message),
  createThread: jest.fn().mockResolvedValue({ id: 'test-thread-id' }),
  createChannel: jest.fn().mockResolvedValue(mockDiscordData.channel),
  getUser: jest.fn().mockResolvedValue(mockDiscordData.user),
  getChannel: jest.fn().mockResolvedValue(mockDiscordData.channel),
  getGuild: jest.fn().mockResolvedValue(mockDiscordData.guild)
}

// Discord.js Builders モック
export const mockSlashCommandBuilder = {
  setName: jest.fn().mockReturnThis(),
  setDescription: jest.fn().mockReturnThis(),
  addStringOption: jest.fn().mockReturnThis(),
  addIntegerOption: jest.fn().mockReturnThis(),
  addBooleanOption: jest.fn().mockReturnThis(),
  addUserOption: jest.fn().mockReturnThis(),
  addChannelOption: jest.fn().mockReturnThis(),
  addSubcommand: jest.fn().mockReturnThis(),
  addSubcommandGroup: jest.fn().mockReturnThis(),
  toJSON: jest.fn().mockReturnValue({
    name: 'test-command',
    description: 'Test command description',
    options: []
  })
}

export const mockContextMenuCommandBuilder = {
  setName: jest.fn().mockReturnThis(),
  setType: jest.fn().mockReturnThis(),
  toJSON: jest.fn().mockReturnValue({
    name: 'test-context-menu',
    type: 3 // MESSAGE
  })
}

export const mockEmbedBuilder = {
  setTitle: jest.fn().mockReturnThis(),
  setDescription: jest.fn().mockReturnThis(),
  setColor: jest.fn().mockReturnThis(),
  addFields: jest.fn().mockReturnThis(),
  setTimestamp: jest.fn().mockReturnThis(),
  setFooter: jest.fn().mockReturnThis(),
  setAuthor: jest.fn().mockReturnThis(),
  setImage: jest.fn().mockReturnThis(),
  setThumbnail: jest.fn().mockReturnThis(),
  data: {
    title: 'Test Embed',
    description: 'Test description',
    color: 0x00ff00,
    fields: [],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Test Footer'
    }
  },
  toJSON: jest.fn().mockReturnValue({
    title: 'Test Embed',
    description: 'Test description'
  })
}

export const mockActionRowBuilder = {
  addComponents: jest.fn().mockReturnThis(),
  toJSON: jest.fn().mockReturnValue({
    type: 1,
    components: []
  })
}

export const mockButtonBuilder = {
  setCustomId: jest.fn().mockReturnThis(),
  setLabel: jest.fn().mockReturnThis(),
  setStyle: jest.fn().mockReturnThis(),
  setEmoji: jest.fn().mockReturnThis(),
  setDisabled: jest.fn().mockReturnThis(),
  toJSON: jest.fn().mockReturnValue({
    type: 2,
    style: 1,
    label: 'Test Button'
  })
}

export const mockSelectMenuBuilder = {
  setCustomId: jest.fn().mockReturnThis(),
  setPlaceholder: jest.fn().mockReturnThis(),
  setMinValues: jest.fn().mockReturnThis(),
  setMaxValues: jest.fn().mockReturnThis(),
  addOptions: jest.fn().mockReturnThis(),
  setOptions: jest.fn().mockReturnThis(),
  toJSON: jest.fn().mockReturnValue({
    type: 3,
    custom_id: 'test-select'
  })
}

export const mockModalBuilder = {
  setCustomId: jest.fn().mockReturnThis(),
  setTitle: jest.fn().mockReturnThis(),
  addComponents: jest.fn().mockReturnThis(),
  toJSON: jest.fn().mockReturnValue({
    title: 'Test Modal',
    custom_id: 'test-modal'
  })
}

export const mockTextInputBuilder = {
  setCustomId: jest.fn().mockReturnThis(),
  setLabel: jest.fn().mockReturnThis(),
  setStyle: jest.fn().mockReturnThis(),
  setMinLength: jest.fn().mockReturnThis(),
  setMaxLength: jest.fn().mockReturnThis(),
  setPlaceholder: jest.fn().mockReturnThis(),
  setRequired: jest.fn().mockReturnThis(),
  setValue: jest.fn().mockReturnThis(),
  toJSON: jest.fn().mockReturnValue({
    type: 4,
    style: 1,
    label: 'Test Input'
  })
}

// Discord Bot Commands モック
export const mockDiscordCommands = {
  rollDice: jest.fn().mockResolvedValue({
    result: '1d100 => 50',
    isSuccess: true
  }),
  createCharacter: jest.fn().mockResolvedValue({
    characterId: 'test-character-id',
    name: 'テストキャラクター'
  }),
  listCharacters: jest.fn().mockResolvedValue([
    { characterId: 'test-char-1', name: 'キャラ1' },
    { characterId: 'test-char-2', name: 'キャラ2' }
  ])
}
