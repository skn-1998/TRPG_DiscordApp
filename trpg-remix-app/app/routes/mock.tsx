import { Outlet } from '@remix-run/react'
import { MantineProvider, createTheme, MantineColorsTuple, virtualColor } from '@mantine/core'
import { generateColors } from '@mantine/colors-generator'

const baseColor: MantineColorsTuple = generateColors('#ffffff')
const mainColor: MantineColorsTuple = generateColors('#424242')
const accentColor: MantineColorsTuple = generateColors('#673AB7')

const theme = createTheme({
  primaryColor: 'accent',
  colors: {
    base: baseColor,
    main: virtualColor({
      name: 'main',
      dark: 'dark',
      light: 'gray'
    }),
    accent: accentColor,
    test: virtualColor({
      name: 'test',
      dark: 'main.5',
      light: 'base.2'
    })
  },
  primaryShade: { light: 5, dark: 6 }
})

export default function Mock() {
  return (
    <>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <Outlet />
      </MantineProvider>
    </>
  )
}
