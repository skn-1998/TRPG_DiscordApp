import { Character } from '../../src/domains/character/models/character.model'
import { User } from '../../src/domains/user/models/user.model'
import { mockAuthData } from '../mocks/auth.mock'
import { mockDiscordData } from '../mocks/discord.mock'

// キャラクターテストデータファクトリー
export class CharacterFactory {
  static create(overrides: Partial<Character> = {}): Character {
    const defaultCharacter: Character = {
      characterId: 'test-character-id',
      name: 'テストキャラクター',
      gameSystem: 'CoC',
      discordUserId: mockDiscordData.user.id,
      status: {
        STR: 50,
        CON: 50,
        POW: 50,
        DEX: 50,
        APP: 50,
        SIZ: 50,
        INT: 50,
        EDU: 50,
        HP: 10,
        MP: 10,
        SAN: 50
      },
      skills: {
        キック: 25,
        こぶし: 50,
        頭突き: 10,
        投擲: 25,
        回避: 20,
        鍵開け: 1,
        隠す: 10,
        隠れる: 10,
        聞き耳: 20,
        忍び歩き: 10,
        写真術: 10,
        精神分析: 1,
        追跡: 10,
        登攀: 40,
        図書館: 25,
        目星: 25,
        応急手当: 30,
        医学: 5,
        心理学: 5,
        人類学: 1,
        考古学: 1,
        芸術: 5,
        化学: 1,
        クトゥルフ神話: 0,
        地質学: 1,
        生物学: 1,
        博物学: 10,
        物理学: 1,
        薬学: 1,
        法律: 5,
        会計: 10,
        経済学: 1,
        歴史: 20,
        母国語: 80,
        英語: 1,
        値切り: 5,
        信用: 15,
        説得: 15,
        言いくるめ: 5,
        運転: 20,
        機械修理: 20,
        重機械操作: 1,
        乗馬: 5,
        水泳: 25,
        製作: 5,
        操縦: 1,
        跳躍: 25,
        電気修理: 10,
        ナビゲート: 10,
        変装: 1,
        武道: 1,
        拳銃: 20,
        サブマシンガン: 15,
        ショットガン: 30,
        マシンガン: 15,
        ライフル: 25
      },
      description: 'テスト用キャラクター',
      avatar: 'test-avatar.png',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      ...overrides
    }

    return defaultCharacter
  }

  static createMany(count: number, overrides: Partial<Character> = {}): Character[] {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        characterId: `test-character-${index + 1}`,
        name: `テストキャラクター${index + 1}`,
        ...overrides
      })
    )
  }

  static createWithCustomSkills(skills: Record<string, number>): Character {
    return this.create({
      skills: {
        ...this.create().skills,
        ...skills
      }
    })
  }

  static createWithGameSystem(gameSystem: string): Character {
    return this.create({ gameSystem })
  }
}

// ユーザーテストデータファクトリー
export class UserFactory {
  static create(overrides: Partial<User> = {}): User {
    const defaultUser: User = {
      id: mockAuthData.discordUser.id,
      discordId: mockAuthData.discordUser.id,
      username: mockAuthData.discordUser.username,
      email: mockAuthData.discordUser.email,
      avatar: mockAuthData.discordUser.avatar,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      ...overrides
    }

    return defaultUser
  }

  static createMany(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        id: `test-user-${index + 1}`,
        discordId: `discord-id-${index + 1}`,
        username: `TestUser${index + 1}`,
        email: `test${index + 1}@example.com`,
        ...overrides
      })
    )
  }
}

// Discord関連テストデータファクトリー
export class DiscordFactory {
  static createUser(overrides: Partial<typeof mockDiscordData.user> = {}) {
    return {
      ...mockDiscordData.user,
      ...overrides
    }
  }

  static createGuild(overrides: Partial<typeof mockDiscordData.guild> = {}) {
    return {
      ...mockDiscordData.guild,
      ...overrides
    }
  }

  static createChannel(overrides: Partial<typeof mockDiscordData.channel> = {}) {
    return {
      ...mockDiscordData.channel,
      ...overrides
    }
  }

  static createMessage(overrides: Partial<typeof mockDiscordData.message> = {}) {
    return {
      ...mockDiscordData.message,
      ...overrides
    }
  }
}

// ダイスロール結果ファクトリー
export class DiceRollFactory {
  static createResult(
    overrides: Partial<{
      result: string
      total: number
      dice: number[]
      isSuccess: boolean
      isCritical: boolean
      isFumble: boolean
    }> = {}
  ) {
    return {
      result: '1d100 => 50',
      total: 50,
      dice: [50],
      isSuccess: true,
      isCritical: false,
      isFumble: false,
      ...overrides
    }
  }

  static createSuccessResult(skillValue: number = 50) {
    const roll = Math.floor(Math.random() * skillValue)
    return this.createResult({
      result: `1d100 => ${roll}`,
      total: roll,
      dice: [roll],
      isSuccess: true,
      isCritical: roll === 1,
      isFumble: false
    })
  }

  static createFailureResult(skillValue: number = 50) {
    const roll = skillValue + Math.floor(Math.random() * (100 - skillValue))
    return this.createResult({
      result: `1d100 => ${roll}`,
      total: roll,
      dice: [roll],
      isSuccess: false,
      isCritical: false,
      isFumble: roll >= 96
    })
  }

  static createCriticalSuccess() {
    return this.createResult({
      result: '1d100 => 1',
      total: 1,
      dice: [1],
      isSuccess: true,
      isCritical: true,
      isFumble: false
    })
  }

  static createFumble() {
    return this.createResult({
      result: '1d100 => 100',
      total: 100,
      dice: [100],
      isSuccess: false,
      isCritical: false,
      isFumble: true
    })
  }
}

// エラーテストデータファクトリー
export class ErrorFactory {
  static createHttpError(status: number, message: string) {
    return {
      response: {
        statusCode: status,
        message,
        error: this.getErrorName(status)
      }
    }
  }

  static createValidationError(fields: string[]) {
    return {
      response: {
        statusCode: 400,
        message: fields.map((field) => `${field} は必須です`),
        error: 'Bad Request'
      }
    }
  }

  static createDiscordError(message: string) {
    return new Error(`Discord API Error: ${message}`)
  }

  static createDatabaseError(message: string) {
    return new Error(`Database Error: ${message}`)
  }

  private static getErrorName(status: number): string {
    const statusNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error'
    }
    return statusNames[status] || 'Unknown Error'
  }
}

// テストシナリオファクトリー
export class ScenarioFactory {
  static createAuthFlow() {
    return {
      user: UserFactory.create(),
      token: 'test-jwt-token',
      expiresAt: new Date(Date.now() + 3600000) // 1時間後
    }
  }

  static createCharacterCreationFlow() {
    return {
      user: UserFactory.create(),
      character: CharacterFactory.create(),
      gameSystem: 'CoC'
    }
  }

  static createDiceRollFlow() {
    return {
      user: UserFactory.create(),
      character: CharacterFactory.create(),
      skill: 'キック',
      skillValue: 25,
      diceResult: DiceRollFactory.createResult()
    }
  }

  static createErrorFlow() {
    return {
      user: UserFactory.create(),
      error: ErrorFactory.createHttpError(500, 'Internal Server Error'),
      context: {
        operation: 'test-operation',
        timestamp: new Date(),
        userId: 'test-user-id'
      }
    }
  }
}
