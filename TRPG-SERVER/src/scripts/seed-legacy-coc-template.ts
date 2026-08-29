import 'tsconfig-paths/register'

import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { INestApplicationContext } from '@nestjs/common'
import type {
  CharacterSheetTemplateEntity,
  SheetTemplateSection,
  SheetTemplateTable
} from '../domains/character-sheet-template/models/character-sheet-template.entity'
import { SYSTEM_TEMPLATE_AUTHOR } from '../domains/character-sheet-template/character-sheet-template.constants'
import { LEGACY_COC_TEMPLATE } from '../domains/character-sheet-template/seeds/legacy-coc.template'
import { collectTemplatePublishValidationIssues } from '../domains/character-sheet-template/validation/template-publish-validation-issue.collector'

/**
 * 配布中の system テンプレートを `legacy-coc-v4`（LEGACY_COC_TEMPLATE）へ入れ替える seeder。
 * v4 の published 行を 1 件投入し、置き換えられた旧 `legacy-coc-v3` の行を deprecated へ落とす。
 *
 * Why: v3 はカスタム技能・ステータス欄を持たず、キャラ固有の行を追加できない
 * （seeds/legacy-coc.template.ts の Why）。v4 の行を足すだけでは足りない。一覧は requester を問わず
 * system 所有の published 行を配る
 * （repositories/character-sheet-template.repository.ts の findListedSummariesForRequester）ため、
 * 旧行が published のままだと技能の無い側が選択肢に残る。
 * この 1 件の入れ替えが目的で、汎用 seeder 基盤ではない。
 *
 * 冪等キー: templateId + version。同じ published 行が既にあれば挿入しない（再実行安全）。
 * deprecate も published 行だけを対象にするので、2 回目以降は一致行なしで何も変えない。
 * 既定は dry-run。書き込みは `--execute` を明示したときだけ行い、本番 DB への誤爆を防ぐ。
 * rollback 経路は持たない（誤投入時は該当 templateId の 1 行を手で削除する）。
 */

/**
 * v4 に置き換えられた旧テンプレートの id。
 *
 * この行は DB から消さず deprecated にするだけにする。旧 `legacy-coc-v3` に pin された既存キャラが
 * 残っている前提で、pin 解決（CharacterSheetTemplateService.resolvePinnedRevision）は deprecated を
 * 受理する一方、新規作成の解決（resolveForCreate）と上記の一覧は published しか通さない。
 * つまり deprecate だけで「新しく選べない・既存キャラは解決できる」になる。
 *
 * 本番は 2026-08-22 の v3 seeder 実行で v1 / v2 とも deprecate 済み（実測記録は TRPG-SERVER/AI.character.md）。
 * 以前の seeder を通していない環境ではさらに古い世代が published のまま残り得るが、
 * この seeder は直前の 1 段しか落とさない。
 */
const PREVIOUS_TEMPLATE_ID = 'legacy-coc-v3'

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
  /** 一致する published 行が無ければ `null`。行を消さずに status だけを落とす。 */
  deprecatePublished(templateId: string, authorDiscordUserId: string): Promise<CharacterSheetTemplateEntity | null>
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
  /** 旧行を published から deprecated へ落としたか。対象行が無かった場合も false になる。 */
  deprecatedPrevious: boolean
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

  // 旧行を落としてよいのは v4 が published として在るときだけ。insert に失敗したまま
  // 旧行を deprecate すると、一覧に出る system テンプレートが 1 つも無くなる。
  // skip-existing は同版の published 行が既にあるので insert 無しでも成立する。
  // dry-run は書き込まないので、insert 予定（decision='insert' かつ失敗なし）を成立扱いにして
  // 「execute ならこうなる」をそのまま出力する。
  const canDeprecatePrevious = decision === 'skip-existing' || (decision === 'insert' && !insertFailed)

  let deprecatedPrevious = false
  let deprecateFailed = false
  if (canDeprecatePrevious) {
    if (mode === 'dry-run') {
      logger.log(`would deprecate templateId=${PREVIOUS_TEMPLATE_ID} author=${SYSTEM_TEMPLATE_AUTHOR}`)
    } else {
      try {
        const previous = await repository.deprecatePublished(PREVIOUS_TEMPLATE_ID, SYSTEM_TEMPLATE_AUTHOR)
        deprecatedPrevious = previous !== null
        // 一致行なしは新規セットアップ・実行済みのどちらでも起きる正常系。失敗と読まれないよう文言で分ける。
        logger.log(
          deprecatedPrevious
            ? `deprecated templateId=${PREVIOUS_TEMPLATE_ID}`
            : `no published ${PREVIOUS_TEMPLATE_ID} row to deprecate (absent or already deprecated)`
        )
      } catch (error) {
        deprecateFailed = true
        logger.error(formatError(error))
      }
    }
  }

  const failed = insertFailed || deprecateFailed || decision === 'validation-failed' || decision === 'conflict-existing'
  return {
    mode,
    templateId: entity.templateId,
    version: entity.version,
    decision,
    issues,
    inserted,
    deprecatedPrevious,
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
