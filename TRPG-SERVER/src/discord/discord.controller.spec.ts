import { Test } from '@nestjs/testing'
import { HttpException, HttpStatus, BadRequestException, NotFoundException, Logger } from '@nestjs/common'
import { validate } from 'class-validator'
import { DiscordController } from './discord.controller'
import { DiscordFacadeService } from './discord-facade.service'
import { CharacterService } from '../domains/character/character.service'
import { JwtAuthGuard } from '../domains/auth/guards/jwt-auth.guard'
import { CreateChannelDto, CreateChannelType } from './dto/create-channel.dto'
import { CharacterEmbedManagerService } from './features/characterEdit/services/character-embed-manager.service'
import { ChannelDetectionService } from './features/characterEdit/services/channel-detection.service'

// DiscordController の責務は HTTP の受付・認可確認・入力検証・委譲・エラー変換。
// 副作用境界（DiscordFacadeService / CharacterService / CharacterEmbedManagerService）はモックし、各エンドポイントが
// 「正しく委譲して結果を返すか」「分岐ごとに正しい例外へ変換するか」を検証する。
// ビジネスロジックは持たないため、内部実装ではなく公開挙動だけを見る。
type DiscordFacadeServiceMock = {
  verifyChannelAccess: jest.Mock
  verifyGuildAccess: jest.Mock
  verifyGuildManagePermission: jest.Mock
  sendMessage: jest.Mock
  createChannel: jest.Mock
  getHealthStatus: jest.Mock
  getClient: jest.Mock
  getGuildInfo: jest.Mock
  getChannelInfo: jest.Mock
}

type CharacterServiceMock = {
  findOneForOwner: jest.Mock
  updateForOwner: jest.Mock
}

type CharacterEmbedManagerServiceMock = {
  createSectionedEmbeds: jest.Mock
}

type ChannelDetectionServiceMock = {
  markBotManagedChannel: jest.Mock
}

