import { Checkbox, Group, Paper, Progress, Stack, Text } from '@mantine/core'
import type { ConstraintEvaluationResult, TrackField } from '@trpg/sheet-engine'
import { numberDisplayValue } from './renderer-value'

// 典型的な TRPG トラック規模だけをマーク列にし、DOM 肥大を防ぐため 30 超は数値表示へ退避する。
// max <= 0 は style ごとの退避規則として、割合を描く gauge は 0% を保ち、個数を描く checkboxes は列ごと退避する。
const MAX_TRACK_CHECKBOX_MARKS = 30

export function TrackFieldView({
  field,
  rawValue,
  maxRuntime
}: {
  field: TrackField
  rawValue: unknown
  maxRuntime: ConstraintEvaluationResult
}) {
  // design-v1-ui の「制約評価 API」節の numberOrZero 不変更契約により、未入力 track は engine が min 非依存で 0 評価するため、
  // evaluated 基底の preview・hub/Discord 投影と
  // 同じ表示へ揃える。定義済みだが壊れた raw は numberDisplayValue の「—」退化を維持する。
  const displayValue = rawValue === undefined ? 0 : numberDisplayValue(rawValue)
  const maxValue = maxRuntime.status === 'ok' ? maxRuntime.value : undefined
  const valueText = maxRuntime.status === 'error'
    ? String(displayValue ?? '—')
    : `${displayValue ?? '—'} / ${maxValue ?? '—'}`

  return (
    <Paper
      key={field.uid}
      p="sm"
      withBorder
      style={{ width: '100%' }}
      data-track-field={field.uid}
      data-track-max-status={maxRuntime.status}
    >
      <Stack gap={4}>
        <Text fw={600}>{field.label}</Text>
        {field.description === undefined ? null : <Text c="dimmed" size="xs">{field.description}</Text>}
        {field.style === 'gauge' ? (
          <Progress
            aria-label={`${field.label} のゲージ`}
            value={toTrackProgress(displayValue, maxValue)}
          />
        ) : null}
        {field.style === 'checkboxes' ? renderTrackCheckboxes(field, displayValue, maxValue) : null}
        <Text data-track-display-value={field.uid} size="sm">{valueText}</Text>
        {/* design-v1-ui の「制約評価 API」節 / SM-9(b): 未確定値は警告せず、評価失敗だけを制約単位で隠さず警告する。 */}
        {maxRuntime.status === 'error' ? (
          <Text c="red" data-track-max-error={field.uid} size="sm">最大値を評価できません</Text>
        ) : null}
      </Stack>
    </Paper>
  )
}

function renderTrackCheckboxes(
  field: TrackField,
  displayValue: number | undefined,
  maxValue: number | undefined
) {
  if (displayValue === undefined || maxValue === undefined) return null
  if (!Number.isInteger(maxValue) || maxValue <= 0 || maxValue > MAX_TRACK_CHECKBOX_MARKS) return null

  const checkedCount = Math.max(0, Math.min(maxValue, Math.floor(displayValue)))

  // Mantine Checkbox なら既存テーマの箱表現を保ちつつ、readOnly と tabIndex で編集用 Checkbox から分離できる。
  return (
    <Group
      aria-hidden="true"
      data-track-checkboxes={field.uid}
      gap="xs"
      wrap="wrap"
    >
      {Array.from({ length: maxValue }, (_, index) => (
        <Checkbox
          key={`${field.uid}:${index}`}
          checked={index < checkedCount}
          readOnly
          size="xs"
          tabIndex={-1}
        />
      ))}
    </Group>
  )
}

function toTrackProgress(value: number | undefined, max: number | undefined) {
  if (value === undefined || max === undefined || max <= 0) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}
