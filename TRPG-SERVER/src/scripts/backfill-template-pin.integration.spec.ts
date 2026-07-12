import { getModelToken, MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import { Model } from 'mongoose'
import { requireIsolatedMongoUri } from '../../test/testcontainers/mongo-uri'
import {
  BACKFILL_TEMPLATE_PIN,
  BackfillCharacterModel,
  BackfillLogger,
  runTemplatePinBackfill
} from './backfill-template-pin'
import { CHARACTER_MODEL, CharacterDocument, CharacterSchema } from '../domains/character/models/character.model'
import { CharacterRepository } from '../domains/character/repositories/character.repository'

describe('backfill-template-pin integration', () => {
  const mongoUri = requireIsolatedMongoUri()
  const logger: BackfillLogger = { log: jest.fn(), error: jest.fn() }
  let moduleRef: TestingModule
  let characterModel: Model<CharacterDocument>
  let repository: CharacterRepository

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: CHARACTER_MODEL, schema: CharacterSchema }])
      ],
      providers: [CharacterRepository]
    }).compile()

    characterModel = moduleRef.get<Model<CharacterDocument>>(getModelToken(CHARACTER_MODEL))
    repository = moduleRef.get(CharacterRepository)
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    await characterModel.deleteMany({}).exec()
  })

  afterAll(async () => {
    await characterModel.deleteMany({}).exec()
    await moduleRef.close()
  })

  it('初回 N 件だけを pin し、再実行は 0 件、rollback は専用 marker だけを戻す', async () => {
    const manualPin = { templateId: 'manual-template', templateVersion: '2.0.0', pinnedBy: 'user-1' }
    const materializedSheet = {
      templateId: 'materialized-template',
      templateVersion: '3.0.0',
      revision: 4,
      values: { hp: 12 }
    }
    await characterModel.create([
      character('legacy-a'),
      character('legacy-b'),
      { ...character('already-pinned'), templatePin: manualPin },
      { ...character('materialized'), sheet: materializedSheet }
    ])

    const model = characterModel as unknown as BackfillCharacterModel
    const first = await runTemplatePinBackfill({ mode: 'execute', repository, model, logger })
    const second = await runTemplatePinBackfill({ mode: 'execute', repository, model, logger })

    expect(first.targetCharacterIds).toEqual(['legacy-a', 'legacy-b'])
    expect(first.processedCharacterIds).toEqual(['legacy-a', 'legacy-b'])
    expect(second.targetCharacterIds).toEqual([])
    expect(second.processedCharacterIds).toEqual([])
    await expect(characterModel.findOne({ characterId: 'legacy-a' }).lean().exec()).resolves.toMatchObject({
      templatePin: BACKFILL_TEMPLATE_PIN
    })
    await expect(characterModel.findOne({ characterId: 'already-pinned' }).lean().exec()).resolves.toMatchObject({
      templatePin: manualPin
    })
    await expect(characterModel.findOne({ characterId: 'materialized' }).lean().exec()).resolves.toMatchObject({
      sheet: materializedSheet
    })

    const rollback = await runTemplatePinBackfill({ mode: 'rollback', repository, model, logger })

    expect(rollback.targetCharacterIds).toEqual(['legacy-a', 'legacy-b'])
    expect(rollback.processedCharacterIds).toEqual(['legacy-a', 'legacy-b'])
    await expect(characterModel.findOne({ characterId: 'legacy-a' }).lean().exec()).resolves.not.toHaveProperty(
      'templatePin'
    )
    await expect(characterModel.findOne({ characterId: 'legacy-b' }).lean().exec()).resolves.not.toHaveProperty(
      'templatePin'
    )
    await expect(characterModel.findOne({ characterId: 'already-pinned' }).lean().exec()).resolves.toMatchObject({
      templatePin: manualPin
    })
    await expect(characterModel.findOne({ characterId: 'materialized' }).lean().exec()).resolves.toMatchObject({
      sheet: materializedSheet
    })
  })
})

function character(characterId: string) {
  return {
    characterId,
    characterName: characterId,
    gameSystemId: 'coc7',
    discordUserId: 'user-1',
    discordChannelId: `channel-${characterId}`
  }
}
