import { MantineColorsTuple, createTheme, colorsTuple } from '@mantine/core'
import generateColors from './utils/generateColors'

const primaryShade = 5

const mainColor: MantineColorsTuple = generateColors('#424242', primaryShade)
const accentColor: MantineColorsTuple = generateColors('#673AB7', primaryShade)
const subColor: MantineColorsTuple = generateColors('#78b7b7', primaryShade)
const complementaryColor: MantineColorsTuple = generateColors('#8ab73a', primaryShade)
const subComplementaryColor: MantineColorsTuple = generateColors('#b77878', primaryShade)

const theme = createTheme({
  primaryColor: 'main',
  colors: {
    main: mainColor,
    accent: accentColor,
    sub: subColor,
    comp: complementaryColor,
    subComp: subComplementaryColor
  },
  primaryShade
})

export default theme
