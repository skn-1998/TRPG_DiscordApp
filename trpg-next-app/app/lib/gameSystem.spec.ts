import {
  filterGameSystemOptions,
  gameSystemSelectOptions,
  resolveGameSystemOptions
} from './gameSystem'

describe('filterGameSystemOptions', () => {
  it('SEARCH_KEY_HIRAGANA のひらがなで検索できる', () => {
    const filtered = filterGameSystemOptions({
      options: gameSystemSelectOptions,
      search: 'しんくとぅるふしんわ'
    })

    expect(filtered).toContainEqual(expect.objectContaining({ value: 'Cthulhu7th' }))
  })

  it('SEARCH_KEY_KANJI の漢字混じり表記で検索できる', () => {
    const filtered = filterGameSystemOptions({
      options: gameSystemSelectOptions,
      search: 'くとぅるふ神話'
    })

    expect(filtered).toContainEqual(expect.objectContaining({ value: 'Cthulhu' }))
  })

  it('空検索では全件を返し、Select から limit が渡された場合だけ表示件数を制限する', () => {
    expect(filterGameSystemOptions({ options: gameSystemSelectOptions, search: '' })).toBe(gameSystemSelectOptions)
    expect(filterGameSystemOptions({ options: gameSystemSelectOptions, search: '', limit: 50 })).toHaveLength(50)
  })
})

describe('resolveGameSystemOptions', () => {
  it('一覧内 ID では共有 options をそのまま返す', () => {
    expect(resolveGameSystemOptions('Cthulhu')).toBe(gameSystemSelectOptions)
  })

  it('一覧に無い既存 ID だけを先頭へ補う', () => {
    expect(resolveGameSystemOptions('coc7')[0]).toEqual({ value: 'coc7', label: 'coc7（一覧に無い ID）' })
  })
})
