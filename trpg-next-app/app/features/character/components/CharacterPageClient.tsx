'use client'

import type { CharacterSummaryWire } from '@trpg/api-contract'
import { useState, useTransition } from 'react'
import { refreshCharacterList } from '../actions'
import { CharacterList } from './CharacterList'

interface CharacterPageClientProps {
  characters: CharacterSummaryWire[]
}

export function CharacterPageClient({ characters }: CharacterPageClientProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleManualRefresh = () => {
    setError(null)
    startTransition(async () => {
      const result = await refreshCharacterList()
      setError(result.error)
    })
  }

  return (
    <div>
      {isPending && (
        <div style={{ padding: '10px', backgroundColor: '#f0f0f0', marginBottom: '10px' }}>Loading characters...</div>
      )}

      {error && (
        <div style={{ padding: '10px', backgroundColor: '#ffebee', color: '#c62828', marginBottom: '10px' }}>
          Error: {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '10px' }}>
            Dismiss
          </button>
        </div>
      )}

      <div style={{ marginBottom: '10px' }}>
        <button onClick={handleManualRefresh} disabled={isPending}>
          {isPending ? 'Refreshing...' : 'Refresh Characters'}
        </button>
        <span style={{ marginLeft: '10px', fontSize: '14px', color: '#666' }}>
          {characters.length} character(s) loaded
        </span>
      </div>
      <CharacterList characters={characters} onCharacterClick={(character) => console.log('詳細:', character)} />
    </div>
  )
}
