import { Test } from '@nestjs/testing'
import { HttpException, HttpStatus, BadRequestException, NotFoundException, Logger } from '@nestjs/common'
import { DiscordController } from './discord.controller'
import { DiscordFacadeService } from './discord-facade.service'
import { CharacterService } from '../domains/character/character.service'
import { JwtAuthGuard } from '../domains/auth/guards/jwt-auth.guard'
import { CreateChannelType } from './dto/create-channel.dto'

// DiscordController の責務は HTTP の受付・認可確認・入力検証・委譲・エラー変換。
// 副作用境界（DiscordFacadeService / CharacterService）はモックし、各エンドポイントが
// 「正しく委譲して結果を返すか」「分岐ごとに正しい例外へ変換するか」を検証する。
// ビジネスロジックは持たないため、内部実装ではなく公開挙動だけを見る。
type DiscordFacadeServiceMock = {
  verifyChannelAccess: jest.Mock
  verifyGuildAccess: jest.Mock
  sendMessage: jest.Mock
  createChannel: jest.Mock
  getHealthStatus: jest.Mock
  getClient: jest.Mock
  getGuildInfo: jest.Mock
  getChannelInfo: jest.Mock
}

type CharacterServiceMock = {
  findOne: jest.Mock
  update: jest.Mock
}

