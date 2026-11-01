'use client'

import { Badge, Group, Progress, Stack, Text, Title } from '@mantine/core'
import {
  evaluateAnnotationRuntime,
  evaluateConstraint,
  resolveGridSpan,
  resolveSectionLayout,
  type ConstraintEvaluationResult,
  type SectionAnnotationRuntime,
  type SheetField,
  type SheetTemplate
} from '@trpg/sheet-engine'
import { useMemo, type ReactNode } from 'react'
import {
  FieldRenderer,
  type CreationRollReroll as CreationRollRerollOptions
} from './fields/FieldRenderer'
import { TableFieldLayout } from './layouts/TableFieldLayout'
import styles from './TemplateFormRenderer.module.css'

export type { CreationRollReroll } from './fields/FieldRenderer'

interface TemplateFormRendererProps {
  template: SheetTemplate
  values: Record<string, unknown>
  onChange?: (fieldUid: string, value: unknown) => void
  onPartsChange?: (fieldUid: string, partsKey: string, value: number) => void
  /**
   * 呼び出し側のページ構造に section 見出しの階層を合わせる。既定値 2 は従来の h2 構造を維持する。
   */
  headingLevel?: 2 | 3
  /**
   * 呼び出し側が field 単位で描画を差し替える controlled 拡張点。既定描画を defaultNode として渡して呼ぶので、
   * 差し替えない field は defaultNode をそのまま返す。未指定なら全 field が既定描画のまま（既存呼び出し側は無影響）。
   * 例外: table layout の parts 列は行構造ごと parts 専用に組むため、この差し替えを経由しない。
   * table layout では labelledBy を渡さないため既定の aria-labelledby を再現できず、差し替え側が自前のラベルを要する。
   */
  renderField?: (field: SheetField, defaultNode: ReactNode) => ReactNode
  /**
   * 作成時ロールを宣言している field へ振り直しの導線を出す拡張点。未指定なら導線を一切描かない。
   *
   * この component は実シートの編集（CharacterSheetEditClient）とテンプレートのプレビュー
   * （TemplatePreviewV3）の 2 箇所から使われる。プレビューには保存先のキャラクターが存在しないので
   * 振り直しを出してはならず、prop を渡さないことでそれを保証する。
   *
   * この「未指定なら描かない」は TFR で初めての形。他の optional prop（onChange・onPartsChange）は
   * 未指定でも UI を描き続け、`?.()` で編集だけが無効になる。よって既存 prop の読み方をこの prop へ
   * 持ち込まないこと。保証を与えているのは FieldRenderer 内の未指定 early return 1 行だけで、
   * spec の「creationRollReroll 未指定なら宣言済み field にも導線を描かない」と
   * 「TemplatePreviewV3 は creationRollReroll を渡さない」の 2 本がその不変条件を固定している。
   *
   * callback と実行中 uid を 1 つの prop にまとめているのは、片方だけを渡しても意味を成さない対であり、
   * かつ内部の描画関数群へ 2 本ではなく 1 本の引数として通せるため。
   */
  creationRollReroll?: CreationRollRerollOptions
}

type RenderFieldEntry = {
  field: SheetField
  fieldIndex: number
  blockId: string | undefined
  displayValue: number | undefined
  trackMax: ConstraintEvaluationResult | undefined
}

export function TemplateFormRenderer({
  template,
  values,
  onChange,
  onPartsChange,
  headingLevel = 2,
  renderField,
  creationRollReroll
}: TemplateFormRendererProps) {
  const blockHeadingLevel = headingLevel === 2 ? 3 : 4
  const annotationRuntime = useMemo(
    () => evaluateAnnotationRuntime(template, values),
    [template, values]
  )
  return (
    <Stack gap="lg">
      {template.sections.map((section, sectionIndex) => {
        if (section.fields.length === 0) return null

        const layout = resolveSectionLayout(section.layout)
        const annotations = annotationRuntime.sections[sectionIndex]
        const fields = buildRenderFieldEntries(section.fields, annotations, template, values)
        const fieldConstraintMessages = buildFieldConstraintMessages(annotations)

        return (
          <Stack component="section" gap="sm" key={`${section.id}:${sectionIndex}`}>
            <Title order={headingLevel}>{section.label}</Title>
            {renderSectionPools(section, annotations)}
            {annotations.blockIds.length > 0
              ? renderBlockGroups(
                section,
                fields,
                layout,
                values,
                onChange,
                onPartsChange,
                renderField,
                annotations,
                fieldConstraintMessages,
                blockHeadingLevel,
                creationRollReroll
              )
              : renderFieldContainer(
                fields,
                layout,
                values,
                onChange,
                onPartsChange,
                renderField,
                fieldConstraintMessages,
                creationRollReroll
              )}
          </Stack>
        )
      })}
    </Stack>
  )
}

