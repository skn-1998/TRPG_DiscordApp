import StaticLoader from 'bcdice/lib/loader/static_loader'

/**
 * BCDice ローダ wrapper（E-6e で src/discord/utils/dice.ts から移設・内容不変）
 *
 * dynamicLoad で得た gameSystem の eval を呼んで返すだけの純 wrapper。
 * discord.js 非依存のため domains/dice-roll に置き、Web など他の呼び出し元からも使える。
 */
const loader = new StaticLoader()

export default async function dice(command: string, gameSystemId: string = 'DiceBot') {
  const gameSystem = await loader.dynamicLoad(gameSystemId)
  return gameSystem.eval(command)
}
