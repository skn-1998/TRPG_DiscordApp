import { darken, lighten, colorsTuple } from '@mantine/core'

const rgba2hex = (rgba: string) => {
  const rgbaArray = rgba
    .replace(/^rgba?\(|\s+|\)$/g, '')
    .split(',')
    .map((e) => Number(e))
  rgbaArray.pop()
  return '#' + rgbaArray.map((e) => ('0' + e.toString(16)).slice(-2)).join('')
}

function generateColors(hex: string, primaryShade: number) {
  const colors = Array.from({ length: 10 }, (_, index) => {
    const diff = primaryShade - index
    const alpha = Math.abs(diff / 10) + 0.03
    const rgba = diff >= 0 ? lighten(hex, alpha) : darken(hex, alpha)
    return rgba2hex(rgba)
  })
  return colorsTuple(colors)
}

export default generateColors
