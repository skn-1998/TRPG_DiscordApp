const { readFileSync } = require('fs')
const { resolve } = require('path')
const { evaluateConstraint, evaluateTemplate, validatePublishTemplate } = require('../../../packages/sheet-engine/dist')

const jsonName = process.argv[2] || 'coc6-grok-4.6.json'
const body = JSON.parse(readFileSync(resolve(__dirname, jsonName), 'utf8'))
const template = {
  ...body,
  templateId: 'trial-coc6-grok-46',
  tags: [],
  visibility: 'private',
  authorDiscordUserId: 'trial'
}

const result = validatePublishTemplate(template)
console.log(JSON.stringify({ ok: result.ok, issues: result.issues, warnings: result.warnings }, null, 2))
if (!result.ok) {
  process.exit(1)
}

const sampleValues = {
  abilities_str: 50,
  abilities_siz: 65,
  abilities_con: 55,
  abilities_pow: 60,
  abilities_int: 70,
  abilities_edu: 80
}
const status = template.sections.find((section) => section.id === 'status')
const hp = status.fields.find((field) => field.id === 'hp')
const mp = status.fields.find((field) => field.id === 'mp')
const san = status.fields.find((field) => field.id === 'san')
const evaluated = evaluateTemplate(template, { values: sampleValues })
const summary = {
  hpMax: evaluateConstraint(hp.max, template, sampleValues),
  mpMax: evaluateConstraint(mp.max, template, sampleValues),
  sanMax: evaluateConstraint(san.max, template, sampleValues),
  idea: evaluated.values.status_idea,
  luck: evaluated.values.status_luck,
  know: evaluated.values.status_know,
  db: evaluated.values.status_db
}
console.log(JSON.stringify(summary, null, 2))