function renderBlockGroups(
  section: SheetTemplate['sections'][number],
  fields: RenderFieldEntry[],
  layout: ReturnType<typeof resolveSectionLayout>,
  values: Record<string, unknown>,
  onChange: TemplateFormRendererProps['onChange'],
  onPartsChange: TemplateFormRendererProps['onPartsChange'],
  renderFieldOverride: TemplateFormRendererProps['renderField'],
  annotations: SectionAnnotationRuntime,
  fieldConstraintMessages: ReadonlyMap<string, string>,
  blockHeadingLevel: 3 | 4,
  creationRollReroll: TemplateFormRendererProps['creationRollReroll']
) {
  const blockLabels = new Map<string, string>()
  for (const block of section.blocks ?? []) {
    if (!blockLabels.has(block.id)) blockLabels.set(block.id, block.label)
  }

  const blockGroups = new Map<string, { label: string; fields: RenderFieldEntry[] }>()
  for (const blockId of annotations.blockIds) {
    blockGroups.set(blockId, { label: blockLabels.get(blockId) as string, fields: [] })
  }
  const defaultFields: RenderFieldEntry[] = []
  for (const entry of fields) {
    if (entry.blockId === undefined) defaultFields.push(entry)
    else blockGroups.get(entry.blockId)?.fields.push(entry)
  }

  return (
    <>
      {defaultFields.length > 0
        ? renderFieldContainer(
          defaultFields,
          layout,
          values,
          onChange,
          onPartsChange,
          renderFieldOverride,
          fieldConstraintMessages,
          creationRollReroll
        )
        : null}
      {[...blockGroups]
        .filter(([, { fields }]) => fields.length > 0)
        .map(([blockId, { label, fields }]) => {
          const capRuntime = annotations.blocks.find((block) => block.blockId === blockId)

          return (
            <Stack gap="xs" key={blockId}>
              {capRuntime === undefined ? (
                <Title order={blockHeadingLevel}>{label}</Title>
              ) : (
                <Group gap="xs">
                  <Title order={blockHeadingLevel}>{label}</Title>
                  {/* design-v1-ui の「制約評価 API」節 / SM-9(b): 未確定値は警告せず、評価失敗だけを制約単位で隠さず警告する。 */}
                  {capRuntime.status === 'ok' ? (
                    <Badge data-block-cap={capRuntime.cap}>上限 {capRuntime.cap}</Badge>
                  ) : capRuntime.status === 'indeterminate' ? (
                    <Badge data-block-cap="indeterminate">上限 —</Badge>
                  ) : (
                    <Text c="red" data-block-cap-error={blockId} size="sm">上限を評価できません</Text>
                  )}
                </Group>
              )}
              {renderFieldContainer(
                fields,
                layout,
                values,
                onChange,
                onPartsChange,
                renderFieldOverride,
                fieldConstraintMessages,
                creationRollReroll
              )}
            </Stack>
          )
        })}
    </>
  )
}

function buildRenderFieldEntries(
  fields: SheetField[],
  annotations: SectionAnnotationRuntime,
  template: SheetTemplate,
  values: Record<string, unknown>
): RenderFieldEntry[] {
  // fieldBlocks は engine が section.fields と同数・同順で返すため、宣言 index で対応付ける。
  return fields.map((field, fieldIndex) => ({
    field,
    fieldIndex,
    blockId: annotations.fieldBlocks[fieldIndex]?.blockId,
    displayValue: annotations.fieldBlocks[fieldIndex]?.displayValue,
    trackMax: field.type === 'track' ? evaluateConstraint(field.max, template, values) : undefined
  }))
}

