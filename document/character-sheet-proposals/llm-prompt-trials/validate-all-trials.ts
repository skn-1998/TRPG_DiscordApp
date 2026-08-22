import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { evaluateTemplate, validatePublishTemplate } from '../../../packages/sheet-engine/dist'

const dir = __dirname
const files = readdirSync(dir)
  .filter((name) => name.startsWith('coc6-') && name.endsWith('.json'))
  .sort()

const sampleValues = {
  abilities_str: 50,
  abilities_siz: 65,
  abilities_con: 55,
  abilities_pow: 60,
  abilities_int: 70,
  abilities_edu: 80,
  abilities_pow_stat: 60,
  abilities_int_stat: 70
}

for (const file of files) {
  const jsonPath = resolve(dir, file)
  const body = JSON.parse(readFileSync(jsonPath, 'utf8')) as Record<string, unknown>
  const forSave = {
    ...body,
    templateId: `trial-${file.replace(/\.json$/, '')}`,
    tags: [],
    visibility: 'private',
    authorDiscordUserId: 'trial'
  }
  const result = validatePublishTemplate(forSave)
  const summary: Record<string, unknown> = {
    file,
    parseOk: true,
    gameSystemId: body.gameSystemId,
    sectionCount: Array.isArray(body.sections) ? body.sections.length : 0,
    tableRows: Array.isArray(body.tables)
      ? (body.tables as Array<{ rows?: unknown[] }>)[0]?.rows?.length ?? 0
      : 0,
    publishOk: result.ok,
    issues: result.issues,
    warnings: result.warnings
  }
  if (result.ok) {
    const evaluated = evaluateTemplate(forSave as never, { values: sampleValues })
    summary.evaluated = {
      hp: evaluated.values.status_hp,
      mp: evaluated.values.status_mp,
      san: evaluated.values.status_san,
      idea: evaluated.values.status_idea,
      luck: evaluated.values.status_luck,
      know: evaluated.values.status_know ?? evaluated.values.status_knowledge,
      db: evaluated.values.status_db ?? evaluated.values.status_damage_bonus
    }
  }
  console.log(JSON.stringify(summary, null, 2))
  console.log('---')
}
