import { useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import { useGalleryStore } from '../store/galleryStore'
import type { TemplateSummary } from '../types'

const mock: TemplateSummary[] = [
  { id: 'coc_basic', name: 'CoC 基本', author: 'system', tags: ['coc'], version: '1.0.0', createdAt: '2025-01-01' },
  { id: 'dx3_basic', name: 'DX3 基本', author: 'system', tags: ['dx3'], version: '1.0.0', createdAt: '2025-01-01' }
]

export const Gallery = () => {
  const { items, setItems, query, setQuery } = useGalleryStore()
  const [filtered, setFiltered] = useState<TemplateSummary[]>(items)

  useEffect(() => {
    if (items.length === 0) setItems(mock)
  }, [items.length, setItems])

  const fuse = useMemo(() => new Fuse(items, { keys: ['name', 'tags', 'author'] }), [items])

  useEffect(() => {
    if (!query) setFiltered(items)
    else setFiltered(fuse.search(query).map((r) => r.item))
  }, [items, query, fuse])

  return (
    <div>
      <h3>Public Gallery</h3>
      <input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>
        {filtered.map((t) => (
          <li key={t.id}>
            {t.name} — {t.author} — v{t.version} — {t.tags?.join(', ')}
          </li>
        ))}
      </ul>
    </div>
  )
}
