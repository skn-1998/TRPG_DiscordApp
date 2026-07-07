import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { CharacterRepository } from './character.repository'
import { CHARACTER_MODEL, Character } from '../models/character.model'

/**
 * CharacterRepository の単体テスト
 *
 * Mongoose Model を注入された薄いリポジトリ。実 DB には接続せず、Model をモックして
 * 「各メソッドが正しいクエリ条件・select・チェーンで Model を呼び、結果を返すか」を検証する。
 * Mongoose のクエリチェーン（.select().lean().exec() 等）はモックの本質的な境界であり、
 * チェーンビルダのヘルパで読みやすくする。
 */
describe('CharacterRepository', () => {
  let repository: CharacterRepository
  let model: any

  /**
   * .select().lean().sort().exec() などのチェーンを許容しつつ、最終的に exec() が
   * resolveValue を解決するモッククエリを作る。
   */
  const createQuery = (resolveValue: unknown) => {
    const query: any = {}
    query.select = jest.fn().mockReturnValue(query)
    query.lean = jest.fn().mockReturnValue(query)
    query.sort = jest.fn().mockReturnValue(query)
    query.exec = jest.fn().mockResolvedValue(resolveValue)
    return query
  }

  beforeEach(async () => {
    // Model は new でドキュメントを生成する関数でもあり、static メソッドも持つ。
    // jest.fn() をコンストラクタとして使い、static メソッドを後付けする。
    model = jest.fn()
    model.findOne = jest.fn()
    model.find = jest.fn()
    model.findOneAndUpdate = jest.fn()
    model.findOneAndDelete = jest.fn()
    model.deleteOne = jest.fn()
    model.countDocuments = jest.fn()

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterRepository,
        {
          provide: getModelToken(CHARACTER_MODEL),
          useValue: model
        }
      ]
    }).compile()

    repository = moduleRef.get<CharacterRepository>(CharacterRepository)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('インスタンスが生成される', () => {
    expect(repository).toBeDefined()
  })

  describe('create', () => {
    it('Model のインスタンスを生成し save 後に toObject() で plain 化して返す（E-6d）', async () => {
      // Arrange
      const entity: Partial<Character> = { characterId: 'c1', characterName: 'Alice' }
      const plain = { characterId: 'c1', characterName: 'Alice' }
      // save は Mongoose Document（toObject を持つ）を解決する
      const toObject = jest.fn().mockReturnValue(plain)
      const save = jest.fn().mockResolvedValue({ ...plain, toObject })
      // new this.characterModel(entity) が save を持つインスタンスを返すよう設定
      model.mockImplementation((arg: unknown) => ({ ...(arg as object), save }))

      // Act
      const result = await repository.create(entity)

      // Assert
      expect(model).toHaveBeenCalledWith(entity)
      expect(save).toHaveBeenCalledTimes(1)
      expect(toObject).toHaveBeenCalledTimes(1)
      expect(result).toBe(plain)
    })
  })

  describe('findById', () => {
    it('characterId 条件で findOne し lean/exec の結果を返す', async () => {
      // Arrange
      const doc = { characterId: 'c1' }
      const query = createQuery(doc)
      model.findOne.mockReturnValue(query)

      // Act
      const result = await repository.findById('c1')

      // Assert
      expect(model.findOne).toHaveBeenCalledWith({ characterId: 'c1' })
      expect(query.lean).toHaveBeenCalledTimes(1)
      expect(query.exec).toHaveBeenCalledTimes(1)
      expect(result).toBe(doc)
    })

    it('該当なしの場合は null を返す', async () => {
      model.findOne.mockReturnValue(createQuery(null))

      const result = await repository.findById('missing')

      expect(result).toBeNull()
    })
  })

  describe('findByName', () => {
    it('characterName 条件で findOne し select 指定して結果を返す', async () => {
      const doc = { characterId: 'c1', characterName: 'Alice' }
      const query = createQuery(doc)
      model.findOne.mockReturnValue(query)

      const result = await repository.findByName('Alice')

      expect(model.findOne).toHaveBeenCalledWith({ characterName: 'Alice' })
      expect(query.select).toHaveBeenCalledWith(
        'characterId characterName discordChannelId attributes primaryAttributes createdAt updatedAt'
      )
      expect(query.lean).toHaveBeenCalledTimes(1)
      expect(result).toBe(doc)
    })
  })

  describe('findByChannelId', () => {
    it('discordChannelId 条件で findOne し select 指定して結果を返す', async () => {
      const doc = { characterId: 'c1' }
      const query = createQuery(doc)
      model.findOne.mockReturnValue(query)

      const result = await repository.findByChannelId('ch1')

      expect(model.findOne).toHaveBeenCalledWith({ discordChannelId: 'ch1' })
      // S-1: status/skill/parameter/gameSystemId を含む（スレッド内ロールの key 再解決の前提）。
      expect(query.select).toHaveBeenCalledWith(
        'characterId characterName discordChannelId attributes primaryAttributes status skill parameter gameSystemId createdAt updatedAt'
      )
      expect(result).toBe(doc)
    })
  })

  describe('findAll', () => {
    it('filter を渡した場合はその条件で find する', async () => {
      const docs = [{ characterId: 'c1' }]
      const query = createQuery(docs)
      model.find.mockReturnValue(query)
      const filter: Partial<Character> = { discordUserId: 'u1' }

      const result = await repository.findAll(filter)

      expect(model.find).toHaveBeenCalledWith(filter)
      expect(result).toBe(docs)
    })

    it('filter 未指定の場合は空オブジェクトで find する', async () => {
      const query = createQuery([])
      model.find.mockReturnValue(query)

      await repository.findAll()

      expect(model.find).toHaveBeenCalledWith({})
    })
  })

  describe('findByUserId', () => {
    it('discordUserId 条件で find し updatedAt 降順でソートする', async () => {
      const docs = [{ characterId: 'c1' }]
      const query = createQuery(docs)
      model.find.mockReturnValue(query)

      const result = await repository.findByUserId('u1')

      expect(model.find).toHaveBeenCalledWith({ discordUserId: 'u1' })
      expect(query.sort).toHaveBeenCalledWith({ updatedAt: -1 })
      expect(result).toBe(docs)
    })
  })

  describe('update', () => {
    it('characterId 条件で findOneAndUpdate し new:true を渡す', async () => {
      const updated = { characterId: 'c1', characterName: 'New' }
      const query = createQuery(updated)
      model.findOneAndUpdate.mockReturnValue(query)
      const updateData: Partial<Character> = { characterName: 'New' }

      const result = await repository.update('c1', updateData)

      expect(model.findOneAndUpdate).toHaveBeenCalledWith({ characterId: 'c1' }, updateData, { new: true })
      expect(result).toBe(updated)
    })
  })

  describe('updateByChannelId', () => {
    it('discordChannelId 条件で findOneAndUpdate し new:true を渡す', async () => {
      const updated = { characterId: 'c1' }
      const query = createQuery(updated)
      model.findOneAndUpdate.mockReturnValue(query)
      const updateData: Partial<Character> = { characterName: 'New' }

      const result = await repository.updateByChannelId('ch1', updateData)

      expect(model.findOneAndUpdate).toHaveBeenCalledWith({ discordChannelId: 'ch1' }, updateData, { new: true })
      expect(result).toBe(updated)
    })
  })

  describe('updateField', () => {
    it('field をキーにした updateData で update に委譲する', async () => {
      const updated = { characterId: 'c1' }
      const query = createQuery(updated)
      model.findOneAndUpdate.mockReturnValue(query)
      const data = { HP: 10 }

      const result = await repository.updateField('c1', 'status', data)

      // update() 経由なので findOneAndUpdate が { status: data } で呼ばれる
      expect(model.findOneAndUpdate).toHaveBeenCalledWith({ characterId: 'c1' }, { status: data }, { new: true })
      expect(result).toBe(updated)
    })
  })

  describe('updateFieldByChannelId', () => {
    it('field をキーにした updateData で updateByChannelId に委譲する', async () => {
      const updated = { characterId: 'c1' }
      const query = createQuery(updated)
      model.findOneAndUpdate.mockReturnValue(query)
      const data = { 回避: 50 }

      const result = await repository.updateFieldByChannelId('ch1', 'skill', data)

      expect(model.findOneAndUpdate).toHaveBeenCalledWith({ discordChannelId: 'ch1' }, { skill: data }, { new: true })
      expect(result).toBe(updated)
    })
  })

  describe('remove', () => {
    it('characterId 条件で findOneAndDelete し結果を返す', async () => {
      const removed = { characterId: 'c1' }
      const query = createQuery(removed)
      model.findOneAndDelete.mockReturnValue(query)

      const result = await repository.remove('c1')

      expect(model.findOneAndDelete).toHaveBeenCalledWith({ characterId: 'c1' })
      expect(result).toBe(removed)
    })
  })

  describe('removeByChannelId', () => {
    it('discordChannelId 条件で deleteOne を呼ぶ（戻り値なし）', async () => {
      const query = createQuery({ deletedCount: 1 })
      model.deleteOne.mockReturnValue(query)

      const result = await repository.removeByChannelId('ch1')

      expect(model.deleteOne).toHaveBeenCalledWith({ discordChannelId: 'ch1' })
      expect(query.exec).toHaveBeenCalledTimes(1)
      expect(result).toBeUndefined()
    })
  })

  describe('findUserCharacterSummaries', () => {
    it('discordUserId で find し必要フィールドのみ select/lean する', async () => {
      const summaries = [{ characterId: 'c1', characterName: 'Alice', gameSystemId: 'coc' }]
      const query = createQuery(summaries)
      model.find.mockReturnValue(query)

      const result = await repository.findUserCharacterSummaries('u1')

      expect(model.find).toHaveBeenCalledWith({ discordUserId: 'u1' })
      expect(query.select).toHaveBeenCalledWith('characterId characterName gameSystemId -_id')
      expect(query.lean).toHaveBeenCalledTimes(1)
      expect(result).toBe(summaries)
    })
  })

  describe('existsById', () => {
    it('countDocuments が 1 以上なら true を返す', async () => {
      model.countDocuments.mockReturnValue(createQuery(1))

      const result = await repository.existsById('c1')

      expect(model.countDocuments).toHaveBeenCalledWith({ characterId: 'c1' })
      expect(result).toBe(true)
    })

    it('countDocuments が 0 なら false を返す（境界値）', async () => {
      model.countDocuments.mockReturnValue(createQuery(0))

      const result = await repository.existsById('c1')

      expect(result).toBe(false)
    })
  })

  describe('existsByIdAndChannel', () => {
    it('characterId と discordChannelId の両条件で count し存在判定する', async () => {
      model.countDocuments.mockReturnValue(createQuery(2))

      const result = await repository.existsByIdAndChannel('c1', 'ch1')

      expect(model.countDocuments).toHaveBeenCalledWith({ characterId: 'c1', discordChannelId: 'ch1' })
      expect(result).toBe(true)
    })

    it('0 件なら false（境界値）', async () => {
      model.countDocuments.mockReturnValue(createQuery(0))

      const result = await repository.existsByIdAndChannel('c1', 'ch1')

      expect(result).toBe(false)
    })
  })

  describe('existsByNameAndChannel', () => {
    it('characterName と discordChannelId の両条件で count し存在判定する', async () => {
      model.countDocuments.mockReturnValue(createQuery(1))

      const result = await repository.existsByNameAndChannel('Alice', 'ch1')

      expect(model.countDocuments).toHaveBeenCalledWith({ characterName: 'Alice', discordChannelId: 'ch1' })
      expect(result).toBe(true)
    })

    it('0 件なら false（境界値）', async () => {
      model.countDocuments.mockReturnValue(createQuery(0))

      const result = await repository.existsByNameAndChannel('Alice', 'ch1')

      expect(result).toBe(false)
    })
  })

  describe('existsByNameAndUser', () => {
    it('characterName と discordUserId の両条件で count し存在判定する', async () => {
      model.countDocuments.mockReturnValue(createQuery(1))

      const result = await repository.existsByNameAndUser('Alice', 'u1')

      expect(model.countDocuments).toHaveBeenCalledWith({ characterName: 'Alice', discordUserId: 'u1' })
      expect(result).toBe(true)
    })

    it('0 件なら false（境界値）', async () => {
      model.countDocuments.mockReturnValue(createQuery(0))

      const result = await repository.existsByNameAndUser('Alice', 'u1')

      expect(result).toBe(false)
    })
  })
})
