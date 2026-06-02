import 'reflect-metadata'

// Jest グローバル設定
beforeEach(() => {
  // 各テスト前に実行される共通処理
  jest.clearAllMocks()
  jest.restoreAllMocks()
})

// コンソールのモック（テスト出力をクリーンに保つ）
const originalConsole = global.console

beforeAll(() => {
  global.console = {
    ...originalConsole,
    // テスト中はコンソールログを抑制（必要に応じてコメントアウト）
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
})

afterAll(() => {
  global.console = originalConsole
})

// 非同期処理のタイムアウト対策
jest.setTimeout(10000)

// 未処理のPromise rejection警告を無効化
process.removeAllListeners('unhandledRejection')
process.on('unhandledRejection', () => {
  // テスト環境では警告を無視
})

// Discord.js モジュールのモック（テスト実行時のDiscord接続を防ぐ）
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    login: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    channels: {
      fetch: jest.fn().mockResolvedValue({
        send: jest.fn().mockResolvedValue({}),
        isTextBased: jest.fn().mockReturnValue(true)
      })
    },
    user: {
      id: 'test-bot-id'
    }
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4
  },
  ButtonBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setDisabled: jest.fn().mockReturnThis(),
    setEmoji: jest.fn().mockReturnThis(),
    setURL: jest.fn().mockReturnThis()
  })),
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setFields: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setURL: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setThumbnail: jest.fn().mockReturnThis(),
    setAuthor: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis()
  })),
  ActionRowBuilder: jest.fn().mockImplementation(() => ({
    addComponents: jest.fn().mockReturnThis()
  })),
  ModalBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    addComponents: jest.fn().mockReturnThis()
  })),
  TextInputBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setPlaceholder: jest.fn().mockReturnThis(),
    setRequired: jest.fn().mockReturnThis(),
    setMinLength: jest.fn().mockReturnThis(),
    setMaxLength: jest.fn().mockReturnThis(),
    // 実 discord.js には存在するが旧モックに欠けていたため補完（既存値の復元に使用）
    setValue: jest.fn().mockReturnThis()
  })),
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4
  },
  TextInputStyle: {
    Short: 1,
    Paragraph: 2
  },
  SlashCommandBuilder: jest.fn().mockImplementation(() => ({
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
  })),
  ContextMenuCommandBuilder: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setType: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({
      name: 'test-context-menu',
      type: 3
    })
  })),
  StringSelectMenuBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setPlaceholder: jest.fn().mockReturnThis(),
    setMinValues: jest.fn().mockReturnThis(),
    setMaxValues: jest.fn().mockReturnThis(),
    addOptions: jest.fn().mockReturnThis(),
    setOptions: jest.fn().mockReturnThis(),
    setDisabled: jest.fn().mockReturnThis()
  })),
  StringSelectMenuOptionBuilder: jest.fn().mockImplementation(() => ({
    setLabel: jest.fn().mockReturnThis(),
    setValue: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setDefault: jest.fn().mockReturnThis(),
    setEmoji: jest.fn().mockReturnThis()
  })),
  ApplicationCommandType: {
    ChatInput: 1,
    User: 2,
    Message: 3
  },
  // 実 discord.js と同じ値で全列挙を提供（旧モックは PublicThread のみで各 spec が個別補完していた）
  ChannelType: {
    GuildText: 0,
    DM: 1,
    GuildVoice: 2,
    GroupDM: 3,
    GuildCategory: 4,
    GuildAnnouncement: 5,
    AnnouncementThread: 10,
    PublicThread: 11,
    PrivateThread: 12,
    GuildStageVoice: 13,
    GuildDirectory: 14,
    GuildForum: 15,
    GuildMedia: 16
  },
  // よく参照されるイベント名（実 discord.js の文字列値に一致）
  Events: {
    ClientReady: 'ready',
    InteractionCreate: 'interactionCreate',
    ChannelCreate: 'channelCreate',
    MessageCreate: 'messageCreate',
    GuildCreate: 'guildCreate',
    Error: 'error'
  },
  // 権限フラグ（実 discord.js の bigint 値に一致・主要分のみ）
  PermissionsBitField: {
    Flags: {
      ManageChannels: 16n,
      ViewChannel: 1024n,
      SendMessages: 2048n,
      ManageThreads: 17179869184n,
      CreatePublicThreads: 34359738368n,
      Administrator: 8n
    }
  },
  // スレッド自動アーカイブ期間（実 discord.js の値に一致）
  ThreadAutoArchiveDuration: {
    OneHour: 60,
    OneDay: 1440,
    ThreeDays: 4320,
    OneWeek: 10080
  },
  Colors: {
    White: 0xffffff,
    Gold: 0xffd700,
    Red: 0xff0000,
    Green: 0x008000,
    Blue: 0x0000ff,
    Grey: 0x808080
  }
}))

// bcdice モジュールのモック（ダイスロール機能）
jest.mock('bcdice', () => ({
  DiceBot: jest.fn().mockImplementation(() => ({
    roll: jest.fn().mockReturnValue({
      result: '1d100 => 50',
      isSuccess: true,
      rands: [[50]]
    })
  }))
}))

console.log('Jest セットアップ完了')
