import { Stack, Title, TextInput, Textarea, NumberInput, Group, Select } from '@mantine/core'
import { UseFormReturnType } from '@mantine/form'

interface COCCharacterForm {
  name: string
  age: number
  gender: string
  occupation: string
  birthplace: string
  residence: string
  description: string
  backstory: string
  personalData: string
  importantPersons: string
  importantPlaces: string
  treasuredPossessions: string
  traits: string
}

interface DescriptionFormProps {
  form: UseFormReturnType<any>
}

const genderOptions = [
  { value: 'male', label: '男性' },
  { value: 'female', label: '女性' },
  { value: 'other', label: 'その他' },
  { value: 'notSpecified', label: '指定しない' }
]

const occupationOptions = [
  { value: 'antiquarian', label: '骨董収集家' },
  { value: 'archaeologist', label: '考古学者' },
  { value: 'artist', label: '芸術家' },
  { value: 'athlete', label: '運動選手' },
  { value: 'author', label: '作家' },
  { value: 'dilettante', label: 'ディレッタント' },
  { value: 'doctor', label: '医師' },
  { value: 'journalist', label: 'ジャーナリスト' },
  { value: 'lawyer', label: '弁護士' },
  { value: 'librarian', label: '司書' },
  { value: 'musician', label: '音楽家' },
  { value: 'professor', label: '教授' },
  { value: 'detective', label: '探偵' },
  { value: 'student', label: '学生' },
  { value: 'other', label: 'その他' }
]

export function DescriptionForm({ form }: DescriptionFormProps) {
  return (
    <Stack gap="md">
      <Title order={3} c="sub.5">
        基本情報
      </Title>

      <Group grow>
        <TextInput label="名前" placeholder="探索者の名前" {...form.getInputProps('name')} required />
        <NumberInput label="年齢" placeholder="20" min={15} max={90} {...form.getInputProps('age')} required />
      </Group>

      <Group grow>
        <Select label="性別" data={genderOptions} {...form.getInputProps('gender')} />
        <Select label="職業" data={occupationOptions} searchable {...form.getInputProps('occupation')} required />
      </Group>

      <Group grow>
        <TextInput label="出身地" placeholder="東京" {...form.getInputProps('birthplace')} />
        <TextInput label="現住所" placeholder="神奈川県横浜市" {...form.getInputProps('residence')} />
      </Group>

      <Textarea
        label="外見・特徴"
        placeholder="キャラクターの外見や特徴的な部分を記述してください"
        minRows={3}
        {...form.getInputProps('description')}
      />

      <Title order={4} c="sub.4" mt="lg">
        背景設定
      </Title>

      <Textarea
        label="個人的な説明"
        placeholder="性格や人柄、生い立ちなど"
        minRows={3}
        {...form.getInputProps('personalData')}
      />

      <Textarea
        label="重要な人物"
        placeholder="家族、友人、恋人、師匠など"
        minRows={2}
        {...form.getInputProps('importantPersons')}
      />

      <Textarea
        label="重要な場所"
        placeholder="故郷、思い出の場所、秘密の隠れ家など"
        minRows={2}
        {...form.getInputProps('importantPlaces')}
      />

      <Textarea
        label="宝物"
        placeholder="大切にしている物、家宝、記念品など"
        minRows={2}
        {...form.getInputProps('treasuredPossessions')}
      />

      <Textarea label="特徴・癖" placeholder="口癖、習慣、特技など" minRows={2} {...form.getInputProps('traits')} />

      <Textarea label="背景" placeholder="詳細な背景ストーリー" minRows={4} {...form.getInputProps('backstory')} />
    </Stack>
  )
}
