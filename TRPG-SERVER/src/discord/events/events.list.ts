// イベントの基本型
export type eventType = {
  customId: string // カスタムID
}

// 選択肢を持つイベントの型
export type eventSelectType = eventType & {
  placeholder: string // プレースホルダー
}

// ボタンを持つイベントの型
export type eventButtonType = eventType & {
  label: string // ラベル
}

// 選択肢とボタンの両方を持つイベントの型
export type eventSelectButtonType = eventSelectType & eventButtonType

// キャラクターチャンネル選択イベントの設定
export const selectCharacterChannelConfig: eventSelectType = {
  customId: 'thread-create-character',
  placeholder: 'キャラクターを選択'
}

// キャラクター情報追加イベントの設定
export const addCharacterInfoConfig: eventSelectButtonType = {
  customId: 'add-chara-info',
  label: '追加',
  placeholder: '追加する項目を選択'
}

// キャラクター情報変更・削除イベントの設定
export const changeCharacterInfoConfig: eventSelectButtonType = {
  customId: 'change-chara-info',
  label: '変更・削除',
  placeholder: '変更する項目を選択'
}

// キャラクターモーダルイベントの設定
export const characterModalConfig: eventType = {
  customId: 'character-modal'
}

// ダイスボタンイベントの設定
export const diceButtonConfig: eventButtonType = {
  customId: 'dice_button',
  label: '1d100'
}

// キャラクタータブボタンイベントの設定
export const characterTabButtonsConfig: eventButtonType = {
  customId: 'character-tab*',
  label: 'キャラクタータブ'
}

// キャラクターダイスボタンイベントの設定
export const characterDiceButtonsConfig: eventButtonType = {
  customId: 'roll*',
  label: 'ダイスロール'
}

// ダイスページ前ボタンイベントの設定
export const dicePagePrevButtonConfig: eventButtonType = {
  customId: 'dice-prev*',
  label: '前ページ'
}

// ダイスページ次ボタンイベントの設定
export const dicePageNextButtonConfig: eventButtonType = {
  customId: 'dice-next*',
  label: '次ページ'
}

// ダイスページ最初ボタンイベントの設定
export const dicePageFirstButtonConfig: eventButtonType = {
  customId: 'dice-first*',
  label: '最初のページ'
}

// ダイスページ最後ボタンイベントの設定
export const dicePageLastButtonConfig: eventButtonType = {
  customId: 'dice-last*',
  label: '最後のページ'
}

// ダイスページキャンセルボタンイベントの設定
export const dicePageCancelButtonConfig: eventButtonType = {
  customId: 'dice-cancel*',
  label: 'キャンセル'
}

// キャラクター選択メニューイベントの設定
export const diceCharacterSelectConfig: eventSelectType = {
  customId: 'dice-char-select*',
  placeholder: 'キャラクターを選択'
}

// ページ選択メニューイベントの設定
export const dicePageSelectConfig: eventSelectType = {
  customId: 'dice-page-select*',
  placeholder: 'ページを選択'
}
