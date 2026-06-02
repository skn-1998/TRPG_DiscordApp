import { Test } from '@nestjs/testing'
import { HttpException, HttpStatus, BadRequestException, NotFoundException, Logger } from '@nestjs/common'
import { DiscordController } from './discord.controller'
import { DiscordService } from './discord.service'
import { CharacterService } from '../domains/character/character.service'
import { JwtAuthGuard } from '../domains/auth/guards/jwt-auth.guard'
import { CreateChannelType } from './dto/create-channel.dto'

// DiscordController の責務は HTTP の受付・認可確認・入力検証・委譲・エラー変換。
// 副作用境界（DiscordService / CharacterService）はモックし、各エンドポイントが
// 「正しく委譲して結果を返すか」「分岐ごとに正しい例外へ変換するか」を検証する。
// ビジネスロジックは持たないため、内部実装ではなく公開挙動だけを見る。
type DiscordServiceMock = {
  verifyChannelAccess: jest.Mock
  verifyGuildManagePermission: jest.Mock
  verifyGuildAccess: jest.Mock
  sendMessage: jest.Mock
  createChannel: jest.Mock
  getBotStatus: jest.Mock
  getGuildInfo: jest.Mock
  getChannelInfo: jest.Mock
}

type CharacterServiceMock = {
  findOne: jest.Mock
  update: jest.Mock
}

