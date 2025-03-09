import { UserDefinedDiceTable } from 'bcdice'

export const tableDice = (
  channelName: string,
  contents: string[],
  isDirect: boolean
): string | undefined => {
  const text = isDirect
    ? contents[0]
    : createTaleDiceText(channelName, contents)

  const table = new UserDefinedDiceTable(text)
  return table.roll()?.text
}

function createTaleDiceText(channelName: string, contents: string[]): string {
  const roll = `1d${contents.length}`
  const contentsRows = contents
    .reverse()
    .map((e, i) => `${i + 1}:${e.replace(/\n/g, '\\n')}`)
    .join('\n')
  return `${channelName}\n${roll}\n${contentsRows}`
}
