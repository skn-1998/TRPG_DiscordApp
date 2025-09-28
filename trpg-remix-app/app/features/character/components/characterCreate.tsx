import { Button, ComboboxItem, TextInput, Stack } from '@mantine/core'
import { Select } from '@mantine/core'
import { useState } from 'react'
import { createCharacter } from '../api/character.service'
import { ActionFunctionArgs } from '@remix-run/node'
import { getJwtFromRequest, validateJwt, userData } from '~/features/auth'
import { Character } from '~/types'
import { gameSystemOptions, createGameSystemOptionsFilter } from '~/lib/gameSystem'

export async function action(args: ActionFunctionArgs) {
  console.log('action')
  const { request, context, params } = args

  const body = await request.formData()

  if (body.has('characterData')) {
    const _characterData = body.get('characterData') as string
    const characterData = JSON.parse(_characterData)
    const validated = (await validateJwt(args)) as userData

    const userId = validated?._id ? validated?._id : ''

    const jwt = getJwtFromRequest(request)

    const data = await createCharacter({ ...characterData, userId })

    // const getData = await getUserCharacters(jwt || 'no jwt')
    // console.log(getData)
  }

  return 'test'
}

interface CharacterCreateProps {
  onCharacterCreated?: (character?: any) => void
}

export function CharacterCreate({ onCharacterCreated }: CharacterCreateProps) {
  const [TRPGSystemValue, setTRPGSystemValue] = useState<ComboboxItem | null>(null)
  const [characterName, setCharacterName] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)

  async function handleCreateCharacter() {
    console.log('clicked!')

    if (!TRPGSystemValue) {
      return
    }

    if (!characterName.trim()) {
      return
    }

    setIsLoading(true)

    try {
      const characterData: Omit<Character, '_id' | 'createdAt' | 'updatedAt'> = {
        characterId: ``, // 仮のID生成
        characterName: characterName,
        gameSystemId: TRPGSystemValue.value,
        discordUserId: '', // TODO: 実際のユーザーIDを設定
        discordChannelId: '', // TODO: 実際のチャンネルIDを設定
        status: {}
      }

      const newCharacter = await createCharacter(characterData)
      console.log('newCharacter', newCharacter)

      // キャラクター作成成功後の処理
      onCharacterCreated?.(newCharacter)

      // フォームをリセット
      setCharacterName('')
      setTRPGSystemValue(null)
    } catch (error) {
      console.error('Character creation failed:', error)
      // TODO: エラーハンドリングを実装
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Stack gap="md">
      <TextInput
        label="キャラクター名"
        placeholder="キャラクター名を入力してください"
        value={characterName}
        onChange={(e) => setCharacterName(e.target.value)}
        required
      />

      <Select
        label="TRPG System"
        placeholder="TRPGシステムを選択してください"
        data={gameSystemOptions}
        searchable
        nothingFoundMessage="該当するシステムが見つかりません"
        value={TRPGSystemValue ? TRPGSystemValue.value : null}
        onChange={(_value, option) => setTRPGSystemValue(option)}
        withScrollArea={false}
        styles={{ dropdown: { maxHeight: 300, overflowY: 'auto' } }}
        filter={createGameSystemOptionsFilter()}
        required
      />

      <Button
        onClick={handleCreateCharacter}
        disabled={isLoading || !TRPGSystemValue || !characterName.trim()}
        loading={isLoading}
        fullWidth
      >
        {isLoading ? '作成中...' : 'キャラクターを作成'}
      </Button>
    </Stack>
  )
}
