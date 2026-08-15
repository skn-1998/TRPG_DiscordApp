import 'tsconfig-paths/register'

import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { INestApplicationContext } from '@nestjs/common'
import type {
  CharacterSheetTemplateEntity,
  SheetTemplateSection,
  SheetTemplateTable
} from '../domains/character-sheet-template/models/character-sheet-template.entity'
import { LEGACY_COC_TEMPLATE } from '../domains/character-sheet-template/seeds/legacy-coc.template'
import { collectTemplatePublishValidationIssues } from '../domains/character-sheet-template/validation/template-publish-validation-issue.collector'

/**
 * legacy-coc テンプレートの行を character-sheet-template コレクションへ 1 件だけ投入する seeder。
 *
 * Why: legacy-coc はコード側 seed（LEGACY_COC_TEMPLATE）としてしか存在せず DB に行が無い。
 * そのため legacy キャラクターの template 解決（findOne / resolvePinnedRevision）が
 * 「行が無い」ことで失敗する。この 1 件のギャップを埋めるのが目的で、汎用 seeder 基盤ではない。
 *
 * 冪等キー: templateId + version。同じ published 行が既にあれば何もしない（再実行安全）。
 * 既定は dry-run。実際の挿入は `--execute` を明示したときだけ行い、本番 DB への誤爆を防ぐ。
 * rollback 経路は持たない（誤投入時は該当 templateId の 1 行を手で削除する）。
 */

export type SeedMode = 'dry-run' | 'execute'

/**
 * - insert: 挿入対象（dry-run では表示のみ）
 * - skip-existing: 冪等キーが一致する published 行が既にある
 * - conflict-existing: 同 templateId で版 / status が異なる行がある（人間の判断へ返す）
 * - validation-failed: publish 検証に落ちた
 */
export type SeedDecision = 'insert' | 'skip-existing' | 'conflict-existing' | 'validation-failed'

export interface SeedTemplateRepository {
  findById(templateId: string): Promise<CharacterSheetTemplateEntity | null>
  create(entity: CharacterSheetTemplateEntity): Promise<CharacterSheetTemplateEntity>
}

export interface SeedLogger {
  log(message: string): void
  error(message: string): void
}

export interface SeedResult {
  mode: SeedMode
  templateId: string
  version: string
  decision: SeedDecision
  issues: string[]
  inserted: boolean
  exitCode: 0 | 1
}

/**
 * 保存する行を組み立てる。seed 実体（templateId / version / visibility / authorDiscordUserId 等）は
 * 一切書き換えず、永続化専用フィールド（status / draftRevision / publishedAt）だけを足す。
 */
export function buildLegacyCocSeedEntity(publishedAt: Date): CharacterSheetTemplateEntity {
  return {
    templateId: LEGACY_COC_TEMPLATE.templateId,
    status: 'published',
    version: LEGACY_COC_TEMPLATE.version,
    schemaVersion: LEGACY_COC_TEMPLATE.schemaVersion,
    name: LEGACY_COC_TEMPLATE.name,
    gameSystemId: LEGACY_COC_TEMPLATE.gameSystemId,
    tags: LEGACY_COC_TEMPLATE.tags,
    visibility: LEGACY_COC_TEMPLATE.visibility,
    authorDiscordUserId: LEGACY_COC_TEMPLATE.authorDiscordUserId,
    // engine 型（SheetSection / LookupTable）と entity 型（Record ベース）の境界。
    // sheet-engine-template.mapper.ts が担う entity → engine の逆向きで、同じ理由の cast。
    sections: LEGACY_COC_TEMPLATE.sections as unknown as SheetTemplateSection[],
    tables: LEGACY_COC_TEMPLATE.tables as unknown as SheetTemplateTable[],
    settings: LEGACY_COC_TEMPLATE.settings,
    draftRevision: 1,
    publishedAt
  }
}

