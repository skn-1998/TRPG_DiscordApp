import { DiceRollText } from '../models/dice-roll-text.model'
import { DiceRollTextRepository } from './dice-roll-text.repository'

// 本体の private 定数（仕様変更時はここを揃える）
const CACHE_TTL = 60000

const BASE_TIME = new Date('2023-01-01T00:00:00.000Z').getTime()

/**
 * DiceRollText の最小ファクトリ。テストで必要なフィールドのみ設定する。
 */
const makeText = (overrides: Partial<DiceRollText> = {}): DiceRollText =>
  ({
    textId: 'text-1',
    discordChannelId: 'ch-1',
    characterId: 'char-1',
    result: 10,
    diceRoll: '1d20',
    text: 'rolled'
  }) as DiceRollText

/**
 * Mongoose クエリチェーンのモック。
 * find().select().sort().limit().skip().lean().exec() のように
 * 各メソッドが自分自身を返し、exec() で結果を解決する。
 */
const makeQueryChain = (resolved: unknown) => {
  const chain: Record<string, jest.Mock> = {}
  for (const method of ['select', 'sort', 'limit', 'skip', 'lean']) {
    chain[method] = jest.fn(() => chain)
  }
  chain.exec = jest.fn().mockResolvedValue(resolved)
  return chain
}

/**
 * Mongoose Model のモックを生成する。
 * - new this.diceRollTextModel(entity) のコンストラクタ用途と
 * - 静的メソッド（find / findOne など）の用途を両立させる。
 */
type ModelMock = jest.Mock & Record<string, jest.Mock>

const makeModelMock = (saveResult: unknown = makeText()): { model: ModelMock; save: jest.Mock } => {
  const save = jest.fn().mockResolvedValue(saveResult)
  // コンストラクタ呼び出し（new model(entity)）で { save } を返す
  const model = jest.fn().mockImplementation(() => ({ save })) as ModelMock

  // 静的メソッド群
  model.findOne = jest.fn()
  model.find = jest.fn()
  model.findOneAndUpdate = jest.fn()
  model.findOneAndDelete = jest.fn()
  model.deleteMany = jest.fn()
  model.countDocuments = jest.fn()

  return { model, save }
}

