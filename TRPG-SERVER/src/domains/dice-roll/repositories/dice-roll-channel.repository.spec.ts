import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { DiceRollChannelRepository } from './dice-roll-channel.repository'
import { DiceRollChannel, DICE_ROLL_CHANNEL_MODEL } from '../models/dice-roll-channel.model'

/**
 * `.exec()` を持つ Mongoose クエリのモックを作る。
 * `exec` は解決値（または Promise）を返す。
 */
const queryWith = (result: unknown) => ({
  exec: jest.fn().mockResolvedValue(result)
})

describe('DiceRollChannelRepository', () => {
  let repository: DiceRollChannelRepository
  // 使うメソッドだけを型なしモックで持つ（Mongoose Model 全体はモックしない）
  let model: {
    findOne: jest.Mock
    find: jest.Mock
    findOneAndUpdate: jest.Mock
    findOneAndDelete: jest.Mock
  }
  // `new this.model(entity)` のコンストラクタ呼び出しを再現するためのモック関数
  let modelConstructor: jest.Mock
  let saveMock: jest.Mock

  beforeEach(async () => {
    saveMock = jest.fn()
    modelConstructor = jest.fn().mockImplementation((entity) => ({
      ...entity,
      save: saveMock
    }))

    model = {
      findOne: jest.fn(),
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn()
    }

    // コンストラクタとしても、メソッド辞書としても振る舞うモデルモックを合成する
    const modelMock = Object.assign(modelConstructor, model)

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DiceRollChannelRepository,
        {
          provide: getModelToken(DICE_ROLL_CHANNEL_MODEL),
          useValue: modelMock
        }
      ]
    }).compile()

    repository = moduleRef.get(DiceRollChannelRepository)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('インスタンス化できる', () => {
    expect(repository).toBeDefined()
  })

  describe('create', () => {
    it('エンティティでモデルを生成し save した結果を返す', async () => {
      // Arrange
      const entity: Partial<DiceRollChannel> = { discordChannelId: 'ch-1' }
      const saved = { discordChannelId: 'ch-1', characterIds: [] }
      saveMock.mockResolvedValue(saved)

      // Act
      const result = await repository.create(entity)

      // Assert: コンストラクタに entity が渡り、save の戻り値がそのまま返る
      expect(modelConstructor).toHaveBeenCalledWith(entity)
      expect(saveMock).toHaveBeenCalledTimes(1)
      expect(result).toBe(saved)
    })
  })

  describe('findById', () => {
    it('discordChannelId 条件で findOne し exec の結果を返す', async () => {
      const found = { discordChannelId: 'ch-1' }
      model.findOne.mockReturnValue(queryWith(found))

      const result = await repository.findById('ch-1')

      expect(model.findOne).toHaveBeenCalledWith({ discordChannelId: 'ch-1' })
      expect(result).toBe(found)
    })

    it('該当なしの場合は null を返す', async () => {
      model.findOne.mockReturnValue(queryWith(null))

      const result = await repository.findById('missing')

      expect(result).toBeNull()
    })
  })

  describe('findByChannelId', () => {
    it('findById に委譲し同じ結果を返す', async () => {
      const found = { discordChannelId: 'ch-9' }
      model.findOne.mockReturnValue(queryWith(found))

      const result = await repository.findByChannelId('ch-9')

      expect(model.findOne).toHaveBeenCalledWith({ discordChannelId: 'ch-9' })
      expect(result).toBe(found)
    })
  })

  describe('findAll', () => {
    it('フィルターを渡した場合はそのフィルターで find する', async () => {
      const filter: Partial<DiceRollChannel> = { discordChannelId: 'ch-1' }
      const list = [{ discordChannelId: 'ch-1' }]
      model.find.mockReturnValue(queryWith(list))

      const result = await repository.findAll(filter)

      expect(model.find).toHaveBeenCalledWith(filter)
      expect(result).toBe(list)
    })

    it('フィルター未指定の場合は空オブジェクトで find する', async () => {
      const list = [{ discordChannelId: 'ch-1' }, { discordChannelId: 'ch-2' }]
      model.find.mockReturnValue(queryWith(list))

      const result = await repository.findAll()

      expect(model.find).toHaveBeenCalledWith({})
      expect(result).toBe(list)
    })
  })

  describe('update', () => {
    it('discordChannelId 条件で findOneAndUpdate を new:true で呼ぶ', async () => {
      const updateData: Partial<DiceRollChannel> = { embedId: 'e-1' }
      const updated = { discordChannelId: 'ch-1', embedId: 'e-1' }
      model.findOneAndUpdate.mockReturnValue(queryWith(updated))

      const result = await repository.update('ch-1', updateData)

      expect(model.findOneAndUpdate).toHaveBeenCalledWith({ discordChannelId: 'ch-1' }, updateData, { new: true })
      expect(result).toBe(updated)
    })

    it('対象が存在しない場合は null を返す', async () => {
      model.findOneAndUpdate.mockReturnValue(queryWith(null))

      const result = await repository.update('missing', { embedId: 'e-1' })

      expect(result).toBeNull()
    })
  })

  describe('addTextId', () => {
    it('$addToSet で textIds に追加する', async () => {
      const updated = { discordChannelId: 'ch-1', textIds: ['t-1'] }
      model.findOneAndUpdate.mockReturnValue(queryWith(updated))

      const result = await repository.addTextId('ch-1', 't-1')

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { discordChannelId: 'ch-1' },
        { $addToSet: { textIds: 't-1' } },
        { new: true }
      )
      expect(result).toBe(updated)
    })
  })

  describe('addCharacterId', () => {
    it('$addToSet で characterIds に追加する', async () => {
      const updated = { discordChannelId: 'ch-1', characterIds: ['c-1'] }
      model.findOneAndUpdate.mockReturnValue(queryWith(updated))

      const result = await repository.addCharacterId('ch-1', 'c-1')

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { discordChannelId: 'ch-1' },
        { $addToSet: { characterIds: 'c-1' } },
        { new: true }
      )
      expect(result).toBe(updated)
    })
  })

  describe('addEmbedId', () => {
    it('embedId を上書き更新する', async () => {
      const updated = { discordChannelId: 'ch-1', embedId: 'e-1' }
      model.findOneAndUpdate.mockReturnValue(queryWith(updated))

      const result = await repository.addEmbedId('ch-1', 'e-1')

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { discordChannelId: 'ch-1' },
        { embedId: 'e-1' },
        { new: true }
      )
      expect(result).toBe(updated)
    })
  })

  describe('remove', () => {
    it('discordChannelId 条件で findOneAndDelete し結果を返す', async () => {
      const deleted = { discordChannelId: 'ch-1' }
      model.findOneAndDelete.mockReturnValue(queryWith(deleted))

      const result = await repository.remove('ch-1')

      expect(model.findOneAndDelete).toHaveBeenCalledWith({ discordChannelId: 'ch-1' })
      expect(result).toBe(deleted)
    })

    it('対象が存在しない場合は null を返す', async () => {
      model.findOneAndDelete.mockReturnValue(queryWith(null))

      const result = await repository.remove('missing')

      expect(result).toBeNull()
    })
  })
})
