import gameSystemList from '../static/gameSystemList.json'

export function getGameSystemNameById(id: string): string {
  return gameSystemList.find((gameSystem) => gameSystem.ID === id)?.NAME ?? ''
}
