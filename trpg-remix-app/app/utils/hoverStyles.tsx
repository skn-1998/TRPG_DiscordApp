import { useMantineTheme } from '@mantine/core'

export const useHoverStyles = () => {
  const theme = useMantineTheme()

  return {
    hover: {
      '&:hover': {
        backgroundColor: theme.colors.main[8],
        transition: 'background-color 0.2s ease'
      }
    }
  }
}

export default useHoverStyles