function renderSectionPools(
  section: SheetTemplate['sections'][number],
  annotations: SectionAnnotationRuntime
) {
  if (annotations.pools.length === 0) return null

  const poolLabels = new Map<string, string>()
  for (const pool of section.pools ?? []) {
    if (!poolLabels.has(pool.id)) poolLabels.set(pool.id, pool.label)
  }

  return (
    <Stack gap="sm">
      {annotations.pools.map((pool) => {
        const label = poolLabels.get(pool.poolId) ?? pool.poolId

        // design-v1-ui の「制約評価 API」節 / SM-9(b): indeterminate は値だけ「—」へ退化し、error はこの pool 行だけで警告する。
        if (pool.status !== 'ok') {
          if (pool.status === 'indeterminate') {
            return (
              <Stack gap={4} key={pool.poolId} data-pool-id={pool.poolId} data-pool-status="indeterminate">
                <Text fw={600}>{label}</Text>
                <Text size="sm">残り —</Text>
              </Stack>
            )
          }
          return (
            <Stack gap={4} key={pool.poolId} data-pool-id={pool.poolId} data-pool-status="error">
              <Text fw={600}>{label}</Text>
              <Text c="red" data-pool-error={pool.poolId} size="sm">残量を評価できません</Text>
            </Stack>
          )
        }

        const isOver = pool.over

        return (
          <Stack gap={4} key={pool.poolId} data-pool-id={pool.poolId} data-pool-status={isOver ? 'danger' : 'ok'}>
            <Text fw={600}>{label}</Text>
            <Progress
              aria-label={`${label} の予算使用率`}
              color={isOver ? 'red' : 'blue'}
              value={toPoolProgress(pool.consumed, pool.total)}
            />
            <Text c={isOver ? 'red' : undefined} size="sm">
              {isOver ? `超過 ${Math.abs(pool.remaining)}` : `残り ${pool.remaining} / ${pool.total}`}
            </Text>
          </Stack>
        )
      })}
    </Stack>
  )
}

function toPoolProgress(consumed: number, total: number) {
  const percentage = (consumed / total) * 100
  // 非有限値は engine が error へ退化するため、NaN 防御の実効域は consumed=0 かつ total=0 の縁だけ。
  return Number.isNaN(percentage) ? 0 : Math.max(0, Math.min(100, percentage))
}

function buildFieldConstraintMessages(annotations: SectionAnnotationRuntime) {
  const fieldUids = new Set<string>()
  const ambiguousFieldUids = new Set<string>()
  for (const { fieldUid } of annotations.fieldBlocks) {
    if (fieldUids.has(fieldUid)) ambiguousFieldUids.add(fieldUid)
    else fieldUids.add(fieldUid)
  }
  const messages = new Map<string, string>()

  for (const limit of annotations.limits) {
    if (ambiguousFieldUids.has(limit.fieldUid)) continue
    // design-v1-ui の「制約評価 API」節 / SM-9(b): indeterminate は超過警告を抑え、error は該当 field の近傍だけで警告する。
    if (limit.status !== 'ok') {
      if (limit.status === 'indeterminate') continue
      messages.set(limit.fieldUid, '上限を評価できません')
      continue
    }
    if (!limit.over) continue
    messages.set(limit.fieldUid, `上限 ${limit.limit} を超えています（現在 ${limit.displayValue}）`)
  }

  return messages
}

function renderFieldContainer(
  fields: RenderFieldEntry[],
  layout: ReturnType<typeof resolveSectionLayout>,
  values: Record<string, unknown>,
  onChange: TemplateFormRendererProps['onChange'],
  onPartsChange: TemplateFormRendererProps['onPartsChange'],
  renderFieldOverride: TemplateFormRendererProps['renderField'],
  fieldConstraintMessages: ReadonlyMap<string, string>,
  creationRollReroll: TemplateFormRendererProps['creationRollReroll']
) {
  return (
    <div
      className={styles.fieldContainer}
      data-layout-mode={layout.mode}
      data-grid-columns={layout.columns ?? undefined}
    >
      {layout.mode === 'table' ? (
        <TableFieldLayout
          fields={fields}
          values={values}
          onChange={onChange}
          onPartsChange={onPartsChange}
          renderField={renderFieldOverride}
          fieldConstraintMessages={fieldConstraintMessages}
          creationRollReroll={creationRollReroll}
        />
      ) : fields.map(({ field, fieldIndex, displayValue, trackMax }) => {
        const span = layout.mode === 'grid' ? resolveGridSpan(field, layout.columns) : null

        return (
          <div
            key={`${field.uid}:${fieldIndex}`}
            className={span === null ? undefined : styles.gridField}
            data-field-uid={field.uid}
            data-grid-span={span ?? undefined}
          >
            <FieldRenderer
              field={field}
              value={values[field.uid]}
              displayValue={displayValue}
              trackMax={trackMax}
              onChange={onChange}
              onPartsChange={onPartsChange}
              renderField={renderFieldOverride}
              warning={fieldConstraintMessages.get(field.uid)}
              creationRollReroll={creationRollReroll}
            />
          </div>
        )
      })}
    </div>
  )
}
