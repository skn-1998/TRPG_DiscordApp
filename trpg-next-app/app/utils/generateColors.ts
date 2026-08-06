import { colorsTuple, darken, lighten } from '@mantine/core'

function rgbaToHex(rgba: string): string {
  const rgbaChannels = rgba
    .replace(/^rgba?\(|\s+|\)$/g, '')
    .split(',')
    .map(Number)

  rgbaChannels.pop()
  return `#${rgbaChannels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

export default function generateColors(hex: string, primaryShade: number) {
  const colors = Array.from({ length: 10 }, (_, index) => {
    const shadeDistance = primaryShade - index
    const alpha = Math.abs(shadeDistance / 10) + 0.03
    const rgba = shadeDistance >= 0 ? lighten(hex, alpha) : darken(hex, alpha)

    return rgbaToHex(rgba)
  })

  return colorsTuple(colors)
}