export function parseSeedMode(args: string[]): SeedMode {
  const knownArgs = new Set(['--execute'])
  const unknownArg = args.find((arg) => !knownArgs.has(arg))
  if (unknownArg !== undefined) {
    throw new Error(`Unknown argument: ${unknownArg}`)
  }
  return args.includes('--execute') ? 'execute' : 'dry-run'
}

/**
 * publish 境界と同じ検証を、保存する行そのものに対して実行する。
 *
 * NOTE: 規約例外 - domain の SheetEngineTemplateValidationService.validateForPublish は
 * visibility='public' を要求するが、この seed は visibility='private' が正であり書き換えを禁じられている。
 * そのため visibility 方針だけを外し、残る 3 検証（engine publish 検証・standalone roll notation・
 * 投影キー衝突）は同じ関数・同じ順序で再利用する。検証を弱める・飛ばす経路は作らない。
 */
export function collectSeedPublishIssues(entity: CharacterSheetTemplateEntity): string[] {
  return collectTemplatePublishValidationIssues(entity).flatMap(({ issues }) =>
    issues.map((issue) => (issue.path === undefined ? issue.message : `${issue.path}: ${issue.message}`))
  )
}

function decideSeedAction(
  entity: CharacterSheetTemplateEntity,
  existing: CharacterSheetTemplateEntity | null,
  issues: string[]
): SeedDecision {
  // 検証落ちは他の判定より先に確定させ、挿入へ進む経路を残さない
  if (issues.length > 0) return 'validation-failed'
  if (existing === null) return 'insert'
  if (existing.status === 'published' && existing.version === entity.version) return 'skip-existing'
  // templateId は unique index。版 / status が違う行の上書きは seeder の責務を超える
  return 'conflict-existing'
}

function formatError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

export async function runLegacyCocTemplateSeed(options: {
  mode: SeedMode
  repository: SeedTemplateRepository
  logger: SeedLogger
  publishedAt?: Date
}): Promise<SeedResult> {
  const { mode, repository, logger, publishedAt = new Date() } = options
  const entity = buildLegacyCocSeedEntity(publishedAt)

  const issues = collectSeedPublishIssues(entity)
  const existing = await repository.findById(entity.templateId)
  const decision = decideSeedAction(entity, existing, issues)

  logger.log(`mode=${mode} templateId=${entity.templateId} version=${entity.version} decision=${decision}`)
  for (const issue of issues) {
    logger.error(`validation ${issue}`)
  }
  if (decision === 'conflict-existing' && existing !== null) {
    logger.error(`existing row conflicts: status=${existing.status} version=${existing.version}`)
  }

  let inserted = false
  let insertFailed = false
  if (mode === 'execute' && decision === 'insert') {
    try {
      await repository.create(entity)
      inserted = true
    } catch (error) {
      insertFailed = true
      logger.error(formatError(error))
    }
  }
  logger.log(`inserted=${inserted}`)

  const failed = insertFailed || decision === 'validation-failed' || decision === 'conflict-existing'
  return {
    mode,
    templateId: entity.templateId,
    version: entity.version,
    decision,
    issues,
    inserted,
    exitCode: failed ? 1 : 0
  }
}

export async function main(args: string[] = process.argv.slice(2)): Promise<number> {
  const logger = new Logger('SeedLegacyCocTemplate')
  let app: INestApplicationContext | undefined

  try {
    const mode = parseSeedMode(args)
    const [{ AppModule }, { CharacterSheetTemplateRepository }] = await Promise.all([
      import('../app.module'),
      import('../domains/character-sheet-template/repositories/character-sheet-template.repository')
    ])
    app = await NestFactory.createApplicationContext(AppModule)
    const repository = app.get(CharacterSheetTemplateRepository)
    const result = await runLegacyCocTemplateSeed({ mode, repository, logger })
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
      new Logger('SeedLegacyCocTemplate').error(formatError(error))
      process.exitCode = 1
    }
  )
}
