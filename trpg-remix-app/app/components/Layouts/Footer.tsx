'use client'

import { Group, Text, ActionIcon, Divider, Container, Stack, useMantineTheme, darken } from '@mantine/core'
import { IconBrandGithub, IconBrandTwitter, IconMail, IconDice6 } from '@tabler/icons-react'

export function Footer() {
  const theme = useMantineTheme()

  return (
    <div
      style={{
        backgroundColor: darken(theme.colors.bg[0], 0.4),
        borderTop: `1px solid ${theme.colors.main[8]}`
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="lg">
          {/* Top section */}
          <Group justify="space-between" align="flex-start">
            {/* Logo and description */}
            <Stack gap="xs" style={{ maxWidth: 300 }}>
              <Group gap="xs">
                <IconDice6 size={24} color={theme.colors.accent[5]} />
                <Text size="lg" fw={700} c={theme.colors.accent[5]}>
                  TRPG Master
                </Text>
              </Group>
              <Text size="sm" c="dimmed">
                オンラインTRPGセッションを快適に楽しむためのプラットフォーム
              </Text>
            </Stack>

            {/* Links */}
            <Group gap="xl">
              <Stack gap="xs">
                <Text size="sm" fw={600} c={theme.colors.accent[5]}>
                  機能
                </Text>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed" component="a" href="/sessions" style={{ textDecoration: 'none' }}>
                    セッション管理
                  </Text>
                  <Text size="xs" c="dimmed" component="a" href="/characters" style={{ textDecoration: 'none' }}>
                    キャラクター作成
                  </Text>
                  <Text size="xs" c="dimmed" component="a" href="/dice" style={{ textDecoration: 'none' }}>
                    ダイスロール
                  </Text>
                </Stack>
              </Stack>

              <Stack gap="xs">
                <Text size="sm" fw={600} c={theme.colors.accent[5]}>
                  サポート
                </Text>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed" component="a" href="/help" style={{ textDecoration: 'none' }}>
                    ヘルプ
                  </Text>
                  <Text size="xs" c="dimmed" component="a" href="/faq" style={{ textDecoration: 'none' }}>
                    よくある質問
                  </Text>
                  <Text size="xs" c="dimmed" component="a" href="/contact" style={{ textDecoration: 'none' }}>
                    お問い合わせ
                  </Text>
                </Stack>
              </Stack>
            </Group>
          </Group>

          <Divider color={theme.colors.main[8]} />

          {/* Bottom section */}
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              © 2024 TRPG Master. All rights reserved.
            </Text>

            <Group gap="xs">
              <ActionIcon size="sm" variant="subtle" color="dimmed">
                <IconBrandGithub size={16} />
              </ActionIcon>
              <ActionIcon size="sm" variant="subtle" color="dimmed">
                <IconBrandTwitter size={16} />
              </ActionIcon>
              <ActionIcon size="sm" variant="subtle" color="dimmed">
                <IconMail size={16} />
              </ActionIcon>
            </Group>
          </Group>
        </Stack>
      </Container>
    </div>
  )
}
