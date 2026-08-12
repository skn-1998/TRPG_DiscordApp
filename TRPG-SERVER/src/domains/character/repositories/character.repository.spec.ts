import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import {
  expectRequiredCharacterRuntimeKeyCount,
  requiredCharacterRuntimeKeys
} from 'test/utils/character-http-contract'
import { CharacterRepository } from './character.repository'
import { CHARACTER_MODEL, Character } from '../models/character.model'

const expectProjectionToContainRequiredCharacterEntityKeys = (select: jest.Mock): void => {
  expectRequiredCharacterRuntimeKeyCount()
  const [projection] = select.mock.calls[0] as [string]
  const selectedKeys = new Set(projection.split(/\s+/))
  const missingRequiredKeys = requiredCharacterRuntimeKeys.filter((key) => !selectedKeys.has(key))

  expect(missingRequiredKeys).toEqual([])
}

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

    it('legacy create は materialized/metadata フィールドを受け付けない', async () => {
      await expect(
        repository.create({
          characterId: 'c1',
          sheet: { templateId: 'tpl-1', templateVersion: '1.0.0', revision: 1, values: {} }
        } as any)
      ).rejects.toThrow('Legacy write cannot update sheet')

      expect(model).not.toHaveBeenCalled()
    })

    it('legacy create は undefined を除去し、非正準セクションを拒否する', async () => {
      const plain = { characterId: 'c1' }
      const toObject = jest.fn().mockReturnValue(plain)
      const save = jest.fn().mockResolvedValue({ ...plain, toObject })
      model.mockImplementation((arg: unknown) => ({ ...(arg as object), save }))

      await repository.create({ characterId: 'c1', discordThreadId: undefined })

      expect(model).toHaveBeenCalledWith({ characterId: 'c1' })
      await expect(repository.create({ characterId: 'c2', status: { HP: 10 } as any })).rejects.toThrow(
        /AttributeSection/
      )
      expect(model).toHaveBeenCalledTimes(1)
    })
  })

  describe('materialized-write', () => {
    const projection = {
      status: { HP: { values: { base: 10, buff: 2, temp: -1, other: 3 } } },
      parameter: {},
      skill: {},
      item: {},
      description: {}
    }

    it('createMaterializedCharacter は全 materialized 要素を1回の insert で保存する', async () => {
      const entity = {
        characterId: 'c1',
        characterName: 'Alice',
        gameSystemId: 'coc7',
        discordUserId: 'u1',
        discordChannelId: 'ch1',
        ...projection,
        sheet: {
          templateId: 'tpl-1',
          templateVersion: '1.0.0',
          revision: 1,
          visibility: 'private' as const,
          values: { hp: 10 }
        },
        computedCache: { hpHalf: 5 },
        palette: [],
        hub: { status: 'none' as const },
        appliedInteractionIds: []
      }
      const toObject = jest.fn().mockReturnValue(entity)
      const save = jest.fn().mockResolvedValue({ ...entity, toObject })
      model.mockImplementation((arg: unknown) => ({ ...(arg as object), save }))

      const result = await repository.createMaterializedCharacter(entity)

      expect(model).toHaveBeenCalledTimes(1)
      expect(model).toHaveBeenCalledWith(entity)
      expect(save).toHaveBeenCalledTimes(1)
      expect(result).toBe(entity)
    })

    it('saveSheetMaterialized は revision CAS・単一 $set/$inc を保ち public visibility を消さない', async () => {
      const updated = {
        characterId: 'c1',
        ...projection,
        sheet: {
          templateId: 'tpl-1',
          templateVersion: '1.0.0',
          revision: 4,
          visibility: 'public' as const,
          values: { hp: 12 }
        }
      }
      const query = createQuery(updated)
      model.findOneAndUpdate.mockReturnValue(query)
      const appliedInteractionIds = Array.from({ length: 21 }, (_, index) => `i${index}`)

      const result = await repository.saveSheetMaterialized(
        'c1',
        {
          values: { hp: 12 },
          computedCache: { hpHalf: 6 },
          palette: [],
          ...projection,
          pendingRevision: 4,
          appliedInteractionIds
        },
        3
      )

      expect(model.findOneAndUpdate).toHaveBeenCalledTimes(1)
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { characterId: 'c1', 'sheet.revision': 3 },
        {
          $set: {
            'sheet.values': { hp: 12 },
            computedCache: { hpHalf: 6 },
            palette: [],
            status: projection.status,
            parameter: projection.parameter,
            skill: projection.skill,
            item: projection.item,
            description: projection.description,
            'hub.pendingRevision': 4,
            appliedInteractionIds: appliedInteractionIds.slice(-20)
          },
          $inc: { 'sheet.revision': 1 }
        },
        { new: true }
      )
      expect(result).toBe(updated)
      expect(result?.sheet?.visibility).toBe('public')
    })

    it('saveSheetMaterialized は0件更新を競合として null で返す', async () => {
      model.findOneAndUpdate.mockReturnValue(createQuery(null))

      const result = await repository.saveSheetMaterialized(
        'c1',
        {
          values: {},
          computedCache: {},
          palette: [],
          ...projection,
          pendingRevision: 2,
          appliedInteractionIds: []
        },
        1
      )

      expect(result).toBeNull()
    })

    it('saveSheetMaterialized は非正準投影なら DB を更新しない', async () => {
      await expect(
        repository.saveSheetMaterialized(
          'c1',
          {
            values: {},
            computedCache: {},
            palette: [],
            ...projection,
            status: { HP: { values: { base: 10 }, display: 10 } } as any,
            pendingRevision: 2,
            appliedInteractionIds: []
          },
          1
        )
      ).rejects.toThrow()
      expect(model.findOneAndUpdate).not.toHaveBeenCalled()
    })

    it('saveSheetMaterialized は pendingRevision が次 revision でなければ DB を更新しない', async () => {
      await expect(
        repository.saveSheetMaterialized(
          'c1',
          {
            values: {},
            computedCache: {},
            palette: [],
            ...projection,
            pendingRevision: 99,
            appliedInteractionIds: []
          },
          1
        )
      ).rejects.toThrow('pendingRevision must equal expectedRevision + 1')

      expect(model.findOneAndUpdate).not.toHaveBeenCalled()
    })
  })

  describe('metadata-write', () => {
    it('setTemplatePin は sheet と templatePin が無い場合だけ pin を確立する', async () => {
      const pin = { templateId: 'legacy-coc', templateVersion: '1.0.0', pinnedBy: 'backfill-2026-07-12' }
      const updated = { characterId: 'c1', templatePin: pin }
      model.findOneAndUpdate.mockReturnValue(createQuery(updated))

      const result = await repository.setTemplatePin('c1', pin)

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { characterId: 'c1', sheet: { $exists: false }, templatePin: { $exists: false } },
        { $set: { templatePin: pin } },
        { new: true }
      )
      expect(result).toBe(updated)
    })

    it('setTemplatePin は条件不成立を null で返し既存 pin を上書きしない', async () => {
      model.findOneAndUpdate.mockReturnValue(createQuery(null))

      await expect(
        repository.setTemplatePin('c1', {
          templateId: 'legacy-coc',
          templateVersion: '1.0.0',
          pinnedBy: 'backfill'
        })
      ).resolves.toBeNull()
    })

    it('setTemplatePin は不正な pin を DB 更新前に拒否する', async () => {
      await expect(
        repository.setTemplatePin('c1', {
          templateId: '',
          templateVersion: '1.0.0',
          pinnedBy: 'backfill'
        })
      ).rejects.toThrow()
      expect(model.findOneAndUpdate).not.toHaveBeenCalled()
    })

    it('setHubState は from の hub 条件で CAS し to の hub フィールドだけを更新する', async () => {
      const updated = { characterId: 'c1', hub: { status: 'active', opId: 'op-1', messageId: 'm1' } }
      model.findOneAndUpdate.mockReturnValue(createQuery(updated))

      const result = await repository.setHubState(
        'c1',
        { status: 'publishing', opId: 'op-1' },
        { status: 'active', messageId: 'm1', appliedRevision: 3 }
      )

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { characterId: 'c1', 'hub.status': 'publishing', 'hub.opId': 'op-1' },
        {
          $set: {
            'hub.status': 'active',
            'hub.messageId': 'm1',
            'hub.appliedRevision': 3
          }
        },
        { new: true }
      )
      expect(result).toBe(updated)
    })

    it('setHubState は不正な hub 遷移を DB 更新前に拒否する', async () => {
      await expect(
        repository.setHubState('c1', { status: 'none' }, { status: 'active', pendingRevision: Number.NaN })
      ).rejects.toThrow()

      await expect(
        repository.setHubState('c1', { status: 'publishing', opId: 'op-1' }, { status: 'active' })
      ).rejects.toThrow('publishing->active requires messageId')

      await expect(
        repository.setHubState('c1', { status: 'active', messageId: 'm1' }, { status: 'none' })
      ).rejects.toThrow('Illegal character hub transition')

      expect(model.findOneAndUpdate).not.toHaveBeenCalled()
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

    it('永続化済みlegacy属性をrepository境界で正準形へ変換する', async () => {
      const doc = {
        characterId: 'c1',
        status: {
          HP: { name: 'HP', index: null, values: { base: 10 }, description: null, dice: null },
          MP: 5
        }
      }
      model.findOne.mockReturnValue(createQuery(doc))

      const result = await repository.findById('c1')

      expect(result?.status).toEqual({
        HP: { name: 'HP', values: { base: 10 } },
        MP: { values: { base: 5 } }
      })
      expect(doc.status.HP.index).toBeNull()
    })
  })

  describe('owner-qualified operations', () => {
    it('findByIdForOwner はcharacterIdとdiscordUserIdの両方を検索条件にする', async () => {
      const doc = { characterId: 'c1', discordUserId: 'owner-1' }
      const query = createQuery(doc)
      model.findOne.mockReturnValue(query)

      const result = await repository.findByIdForOwner('c1', 'owner-1')

      expect(model.findOne).toHaveBeenCalledWith({ characterId: 'c1', discordUserId: 'owner-1' })
      expect(query.lean).toHaveBeenCalledTimes(1)
      expect(result).toBe(doc)
    })

    it.each([
      ['欠落', {}],
      ['unlisted', { visibility: 'unlisted' }],
      ['不正値', { visibility: 42 }]
    ])('findByIdForOwner は raw persisted visibility の%sを private に正規化する', async (_caseName, extra) => {
      const sheet = {
        templateId: 'tpl-1',
        templateVersion: '1.0.0',
        revision: 1,
        values: {},
        ...extra
      }
      const doc = { characterId: 'c1', discordUserId: 'owner-1', sheet }
      model.findOne.mockReturnValue(createQuery(doc))

      const result = await repository.findByIdForOwner('c1', 'owner-1')

      expect(result?.sheet?.visibility).toBe('private')
      expect(doc.sheet).toBe(sheet)
      expect(doc.sheet).toEqual({
        templateId: 'tpl-1',
        templateVersion: '1.0.0',
        revision: 1,
        values: {},
        ...extra
      })
    })

    it('updateForOwner は所有者条件を含む単一クエリで更新する', async () => {
      const updated = { characterId: 'c1', discordUserId: 'owner-1', characterName: 'updated' }
      const query = createQuery(updated)
      model.findOneAndUpdate.mockReturnValue(query)

      const result = await repository.updateForOwner('c1', 'owner-1', { characterName: 'updated' })

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { characterId: 'c1', discordUserId: 'owner-1' },
        { $set: { characterName: 'updated' } },
        { new: true }
      )
      expect(result).toBe(updated)
    })

    it('removeForOwner は所有者条件を含む単一クエリで削除する', async () => {
      const deleted = { characterId: 'c1', discordUserId: 'owner-1' }
      const query = createQuery(deleted)
      model.findOneAndDelete.mockReturnValue(query)

      const result = await repository.removeForOwner('c1', 'owner-1')

      expect(model.findOneAndDelete).toHaveBeenCalledWith({ characterId: 'c1', discordUserId: 'owner-1' })
      expect(result).toBe(deleted)
    })
  })

  describe('findByName', () => {
    it('CharacterEntity の必須フィールドをすべて含む projection で検索する', async () => {
      const doc = {
        characterId: 'c1',
        characterName: 'Alice',
        gameSystemId: 'coc7',
        discordUserId: 'user-1',
        discordChannelId: 'channel-1',
        status: {}
      }
      const query = createQuery(doc)
      model.findOne.mockReturnValue(query)

      const result = await repository.findByName('Alice')

      expect(model.findOne).toHaveBeenCalledWith({ characterName: 'Alice' })
      expectProjectionToContainRequiredCharacterEntityKeys(query.select)
      expect(query.select).toHaveBeenCalledWith(
        'characterId characterName gameSystemId discordUserId discordChannelId status createdAt updatedAt'
      )
      expect(query.lean).toHaveBeenCalledTimes(1)
      expect(result).toBe(doc)
    })
  })

  describe('findByChannelId', () => {
    it('discordChannelId 条件で findOne し必須フィールドを含む projection の結果を返す', async () => {
      const doc = { characterId: 'c1' }
      const query = createQuery(doc)
      model.findOne.mockReturnValue(query)

      const result = await repository.findByChannelId('ch1')

      expect(model.findOne).toHaveBeenCalledWith({ discordChannelId: 'ch1' })
      // S-1: status/skill/parameter/gameSystemId を含む（スレッド内ロールの key 再解決の前提）。
      expectProjectionToContainRequiredCharacterEntityKeys(query.select)
      expect(query.select).toHaveBeenCalledWith(
        'characterId characterName discordChannelId attributes primaryAttributes status skill parameter gameSystemId palette discordUserId hub.status createdAt updatedAt'
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

      expect(model.findOneAndUpdate).toHaveBeenCalledWith({ characterId: 'c1' }, { $set: updateData }, { new: true })
      expect(result).toBe(updated)
    })

    it('legacy update は materialized/metadata フィールドを受け付けない', async () => {
      await expect(repository.update('c1', { hub: { status: 'none' } } as any)).rejects.toThrow(
        'Legacy write cannot update hub'
      )

      expect(model.findOneAndUpdate).not.toHaveBeenCalled()
    })

    it('section更新では undefined をpipelineへ渡さず、非正準セクションを拒否する', async () => {
      const status = { HP: { values: { base: 10 } } }
      model.findOneAndUpdate.mockReturnValue(createQuery({ characterId: 'c1', status }))

      await repository.update('c1', { status, discordThreadId: undefined })

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { characterId: 'c1' },
        [{ $set: { status: { $literal: status } } }],
        { new: true }
      )

      model.findOneAndUpdate.mockClear()
      await expect(repository.update('c1', { status: { HP: 10 } as any })).rejects.toThrow(/AttributeSection/)
      await expect(
        repository.update('c1', { status: { HP: { values: { base: 10 }, dice: undefined } } })
      ).rejects.toThrow(/AttributeSection/)
      expect(model.findOneAndUpdate).not.toHaveBeenCalled()
    })
  })

  describe('updateByChannelId', () => {
    it('discordChannelId 条件で findOneAndUpdate し new:true を渡す', async () => {
      const updated = { characterId: 'c1' }
      const query = createQuery(updated)
      model.findOneAndUpdate.mockReturnValue(query)
      const updateData: Partial<Character> = { characterName: 'New' }

      const result = await repository.updateByChannelId('ch1', updateData)

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { discordChannelId: 'ch1' },
        { $set: updateData },
        { new: true }
      )
      expect(result).toBe(updated)
    })
  })

  describe('updateField', () => {
    it('field をキーにした updateData で update に委譲する', async () => {
      const updated = { characterId: 'c1' }
      const query = createQuery(updated)
      model.findOneAndUpdate.mockReturnValue(query)
      const data = { HP: { values: { base: 10 } } }

      const result = await repository.updateField('c1', 'status', data)

      // Mixed配下を深くmergeさせず、status全体を原子的に置換するpipelineを使う。
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { characterId: 'c1' },
        [{ $set: { status: { $literal: data } } }],
        { new: true }
      )
      expect(result).toBe(updated)
    })

    it('非正準形を永続化しない', async () => {
      const invalid = { HP: 10 } as unknown as Parameters<CharacterRepository['updateField']>[2]

      await expect(repository.updateField('c1', 'status', invalid)).rejects.toThrow(/AttributeSection/)
      expect(model.findOneAndUpdate).not.toHaveBeenCalled()
    })
  })

  describe('updateFieldByChannelId', () => {
    it('field をキーにした updateData で updateByChannelId に委譲する', async () => {
      const updated = { characterId: 'c1' }
      const query = createQuery(updated)
      model.findOneAndUpdate.mockReturnValue(query)
      const data = { 回避: { values: { base: 50 } } }

      const result = await repository.updateFieldByChannelId('ch1', 'skill', data)

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { discordChannelId: 'ch1' },
        [{ $set: { skill: { $literal: data } } }],
        { new: true }
      )
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
    it('必要フィールドのみ select し materialized version を優先して summary へ写す', async () => {
      const summaries = [
        {
          characterId: 'c1',
          characterName: 'Alice',
          gameSystemId: 'coc',
          sheet: { templateVersion: '2.0.0' },
          templatePin: { templateVersion: '1.0.0' },
          hub: { status: 'error' }
        },
        {
          characterId: 'c2',
          characterName: 'Bob',
          gameSystemId: 'coc',
          templatePin: { templateVersion: '1.0.0' }
        }
      ]
      const query = createQuery(summaries)
      model.find.mockReturnValue(query)

      const result = await repository.findUserCharacterSummaries('u1')

      expect(model.find).toHaveBeenCalledWith({ discordUserId: 'u1' })
      expect(query.select).toHaveBeenCalledWith(
        'characterId characterName gameSystemId sheet.templateVersion templatePin.templateVersion hub.status -_id'
      )
      expect(query.lean).toHaveBeenCalledTimes(1)
      expect(result).toEqual([
        {
          characterId: 'c1',
          characterName: 'Alice',
          gameSystemId: 'coc',
          templateVersion: '2.0.0',
          hub: { status: 'error' }
        },
        {
          characterId: 'c2',
          characterName: 'Bob',
          gameSystemId: 'coc',
          templateVersion: '1.0.0'
        }
      ])
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