describe('DiscordController', () => {
  let discordFacade: DiscordFacadeServiceMock
  let characterService: CharacterServiceMock
  let controller: DiscordController

  // req.user.discordUserId だけを参照するため、最小の認証済みリクエストを渡す
  const req = { user: { discordUserId: 'duser-1', id: 'u1', username: 'tester' } } as any

  beforeEach(async () => {
    discordFacade = {
      verifyChannelAccess: jest.fn(),
      verifyGuildAccess: jest.fn(),
      sendMessage: jest.fn(),
      createChannel: jest.fn(),
      getHealthStatus: jest.fn(),
      getClient: jest.fn(),
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
        { provide: DiscordFacadeService, useValue: discordFacade },
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
      expect(discordFacade.sendMessage).not.toHaveBeenCalled()
    })

    it('チャンネルアクセス権限が無い場合は 403 の HttpException を投げる', async () => {
      // Arrange
      const dto = { channelId: 'c1', content: 'hi' } as any
      discordFacade.verifyChannelAccess.mockResolvedValue(false)

      // Act
      const promise = controller.sendMessage(dto, req)

      // Assert
      await expect(promise).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordFacade.sendMessage).not.toHaveBeenCalled()
    })

    it('成功時は discordFacade.sendMessage の戻り値をそのまま返す', async () => {
      // Arrange
      const dto = { channelId: 'c1', content: 'hi' } as any
      const expected = { success: true, messageId: 'm1' }
      discordFacade.verifyChannelAccess.mockResolvedValue(true)
      discordFacade.sendMessage.mockResolvedValue(expected)

      // Act
      const result = await controller.sendMessage(dto, req)

      // Assert
      expect(result).toBe(expected)
      expect(discordFacade.sendMessage).toHaveBeenCalledWith('c1', 'hi', { embeds: undefined, components: undefined })
    })

    it('想定外のエラーは 500 の HttpException にラップする', async () => {
      // Arrange
      const dto = { channelId: 'c1', content: 'hi' } as any
      discordFacade.verifyChannelAccess.mockResolvedValue(true)
      discordFacade.sendMessage.mockRejectedValue(new Error('boom'))

      // Act & Assert
      await expect(controller.sendMessage(dto, req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
    })

    it('HttpException はラップせず再スローする', async () => {
      // Arrange
      const dto = { channelId: 'c1', content: 'hi' } as any
      const original = new HttpException('teapot', HttpStatus.I_AM_A_TEAPOT)
      discordFacade.verifyChannelAccess.mockResolvedValue(true)
      discordFacade.sendMessage.mockRejectedValue(original)

      // Act & Assert
      await expect(controller.sendMessage(dto, req)).rejects.toBe(original)
    })
  })

  describe('createChannel', () => {
    it('ギルド管理権限が無い場合は 403 の HttpException を投げる', async () => {
      // Arrange
      const dto = { guildId: 'g1', name: 'ch' } as any
      discordFacade.verifyGuildAccess.mockResolvedValue(false)

      // Act & Assert
      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it('権限検証が例外を投げた場合も 403 を返す（旧ラッパーのエラー握りつぶし挙動を維持）', async () => {
      // Arrange
      const dto = { guildId: 'g1', name: 'ch' } as any
      discordFacade.verifyGuildAccess.mockRejectedValue(new Error('boom'))

      // Act & Assert
      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it('成功時は discordFacade.createChannel の戻り値を返す', async () => {
      // Arrange
      const dto = { guildId: 'g1', name: 'ch' } as any
      const expected = { success: true, channelId: 'c1' }
      discordFacade.verifyGuildAccess.mockResolvedValue(true)
      discordFacade.createChannel.mockResolvedValue(expected)

      // Act
      const result = await controller.createChannel(dto, req)

      // Assert
      expect(result).toBe(expected)
      expect(discordFacade.createChannel).toHaveBeenCalledWith('g1', 'ch', {
        type: undefined,
        parent: undefined,
        topic: undefined,
        permissions: undefined
      })
    })

    it('想定外のエラーは 500 の HttpException にラップする', async () => {
      // Arrange
      const dto = { guildId: 'g1', name: 'ch' } as any
      discordFacade.verifyGuildAccess.mockResolvedValue(true)
      discordFacade.createChannel.mockRejectedValue(new Error('boom'))

      // Act & Assert
      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
    })
  })

  describe('getBotStatus', () => {
    it('成功時は health/client 情報を集約した status を返す', async () => {
      // Arrange（旧 deprecated ラッパーの getBotStatus と同じ集約結果になることを固定）
      discordFacade.getHealthStatus.mockReturnValue({
        services: { client: true, interactions: true, guilds: true, channels: true }
      })
      discordFacade.getClient.mockReturnValue({
        guilds: { cache: { size: 1 } },
        users: { cache: { size: 2 } },
        ws: { ping: 30 },
        uptime: 100
      })

      // Act
      const result = await controller.getBotStatus()

      // Assert
      expect(result).toEqual({ online: true, guilds: 1, users: 2, ping: 30, uptime: 100 })
    })

    it('エラー時は 500 の HttpException を投げる', async () => {
      // Arrange
      discordFacade.getHealthStatus.mockImplementation(() => {
        throw new Error('boom')
      })

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
      expect(discordFacade.verifyGuildAccess).not.toHaveBeenCalled()
    })

    it('ギルドアクセス権限が無い場合は 403 の HttpException を投げる', async () => {
      // Arrange
      discordFacade.verifyGuildAccess.mockResolvedValue(false)

      // Act & Assert
      await expect(controller.getGuildInfo('g1', req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordFacade.getGuildInfo).not.toHaveBeenCalled()
    })

    it('成功時は guildInfo をそのまま返す', async () => {
      // Arrange
      const guildInfo = { id: 'g1', name: 'Guild', memberCount: 5, channels: [] }
      discordFacade.verifyGuildAccess.mockResolvedValue(true)
      discordFacade.getGuildInfo.mockResolvedValue(guildInfo)

      // Act
      const result = await controller.getGuildInfo('g1', req)

      // Assert
      expect(result).toBe(guildInfo)
      expect(discordFacade.getGuildInfo).toHaveBeenCalledWith('g1')
    })

    it('「ギルドが見つかりません」を含むエラーは NotFoundException に変換する', async () => {
      // Arrange
      discordFacade.verifyGuildAccess.mockResolvedValue(true)
      discordFacade.getGuildInfo.mockRejectedValue(new Error('ギルドが見つかりません: g1'))

      // Act & Assert
      await expect(controller.getGuildInfo('g1', req)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('その他のエラーは 500 の HttpException にラップする', async () => {
      // Arrange
      discordFacade.verifyGuildAccess.mockResolvedValue(true)
      discordFacade.getGuildInfo.mockRejectedValue(new Error('boom'))

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
      expect(discordFacade.verifyChannelAccess).not.toHaveBeenCalled()
    })

    it('チャンネルアクセス権限が無い場合は 403 の HttpException を投げる', async () => {
      // Arrange
      discordFacade.verifyChannelAccess.mockResolvedValue(false)

      // Act & Assert
      await expect(controller.getChannelInfo('c1', req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordFacade.getChannelInfo).not.toHaveBeenCalled()
    })

    it('成功時は channelInfo をそのまま返す', async () => {
      // Arrange
      const channelInfo = { id: 'c1', name: 'general', type: 'text', guild: { id: 'g1', name: 'Guild' } }
      discordFacade.verifyChannelAccess.mockResolvedValue(true)
      discordFacade.getChannelInfo.mockResolvedValue(channelInfo)

      // Act
      const result = await controller.getChannelInfo('c1', req)

      // Assert
      expect(result).toBe(channelInfo)
      expect(discordFacade.getChannelInfo).toHaveBeenCalledWith('c1')
    })

    it('「チャンネルが見つかりません」を含むエラーは NotFoundException に変換する', async () => {
      // Arrange
      discordFacade.verifyChannelAccess.mockResolvedValue(true)
      discordFacade.getChannelInfo.mockRejectedValue(new Error('チャンネルが見つかりません: c1'))

      // Act & Assert
      await expect(controller.getChannelInfo('c1', req)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('facade が null を返した場合は 500 の HttpException にラップする（旧ラッパーの Channel not found 相当）', async () => {
      // Arrange
      discordFacade.verifyChannelAccess.mockResolvedValue(true)
      discordFacade.getChannelInfo.mockResolvedValue(null)

      // Act & Assert
      await expect(controller.getChannelInfo('c1', req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
    })

    it('その他のエラーは 500 の HttpException にラップする', async () => {
      // Arrange
      discordFacade.verifyChannelAccess.mockResolvedValue(true)
      discordFacade.getChannelInfo.mockRejectedValue(new Error('boom'))

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
      expect(discordFacade.verifyGuildAccess).not.toHaveBeenCalled()
    })

    it('ギルドアクセス権限が無い場合は 403 の HttpException を投げる', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue({ characterName: 'Alice' })
      discordFacade.verifyGuildAccess.mockResolvedValue(false)

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it('キャラクターカテゴリが見つからない場合は NotFoundException を投げる', async () => {
      // Arrange（type が '4' でないため対象外）
      characterService.findOne.mockResolvedValue({ characterName: 'Alice' })
      discordFacade.verifyGuildAccess.mockResolvedValue(true)
      discordFacade.getGuildInfo.mockResolvedValue({
        ...guildInfoWithCategory,
        channels: [{ id: 'txt-1', name: 'character-talk', type: '0' }]
      })

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toBeInstanceOf(NotFoundException)
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it('成功時はチャンネル作成・キャラクター更新を行い、自動処理メッセージを返す', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue({ characterName: 'Hero Name!' })
      discordFacade.verifyGuildAccess.mockResolvedValue(true)
      discordFacade.getGuildInfo.mockResolvedValue(guildInfoWithCategory)
      discordFacade.createChannel.mockResolvedValue({ success: true, channelId: 'new-ch' })

      // Act
      const result = await controller.postCharacter(dto, req)

      // Assert: 戻り値
      expect(result).toEqual({ success: true, messageId: 'auto-handled-by-file-based-handlers' })

      // Assert: チャンネル作成は名前を正規化しカテゴリ配下に作る
      expect(discordFacade.createChannel).toHaveBeenCalledWith('g1', 'hero-name', {
        type: CreateChannelType.TEXT,
        parent: 'cat-1',
        topic: 'Hero Name!のキャラクター情報'
      })

      // Assert: 作成したチャンネルIDでキャラクターを更新する
      expect(characterService.update).toHaveBeenCalledWith('char-1', { discordChannelId: 'new-ch' })
    })

    it('チャンネル作成が失敗した場合は 500 の HttpException を投げる', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue({ characterName: 'Alice' })
      discordFacade.verifyGuildAccess.mockResolvedValue(true)
      discordFacade.getGuildInfo.mockResolvedValue(guildInfoWithCategory)
      discordFacade.createChannel.mockResolvedValue({ success: false, error: '作成失敗' })

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
      discordFacade.verifyGuildAccess.mockResolvedValue(true)
      discordFacade.getGuildInfo.mockResolvedValue(guildInfoWithCategory)
      discordFacade.createChannel.mockResolvedValue({ success: true, channelId: 'new-ch' })
      characterService.update.mockRejectedValue(new Error('DB 更新失敗'))

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
      expect(characterService.update).toHaveBeenCalledWith('char-1', { discordChannelId: 'new-ch' })
    })
  })
})
