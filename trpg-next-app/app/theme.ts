import { DEFAULT_THEME, colorsTuple, createTheme, type MantineColorsTuple } from '@mantine/core'
import generateColors from './utils/generateColors'

const primaryShade = 5

const mainColor: MantineColorsTuple = generateColors('#3A3A3A', primaryShade)
const accentColor: MantineColorsTuple = generateColors('#673AB7', primaryShade)
const subColor: MantineColorsTuple = generateColors('#78b7b7', primaryShade)
const complementaryColor: MantineColorsTuple = generateColors('#8ab73a', primaryShade)
const subComplementaryColor: MantineColorsTuple = generateColors('#b77878', primaryShade)
const bgColor: MantineColorsTuple = colorsTuple('#1E1E23')

export const navigationStyles = {
  backgrounds: {
    primary: bgColor[0],
    activeItem: `rgba(${hexToRgb(complementaryColor[primaryShade])}, 0.12)`,
    hoverItem: `rgba(${hexToRgb(accentColor[primaryShade])}, 0.08)`,
    accentBox: `rgba(${hexToRgb(mainColor[primaryShade])}, 0.4)`
  },
  borders: {
    primary: `1px solid rgba(${hexToRgb(mainColor[primaryShade])}, 0.3)`,
    active: `1px solid ${complementaryColor[primaryShade]}`,
    hover: `1px solid rgba(${hexToRgb(accentColor[primaryShade])}, 0.4)`,
    accentBox: `1px solid rgba(${hexToRgb(mainColor[primaryShade])}, 0.5)`,
    separator: `1px solid rgba(${hexToRgb(mainColor[primaryShade])}, 0.2)`
  },
  shadows: {
    primary: `2px 0 8px rgba(${hexToRgb(bgColor[0])}, 0.3)`,
    active: `0 2px 8px rgba(${hexToRgb(complementaryColor[primaryShade])}, 0.15)`,
    hover: `0 1px 4px rgba(${hexToRgb(accentColor[primaryShade])}, 0.1)`,
    iconGlow: 'none',
    badge: `0 1px 3px rgba(${hexToRgb(complementaryColor[primaryShade])}, 0.2)`
  },
  textColors: {
    primary: subColor[primaryShade],
    active: complementaryColor[primaryShade],
    secondary: `rgba(${hexToRgb(subColor[primaryShade])}, 0.7)`,
    activeSecondary: `rgba(${hexToRgb(complementaryColor[primaryShade])}, 0.8)`,
    muted: `rgba(${hexToRgb(subColor[primaryShade])}, 0.5)`,
    chevron: {
      active: complementaryColor[primaryShade],
      default: `rgba(${hexToRgb(subColor[primaryShade])}, 0.4)`
    }
  },
  transitions: {
    smooth: 'all 0.2s ease-out',
    fast: 'all 0.15s ease-out'
  }
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '0, 0, 0'

  const red = Number.parseInt(result[1], 16)
  const green = Number.parseInt(result[2], 16)
  const blue = Number.parseInt(result[3], 16)

  return `${red}, ${green}, ${blue}`
}

const theme = createTheme({
  primaryColor: 'main',
  colors: {
    main: mainColor,
    accent: accentColor,
    sub: subColor,
    comp: complementaryColor,
    subComp: subComplementaryColor,
    bg: bgColor
  },
  primaryShade,
  fontFamily: `Noto Sans JP, ${DEFAULT_THEME.fontFamily}`
})

export default theme
