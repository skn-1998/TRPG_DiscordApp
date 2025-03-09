import StaticLoader from 'bcdice/lib/loader/static_loader'

const loader = new StaticLoader()

export default async function dice(
  command: string,
  gameSystemId: string = 'DiceBot'
) {
  const gameSystem = await loader.dynamicLoad(gameSystemId)
  return gameSystem.eval(command)
}
