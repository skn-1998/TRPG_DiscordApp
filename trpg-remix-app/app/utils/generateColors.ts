import { darken, lighten } from '@mantine/core'

const rgba2hex = (rgba: string) => {
  const rgbaArray = rgba.replace(/^rgba?\(|\s+|\)$/g, '').split(',').map(e => Number(e))
  rgbaArray.pop()
  return '#' + rgbaArray.map(e => ('0' + e.toString(16)).slice(-2)).join('')
}

function generateColors (hex: string, primaryShade: number): [string, string, string, string, string, string, string, string, string, string] {
  const colors = Array.from({ length: 10 }, (_, index) => {
    const diff = primaryShade - index
    const alpha = Math.abs(diff / 10) + 0.03
    const rgba = diff >= 0 ? lighten(hex, alpha) : darken(hex, alpha)
    return rgba2hex(rgba)
  })
  return [
    `${colors[0]}`,
    `${colors[1]}`,
    `${colors[2]}`,
    `${colors[3]}`,
    `${colors[4]}`,
    `${colors[5]}`,
    `${colors[6]}`,
    `${colors[7]}`,
    `${colors[8]}`,
    `${colors[9]}`,
  ]
}

export default generateColors
