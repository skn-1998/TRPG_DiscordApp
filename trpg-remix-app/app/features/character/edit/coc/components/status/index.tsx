import { Stack, Title, NumberInput, Group, Text, Box, Card, Progress, Badge, Table } from '@mantine/core'
import { UseFormReturnType } from '@mantine/form'
import { useMemo } from 'react'

interface COCStats {
  str: number // 筋力 STR
  con: number // 体力 CON
  pow: number // 意思力 POW
  dex: number // 敏捷性 DEX
  app: number // 外見 APP
  siz: number // サイズ SIZ
  int: number // 知力 INT
  edu: number // 教育 EDU
}

interface COCStatsModifiers {
  strBonus: number
  conBonus: number
  powBonus: number
  dexBonus: number
  appBonus: number
  sizBonus: number
  intBonus: number
  eduBonus: number
  strTemp: number
  conTemp: number
  powTemp: number
  dexTemp: number
  appTemp: number
  sizTemp: number
  intTemp: number
  eduTemp: number
}

interface DerivedStats {
  hp: number // 耐久力 (CON + SIZ) / 2
  mp: number // マジックポイント POW
  san: number // 正気度 POW
  idea: number // アイデア INT * 5
  luck: number // 幸運 POW * 5
  know: number // 知識 EDU * 5
  db: string // ダメージボーナス
}

interface StatusFormProps {
  form: UseFormReturnType<any>
}

const statLabels = {
  str: { name: '筋力', abbr: 'STR', color: 'red' },
  con: { name: '体力', abbr: 'CON', color: 'orange' },
  pow: { name: '意思力', abbr: 'POW', color: 'purple' },
  dex: { name: '敏捷性', abbr: 'DEX', color: 'blue' },
  app: { name: '外見', abbr: 'APP', color: 'pink' },
  siz: { name: 'サイズ', abbr: 'SIZ', color: 'yellow' },
  int: { name: '知力', abbr: 'INT', color: 'green' },
  edu: { name: '教育', abbr: 'EDU', color: 'teal' }
}

function calculateDamageBonus(str: number, siz: number): string {
  const combined = str + siz
  if (combined <= 12) return '-1d6'
  if (combined <= 16) return '-1d4'
  if (combined <= 24) return '0'
  if (combined <= 32) return '+1d4'
  if (combined <= 40) return '+1d6'
  if (combined <= 56) return '+2d6'
  if (combined <= 72) return '+3d6'
  if (combined <= 88) return '+4d6'
  return '+5d6'
}