describe('DiscordController', () => {
  let discordService: DiscordServiceMock
  let characterService: CharacterServiceMock
  let controller: DiscordController

  // req.user.discordUserId だけを参照するため、最小の認証済みリクエストを渡す
  const req = { user: { discordUserId: 'duser-1', id: 'u1', username: 'tester' } } as any

  beforeEach(async () => {
    discordService = {
      verifyChannelAccess: jest.fn(),
      verifyGuildManagePermission: jest.fn(),
      verifyGuildAccess: jest.fn(),
      sendMessage: jest.fn(),
      createChannel: jest.fn(),
      getBotStatus: jest.fn(),
      getGuildInfo: jest.fn(),
      getChannelInfo: jest.fn()
    }
    characterService = {
      findOne: jest.fn(),
      update: jest.fn()
    }

    // ログ出力はテスト出力を汚すだけなので抑制する（挙動には影響しない）
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    const moduleRef = await Test.createTestingModule({
      controllers: [DiscordController],
      providers: [
        { provide: DiscordService, useValue: discordService },
        { provide: CharacterService, useValue: characterService }
      ]
    })
      // JwtAuthGuard は JwtTokenService 等に依存するため、認可は別テストの責務として無効化する
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile()

    controller = moduleRef.get(DiscordController)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('sendMessage', () => {
    it('content も embed も無い場合は BadRequestException を投げる', async () => {
      // Arrange
      const dto = { channelId: 'c1' } as any

      // Act & Assert
      await expect(controller.sendMessage(dto, req)).rejects.toBeInstanceOf(BadRequestException)
      expect(discordService.sendMessage).not.toHaveBeenCalled()
    })

    it('チャンネルアクセス権限が無い場合は 403 の HttpException を投げる', async () => {
      // Arrange
      const dto = { channelId: 'c1', content: 'hi' } as any
      discordService.verifyChannelAccess.mockResolvedValue(false)

      // Act
      const promise = controller.sendMessage(dto, req)

      // Assert
      await expect(promise).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordService.sendMessage).not.toHaveBeenCalled()
    })

    it('成功時は discordService.sendMessage の戻り値をそのまま返す', async () => {
      // Arrange
      const dto = { channelId: 'c1', content: 'hi' } as any
      const expected = { success: true, messageId: 'm1' }
      discordService.verifyChannelAccess.mockResolvedValue(true)
      discordService.sendMessage.mockResolvedValue(expected)

      // Act
      const result = await controller.sendMessage(dto, req)

      // Assert
      expect(result).toBe(expected)
      expect(discordService.sendMessage).toHaveBeenCalledWith(dto)
    })

    it('想定外のエラーは 500 の HttpException にラップする', async () => {
      // Arrange
      const dto = { channelId: 'c1', content: 'hi' } as any
      discordService.verifyChannelAccess.mockResolvedValue(true)
      discordService.sendMessage.mockRejectedValue(new Error('boom'))

      // Act & Assert
      await expect(controller.sendMessage(dto, req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
    })

    it('HttpException はラップせず再スローする', async () => {
      // Arrange
      const dto = { channelId: 'c1', content: 'hi' } as any
      const original = new HttpException('teapot', HttpStatus.I_AM_A_TEAPOT)
      discordService.verifyChannelAccess.mockResolvedValue(true)
      discordService.sendMessage.mockRejectedValue(original)

      // Act & Assert
      await expect(controller.sendMessage(dto, req)).rejects.toBe(original)
    })
  })

  describe('createChannel', () => {
    it('ギルド管理権限が無い場合は 403 の HttpException を投げる', async () => {
      // Arrange
      const dto = { guildId: 'g1', name: 'ch' } as any
      discordService.verifyGuildManagePermission.mockResolvedValue(false)

      // Act & Assert
      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordService.createChannel).not.toHaveBeenCalled()
    })

    it('成功時は discordService.createChannel の戻り値を返す', async () => {
      // Arrange
      const dto = { guildId: 'g1', name: 'ch' } as any
      const expected = { success: true, channelId: 'c1' }
      discordService.verifyGuildManagePermission.mockResolvedValue(true)
      discordService.createChannel.mockResolvedValue(expected)

      // Act
      const result = await controller.createChannel(dto, req)

      // Assert
      expect(result).toBe(expected)
      expect(discordService.createChannel).toHaveBeenCalledWith(dto)
    })

    it('想定外のエラーは 500 の HttpException にラップする', async () => {
      // Arrange
      const dto = { guildId: 'g1', name: 'ch' } as any
      discordService.verifyGuildManagePermission.mockResolvedValue(true)
      discordService.createChannel.mockRejectedValue(new Error('boom'))

      // Act & Assert
      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
    })
  })

  describe('getBotStatus', () => {
    it('成功時は status をそのまま返す', async () => {
      // Arrange
      const status = { online: true, guilds: 1, users: 2, ping: 30, uptime: 100 }
      discordService.getBotStatus.mockResolvedValue(status)

      // Act
      const result = await controller.getBotStatus()

      // Assert
      expect(result).toBe(status)
    })

    it('エラー時は 500 の HttpException を投げる', async () => {
      // Arrange
      discordService.getBotStatus.mockRejectedValue(new Error('boom'))

      // Act & Assert
      await expect(controller.getBotStatus()).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
    })
  })

  describe('getGuildInfo', () => {
    it('guildId が不正な場合は BadRequestException を投げる', async () => {
      // Act & Assert（空文字 → 不正）
      await expect(controller.getGuildInfo('', req)).rejects.toBeInstanceOf(BadRequestException)
      expect(discordService.verifyGuildAccess).not.toHaveBeenCalled()
    })

    it('ギルドアクセス権限が無い場合は 403 の HttpException を投げる', async () => {
      // Arrange
      discordService.verifyGuildAccess.mockResolvedValue(false)

      // Act & Assert
      await expect(controller.getGuildInfo('g1', req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordService.getGuildInfo).not.toHaveBeenCalled()
    })

    it('成功時は guildInfo をそのまま返す', async () => {
      // Arrange
      const guildInfo = { id: 'g1', name: 'Guild', memberCount: 5, channels: [] }
      discordService.verifyGuildAccess.mockResolvedValue(true)
      discordService.getGuildInfo.mockResolvedValue(guildInfo)

      // Act
      const result = await controller.getGuildInfo('g1', req)

      // Assert
      expect(result).toBe(guildInfo)
      expect(discordService.getGuildInfo).toHaveBeenCalledWith('g1')
    })

    it('「ギルドが見つかりません」を含むエラーは NotFoundException に変換する', async () => {
      // Arrange
      discordService.verifyGuildAccess.mockResolvedValue(true)
      discordService.getGuildInfo.mockRejectedValue(new Error('ギルドが見つかりません: g1'))

      // Act & Assert
      await expect(controller.getGuildInfo('g1', req)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('その他のエラーは 500 の HttpException にラップする', async () => {
      // Arrange
      discordService.verifyGuildAccess.mockResolvedValue(true)
      discordService.getGuildInfo.mockRejectedValue(new Error('boom'))

      // Act & Assert
      await expect(controller.getGuildInfo('g1', req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
    })
  })

  describe('getChannelInfo', () => {
    it('channelId が不正な場合は BadRequestException を投げる', async () => {
      // Act & Assert
      await expect(controller.getChannelInfo('', req)).rejects.toBeInstanceOf(BadRequestException)
      expect(discordService.verifyChannelAccess).not.toHaveBeenCalled()
    })

    it('チャンネルアクセス権限が無い場合は 403 の HttpException を投げる', async () => {
      // Arrange
      discordService.verifyChannelAccess.mockResolvedValue(false)

      // Act & Assert
      await expect(controller.getChannelInfo('c1', req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordService.getChannelInfo).not.toHaveBeenCalled()
    })

    it('成功時は channelInfo をそのまま返す', async () => {
      // Arrange
      const channelInfo = { id: 'c1', name: 'general', type: 'text', guild: { id: 'g1', name: 'Guild' } }
      discordService.verifyChannelAccess.mockResolvedValue(true)
      discordService.getChannelInfo.mockResolvedValue(channelInfo)

      // Act
      const result = await controller.getChannelInfo('c1', req)

      // Assert
      expect(result).toBe(channelInfo)
      expect(discordService.getChannelInfo).toHaveBeenCalledWith('c1')
    })

    it('「チャンネルが見つかりません」を含むエラーは NotFoundException に変換する', async () => {
      // Arrange
      discordService.verifyChannelAccess.mockResolvedValue(true)
      discordService.getChannelInfo.mockRejectedValue(new Error('チャンネルが見つかりません: c1'))

      // Act & Assert
      await expect(controller.getChannelInfo('c1', req)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('その他のエラーは 500 の HttpException にラップする', async () => {
      // Arrange
      discordService.verifyChannelAccess.mockResolvedValue(true)
      discordService.getChannelInfo.mockRejectedValue(new Error('boom'))

      // Act & Assert
      await expect(controller.getChannelInfo('c1', req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
    })
  })

  describe('postCharacter', () => {
    const dto = { characterId: 'char-1', guildId: 'g1' } as any

    // キャラクターカテゴリ（type==='4' かつ名前に character を含む）を 1 つ持つギルド情報
    const guildInfoWithCategory = {
      id: 'g1',
      name: 'Guild',
      memberCount: 5,
      channels: [{ id: 'cat-1', name: 'Character', type: '4' }]
    }

    it('キャラクターが見つからない場合は NotFoundException を投げる', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue(null)

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toBeInstanceOf(NotFoundException)
      expect(discordService.verifyGuildAccess).not.toHaveBeenCalled()
    })

    it('ギルドアクセス権限が無い場合は 403 の HttpException を投げる', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue({ characterName: 'Alice' })
      discordService.verifyGuildAccess.mockResolvedValue(false)

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordService.createChannel).not.toHaveBeenCalled()
    })

    it('キャラクターカテゴリが見つからない場合は NotFoundException を投げる', async () => {
      // Arrange（type が '4' でないため対象外）
      characterService.findOne.mockResolvedValue({ characterName: 'Alice' })
      discordService.verifyGuildAccess.mockResolvedValue(true)
      discordService.getGuildInfo.mockResolvedValue({
        ...guildInfoWithCategory,
        channels: [{ id: 'txt-1', name: 'character-talk', type: '0' }]
      })

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toBeInstanceOf(NotFoundException)
      expect(discordService.createChannel).not.toHaveBeenCalled()
    })

    it('成功時はチャンネル作成・キャラクター更新を行い、自動処理メッセージを返す', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue({ characterName: 'Hero Name!' })
      discordService.verifyGuildAccess.mockResolvedValue(true)
      discordService.getGuildInfo.mockResolvedValue(guildInfoWithCategory)
      discordService.createChannel.mockResolvedValue({ success: true, channelId: 'new-ch' })

      // Act
      const result = await controller.postCharacter(dto, req)

      // Assert: 戻り値
      expect(result).toEqual({ success: true, messageId: 'auto-handled-by-file-based-handlers' })

      // Assert: チャンネル作成は名前を正規化しカテゴリ配下に作る
      expect(discordService.createChannel).toHaveBeenCalledWith({
        guildId: 'g1',
        name: 'hero-name',
        type: CreateChannelType.TEXT,
        parentId: 'cat-1',
        topic: 'Hero Name!のキャラクター情報'
      })

      // Assert: 作成したチャンネルIDでキャラクターを更新する
      expect(characterService.update).toHaveBeenCalledWith('char-1', { discordChannelId: 'new-ch' })
    })

    it('チャンネル作成が失敗した場合は 500 の HttpException を投げる', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue({ characterName: 'Alice' })
      discordService.verifyGuildAccess.mockResolvedValue(true)
      discordService.getGuildInfo.mockResolvedValue(guildInfoWithCategory)
      discordService.createChannel.mockResolvedValue({ success: false, error: '作成失敗' })

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
      // チャンネル作成失敗時は discordChannelId を永続化しない（undefined 書き込みによるデータ破損を防ぐ）
      expect(characterService.update).not.toHaveBeenCalled()
    })

    it('キャラクター更新が失敗した場合は 500 を投げる（永続化を await し成功応答前にエラーを伝播）', async () => {
      // Arrange: チャンネル作成は成功するが DB 更新が失敗する
      characterService.findOne.mockResolvedValue({ characterName: 'Alice' })
      discordService.verifyGuildAccess.mockResolvedValue(true)
      discordService.getGuildInfo.mockResolvedValue(guildInfoWithCategory)
      discordService.createChannel.mockResolvedValue({ success: true, channelId: 'new-ch' })
      characterService.update.mockRejectedValue(new Error('DB 更新失敗'))

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
      expect(characterService.update).toHaveBeenCalledWith('char-1', { discordChannelId: 'new-ch' })
    })
  })
})
