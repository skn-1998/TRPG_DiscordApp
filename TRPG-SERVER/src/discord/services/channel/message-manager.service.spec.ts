import { Test } from '@nestjs/testing'
import { HttpException } from '@nestjs/common'
import { MessageManagerService } from './message-manager.service'

/**
 * characterization（特性化）テスト
 *
 * MessageManagerService は DI 注入なしの薄いラッパ。副作用の境界
 * （`client.channels.fetch` / `channel.send` / `messages.fetch` / `message.edit` 等）
 * だけを最小スタブでモックし、現挙動を固定する。
 *
 * 重要な現挙動の注意点:
 * - `ErrorHandler.handleServiceError` は実装上「常に throw する」（HttpException を再スロー）。
 *   ErrorHandler はモックしない素直な現挙動として、各メソッドの「例外→ErrorHandler→再スロー」は
 *   `.rejects.toThrow(HttpException)` で検証する。
 * - 非 text-based チャンネルでは `Error(... is not text-based)` を投げるが、
 *   その Error は catch で ErrorHandler に渡され HttpException に変換されるため、
 *   呼び出し側に届くのは HttpException である。
 */
describe('MessageManagerService (characterization)', () => {
  let service: MessageManagerService

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [MessageManagerService]
    }).compile()

    service = moduleRef.get(MessageManagerService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // --- 共通スタブビルダー ----------------------------------------------------
  /** isTextBased が true を返す TextChannel 風スタブ */
  const makeTextChannel = (over: Record<string, unknown> = {}) => ({
    isTextBased: jest.fn().mockReturnValue(true),
    send: jest.fn(),
    bulkDelete: jest.fn(),
    messages: { fetch: jest.fn() },
    ...over
  })

  /** isTextBased が false を返す非テキストチャンネル風スタブ */
  const makeNonTextChannel = () => ({
    isTextBased: jest.fn().mockReturnValue(false)
  })

  /** channels.fetch が指定 channel を返す client スタブ */
  const makeClient = (channel: unknown) => ({ channels: { fetch: jest.fn().mockResolvedValue(channel) } }) as never

  /** Discord Collection の最小スタブ（filter / map / forEach / size） */
  const makeCollection = (items: any[]) => {
    const filter = (fn: (m: any) => boolean) => makeCollection(items.filter(fn))
    return {
      size: items.length,
      filter,
      map: (fn: (m: any) => any) => items.map(fn),
      forEach: (fn: (m: any) => void) => items.forEach(fn)
    }
  }

  // --- sendMessage ----------------------------------------------------------
  describe('sendMessage', () => {
    it('text-based でないチャンネルでは例外を投げる（ErrorHandler 経由で HttpException）', async () => {
      // Arrange
      const client = makeClient(makeNonTextChannel())
      // Act & Assert
      await expect(service.sendMessage(client, 'ch', 'hi')).rejects.toThrow(HttpException)
    })

    it('content がある場合は messageOptions.content を組み立てて channel.send の戻りを返す', async () => {
      // Arrange
      const sent = { id: 'msg-1' }
      const channel = makeTextChannel({ send: jest.fn().mockResolvedValue(sent) })
      const client = makeClient(channel)

      // Act
      const result = await service.sendMessage(client, 'ch', 'hello')

      // Assert
      expect(result).toBe(sent)
      expect(channel.send).toHaveBeenCalledWith({ content: 'hello' })
    })

    it('embeds / components / files を指定すると messageOptions に条件付きで含める', async () => {
      // Arrange
      const sent = { id: 'msg-2' }
      const channel = makeTextChannel({ send: jest.fn().mockResolvedValue(sent) })
      const client = makeClient(channel)
      const embeds = [{ e: 1 }] as any
      const components = [{ c: 1 }] as any
      const files = [{ f: 1 }] as any

      // Act
      await service.sendMessage(client, 'ch', 'body', { embeds, components, files })

      // Assert
      expect(channel.send).toHaveBeenCalledWith({
        content: 'body',
        embeds,
        components,
        files
      })
    })

    it('content が空文字なら content は messageOptions に含めない', async () => {
      // Arrange
      const channel = makeTextChannel({ send: jest.fn().mockResolvedValue({ id: 'm' }) })
      const client = makeClient(channel)

      // Act
      await service.sendMessage(client, 'ch', '')

      // Assert
      expect(channel.send).toHaveBeenCalledWith({})
    })
  })

  // --- editMessage ----------------------------------------------------------
  describe('editMessage', () => {
    it('text-based でないチャンネルでは例外を投げる', async () => {
      const client = makeClient(makeNonTextChannel())
      await expect(service.editMessage(client, 'ch', 'm', 'x')).rejects.toThrow(HttpException)
    })

    it('messages.fetch で取得したメッセージを edit し、その戻りを返す', async () => {
      // Arrange
      const edited = { id: 'edited' }
      const message = { edit: jest.fn().mockResolvedValue(edited) }
      const channel = makeTextChannel({ messages: { fetch: jest.fn().mockResolvedValue(message) } })
      const client = makeClient(channel)

      // Act
      const result = await service.editMessage(client, 'ch', 'msg-1', 'new content')

      // Assert
      expect(channel.messages.fetch).toHaveBeenCalledWith('msg-1')
      expect(message.edit).toHaveBeenCalledWith({ content: 'new content' })
      expect(result).toBe(edited)
    })

    it('content が undefined の場合は editOptions.content に含めない', async () => {
      // Arrange
      const message = { edit: jest.fn().mockResolvedValue({}) }
      const channel = makeTextChannel({ messages: { fetch: jest.fn().mockResolvedValue(message) } })
      const client = makeClient(channel)
      const embeds = [{ e: 1 }] as any

      // Act
      await service.editMessage(client, 'ch', 'msg-1', undefined, { embeds })

      // Assert
      expect(message.edit).toHaveBeenCalledWith({ embeds })
    })

    it('content が空文字でも（undefined でないため）editOptions.content に含める', async () => {
      // Arrange
      const message = { edit: jest.fn().mockResolvedValue({}) }
      const channel = makeTextChannel({ messages: { fetch: jest.fn().mockResolvedValue(message) } })
      const client = makeClient(channel)

      // Act
      await service.editMessage(client, 'ch', 'msg-1', '')

      // Assert
      expect(message.edit).toHaveBeenCalledWith({ content: '' })
    })
  })

  // --- deleteMessage --------------------------------------------------------
  describe('deleteMessage', () => {
    it('text-based でないチャンネルでは例外を投げる', async () => {
      const client = makeClient(makeNonTextChannel())
      await expect(service.deleteMessage(client, 'ch', 'm')).rejects.toThrow(HttpException)
    })

    it('messages.fetch で取得したメッセージを delete する', async () => {
      // Arrange
      const message = { delete: jest.fn().mockResolvedValue(undefined) }
      const channel = makeTextChannel({ messages: { fetch: jest.fn().mockResolvedValue(message) } })
      const client = makeClient(channel)

      // Act
      await service.deleteMessage(client, 'ch', 'msg-1')

      // Assert
      expect(channel.messages.fetch).toHaveBeenCalledWith('msg-1')
      expect(message.delete).toHaveBeenCalledTimes(1)
    })
  })

  // --- deleteMessages（batch 分割が肝）-------------------------------------
  describe('deleteMessages', () => {
    it('text-based でないチャンネルでは例外を投げる', async () => {
      const client = makeClient(makeNonTextChannel())
      await expect(service.deleteMessages(client, 'ch', ['a'])).rejects.toThrow(HttpException)
    })

    it('messageIds が 1 件の場合は bulkDelete せず deleteMessage に個別委譲する', async () => {
      // Arrange
      const message = { delete: jest.fn().mockResolvedValue(undefined) }
      const channel = makeTextChannel({ messages: { fetch: jest.fn().mockResolvedValue(message) } })
      const client = makeClient(channel)

      // Act
      await service.deleteMessages(client, 'ch', ['only-one'])

      // Assert: 個別削除へ委譲され bulkDelete は呼ばれない
      expect(channel.messages.fetch).toHaveBeenCalledWith('only-one')
      expect(message.delete).toHaveBeenCalledTimes(1)
      expect(channel.bulkDelete).not.toHaveBeenCalled()
    })

    it('messageIds が 2〜100 件の場合は bulkDelete(batch, true) を 1 回呼ぶ', async () => {
      // Arrange
      const ids = Array.from({ length: 50 }, (_, i) => `id-${i}`)
      const channel = makeTextChannel({ bulkDelete: jest.fn().mockResolvedValue(undefined) })
      const client = makeClient(channel)

      // Act
      await service.deleteMessages(client, 'ch', ids)

      // Assert
      expect(channel.bulkDelete).toHaveBeenCalledTimes(1)
      expect(channel.bulkDelete).toHaveBeenCalledWith(ids, true)
    })

    it('messageIds がちょうど 100 件の場合は単一 batch で bulkDelete 1 回（境界）', async () => {
      // Arrange
      const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`)
      const channel = makeTextChannel({ bulkDelete: jest.fn().mockResolvedValue(undefined) })
      const client = makeClient(channel)

      // Act
      await service.deleteMessages(client, 'ch', ids)

      // Assert
      expect(channel.bulkDelete).toHaveBeenCalledTimes(1)
      expect(channel.bulkDelete).toHaveBeenCalledWith(ids, true)
    })

    it('messageIds が 150 件の場合は 100 件 + 50 件の bulkDelete を 2 回呼ぶ（境界・複数 batch）', async () => {
      // Arrange
      const ids = Array.from({ length: 150 }, (_, i) => `id-${i}`)
      const channel = makeTextChannel({ bulkDelete: jest.fn().mockResolvedValue(undefined) })
      const client = makeClient(channel)

      // Act
      await service.deleteMessages(client, 'ch', ids)

      // Assert
      expect(channel.bulkDelete).toHaveBeenCalledTimes(2)
      expect(channel.bulkDelete).toHaveBeenNthCalledWith(1, ids.slice(0, 100), true)
      expect(channel.bulkDelete).toHaveBeenNthCalledWith(2, ids.slice(100, 150), true)
    })

    it('messageIds が 101 件の場合は 100 件 bulkDelete + 残り 1 件は個別 deleteMessage（境界）', async () => {
      // Arrange
      const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`)
      const message = { delete: jest.fn().mockResolvedValue(undefined) }
      const channel = makeTextChannel({
        bulkDelete: jest.fn().mockResolvedValue(undefined),
        messages: { fetch: jest.fn().mockResolvedValue(message) }
      })
      const client = makeClient(channel)

      // Act
      await service.deleteMessages(client, 'ch', ids)

      // Assert: 1 つ目の batch(100件) は bulkDelete、2 つ目の batch(1件) は個別削除
      expect(channel.bulkDelete).toHaveBeenCalledTimes(1)
      expect(channel.bulkDelete).toHaveBeenCalledWith(ids.slice(0, 100), true)
      expect(channel.messages.fetch).toHaveBeenCalledWith('id-100')
      expect(message.delete).toHaveBeenCalledTimes(1)
    })
  })

  // --- deleteOldMessages ----------------------------------------------------
  describe('deleteOldMessages', () => {
    const FIXED_NOW = 1_000_000_000_000

    it('text-based でないチャンネルでは例外を投げる', async () => {
      const client = makeClient(makeNonTextChannel())
      await expect(service.deleteOldMessages(client, 'ch', 7)).rejects.toThrow(HttpException)
    })

    it('cutoff より古いメッセージが 0 件なら 0 を返す', async () => {
      // Arrange: createdTimestamp が全て cutoff 以降（新しい）
      jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)
      const collection = makeCollection([
        { id: 'm1', createdTimestamp: FIXED_NOW },
        { id: 'm2', createdTimestamp: FIXED_NOW + 1 }
      ])
      const channel = makeTextChannel({ messages: { fetch: jest.fn().mockResolvedValue(collection) } })
      const client = makeClient(channel)

      // Act
      const result = await service.deleteOldMessages(client, 'ch', 1)

      // Assert
      expect(result).toBe(0)
    })

    it('古いメッセージがあれば deleteMessages に委譲し、その件数を返す', async () => {
      // Arrange: 1 日より古いメッセージを 2 件、新しいものを 1 件用意
      jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)
      const oneDayMs = 24 * 60 * 60 * 1000
      const collection = makeCollection([
        { id: 'old-1', createdTimestamp: FIXED_NOW - oneDayMs - 1 },
        { id: 'old-2', createdTimestamp: FIXED_NOW - oneDayMs - 2 },
        { id: 'new-1', createdTimestamp: FIXED_NOW }
      ])
      const channel = makeTextChannel({
        messages: { fetch: jest.fn().mockResolvedValue(collection) },
        bulkDelete: jest.fn().mockResolvedValue(undefined)
      })
      const client = makeClient(channel)

      // Act
      const result = await service.deleteOldMessages(client, 'ch', 1)

      // Assert: 古い 2 件が削除対象として委譲され、件数 2 を返す
      expect(result).toBe(2)
      expect(channel.bulkDelete).toHaveBeenCalledWith(['old-1', 'old-2'], true)
    })
  })

  // --- getMessageHistory ----------------------------------------------------
  describe('getMessageHistory', () => {
    it('text-based でないチャンネルでは例外を投げる', async () => {
      const client = makeClient(makeNonTextChannel())
      await expect(service.getMessageHistory(client, 'ch')).rejects.toThrow(HttpException)
    })

    it('limit 未指定なら既定の 50 で fetch し、Collection を配列化して返す', async () => {
      // Arrange
      const items = [{ id: 'a' }, { id: 'b' }]
      const collection = makeCollection(items)
      const channel = makeTextChannel({ messages: { fetch: jest.fn().mockResolvedValue(collection) } })
      const client = makeClient(channel)

      // Act
      const result = await service.getMessageHistory(client, 'ch')

      // Assert
      expect(channel.messages.fetch).toHaveBeenCalledWith({ limit: 50 })
      expect(result).toEqual(items)
    })

    it('limit を指定するとその値で fetch する', async () => {
      // Arrange
      const channel = makeTextChannel({ messages: { fetch: jest.fn().mockResolvedValue(makeCollection([])) } })
      const client = makeClient(channel)

      // Act
      const result = await service.getMessageHistory(client, 'ch', { limit: 10 })

      // Assert
      expect(channel.messages.fetch).toHaveBeenCalledWith({ limit: 10 })
      expect(result).toEqual([])
    })
  })

  // --- addReaction ----------------------------------------------------------
  describe('addReaction', () => {
    it('text-based でないチャンネルでは例外を投げる', async () => {
      const client = makeClient(makeNonTextChannel())
      await expect(service.addReaction(client, 'ch', 'm', '👍')).rejects.toThrow(HttpException)
    })

    it('messages.fetch で取得したメッセージに react する', async () => {
      // Arrange
      const message = { react: jest.fn().mockResolvedValue(undefined) }
      const channel = makeTextChannel({ messages: { fetch: jest.fn().mockResolvedValue(message) } })
      const client = makeClient(channel)

      // Act
      await service.addReaction(client, 'ch', 'msg-1', '🎲')

      // Assert
      expect(channel.messages.fetch).toHaveBeenCalledWith('msg-1')
      expect(message.react).toHaveBeenCalledWith('🎲')
    })
  })
})
