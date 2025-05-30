//  登録するスラッシュコマンドを記述する

export type commandType = {
  name: string
  description: string
}

export const createCharacterThreadConfig: commandType = {
  name: 'create-character-thread',
  description: 'キャラクター用のダイスロールスレッドを作成'
}

export const rollDiceConfig: commandType = {
  name: 'd',
  description: 'ダイスを振る'
}

export const selectGameSystemConfig: commandType = {
  name: 'create-dice-channel',
  description: 'ダイスロールチャンネルを作成'
}

export const userDefinedDiceConfig: commandType = {
  name: 'user-dice',
  description: 'オリジナルダイス表を振る'
}

export const diceFromContextMenuConfig: commandType = {
  name: 'dice-from-context-menu',
  description: 'このメッセージのコマンドでダイスを振る'
}

export const diceResultConfig: commandType = {
  name: 'dice-result',
  description: 'ダイスロール結果を表示'
}
