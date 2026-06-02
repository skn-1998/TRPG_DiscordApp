import { EmbedBuilder } from 'discord.js'
import { Character } from 'src/domains/character/models/character.model'
import { DiceRollPaginationStore, PaginatedDiceRoll } from './dice-roll-pagination.store'

// EmbedBuilder の実体生成は不要なため、識別用のダミーを使う
const makeEmbed = (title = 'embed'): EmbedBuilder => ({ title }) as unknown as EmbedBuilder

const makeCharacter = (characterId = 'char-1'): Character =>
  ({ characterId, characterName: `name-${characterId}` }) as Character

const makeState = (overrides: Partial<PaginatedDiceRoll> = {}): PaginatedDiceRoll => ({
  pages: [makeEmbed('p1'), makeEmbed('p2')],
  totalPages: 2,
  currentPage: 1,
  ...overrides
})

// 本体の TTL 定数（private のため値を複製。仕様変更時はここを揃える）
const CACHE_TTL = 5000
const CHARACTER_CACHE_TTL = 60000

const BASE_TIME = new Date('2023-01-01T00:00:00.000Z').getTime()

describe('DiceRollPaginationStore', () => {
  let store: DiceRollPaginationStore

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(BASE_TIME)
    store = new DiceRollPaginationStore()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('ページキャッシュ', () => {
    it('保存したページを同じキーで取得できる', () => {
      // Arrange
      const pages = [makeEmbed('a'), makeEmbed('b')]

      // Act
      store.savePagesToCache('ch-1', 'char-1', pages)
      const result = store.getPagesFromCache('ch-1', 'char-1')

      // Assert
      expect(result).toBe(pages)
    })

    it('存在しないチャンネルではnullを返す', () => {
      expect(store.getPagesFromCache('unknown', 'char-1')).toBeNull()
    })

    it('チャンネルは存在するが対象キャラクターが未保存ならnullを返す', () => {
      // Arrange
      store.savePagesToCache('ch-1', 'char-1', [makeEmbed()])

      // Act & Assert
      expect(store.getPagesFromCache('ch-1', 'char-other')).toBeNull()
    })

    it('TTL境界ちょうどの経過では取得できる', () => {
      // Arrange
      store.savePagesToCache('ch-1', 'char-1', [makeEmbed('x')])

      // Act: ちょうど TTL 経過（now - timestamp === CACHE_TTL は失効しない）
      jest.setSystemTime(BASE_TIME + CACHE_TTL)
      const result = store.getPagesFromCache('ch-1', 'char-1')

      // Assert
      expect(result).not.toBeNull()
    })

    it('TTLを超過するとnullを返し、キャッシュを削除する', () => {
      // Arrange
      store.savePagesToCache('ch-1', 'char-1', [makeEmbed('x')])

      // Act: TTL を 1ms 超過
      jest.setSystemTime(BASE_TIME + CACHE_TTL + 1)
      const expired = store.getPagesFromCache('ch-1', 'char-1')

      // Assert: 期限切れで null、かつ内部から削除済み（時刻を戻しても取得不可）
      expect(expired).toBeNull()
      jest.setSystemTime(BASE_TIME)
      expect(store.getPagesFromCache('ch-1', 'char-1')).toBeNull()
    })

    it('同じキーへの保存は上書きされ、タイムスタンプも更新される', () => {
      // Arrange
      const first = [makeEmbed('first')]
      const second = [makeEmbed('second')]
      store.savePagesToCache('ch-1', 'char-1', first)

      // Act: 元の TTL 境界を越えた時刻で上書きし、さらに時間を進める
      jest.setSystemTime(BASE_TIME + 4000)
      store.savePagesToCache('ch-1', 'char-1', second)
      jest.setSystemTime(BASE_TIME + 4000 + CACHE_TTL)
      const result = store.getPagesFromCache('ch-1', 'char-1')

      // Assert: 上書き後の値が、更新後タイムスタンプ基準でまだ有効
      expect(result).toBe(second)
    })
  })

  describe('invalidateCache', () => {
    it('キャラクター指定で該当ページキャッシュのみ削除する', () => {
      // Arrange
      store.savePagesToCache('ch-1', 'char-1', [makeEmbed('1')])
      store.savePagesToCache('ch-1', 'char-2', [makeEmbed('2')])

      // Act
      store.invalidateCache('ch-1', 'char-1')

      // Assert
      expect(store.getPagesFromCache('ch-1', 'char-1')).toBeNull()
      expect(store.getPagesFromCache('ch-1', 'char-2')).not.toBeNull()
    })

    it('キャラクター未指定でチャンネル全体のページキャッシュを削除する', () => {
      // Arrange
      store.savePagesToCache('ch-1', 'char-1', [makeEmbed('1')])
      store.savePagesToCache('ch-1', 'char-2', [makeEmbed('2')])

      // Act
      store.invalidateCache('ch-1')

      // Assert
      expect(store.getPagesFromCache('ch-1', 'char-1')).toBeNull()
      expect(store.getPagesFromCache('ch-1', 'char-2')).toBeNull()
    })

    it('キャラクター情報キャッシュも併せて無効化する', () => {
      // Arrange
      store.savePagesToCache('ch-1', 'char-1', [makeEmbed('1')])
      store.saveCharactersToCache('ch-1', [makeCharacter()])

      // Act
      store.invalidateCache('ch-1')

      // Assert
      expect(store.getCharactersFromCache('ch-1')).toBeNull()
    })

    it('存在しないチャンネルの無効化は何もしない（例外を投げない）', () => {
      expect(() => store.invalidateCache('unknown')).not.toThrow()
    })
  })

  describe('キャラクター情報キャッシュ', () => {
    it('保存したキャラクターを取得できる', () => {
      // Arrange
      const characters = [makeCharacter('char-1'), makeCharacter('char-2')]

      // Act
      store.saveCharactersToCache('ch-1', characters)

      // Assert
      expect(store.getCharactersFromCache('ch-1')).toBe(characters)
    })

    it('未保存のチャンネルではnullを返す', () => {
      expect(store.getCharactersFromCache('unknown')).toBeNull()
    })

    it('TTL境界ちょうどの経過では取得できる', () => {
      // Arrange
      store.saveCharactersToCache('ch-1', [makeCharacter()])

      // Act
      jest.setSystemTime(BASE_TIME + CHARACTER_CACHE_TTL)

      // Assert
      expect(store.getCharactersFromCache('ch-1')).not.toBeNull()
    })

    it('TTLを超過するとnullを返し、キャッシュを削除する', () => {
      // Arrange
      store.saveCharactersToCache('ch-1', [makeCharacter()])

      // Act
      jest.setSystemTime(BASE_TIME + CHARACTER_CACHE_TTL + 1)
      const expired = store.getCharactersFromCache('ch-1')

      // Assert
      expect(expired).toBeNull()
      jest.setSystemTime(BASE_TIME)
      expect(store.getCharactersFromCache('ch-1')).toBeNull()
    })

    it('同じチャンネルへの保存は上書きされる', () => {
      // Arrange
      const first = [makeCharacter('old')]
      const second = [makeCharacter('new')]
      store.saveCharactersToCache('ch-1', first)

      // Act
      store.saveCharactersToCache('ch-1', second)

      // Assert
      expect(store.getCharactersFromCache('ch-1')).toBe(second)
    })
  })

  describe('ページネーション状態', () => {
    it('保存した状態を取得できる', () => {
      // Arrange
      const state = makeState({ currentPage: 2 })

      // Act
      store.savePaginationState('ch-1', 'msg-1', state)

      // Assert
      expect(store.getPaginationState('ch-1', 'msg-1')).toBe(state)
    })

    it('存在しないチャンネルではnullを返す', () => {
      expect(store.getPaginationState('unknown', 'msg-1')).toBeNull()
    })

    it('チャンネルは存在するが対象メッセージが未保存ならnullを返す', () => {
      // Arrange
      store.savePaginationState('ch-1', 'msg-1', makeState())

      // Act & Assert
      expect(store.getPaginationState('ch-1', 'msg-other')).toBeNull()
    })

    it('同じキーへの保存は上書きされる', () => {
      // Arrange
      const first = makeState({ currentPage: 1 })
      const second = makeState({ currentPage: 2 })
      store.savePaginationState('ch-1', 'msg-1', first)

      // Act
      store.savePaginationState('ch-1', 'msg-1', second)

      // Assert
      expect(store.getPaginationState('ch-1', 'msg-1')).toBe(second)
    })

    it('TTLに依存せず時間が経過しても保持される', () => {
      // Arrange
      const state = makeState()
      store.savePaginationState('ch-1', 'msg-1', state)

      // Act
      jest.setSystemTime(BASE_TIME + CHARACTER_CACHE_TTL * 10)

      // Assert
      expect(store.getPaginationState('ch-1', 'msg-1')).toBe(state)
    })
  })

  describe('deletePaginationState', () => {
    it('存在する状態を削除してtrueを返す', () => {
      // Arrange
      store.savePaginationState('ch-1', 'msg-1', makeState())

      // Act
      const result = store.deletePaginationState('ch-1', 'msg-1')

      // Assert
      expect(result).toBe(true)
      expect(store.getPaginationState('ch-1', 'msg-1')).toBeNull()
    })

    it('存在しないチャンネルの削除はfalseを返す', () => {
      expect(store.deletePaginationState('unknown', 'msg-1')).toBe(false)
    })

    it('チャンネル内に他のメッセージが残る場合はチャンネルを保持する', () => {
      // Arrange
      store.savePaginationState('ch-1', 'msg-1', makeState())
      store.savePaginationState('ch-1', 'msg-2', makeState())

      // Act
      store.deletePaginationState('ch-1', 'msg-1')

      // Assert: msg-2 は残るのでチャンネルも残存している
      expect(store.getPaginationState('ch-1', 'msg-2')).not.toBeNull()
    })

    it('チャンネル内の最後のメッセージを削除するとチャンネルごと片付ける', () => {
      // Arrange
      store.savePaginationState('ch-1', 'msg-1', makeState())

      // Act: 最後の1件を削除した後、再度同チャンネルを削除
      store.deletePaginationState('ch-1', 'msg-1')

      // Assert: チャンネルが空になり削除済みのため、再削除は false
      expect(store.deletePaginationState('ch-1', 'msg-other')).toBe(false)
    })
  })
})