export function StatusForm({ form }: StatusFormProps) {
  const stats = form.values.stats as COCStats
  const statsModifiers = form.values.statsModifiers as COCStatsModifiers

  const derivedStats: DerivedStats = useMemo(() => {
    // 現在値を計算（基本値 + 増加分 + 一時的）
    const currentStats = {
      str: (stats.str || 0) + (statsModifiers?.strBonus || 0) + (statsModifiers?.strTemp || 0),
      con: (stats.con || 0) + (statsModifiers?.conBonus || 0) + (statsModifiers?.conTemp || 0),
      pow: (stats.pow || 0) + (statsModifiers?.powBonus || 0) + (statsModifiers?.powTemp || 0),
      siz: (stats.siz || 0) + (statsModifiers?.sizBonus || 0) + (statsModifiers?.sizTemp || 0),
      int: (stats.int || 0) + (statsModifiers?.intBonus || 0) + (statsModifiers?.intTemp || 0),
      edu: (stats.edu || 0) + (statsModifiers?.eduBonus || 0) + (statsModifiers?.eduTemp || 0)
    }

    return {
      hp: Math.floor((currentStats.con + currentStats.siz) / 2),
      mp: currentStats.pow,
      san: currentStats.pow,
      idea: currentStats.int * 5,
      luck: currentStats.pow * 5,
      know: currentStats.edu * 5,
      db: calculateDamageBonus(currentStats.str, currentStats.siz)
    }
  }, [stats, statsModifiers])

  const totalStats = Object.values(stats).reduce((sum: number, value: number) => sum + (value || 0), 0)

  return (
    <Stack gap="md">
      <Title order={3} c="sub.5">
        能力値
      </Title>

      {/* 能力値テーブル */}
      <Card withBorder p="md">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th></Table.Th>
              <Table.Th ta="center">STR</Table.Th>
              <Table.Th ta="center">CON</Table.Th>
              <Table.Th ta="center">POW</Table.Th>
              <Table.Th ta="center">DEX</Table.Th>
              <Table.Th ta="center">APP</Table.Th>
              <Table.Th ta="center">SIZ</Table.Th>
              <Table.Th ta="center">INT</Table.Th>
              <Table.Th ta="center">EDU</Table.Th>
              <Table.Th ta="center">HP</Table.Th>
              <Table.Th ta="center">MP</Table.Th>
              <Table.Th ta="center">SAN</Table.Th>
              <Table.Th ta="center">IDE</Table.Th>
              <Table.Th ta="center">幸運</Table.Th>
              <Table.Th ta="center">知識</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {/* 能力値（基本値） */}
            <Table.Tr>
              <Table.Td fw={500}>能力値</Table.Td>
              {Object.keys(statLabels).map((key) => (
                <Table.Td key={key} ta="center">
                  <NumberInput
                    size="xs"
                    min={3}
                    max={18}
                    w={60}
                    {...form.getInputProps(`stats.${key as keyof COCStats}`)}
                  />
                </Table.Td>
              ))}
              <Table.Td ta="center" c="comp.5" fw={600}>
                {derivedStats.hp}
              </Table.Td>
              <Table.Td ta="center" c="accent.5" fw={600}>
                {derivedStats.mp}
              </Table.Td>
              <Table.Td ta="center" c="main.5" fw={600}>
                {derivedStats.san}
              </Table.Td>
              <Table.Td ta="center" c="green.6" fw={600}>
                {derivedStats.idea}%
              </Table.Td>
              <Table.Td ta="center" c="blue.6" fw={600}>
                {derivedStats.luck}%
              </Table.Td>
              <Table.Td ta="center" c="teal.6" fw={600}>
                {derivedStats.know}%
              </Table.Td>
            </Table.Tr>

            {/* 増加分 */}
            <Table.Tr>
              <Table.Td fw={500}>増加分</Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.strBonus')} />
              </Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.conBonus')} />
              </Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.powBonus')} />
              </Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.dexBonus')} />
              </Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.appBonus')} />
              </Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.sizBonus')} />
              </Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.intBonus')} />
              </Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.eduBonus')} />
              </Table.Td>
              <Table.Td colSpan={6} ta="center" c="sub.3">
                <Text size="xs">計算値は自動更新</Text>
              </Table.Td>
            </Table.Tr>

            {/* 一時的 */}
            <Table.Tr>
              <Table.Td fw={500}>一時的</Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.strTemp')} />
              </Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.conTemp')} />
              </Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.powTemp')} />
              </Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.dexTemp')} />
              </Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.appTemp')} />
              </Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.sizTemp')} />
              </Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.intTemp')} />
              </Table.Td>
              <Table.Td ta="center">
                <NumberInput size="xs" w={60} {...form.getInputProps('statsModifiers.eduTemp')} />
              </Table.Td>
              <Table.Td colSpan={6}></Table.Td>
            </Table.Tr>

            {/* 現在値 */}
            <Table.Tr bg="gray.1">
              <Table.Td fw={600}>現在値</Table.Td>
              <Table.Td ta="center" fw={600}>
                {(stats.str || 0) + (statsModifiers?.strBonus || 0) + (statsModifiers?.strTemp || 0)}
              </Table.Td>
              <Table.Td ta="center" fw={600}>
                {(stats.con || 0) + (statsModifiers?.conBonus || 0) + (statsModifiers?.conTemp || 0)}
              </Table.Td>
              <Table.Td ta="center" fw={600}>
                {(stats.pow || 0) + (statsModifiers?.powBonus || 0) + (statsModifiers?.powTemp || 0)}
              </Table.Td>
              <Table.Td ta="center" fw={600}>
                {(stats.dex || 0) + (statsModifiers?.dexBonus || 0) + (statsModifiers?.dexTemp || 0)}
              </Table.Td>
              <Table.Td ta="center" fw={600}>
                {(stats.app || 0) + (statsModifiers?.appBonus || 0) + (statsModifiers?.appTemp || 0)}
              </Table.Td>
              <Table.Td ta="center" fw={600}>
                {(stats.siz || 0) + (statsModifiers?.sizBonus || 0) + (statsModifiers?.sizTemp || 0)}
              </Table.Td>
              <Table.Td ta="center" fw={600}>
                {(stats.int || 0) + (statsModifiers?.intBonus || 0) + (statsModifiers?.intTemp || 0)}
              </Table.Td>
              <Table.Td ta="center" fw={600}>
                {(stats.edu || 0) + (statsModifiers?.eduBonus || 0) + (statsModifiers?.eduTemp || 0)}
              </Table.Td>
              <Table.Td ta="center" c="comp.5" fw={600}>
                {derivedStats.hp}
              </Table.Td>
              <Table.Td ta="center" c="accent.5" fw={600}>
                {derivedStats.mp}
              </Table.Td>
              <Table.Td ta="center" c="main.5" fw={600}>
                {derivedStats.san}
              </Table.Td>
              <Table.Td ta="center" c="green.6" fw={600}>
                {derivedStats.idea}%
              </Table.Td>
              <Table.Td ta="center" c="blue.6" fw={600}>
                {derivedStats.luck}%
              </Table.Td>
              <Table.Td ta="center" c="teal.6" fw={600}>
                {derivedStats.know}%
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Card>

      {/* 統計情報 */}
      <Card withBorder p="md">
        <Group justify="space-between" mb="xs">
          <Text fw={500} c="sub.5">
            基本能力値合計
          </Text>
          <Badge color={totalStats >= 400 ? 'green' : totalStats >= 300 ? 'yellow' : 'red'}>{totalStats}</Badge>
        </Group>
        <Text size="sm" c="sub.3">
          ダメージボーナス:{' '}
          <Text span fw={600} c="red.5">
            {derivedStats.db}
          </Text>
        </Text>
      </Card>
    </Stack>
  )
}
