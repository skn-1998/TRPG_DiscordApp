// 貼り付け用 JSON がサーバー保存時検証（validatePublishTemplate）を通ることの事前実測。
// サーバーの create() と同じキー合成（templateId/author/visibility 既定）を再現して engine へ渡す。
const { readFileSync } = require('node:fs')
const path = require('node:path')
const {
  validatePublishTemplate,
  validateStandaloneRollNotations,
} = require('../../../packages/sheet-engine/dist')

const body = JSON.parse(readFileSync(path.join(__dirname, process.argv[2] ?? 'coc6-cc-haiku.json'), 'utf8'))

const engineTemplate = {
  templateId: 'probe-local',
  name: body.name,
  version: body.version ?? '0.1.0',
  schemaVersion: body.schemaVersion ?? 3,
  gameSystemId: body.gameSystemId,
  tags: body.tags ?? [],
  visibility: body.visibility ?? 'private',
  authorDiscordUserId: 'probe-local',
  forkedFrom: body.forkedFrom,
  license: body.license,
  sections: body.sections ?? [],
  tables: body.tables ?? [],
  settings: { rounding: 'floor', ...(body.settings ?? {}) },
}

const save = validatePublishTemplate(engineTemplate)
const standalone = validateStandaloneRollNotations(engineTemplate)

console.log(JSON.stringify({
  saveOk: save.ok,
  saveIssues: save.issues,
  saveWarnings: save.warnings,
  standaloneIssues: standalone,
  resolvedRefCount: save.resolvedRefs.length,
}, null, 2))
