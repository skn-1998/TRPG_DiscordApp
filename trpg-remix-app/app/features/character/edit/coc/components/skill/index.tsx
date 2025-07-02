import { Stack, Title, NumberInput, Group, Text, Box, Collapse, Button, Badge } from '@mantine/core'
import { UseFormReturnType } from '@mantine/form'
import { useState } from 'react'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'

interface SkillData {
  name: string
  baseValue: number
  category: 'combat' | 'interpersonal' | 'knowledge' | 'physical' | 'mental' | 'survival'
  description?: string
}

interface COCSkills {
  // 戦闘スキル
  dodge: number
  fist: number
  grapple: number
  handgun: number
  rifle: number
  shotgun: number
  smg: number
  throw: number

  // 対人スキル
  charm: number
  fastTalk: number
  intimidate: number
  persuade: number
  psychology: number

  // 知識スキル
  accounting: number
  anthropology: number
  archaeology: number
  architecture: number
  art: number
  astronomy: number
  biology: number
  chemistry: number
  computerUse: number
  economics: number
  electronics: number
  geology: number
  history: number
  law: number
  library: number
  linguistics: number
  mathematics: number
  medicine: number
  naturalWorld: number
  occult: number
  physics: number
  psychoanalysis: number

  // 身体スキル
  climb: number
  drive: number
  electricalRepair: number
  firstAid: number
  jump: number
  mechanicalRepair: number
  operateHeavyMachinery: number
  pilot: number
  ride: number
  stealth: number
  swim: number

  // 精神スキル
  listen: number
  spotHidden: number

  // サバイバルスキル
  animalHandling: number
  navigation: number
  survival: number
  track: number
}

const skillCategories = {
  combat: {
    name: '戦闘',
    color: 'red',
    skills: [
      { key: 'dodge', name: '回避', baseValue: 0 },
      { key: 'fist', name: '格闘', baseValue: 25 },
      { key: 'grapple', name: '組み付き', baseValue: 25 },
      { key: 'handgun', name: '拳銃', baseValue: 20 },
      { key: 'rifle', name: 'ライフル', baseValue: 25 },
      { key: 'shotgun', name: 'ショットガン', baseValue: 30 },
      { key: 'smg', name: 'サブマシンガン', baseValue: 15 },
      { key: 'throw', name: '投擲', baseValue: 25 }
    ]
  },
  interpersonal: {
    name: '対人関係',
    color: 'blue',
    skills: [
      { key: 'charm', name: '魅惑', baseValue: 15 },
      { key: 'fastTalk', name: '言いくるめ', baseValue: 5 },
      { key: 'intimidate', name: '威圧', baseValue: 15 },
      { key: 'persuade', name: '説得', baseValue: 15 },
      { key: 'psychology', name: '心理学', baseValue: 5 }
    ]
  },
  knowledge: {
    name: '知識',
    color: 'green',
    skills: [
      { key: 'accounting', name: '経理', baseValue: 10 },
      { key: 'anthropology', name: '人類学', baseValue: 1 },
      { key: 'archaeology', name: '考古学', baseValue: 1 },
      { key: 'art', name: '芸術', baseValue: 5 },
      { key: 'astronomy', name: '天文学', baseValue: 1 },
      { key: 'biology', name: '生物学', baseValue: 1 },
      { key: 'chemistry', name: '化学', baseValue: 1 },
      { key: 'computerUse', name: 'コンピューター', baseValue: 1 },
      { key: 'history', name: '歴史', baseValue: 20 },
      { key: 'law', name: '法律', baseValue: 5 },
      { key: 'library', name: '図書館', baseValue: 25 },
      { key: 'medicine', name: '医学', baseValue: 5 },
      { key: 'occult', name: 'オカルト', baseValue: 5 },
      { key: 'psychoanalysis', name: '精神分析', baseValue: 1 }
    ]
  },
  physical: {
    name: '身体技能',
    color: 'orange',
    skills: [
      { key: 'climb', name: '登攀', baseValue: 40 },
      { key: 'drive', name: '運転', baseValue: 20 },
      { key: 'firstAid', name: '応急手当', baseValue: 30 },
      { key: 'jump', name: '跳躍', baseValue: 25 },
      { key: 'mechanicalRepair', name: '機械修理', baseValue: 20 },
      { key: 'ride', name: '乗馬', baseValue: 5 },
      { key: 'stealth', name: '隠れ身', baseValue: 10 },
      { key: 'swim', name: '水泳', baseValue: 25 }
    ]
  },
  mental: {
    name: '精神技能',
    color: 'purple',
    skills: [
      { key: 'listen', name: '聞き耳', baseValue: 25 },
      { key: 'spotHidden', name: '目星', baseValue: 25 }
    ]
  },
  survival: {
    name: 'サバイバル',
    color: 'teal',
    skills: [
      { key: 'animalHandling', name: '動物使い', baseValue: 5 },
      { key: 'navigation', name: 'ナビゲート', baseValue: 10 },
      { key: 'survival', name: 'サバイバル', baseValue: 10 },
      { key: 'track', name: '追跡', baseValue: 10 }
    ]
  }
} as const

interface SkillFormProps {
  form: UseFormReturnType<any>
}

export function SkillForm({ form }: SkillFormProps) {
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    combat: true,
    interpersonal: true,
    knowledge: false,
    physical: false,
    mental: true,
    survival: false
  })

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  return (
    <Stack gap="md">
      <Title order={3} c="sub.5">
        技能
      </Title>

      {Object.entries(skillCategories).map(([categoryKey, category]) => (
        <Box key={categoryKey}>
          <Button
            variant="subtle"
            color={category.color}
            onClick={() => toggleCategory(categoryKey)}
            leftSection={openCategories[categoryKey] ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            rightSection={
              <Badge color={category.color} size="sm">
                {category.skills.length}
              </Badge>
            }
            fullWidth
            justify="space-between"
            mb="xs"
          >
            {category.name}
          </Button>

          <Collapse in={openCategories[categoryKey]}>
            <Box pl="md" pb="md">
              {category.skills.map((skill, index) => {
                const isEvenRow = index % 3 === 0
                const rowSkills = category.skills.slice(index, index + 3)

                if (isEvenRow) {
                  return (
                    <Group key={`row-${index}`} grow mb="xs">
                      {rowSkills.map((rowSkill) => (
                        <NumberInput
                          key={rowSkill.key}
                          label={rowSkill.name}
                          placeholder={String(rowSkill.baseValue)}
                          min={0}
                          max={100}
                          size="sm"
                          {...form.getInputProps(`skills.${rowSkill.key as keyof COCSkills}`)}
                        />
                      ))}
                      {/* 3個に満たない場合の空要素 */}
                      {Array(3 - rowSkills.length)
                        .fill(null)
                        .map((_, emptyIndex) => (
                          <Box key={`empty-${emptyIndex}`} />
                        ))}
                    </Group>
                  )
                }
                return null
              })}
            </Box>
          </Collapse>
        </Box>
      ))}
    </Stack>
  )
}