describe('DiscordController', () => {
  let discordFacade: DiscordFacadeServiceMock
  let characterService: CharacterServiceMock
  let characterEmbedManager: CharacterEmbedManagerServiceMock
  let channelDetectionService: ChannelDetectionServiceMock
  let controller: DiscordController
  let warnSpy: jest.SpyInstance
  let errorSpy: jest.SpyInstance

  // req.user.discordUserId だけを参照するため、最小の認証済みリクエストを渡す
  const req = { user: { discordUserId: 'duser-1', id: 'u1', username: 'tester' } } as any

  // facade.verifyGuildManagePermission の判別可能な結果（boolean へ潰さない契約）
  const permissionGranted = { hasPermission: true } as const
  const permissionDenied = {
    hasPermission: false,
    denial: 'permission-denied',
    reason: 'User lacks permission to manage channels'
  } as const

  beforeEach(async () => {
    discordFacade = {
      verifyChannelAccess: jest.fn(),
      verifyGuildAccess: jest.fn(),
      verifyGuildManagePermission: jest.fn(),
      sendMessage: jest.fn(),
      createChannel: jest.fn(),
      getHealthStatus: jest.fn(),
      getClient: jest.fn(),
      getGuildInfo: jest.fn(),
      getChannelInfo: jest.fn()
    }
    characterService = {
      findOneForOwner: jest.fn(),
      updateForOwner: jest.fn()
    }
    characterEmbedManager = {
      createSectionedEmbeds: jest.fn()
    }
    channelDetectionService = {
      markBotManagedChannel: jest.fn()
    }

    // ログ出力はテスト出力を汚すだけなので抑制する（warn/error はログ方針の検証にも使う）
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    const moduleRef = await Test.createTestingModule({
      controllers: [DiscordController],
      providers: [
        { provide: DiscordFacadeService, useValue: discordFacade },
        { provide: CharacterService, useValue: characterService },
        { provide: CharacterEmbedManagerService, useValue: characterEmbedManager },
        { provide: ChannelDetectionService, useValue: channelDetectionService }
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
    it('content・embed・embeds がすべて無い場合は BadRequestException を投げる', async () => {
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

    it('単数の embed は embeds に正規化して委譲する', async () => {
      const embed = { title: 'character', color: 0x0099ff }
      const dto = { channelId: 'c1', embed } as any
      const expected = { success: true, messageId: 'm1' }
      discordFacade.verifyChannelAccess.mockResolvedValue(true)
      discordFacade.sendMessage.mockResolvedValue(expected)

      const result = await controller.sendMessage(dto, req)

      expect(result).toBe(expected)
      expect(discordFacade.sendMessage).toHaveBeenCalledWith('c1', '', {
        embeds: [embed],
        components: undefined
      })
    })

    it('複数の embeds だけでも送信できる', async () => {
      const embeds = [{ title: 'first' }, { title: 'second' }]
      const dto = { channelId: 'c1', embeds } as any
      discordFacade.verifyChannelAccess.mockResolvedValue(true)
      discordFacade.sendMessage.mockResolvedValue({ success: true, messageId: 'm1' })

      await expect(controller.sendMessage(dto, req)).resolves.toEqual({ success: true, messageId: 'm1' })
      expect(discordFacade.sendMessage).toHaveBeenCalledWith('c1', '', {
        embeds,
        components: undefined
      })
    })

    it('単数 embed と複数 embeds の併用時は単数を先頭にして統合する', async () => {
      const embed = { title: 'single' }
      const embeds = [{ title: 'array' }]
      const dto = { channelId: 'c1', embed, embeds } as any
      discordFacade.verifyChannelAccess.mockResolvedValue(true)
      discordFacade.sendMessage.mockResolvedValue({ success: true, messageId: 'm1' })

      await controller.sendMessage(dto, req)

      expect(discordFacade.sendMessage).toHaveBeenCalledWith('c1', '', {
        embeds: [embed, ...embeds],
        components: undefined
      })
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
    it('DTO デコレータも共有検証を使い null の permissions を拒否する', async () => {
      const dto = Object.assign(new CreateChannelDto(), {
        guildId: 'g1',
        name: 'ch',
        permissions: null
      })

      const errors = await validate(dto)

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'permissions',
            constraints: expect.objectContaining({
              isValidChannelPermissionOverwrites: expect.stringContaining('permissions は配列で指定してください')
            })
          })
        ])
      )
    })

    it('thread は通常チャンネル作成として扱わず 400 を返す', async () => {
      const dto = { guildId: 'g1', name: 'thread', type: CreateChannelType.THREAD } as any

      await expect(controller.createChannel(dto, req)).rejects.toBeInstanceOf(BadRequestException)
      expect(discordFacade.verifyGuildManagePermission).not.toHaveBeenCalled()
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it('ギルド管理権限が無い場合は 403 の HttpException を投げ warn で記録する', async () => {
      // Arrange
      const dto = { guildId: 'g1', name: 'ch' } as any
      discordFacade.verifyGuildManagePermission.mockResolvedValue(permissionDenied)

      // Act & Assert
      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordFacade.verifyGuildManagePermission).toHaveBeenCalledWith('g1', 'duser-1', undefined, undefined)
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
      // 既知の拒否（4xx）は warn で記録し error 扱いしない
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('チャンネル作成拒否'))
      expect(errorSpy).not.toHaveBeenCalled()
    })

    // fail-closed: 成功述語は result?.hasPermission === true のみ。契約外の戻り値は全て 403 へ倒す
    it.each([
      ['旧 boolean 契約の true', true],
      ['boolean false', false],
      ['undefined', undefined],
      ['空オブジェクト', {}]
    ])('権限検査が契約外の %s を返した場合は 403 とし createChannel を呼ばない', async (_label, verifyResult) => {
      const dto = { guildId: 'g1', name: 'ch' } as any
      discordFacade.verifyGuildManagePermission.mockResolvedValue(verifyResult)

      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it('parent カテゴリで ManageChannels が拒否された場合は 403 を返す', async () => {
      const dto = { guildId: 'g1', name: 'ch', parentId: '123456789012345678' } as any
      discordFacade.verifyGuildManagePermission.mockResolvedValue({
        hasPermission: false,
        denial: 'permission-denied',
        reason: 'User lacks permission to manage channels in parent category'
      })

      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordFacade.verifyGuildManagePermission).toHaveBeenCalledWith(
        'g1',
        'duser-1',
        '123456789012345678',
        undefined
      )
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it('parent が見つからない分類は 400 を返す', async () => {
      const dto = { guildId: 'g1', name: 'ch', parentId: '123456789012345678' } as any
      discordFacade.verifyGuildManagePermission.mockResolvedValue({
        hasPermission: false,
        denial: 'parent-not-found',
        reason: 'Parent category not found'
      })

      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST })
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('チャンネル作成拒否: status=400, reason=指定された親カテゴリが見つかりません')
      )
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('parent がカテゴリでない分類は 400 を返す', async () => {
      const dto = { guildId: 'g1', name: 'ch', parentId: '123456789012345678' } as any
      discordFacade.verifyGuildManagePermission.mockResolvedValue({
        hasPermission: false,
        denial: 'parent-not-category',
        reason: 'Parent channel is not a category'
      })

      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST })
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it('parentId が Snowflake 形式でない場合は権限検査前に 400 で拒否する', async () => {
      const dto = { guildId: 'g1', name: 'ch', parentId: 'not-a-snowflake' } as any

      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST })
      expect(discordFacade.verifyGuildManagePermission).not.toHaveBeenCalled()
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it('権限検査の基盤障害は認可拒否へ変換せず 500 を返し error で記録する', async () => {
      // Arrange
      const dto = { guildId: 'g1', name: 'ch' } as any
      discordFacade.verifyGuildManagePermission.mockRejectedValue(new Error('boom'))

      // Act & Assert
      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
      expect(discordFacade.verifyGuildManagePermission).toHaveBeenCalledWith('g1', 'duser-1', undefined, undefined)
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
      // 予期しない基盤障害は warn ではなく error で記録する
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('チャンネル作成エラー'), expect.anything())
    })

    it('許可済みの permission overwrite はそのまま作成処理へ渡す', async () => {
      const permissions = [
        {
          id: '123456789012345678',
          allow: ['ViewChannel', 'SendMessages'],
          deny: ['CreatePublicThreads']
        }
      ]
      const dto = { guildId: 'g1', name: 'ch', permissions } as any
      const expected = { success: true, channelId: 'c1' }
      discordFacade.verifyGuildManagePermission.mockResolvedValue(permissionGranted)
      discordFacade.createChannel.mockResolvedValue(expected)

      const result = await controller.createChannel(dto, req)

      expect(result).toBe(expected)
      expect(discordFacade.createChannel).toHaveBeenCalledWith('g1', 'ch', {
        type: undefined,
        parent: undefined,
        topic: undefined,
        permissions
      })
    })

    it('非空 overwrite は allow/deny 全キーの和集合（重複除去）を権限検査へ渡す', async () => {
      const dto = {
        guildId: 'g1',
        name: 'ch',
        permissions: [
          { id: '123456789012345678', allow: ['ViewChannel', 'SendMessages'], deny: ['CreatePublicThreads'] },
          { id: '876543210987654321', deny: ['SendMessages'] } // allow 側と重複するキー
        ]
      } as any
      discordFacade.verifyGuildManagePermission.mockResolvedValue(permissionGranted)
      discordFacade.createChannel.mockResolvedValue({ success: true, channelId: 'c1' })

      await controller.createChannel(dto, req)

      expect(discordFacade.verifyGuildManagePermission).toHaveBeenCalledWith('g1', 'duser-1', undefined, [
        'ViewChannel',
        'SendMessages',
        'CreatePublicThreads'
      ])
    })

    it('permissions が空配列なら overwrite 無指定扱いで要求キーを渡さない', async () => {
      const dto = { guildId: 'g1', name: 'ch', permissions: [] } as any
      discordFacade.verifyGuildManagePermission.mockResolvedValue(permissionGranted)
      discordFacade.createChannel.mockResolvedValue({ success: true, channelId: 'c1' })

      await controller.createChannel(dto, req)

      expect(discordFacade.verifyGuildManagePermission).toHaveBeenCalledWith('g1', 'duser-1', undefined, undefined)
    })

    it('falsifier: 非空 overwrite の caller-holds 拒否（ManageRoles 不足等）は 403 とし createChannel を呼ばない', async () => {
      // deny キーはグローバル discord.js モックの Flags に実在するものを使う（whitelist は Flags から導出されるため）
      const dto = {
        guildId: 'g1',
        name: 'ch',
        permissions: [{ id: '123456789012345678', deny: ['ManageThreads'] }]
      } as any
      discordFacade.verifyGuildManagePermission.mockResolvedValue({
        hasPermission: false,
        denial: 'permission-denied',
        reason: 'User lacks permission to manage roles'
      })

      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordFacade.verifyGuildManagePermission).toHaveBeenCalledWith('g1', 'duser-1', undefined, [
        'ManageThreads'
      ])
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it("overwrite の type: 'role' / 'member' は OverwriteType の実値へ正規化して渡す", async () => {
      const dto = {
        guildId: 'g1',
        name: 'ch',
        permissions: [
          { id: '123456789012345678', type: 'role', deny: ['SendMessages'] },
          { id: '876543210987654321', type: 'member', allow: ['ViewChannel'] }
        ]
      } as any
      discordFacade.verifyGuildManagePermission.mockResolvedValue(permissionGranted)
      discordFacade.createChannel.mockResolvedValue({ success: true, channelId: 'c1' })

      await controller.createChannel(dto, req)

      expect(discordFacade.createChannel).toHaveBeenCalledWith('g1', 'ch', {
        type: undefined,
        parent: undefined,
        topic: undefined,
        permissions: [
          { id: '123456789012345678', type: 0, deny: ['SendMessages'] },
          { id: '876543210987654321', type: 1, allow: ['ViewChannel'] }
        ]
      })
    })

    it('overwrite の type が不正な場合は 400 で拒否する', async () => {
      const dto = {
        guildId: 'g1',
        name: 'ch',
        permissions: [{ id: '123456789012345678', type: 'user' }]
      } as any

      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST })
      expect(discordFacade.verifyGuildManagePermission).not.toHaveBeenCalled()
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it('管理系権限が permission overwrite に含まれる場合は 400 で拒否する', async () => {
      const dto = {
        guildId: 'g1',
        name: 'ch',
        permissions: [{ id: '123456789012345678', allow: ['ViewChannel', 'ManageChannels'] }]
      } as any

      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST })
      expect(discordFacade.verifyGuildManagePermission).not.toHaveBeenCalled()
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it('permission overwrite の id が Snowflake 形式でない場合は 400 で拒否する', async () => {
      const dto = {
        guildId: 'g1',
        name: 'ch',
        permissions: [{ id: 'not-a-snowflake', allow: ['ViewChannel'] }]
      } as any

      await expect(controller.createChannel(dto, req)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST })
      expect(discordFacade.verifyGuildManagePermission).not.toHaveBeenCalled()
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it('成功時は discordFacade.createChannel の戻り値を返す', async () => {
      // Arrange
      const dto = { guildId: 'g1', name: 'ch' } as any
      const expected = { success: true, channelId: 'c1' }
      discordFacade.verifyGuildManagePermission.mockResolvedValue(permissionGranted)
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
      discordFacade.verifyGuildManagePermission.mockResolvedValue(permissionGranted)
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

    // getGuildInfo() の実形式である GuildCategory を持つギルド情報
    const guildInfoWithCategory = {
      id: 'g1',
      name: 'Guild',
      memberCount: 5,
      channels: [{ id: 'cat-1', name: 'Character', type: 'GuildCategory' }]
    }

    it('キャラクターが見つからない場合は NotFoundException を投げる', async () => {
      // Arrange
      characterService.findOneForOwner.mockResolvedValue(null)

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toBeInstanceOf(NotFoundException)
      expect(characterService.findOneForOwner).toHaveBeenCalledWith('char-1', 'duser-1')
      expect(discordFacade.verifyGuildManagePermission).not.toHaveBeenCalled()
    })

    it('ManageChannels 権限が無い場合は 403 の HttpException を投げる', async () => {
      // Arrange
      characterService.findOneForOwner.mockResolvedValue({ characterName: 'Alice' })
      discordFacade.verifyGuildManagePermission.mockResolvedValue(permissionDenied)

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordFacade.verifyGuildManagePermission).toHaveBeenCalledWith('g1', 'duser-1', undefined, undefined)
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    // fail-closed: createChannel と同じく、契約外の権限検査結果では後続副作用へ進まない
    it.each([
      ['旧 boolean 契約の true', true],
      ['boolean false', false],
      ['undefined', undefined],
      ['空オブジェクト', {}]
    ])('権限検査が契約外の %s を返した場合は 403 とし後続副作用を実行しない', async (_label, verifyResult) => {
      characterService.findOneForOwner.mockResolvedValue({ characterName: 'Alice' })
      discordFacade.verifyGuildManagePermission.mockResolvedValue(verifyResult)

      await expect(controller.postCharacter(dto, req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
      expect(characterService.updateForOwner).not.toHaveBeenCalled()
      expect(discordFacade.sendMessage).not.toHaveBeenCalled()
    })

    it('targetCategory 特定後のカテゴリ権限検査が拒否された場合は 403 を返し createChannel を呼ばない', async () => {
      // Arrange: 基底権限は許可、カテゴリ overwrite で拒否
      characterService.findOneForOwner.mockResolvedValue({ characterName: 'Alice' })
      discordFacade.verifyGuildManagePermission.mockResolvedValueOnce(permissionGranted).mockResolvedValueOnce({
        hasPermission: false,
        denial: 'permission-denied',
        reason: 'User lacks permission to manage channels in parent category'
      })
      discordFacade.getGuildInfo.mockResolvedValue(guildInfoWithCategory)

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN })
      expect(discordFacade.verifyGuildManagePermission).toHaveBeenNthCalledWith(2, 'g1', 'duser-1', 'cat-1', undefined)
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
      expect(characterService.updateForOwner).not.toHaveBeenCalled()
    })

    it('管理権限検査の基盤障害は認可拒否へ変換せず 500 を返す', async () => {
      // Arrange
      characterService.findOneForOwner.mockResolvedValue({ characterName: 'Alice' })
      discordFacade.verifyGuildManagePermission.mockRejectedValue(new Error('boom'))
      // （基底検査で throw するため getGuildInfo 以降には到達しない）

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
      expect(discordFacade.verifyGuildManagePermission).toHaveBeenCalledWith('g1', 'duser-1', undefined, undefined)
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it('キャラクターカテゴリが見つからない場合は NotFoundException を投げる', async () => {
      // Arrange（実供給形式のテキストチャンネルは対象外）
      characterService.findOneForOwner.mockResolvedValue({ characterName: 'Alice' })
      discordFacade.verifyGuildManagePermission.mockResolvedValue(permissionGranted)
      discordFacade.getGuildInfo.mockResolvedValue({
        ...guildInfoWithCategory,
        channels: [{ id: 'txt-1', name: 'character-talk', type: 'GuildText' }]
      })

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toBeInstanceOf(NotFoundException)
      expect(discordFacade.createChannel).not.toHaveBeenCalled()
    })

    it('成功時は既存部品でEmbedを投稿し、実際のmessageIdを返す', async () => {
      // Arrange
      const character = { characterId: 'char-1', characterName: 'Hero Name!' }
      const updatedCharacter = { ...character, discordChannelId: 'new-ch' }
      const embeds = [{ title: 'Hero Name!' }]
      const components = [{ type: 1 }]
      characterService.findOneForOwner.mockResolvedValue(character)
      discordFacade.verifyGuildManagePermission.mockResolvedValue(permissionGranted)
      discordFacade.getGuildInfo.mockResolvedValue(guildInfoWithCategory)
      discordFacade.createChannel.mockResolvedValue({ success: true, channelId: 'new-ch' })
      characterService.updateForOwner.mockResolvedValue(updatedCharacter)
      characterEmbedManager.createSectionedEmbeds.mockResolvedValue({ embeds, components })
      discordFacade.sendMessage.mockResolvedValue({ success: true, messageId: 'message-1' })

      // Act
      const result = await controller.postCharacter(dto, req)

      // Assert: 戻り値
      expect(result).toEqual({ success: true, messageId: 'message-1' })

      // Assert: 基底権限に加え、targetCategory 特定後にカテゴリ overwrite でも権限を検査する
      expect(discordFacade.verifyGuildManagePermission).toHaveBeenNthCalledWith(
        1,
        'g1',
        'duser-1',
        undefined,
        undefined
      )
      expect(discordFacade.verifyGuildManagePermission).toHaveBeenNthCalledWith(2, 'g1', 'duser-1', 'cat-1', undefined)

      // Assert: チャンネル作成は名前を正規化しカテゴリ配下に作る
      expect(discordFacade.createChannel).toHaveBeenCalledWith('g1', 'hero-name', {
        type: CreateChannelType.TEXT,
        parent: 'cat-1',
        topic: 'Hero Name!のキャラクター情報'
      })

      // Assert: 作成したチャンネルIDでキャラクターを更新する
      expect(characterService.updateForOwner).toHaveBeenCalledWith('char-1', 'duser-1', {
        discordChannelId: 'new-ch'
      })
      expect(channelDetectionService.markBotManagedChannel).toHaveBeenCalledWith('new-ch')
      expect(channelDetectionService.markBotManagedChannel.mock.invocationCallOrder[0]).toBeLessThan(
        characterService.updateForOwner.mock.invocationCallOrder[0]
      )

      // Assert: 完了イベントを経由せず、既存のEmbed/componentsを作成チャンネルへ直接投稿する
      expect(characterEmbedManager.createSectionedEmbeds).toHaveBeenCalledWith(updatedCharacter)
      expect(discordFacade.sendMessage).toHaveBeenCalledWith('new-ch', '', {
        embeds,
        components
      })
    })

    it('Embed投稿が失敗した場合は成功応答を返さず500を投げる', async () => {
      const character = { characterId: 'char-1', characterName: 'Alice' }
      const updatedCharacter = { ...character, discordChannelId: 'new-ch' }
      characterService.findOneForOwner.mockResolvedValue(character)
      discordFacade.verifyGuildManagePermission.mockResolvedValue(permissionGranted)
      discordFacade.getGuildInfo.mockResolvedValue(guildInfoWithCategory)
      discordFacade.createChannel.mockResolvedValue({ success: true, channelId: 'new-ch' })
      characterService.updateForOwner.mockResolvedValue(updatedCharacter)
      characterEmbedManager.createSectionedEmbeds.mockResolvedValue({
        embeds: [{ title: 'Alice' }],
        components: []
      })
      discordFacade.sendMessage.mockResolvedValue({ success: false, error: '投稿失敗' })

      await expect(controller.postCharacter(dto, req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
    })

    it('チャンネル作成が失敗した場合は 500 の HttpException を投げる', async () => {
      // Arrange
      characterService.findOneForOwner.mockResolvedValue({ characterName: 'Alice' })
      discordFacade.verifyGuildManagePermission.mockResolvedValue(permissionGranted)
      discordFacade.getGuildInfo.mockResolvedValue(guildInfoWithCategory)
      discordFacade.createChannel.mockResolvedValue({ success: false, error: '作成失敗' })

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
      // チャンネル作成失敗時は discordChannelId を永続化しない（undefined 書き込みによるデータ破損を防ぐ）
      expect(characterService.updateForOwner).not.toHaveBeenCalled()
    })

    it('キャラクター更新が失敗した場合は 500 を投げる（永続化を await し成功応答前にエラーを伝播）', async () => {
      // Arrange: チャンネル作成は成功するが DB 更新が失敗する
      characterService.findOneForOwner.mockResolvedValue({ characterName: 'Alice' })
      discordFacade.verifyGuildManagePermission.mockResolvedValue(permissionGranted)
      discordFacade.getGuildInfo.mockResolvedValue(guildInfoWithCategory)
      discordFacade.createChannel.mockResolvedValue({ success: true, channelId: 'new-ch' })
      characterService.updateForOwner.mockRejectedValue(new Error('DB 更新失敗'))

      // Act & Assert
      await expect(controller.postCharacter(dto, req)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
      expect(characterService.updateForOwner).toHaveBeenCalledWith('char-1', 'duser-1', {
        discordChannelId: 'new-ch'
      })
    })
  })
})
