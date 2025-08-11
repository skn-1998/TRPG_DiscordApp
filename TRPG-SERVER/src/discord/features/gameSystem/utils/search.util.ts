import moji from 'moji'

export function convertSearchText(str: string): string[] {
  const hiragana = moji(str).convert('KK', 'HG').toString()
  const katakana = moji(str).convert('HG', 'KK').toString()
  return [str, hiragana, katakana]
}
