import { Badge, Box, Flex, NavLink } from '@mantine/core'
import { useLocation, useMatches, useResolvedPath } from '@remix-run/react'
import { IconHome2, IconGauge, IconChevronRight, IconActivity, IconCircleOff, IconProps } from '@tabler/icons-react'
import { useState } from 'react'

type linkData = {
  icon: React.ElementType
  label: string
  href: string
}

const navData: linkData[] = [
  { icon: IconGauge, label: 'キャラ一覧', href: '/user/character' },
  {
    icon: IconGauge,
    label: 'シナリオ作成',
    href: '/user/story'
  },
  {
    icon: IconGauge,
    label: 'GM管理',
    href: '/user/gameManager'
  },
  {
    icon: IconGauge,
    label: 'DiscordBot連携',
    href: '/user/discordBotCombination'
  }
]

export function UserPageNav() {
  const [active, setActive] = useState(0)
  const path = useLocation()
  const matches = useMatches()
  console.log(path)

  return (
    <>
      <Flex justify="flex-start">
        <Box w={240} bg={'#424242'}>
          {navData.map((item, index) => (
            <NavLink
              label={item.label}
              active={path.pathname.includes(item.href)}
              onClick={() => setActive(index)}
              key={index}
              maw={300}
              href={item.href}
              color="#FFFFFF"
            />
          ))}
        </Box>
      </Flex>
    </>
  )
}
