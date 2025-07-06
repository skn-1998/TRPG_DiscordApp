import { useState } from 'react'
import { Stack, Title, Button, Group, Container, Card, Grid, Divider, ScrollArea } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconDeviceFloppy, IconX } from '@tabler/icons-react'
import { DescriptionForm, SkillForm, StatusForm } from './components'
import { COCCharacterForm, COCStats, COCSkills, COCStatsModifiers } from './types'

const defaultStats: COCStats = {
  str: 10,
  con: 10,
  pow: 10,
  dex: 10,
  app: 10,
  siz: 10,
  int: 10,
  edu: 10
}

const defaultSkills: COCSkills = {
  // 戦闘スキル
  dodge: 0,
  fist: 25,
  grapple: 25,
  handgun: 20,
  rifle: 25,
  shotgun: 30,
  smg: 15,
  throw: 25,

  // 対人スキル
  charm: 15,
  fastTalk: 5,
  intimidate: 15,
  persuade: 15,
  psychology: 5,

  // 知識スキル
  accounting: 10,
  anthropology: 1,
  archaeology: 1,
  architecture: 1,
  art: 5,
  astronomy: 1,
  biology: 1,
  chemistry: 1,
  computerUse: 1,
  economics: 1,
  electronics: 1,
  geology: 1,
  history: 20,
  law: 5,
  library: 25,
  linguistics: 1,
  mathematics: 1,
  medicine: 5,
  naturalWorld: 1,
  occult: 5,
  physics: 1,
  psychoanalysis: 1,

  // 身体スキル
  climb: 40,
  drive: 20,
  electricalRepair: 10,
  firstAid: 30,
  jump: 25,
  mechanicalRepair: 20,
  operateHeavyMachinery: 1,
  pilot: 1,
  ride: 5,
  stealth: 10,
  swim: 25,

  // 精神スキル
  listen: 25,
  spotHidden: 25,

  // サバイバルスキル
  animalHandling: 5,
  navigation: 10,
  survival: 10,
  track: 10
}

const defaultStatsModifiers: COCStatsModifiers = {
  strBonus: 0,
  conBonus: 0,
  powBonus: 0,
  dexBonus: 0,
  appBonus: 0,
  sizBonus: 0,
  intBonus: 0,
  eduBonus: 0,
  strTemp: 0,
  conTemp: 0,
  powTemp: 0,
  dexTemp: 0,
  appTemp: 0,
  sizTemp: 0,
  intTemp: 0,
  eduTemp: 0
}

interface COCCharacterEditProps {
  initialData?: Partial<COCCharacterForm>
  onSave?: (data: COCCharacterForm) => void
  onCancel?: () => void
}

export function COCCharacterEdit({ initialData, onSave, onCancel }: COCCharacterEditProps) {
  const form = useForm<COCCharacterForm>({
    initialValues: {
      name: '',
      age: 25,
      gender: '',
      occupation: '',
      birthplace: '',
      residence: '',
      description: '',
      backstory: '',
      personalData: '',
      importantPersons: '',
      importantPlaces: '',
      treasuredPossessions: '',
      traits: '',
      stats: defaultStats,
      skills: defaultSkills,
      statsModifiers: defaultStatsModifiers,
      ...initialData
    },
    validate: {
      name: (value) => (value.length < 1 ? '名前は必須です' : null),
      age: (value) => (value < 15 || value > 90 ? '年齢は15歳から90歳の間で設定してください' : null),
      occupation: (value) => (value.length < 1 ? '職業は必須です' : null)
    }
  })

  const handleSave = () => {
    const validation = form.validate()
    if (!validation.hasErrors) {
      onSave?.(form.values)
      notifications.show({
        title: 'キャラクターが保存されました',
        message: `${form.values.name}のデータが保存されました`,
        color: 'green',
        icon: <IconCheck size={16} />
      })
    } else {
      notifications.show({
        title: '入力エラー',
        message: '必須項目を入力してください',
        color: 'red'
      })
    }
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* ヘッダー */}
        <Card withBorder radius="md" p="lg">
          <Group justify="space-between" align="center">
            <Title order={1} c="sub.5">
              クトゥルフ神話TRPG キャラクターシート
            </Title>
            <Group>
              {onCancel && (
                <Button variant="light" onClick={onCancel} leftSection={<IconX size={16} />}>
                  キャンセル
                </Button>
              )}
              <Button onClick={handleSave} color="comp" leftSection={<IconDeviceFloppy size={16} />}>
                保存
              </Button>
            </Group>
          </Group>
        </Card>

        {/* メインコンテンツ */}
        <Grid gutter="xl">
          {/* 左カラム */}
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Stack gap="xl">
              {/* 基本情報 */}
              <Card withBorder radius="md" p="lg">
                <DescriptionForm form={form} />
              </Card>
            </Stack>
          </Grid.Col>

          {/* 右カラム */}
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Stack gap="xl">
              {/* 能力値 */}
              <Card withBorder radius="md" p="lg">
                <StatusForm form={form} />
              </Card>

              {/* スキル */}
              <Card withBorder radius="md" p="lg" mah={600}>
                <ScrollArea h={550}>
                  <SkillForm form={form} />
                </ScrollArea>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>

        {/* フッター保存ボタン */}
        <Card withBorder radius="md" p="lg">
          <Group justify="center">
            <Button onClick={handleSave} color="comp" size="lg" leftSection={<IconDeviceFloppy size={20} />}>
              キャラクターを保存
            </Button>
          </Group>
        </Card>
      </Stack>
    </Container>
  )
}
