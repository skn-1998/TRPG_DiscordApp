import 'tsconfig-paths/register'

import { Logger } from '@nestjs/common'
import { getModelToken } from '@nestjs/mongoose'
import { NestFactory } from '@nestjs/core'
import type { INestApplicationContext } from '@nestjs/common'
import type { CharacterTemplatePin } from '../domains/character/models/character.entity'
import { CHARACTER_MODEL } from '../domains/character/models/character.model'
import { LEGACY_COC_TEMPLATE } from '../domains/character-sheet-template/seeds/legacy-coc.template'

export const BACKFILL_PINNED_BY = 'backfill-2026-07'

export const BACKFILL_TEMPLATE_PIN: CharacterTemplatePin = {
  templateId: 'legacy-coc',
  templateVersion: LEGACY_COC_TEMPLATE.version,
  pinnedBy: BACKFILL_PINNED_BY
}

export const LEGACY_UNPINNED_FILTER = {
  sheet: { $exists: false },
  templatePin: { $exists: false }
}

export const BACKFILL_MARKER_FILTER = {
  'templatePin.pinnedBy': BACKFILL_PINNED_BY
}

export type BackfillMode = 'dry-run' | 'execute' | 'rollback'

type CharacterIdProjection = {
  characterId: string
}

type CharacterIdQuery = {
  select(selection: string): CharacterIdQuery
  lean(): CharacterIdQuery
  exec(): Promise<CharacterIdProjection[]>
}

type UpdateOneResult = {
  modifiedCount: number
}

export interface BackfillCharacterModel {
  find(filter: Record<string, unknown>): CharacterIdQuery
  updateOne(filter: Record<string, unknown>, update: Record<string, unknown>): { exec(): Promise<UpdateOneResult> }
}

export interface TemplatePinRepository {
  setTemplatePin(characterId: string, pin: CharacterTemplatePin): Promise<unknown>
}

export interface BackfillLogger {
  log(message: string): void
  error(message: string): void
}

export interface BackfillResult {
  mode: BackfillMode
  targetCharacterIds: string[]
  processedCharacterIds: string[]
  skippedCharacterIds: string[]
  failedCharacterIds: string[]
  exitCode: 0 | 1
}

export function parseBackfillMode(args: string[]): BackfillMode {
  const knownArgs = new Set(['--execute', '--rollback'])
  const unknownArg = args.find((arg) => !knownArgs.has(arg))
  if (unknownArg !== undefined) {
    throw new Error(`Unknown argument: ${unknownArg}`)
  }
  if (args.includes('--execute') && args.includes('--rollback')) {
    throw new Error('--execute and --rollback cannot be used together')
  }
  if (args.includes('--rollback')) return 'rollback'
  if (args.includes('--execute')) return 'execute'
  return 'dry-run'
}

async function findCharacterIds(model: BackfillCharacterModel, filter: Record<string, unknown>): Promise<string[]> {
  const characters = await model.find(filter).select('characterId -_id').lean().exec()
  return characters.map(({ characterId }) => characterId).sort()
}

function logIds(logger: BackfillLogger, label: string, characterIds: string[]): void {
  logger.log(`${label}Count=${characterIds.length}`)
  logger.log(`${label}CharacterIds=${characterIds.length === 0 ? '(none)' : characterIds.join(',')}`)
}

function formatError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

export async function runTemplatePinBackfill(options: {
  mode: BackfillMode
  repository: TemplatePinRepository
  model: BackfillCharacterModel
  logger: BackfillLogger
}): Promise<BackfillResult> {
  const { mode, repository, model, logger } = options
  const targetFilter = mode === 'rollback' ? BACKFILL_MARKER_FILTER : LEGACY_UNPINNED_FILTER
  const targetCharacterIds = await findCharacterIds(model, targetFilter)

  logger.log(`mode=${mode}`)
  logIds(logger, 'target', targetCharacterIds)

  const processedCharacterIds: string[] = []
  const skippedCharacterIds: string[] = []
  const failedCharacterIds: string[] = []

  if (mode === 'execute') {
    for (const characterId of targetCharacterIds) {
      try {
        const updated = await repository.setTemplatePin(characterId, BACKFILL_TEMPLATE_PIN)
        if (updated === null) skippedCharacterIds.push(characterId)
        else processedCharacterIds.push(characterId)
      } catch (error) {
        failedCharacterIds.push(characterId)
        logger.error(`characterId=${characterId} ${formatError(error)}`)
      }
    }
  }

  if (mode === 'rollback') {
    for (const characterId of targetCharacterIds) {
      try {
        const result = await model
          .updateOne({ characterId, ...BACKFILL_MARKER_FILTER }, { $unset: { templatePin: 1 } })
          .exec()
        if (result.modifiedCount === 1) processedCharacterIds.push(characterId)
        else skippedCharacterIds.push(characterId)
      } catch (error) {
        failedCharacterIds.push(characterId)
        logger.error(`characterId=${characterId} ${formatError(error)}`)
      }
    }
  }

  if (mode !== 'dry-run') {
    logIds(logger, 'processed', processedCharacterIds)
    logIds(logger, 'skipped', skippedCharacterIds)
    logIds(logger, 'failed', failedCharacterIds)
  }

  return {
    mode,
    targetCharacterIds,
    processedCharacterIds,
    skippedCharacterIds,
    failedCharacterIds,
    exitCode: failedCharacterIds.length === 0 ? 0 : 1
  }
}

export async function main(args: string[] = process.argv.slice(2)): Promise<number> {
  const logger = new Logger('BackfillTemplatePin')
  let app: INestApplicationContext | undefined

  try {
    const mode = parseBackfillMode(args)
    const [{ AppModule }, { CharacterRepository }] = await Promise.all([
      import('../app.module'),
      import('../domains/character/repositories/character.repository')
    ])
    app = await NestFactory.createApplicationContext(AppModule)
    const repository = app.get(CharacterRepository)
    const model = app.get<BackfillCharacterModel>(getModelToken(CHARACTER_MODEL))
    const result = await runTemplatePinBackfill({ mode, repository, model, logger })
    return result.exitCode
  } catch (error) {
    logger.error(formatError(error))
    return 1
  } finally {
    await app?.close()
  }
}

if (require.main === module) {
  void main().then(
    (exitCode) => {
      process.exitCode = exitCode
    },
    (error: unknown) => {
      new Logger('BackfillTemplatePin').error(formatError(error))
      process.exitCode = 1
    }
  )
}
