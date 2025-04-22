import { MantineColorsTuple, createTheme } from '@mantine/core'
import { generateColors } from '@mantine/colors-generator'

const baseColor: MantineColorsTuple = generateColors('#ffffff')
const mainColor: MantineColorsTuple = generateColors('#424242')
const accentColor: MantineColorsTuple = generateColors('#673AB7')

const theme = createTheme({
  primaryColor: 'accent',
  colors: {
    base: baseColor,
    main: mainColor,
    accent: accentColor
  },
  primaryShade: { light: 5, dark: 6 }
})

export default theme
