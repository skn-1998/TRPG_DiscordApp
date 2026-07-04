'use client'

/* eslint-disable @typescript-eslint/no-unused-vars */
import { Badge, Box, NavLink, Text, Stack, Group, rem, useMantineTheme, Divider } from '@mantine/core'
import { usePathname } from 'next/navigation'
import { IconUsers, IconBook, IconShield, IconRobot, IconChevronRight } from '@tabler/icons-react'
import { useState } from 'react'
import { navigationStyles } from '../../../theme'

type LinkData = {
  icon: React.ElementType
  label: string
  href: string
  description?: string
  badge?: string
}

const navData: LinkData[] = [
  {
    icon: IconUsers,
    label: 'キャラクター一覧',
    href: '/user/character',
    description: 'キャラクターの作成・管理',
    badge: 'NEW'
  },
  {
    icon: IconBook,
    label: 'シナリオ作成',
    href: '/user/story',
    description: 'オリジナルシナリオを作成'
  },
  {
    icon: IconShield,
    label: 'GM管理',
    href: '/user/gameManager',
    description: 'ゲームマスター専用機能'
  },
  {
    icon: IconRobot,
    label: 'Discord Bot連携',
    href: '/user/discordBotCombination',
    description: 'Discordとの連携設定'
  }
]

export function UserPageNav() {
  const theme = useMantineTheme()
  const pathname = usePathname()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <Box
      w={280}
      h="100vh"
      bg={navigationStyles.backgrounds.primary}
      style={{
        borderRight: navigationStyles.borders.primary,
        boxShadow: navigationStyles.shadows.primary,
        flexShrink: 0
      }}
    >
      {/* ヘッダー */}
      <Box p="lg" style={{ borderBottom: navigationStyles.borders.separator }}>
        <Text
          size="md"
          fw={600}
          c={navigationStyles.textColors.primary}
          ta="center"
          style={{
            fontFamily: theme.fontFamily,
            letterSpacing: '0.5px'
          }}
        >
          ユーザーメニュー
        </Text>
      </Box>

      {/* ナビゲーション項目 */}
      <Box p="sm">
        <Stack gap="xs">
          {navData.map((item, index) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)
            const isHovered = hoveredIndex === index

            return (
              <NavLink
                key={index}
                href={item.href}
                label={
                  <Group gap="md" wrap="nowrap">
                    <Box
                      w={32}
                      h={32}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: rem(6),
                        backgroundColor: isActive ? navigationStyles.textColors.active : 'transparent',
                        transition: navigationStyles.transitions.fast
                      }}
                    >
                      <Icon
                        size={18}
                        style={{
                          color: isActive ? 'white' : navigationStyles.textColors.primary,
                          transition: navigationStyles.transitions.fast
                        }}
                      />
                    </Box>
                    <Box flex={1}>
                      <Group justify="space-between" align="center">
                        <Text
                          size="sm"
                          fw={isActive ? 600 : 500}
                          c={isActive ? navigationStyles.textColors.active : navigationStyles.textColors.primary}
                          style={{
                            transition: navigationStyles.transitions.fast,
                            fontFamily: theme.fontFamily
                          }}
                        >
                          {item.label}
                        </Text>
                        {item.badge && (
                          <Badge
                            size="xs"
                            color="comp"
                            variant="filled"
                            style={{
                              backgroundColor: theme.colors.comp[5],
                              boxShadow: navigationStyles.shadows.badge,
                              fontWeight: 600
                            }}
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </Group>
                      {item.description && (
                        <Text
                          size="xs"
                          c={navigationStyles.textColors.muted}
                          mt={2}
                          style={{
                            fontFamily: theme.fontFamily
                          }}
                        >
                          {item.description}
                        </Text>
                      )}
                    </Box>
                    <IconChevronRight
                      size={14}
                      style={{
                        color: isActive
                          ? navigationStyles.textColors.active
                          : navigationStyles.textColors.chevron.default,
                        transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
                        transition: navigationStyles.transitions.fast,
                        opacity: isActive ? 1 : 0.6
                      }}
                    />
                  </Group>
                }
                active={isActive}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  borderRadius: rem(8),
                  padding: rem(8),
                  marginBottom: rem(2),
                  backgroundColor: isActive
                    ? navigationStyles.backgrounds.activeItem
                    : isHovered
                      ? navigationStyles.backgrounds.hoverItem
                      : 'transparent',
                  border: isActive ? navigationStyles.borders.active : '1px solid transparent',
                  transition: navigationStyles.transitions.smooth,
                  cursor: 'pointer',
                  boxShadow: isActive
                    ? navigationStyles.shadows.active
                    : isHovered
                      ? navigationStyles.shadows.hover
                      : 'none'
                }}
              />
            )
          })}
        </Stack>
      </Box>

      {/* フッター */}
      <Box
        mt="auto"
        p="md"
        style={{
          borderTop: navigationStyles.borders.separator,
          backgroundColor: navigationStyles.backgrounds.accentBox
        }}
      >
        <Text
          size="xs"
          c={navigationStyles.textColors.muted}
          ta="center"
          fw={500}
          style={{
            fontFamily: theme.fontFamily,
            letterSpacing: '0.3px'
          }}
        >
          TRPG Management System
        </Text>
        <Text
          size="xs"
          c={navigationStyles.textColors.muted}
          ta="center"
          mt={4}
          style={{
            fontFamily: theme.fontFamily,
            opacity: 0.8
          }}
        >
          v1.0
        </Text>
      </Box>
    </Box>
  )
}
