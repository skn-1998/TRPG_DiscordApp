import { Link, Outlet, useOutletContext } from '@remix-run/react'
import { CharacterCreate, CharacterList } from '~/features/character'

const characters = [
  {
    id: '1',
    name: 'サンプルキャラクター',
    gameSystem: 'クトゥルフ神話TRPG'
  }
]

export default function User() {
  // 親ルート(User.tsx)の loader が返す型情報を取得
  const outletContextData = useOutletContext<{ data: unknown; cookie: string }>()

  return (
    <>
      <CharacterCreate />
      <CharacterList
        characters={characters}
        onCreateNew={() => console.log('新規作成')}
        onEditCharacter={(character) => console.log('編集:', character)}
        onCharacterClick={(character) => console.log('詳細:', character)}
      />
    </>
  )
}