describe('DiceRollTextRepository', () => {
  let model: ModelMock
  let save: jest.Mock
  let repository: DiceRollTextRepository

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(BASE_TIME)
    const mocks = makeModelMock()
    model = mocks.model
    save = mocks.save
    repository = new DiceRollTextRepository(model as never)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('create', () => {
    it('モデルを生成して保存し、結果を返す', async () => {
      // Arrange
      const entity = makeText()
      save.mockResolvedValue(entity)

      // Act
      const result = await repository.create(entity)

      // Assert
      expect(model).toHaveBeenCalledWith(entity)
      expect(save).toHaveBeenCalledTimes(1)
      expect(result).toBe(entity)
    })

    it('discordChannelId があればそのチャンネルのキャッシュを無効化する', async () => {
      // Arrange: 先にキャッシュを作る
      const cached = [makeText()]
      model.find.mockReturnValue(makeQueryChain(cached))
      await repository.findByChannelId('ch-1') // limit=500 でキャッシュされる
      expect(repository.getCacheStats().cachedChannels).toBe(1)

      // Act
      await repository.create(makeText({ discordChannelId: 'ch-1' }))

      // Assert
      expect(repository.getCacheStats().cachedChannels).toBe(0)
    })

    it('discordChannelId が無ければキャッシュ無効化しない', async () => {
      // Arrange
      const cached = [makeText()]
      model.find.mockReturnValue(makeQueryChain(cached))
      await repository.findByChannelId('ch-1')
      expect(repository.getCacheStats().cachedChannels).toBe(1)

      // Act: discordChannelId を持たないエンティティで作成
      const entityWithoutChannel = { textId: 'no-ch', result: 1, diceRoll: '1d6', text: 't' } as DiceRollText
      await repository.create(entityWithoutChannel)

      // Assert
      expect(repository.getCacheStats().cachedChannels).toBe(1)
    })
  })

  describe('findById', () => {
    it('textId で findOne し lean().exec() の結果を返す', async () => {
      // Arrange
      const doc = makeText()
      model.findOne.mockReturnValue(makeQueryChain(doc))

      // Act
      const result = await repository.findById('text-1')

      // Assert
      expect(model.findOne).toHaveBeenCalledWith({ textId: 'text-1' })
      expect(result).toBe(doc)
    })

    it('該当なしの場合は null を返す', async () => {
      // Arrange
      model.findOne.mockReturnValue(makeQueryChain(null))

      // Act
      const result = await repository.findById('missing')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('findByChannelId', () => {
    it('クエリチェーンを構築してチャンネルのテキストを返す', async () => {
      // Arrange
      const docs = [makeText({ textId: 'a' }), makeText({ textId: 'b' })]
      const chain = makeQueryChain(docs)
      model.find.mockReturnValue(chain)

      // Act
      const result = await repository.findByChannelId('ch-1')

      // Assert
      expect(model.find).toHaveBeenCalledWith({ discordChannelId: 'ch-1' })
      expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 })
      expect(chain.limit).toHaveBeenCalledWith(500)
      expect(chain.skip).toHaveBeenCalledWith(0)
      expect(result).toBe(docs)
    })

    it('offset=0 かつ limit>=500 の取得結果はキャッシュされ、2回目はDBを叩かない', async () => {
      // Arrange
      const docs = [makeText()]
      model.find.mockReturnValue(makeQueryChain(docs))

      // Act
      await repository.findByChannelId('ch-1') // 1回目: DB アクセス＋キャッシュ
      const second = await repository.findByChannelId('ch-1') // 2回目: キャッシュ

      // Assert
      expect(model.find).toHaveBeenCalledTimes(1)
      expect(second).toEqual(docs)
    })

    it('キャッシュ済みでも limit に合わせて結果を切り詰める', async () => {
      // Arrange: 3件をキャッシュさせる
      const docs = [makeText({ textId: 'a' }), makeText({ textId: 'b' }), makeText({ textId: 'c' })]
      model.find.mockReturnValue(makeQueryChain(docs))
      await repository.findByChannelId('ch-1') // limit=500 でキャッシュ

      // Act: キャッシュから limit=2 で取得
      const result = await repository.findByChannelId('ch-1', 2)

      // Assert
      expect(model.find).toHaveBeenCalledTimes(1) // 2回目はDBを叩かない
      expect(result).toHaveLength(2)
    })

    it('TTL を超えたキャッシュは破棄され、再度DBへ問い合わせる', async () => {
      // Arrange
      const docs = [makeText()]
      model.find.mockReturnValue(makeQueryChain(docs))
      await repository.findByChannelId('ch-1') // キャッシュ生成

      // Act: TTL 超過させてから再取得
      jest.setSystemTime(BASE_TIME + CACHE_TTL + 1)
      await repository.findByChannelId('ch-1')

      // Assert
      expect(model.find).toHaveBeenCalledTimes(2)
    })

    it('offset>0 の場合はキャッシュを使わない', async () => {
      // Arrange
      const docs = [makeText()]
      const chain = makeQueryChain(docs)
      model.find.mockReturnValue(chain)
      await repository.findByChannelId('ch-1') // キャッシュ生成（offset=0）

      // Act
      await repository.findByChannelId('ch-1', 500, 10)

      // Assert: offset>0 はキャッシュを参照せずDBアクセス
      expect(model.find).toHaveBeenCalledTimes(2)
      expect(chain.skip).toHaveBeenLastCalledWith(10)
    })

    it('limit<500 の取得結果はキャッシュしない', async () => {
      // Arrange
      const docs = [makeText()]
      model.find.mockReturnValue(makeQueryChain(docs))

      // Act
      await repository.findByChannelId('ch-1', 100)

      // Assert: キャッシュ未生成
      expect(repository.getCacheStats().cachedChannels).toBe(0)
    })
  })

  describe('findByCharacterId', () => {
    it('characterId で検索し、limit を指定して結果を返す', async () => {
      // Arrange
      const docs = [makeText()]
      const chain = makeQueryChain(docs)
      model.find.mockReturnValue(chain)

      // Act
      const result = await repository.findByCharacterId('char-1', 50)

      // Assert
      expect(model.find).toHaveBeenCalledWith({ characterId: 'char-1' })
      expect(chain.limit).toHaveBeenCalledWith(50)
      expect(result).toBe(docs)
    })
  })

  describe('countByChannelId', () => {
    it('countDocuments の結果を返す', async () => {
      // Arrange
      model.countDocuments.mockResolvedValue(7)

      // Act
      const result = await repository.countByChannelId('ch-1')

      // Assert
      expect(model.countDocuments).toHaveBeenCalledWith({ discordChannelId: 'ch-1' })
      expect(result).toBe(7)
    })
  })

  describe('deleteOldRolls', () => {
    it('残す件数以外を削除し、削除件数を返す', async () => {
      // Arrange: 残す対象の _id 一覧
      const rollsToKeep = [{ _id: 'id-1' }, { _id: 'id-2' }]
      model.find.mockReturnValue(makeQueryChain(rollsToKeep))
      model.deleteMany.mockResolvedValue({ deletedCount: 3 })

      // Act
      const result = await repository.deleteOldRolls('ch-1', 2)

      // Assert
      expect(model.deleteMany).toHaveBeenCalledWith({
        discordChannelId: 'ch-1',
        _id: { $nin: ['id-1', 'id-2'] }
      })
      expect(result).toBe(3)
    })

    it('deletedCount が undefined の場合は 0 を返す', async () => {
      // Arrange
      model.find.mockReturnValue(makeQueryChain([]))
      model.deleteMany.mockResolvedValue({})

      // Act
      const result = await repository.deleteOldRolls('ch-1')

      // Assert
      expect(result).toBe(0)
    })

    it('キャッシュを無効化する', async () => {
      // Arrange: キャッシュ生成
      model.find.mockReturnValue(makeQueryChain([makeText()]))
      await repository.findByChannelId('ch-1')
      expect(repository.getCacheStats().cachedChannels).toBe(1)
      model.deleteMany.mockResolvedValue({ deletedCount: 0 })

      // Act
      await repository.deleteOldRolls('ch-1')

      // Assert
      expect(repository.getCacheStats().cachedChannels).toBe(0)
    })
  })

  describe('findAll', () => {
    it('全件を取得して返す', async () => {
      // Arrange
      const docs = [makeText()]
      model.find.mockReturnValue(makeQueryChain(docs))

      // Act
      const result = await repository.findAll()

      // Assert
      expect(model.find).toHaveBeenCalledWith()
      expect(result).toBe(docs)
    })
  })

  describe('update', () => {
    it('更新結果を返し、対象チャンネルのキャッシュを無効化する', async () => {
      // Arrange
      const updated = makeText({ discordChannelId: 'ch-1' })
      model.findOneAndUpdate.mockReturnValue(makeQueryChain(updated))
      model.find.mockReturnValue(makeQueryChain([makeText()]))
      await repository.findByChannelId('ch-1') // キャッシュ生成
      expect(repository.getCacheStats().cachedChannels).toBe(1)

      // Act
      const result = await repository.update('text-1', { text: 'new' })

      // Assert
      expect(model.findOneAndUpdate).toHaveBeenCalledWith({ textId: 'text-1' }, { text: 'new' }, { new: true })
      expect(result).toBe(updated)
      expect(repository.getCacheStats().cachedChannels).toBe(0)
    })

    it('更新対象が無ければ null を返しキャッシュは無効化しない', async () => {
      // Arrange
      model.findOneAndUpdate.mockReturnValue(makeQueryChain(null))
      model.find.mockReturnValue(makeQueryChain([makeText()]))
      await repository.findByChannelId('ch-1')

      // Act
      const result = await repository.update('missing', { text: 'new' })

      // Assert
      expect(result).toBeNull()
      expect(repository.getCacheStats().cachedChannels).toBe(1)
    })
  })

  describe('delete', () => {
    it('削除した場合は対象チャンネルのキャッシュを無効化する', async () => {
      // Arrange
      const deleted = makeText({ discordChannelId: 'ch-1' })
      model.findOneAndDelete.mockReturnValue(makeQueryChain(deleted))
      model.find.mockReturnValue(makeQueryChain([makeText()]))
      await repository.findByChannelId('ch-1')

      // Act
      await repository.delete('text-1')

      // Assert
      expect(model.findOneAndDelete).toHaveBeenCalledWith({ textId: 'text-1' })
      expect(repository.getCacheStats().cachedChannels).toBe(0)
    })

    it('削除対象が無ければキャッシュは無効化しない', async () => {
      // Arrange
      model.findOneAndDelete.mockReturnValue(makeQueryChain(null))
      model.find.mockReturnValue(makeQueryChain([makeText()]))
      await repository.findByChannelId('ch-1')

      // Act
      await repository.delete('missing')

      // Assert
      expect(repository.getCacheStats().cachedChannels).toBe(1)
    })
  })

  describe('remove', () => {
    it('削除したエンティティを返し、キャッシュを無効化する', async () => {
      // Arrange
      const deleted = makeText({ discordChannelId: 'ch-1' })
      model.findOneAndDelete.mockReturnValue(makeQueryChain(deleted))
      model.find.mockReturnValue(makeQueryChain([makeText()]))
      await repository.findByChannelId('ch-1')

      // Act
      const result = await repository.remove('text-1')

      // Assert
      expect(result).toBe(deleted)
      expect(repository.getCacheStats().cachedChannels).toBe(0)
    })

    it('削除対象が無ければ null を返す', async () => {
      // Arrange
      model.findOneAndDelete.mockReturnValue(makeQueryChain(null))

      // Act
      const result = await repository.remove('missing')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('removeByChannelId', () => {
    it('チャンネルの全テキストを削除しキャッシュを無効化する', async () => {
      // Arrange
      model.deleteMany.mockReturnValue(makeQueryChain({ deletedCount: 5 }))
      model.find.mockReturnValue(makeQueryChain([makeText()]))
      await repository.findByChannelId('ch-1')

      // Act
      await repository.removeByChannelId('ch-1')

      // Assert
      expect(model.deleteMany).toHaveBeenCalledWith({ discordChannelId: 'ch-1' })
      expect(repository.getCacheStats().cachedChannels).toBe(0)
    })
  })

  describe('clearCache', () => {
    it('全チャンネルのキャッシュをクリアする', async () => {
      // Arrange: 2チャンネルをキャッシュ
      model.find.mockReturnValue(makeQueryChain([makeText()]))
      await repository.findByChannelId('ch-1')
      await repository.findByChannelId('ch-2')
      expect(repository.getCacheStats().cachedChannels).toBe(2)

      // Act
      repository.clearCache()

      // Assert
      expect(repository.getCacheStats().cachedChannels).toBe(0)
    })
  })

  describe('getCacheStats', () => {
    it('キャッシュ済みチャンネル数と総エントリ数を返す', async () => {
      // Arrange
      model.find.mockReturnValueOnce(makeQueryChain([makeText(), makeText()])) // ch-1: 2件
      await repository.findByChannelId('ch-1')
      model.find.mockReturnValueOnce(makeQueryChain([makeText()])) // ch-2: 1件
      await repository.findByChannelId('ch-2')

      // Act
      const stats = repository.getCacheStats()

      // Assert
      expect(stats.cachedChannels).toBe(2)
      expect(stats.totalEntries).toBe(3)
    })

    it('キャッシュが空なら 0 を返す', () => {
      // Act
      const stats = repository.getCacheStats()

      // Assert
      expect(stats).toEqual({ cachedChannels: 0, totalEntries: 0 })
    })
  })
})
