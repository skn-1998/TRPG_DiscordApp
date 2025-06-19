import { MantineColorsTuple, createTheme, colorsTuple, DEFAULT_THEME } from '@mantine/core'
import generateColors from './utils/generateColors'

const primaryShade = 5

const mainColor: MantineColorsTuple = generateColors('#3A3A3A', primaryShade)
const accentColor: MantineColorsTuple = generateColors('#673AB7', primaryShade)
const subColor: MantineColorsTuple = generateColors('#78b7b7', primaryShade)
const complementaryColor: MantineColorsTuple = generateColors('#8ab73a', primaryShade)
const subComplementaryColor: MantineColorsTuple = generateColors('#b77878', primaryShade)
const bgColor: MantineColorsTuple = colorsTuple('#1E1E23')

// ナビゲーション用のスタイル定数（シンプルデザイン）
export const navigationStyles = {
  // 背景関連
  backgrounds: {
    primary: bgColor[0], // シンプルな単色背景
    activeItem: `rgba(${hexToRgb(complementaryColor[primaryShade])}, 0.12)`,
    hoverItem: `rgba(${hexToRgb(accentColor[primaryShade])}, 0.08)`,
    accentBox: `rgba(${hexToRgb(mainColor[primaryShade])}, 0.4)`
  },

  // ボーダー関連
  borders: {
    primary: `1px solid rgba(${hexToRgb(mainColor[primaryShade])}, 0.3)`,
    active: `1px solid ${complementaryColor[primaryShade]}`,
    hover: `1px solid rgba(${hexToRgb(accentColor[primaryShade])}, 0.4)`,
    accentBox: `1px solid rgba(${hexToRgb(mainColor[primaryShade])}, 0.5)`,
    separator: `1px solid rgba(${hexToRgb(mainColor[primaryShade])}, 0.2)`
  },

  // シャドウ関連
  shadows: {
    primary: `2px 0 8px rgba(${hexToRgb(bgColor[0])}, 0.3)`,
    active: `0 2px 8px rgba(${hexToRgb(complementaryColor[primaryShade])}, 0.15)`,
    hover: `0 1px 4px rgba(${hexToRgb(accentColor[primaryShade])}, 0.1)`,
    iconGlow: 'none', // グロー効果を無効化
    badge: `0 1px 3px rgba(${hexToRgb(complementaryColor[primaryShade])}, 0.2)`
  },

  // テキストカラー関連
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

  // アニメーション関連
  transitions: {
    smooth: 'all 0.2s ease-out',
    fast: 'all 0.15s ease-out'
  }
}

// Hexカラーコードを RGB に変換するヘルパー関数
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '0, 0, 0'

  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)

  return `${r}, ${g}, ${b}`
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
