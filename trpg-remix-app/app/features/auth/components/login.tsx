import { useLoaderData } from '@remix-run/react'
import { Container, Paper, Title, Text, Button, Stack, ThemeIcon } from '@mantine/core'
import { IconBrandDiscord } from '@tabler/icons-react'
import { loader } from '../../../routes/_auth.login'

export function LoginBtn() {
  const { discordAuthUrl } = useLoaderData<typeof loader>()

  return (
    <Container size="xs" mt={80}>
      <Paper
        shadow="xl"
        p={50}
        radius="lg"
        style={{
          background: 'linear-gradient(135deg, var(--mantine-color-bg-5) 0%, var(--mantine-color-main-9) 100%)',
          border: '1px solid var(--mantine-color-main-6)'
        }}
      >
        <Stack align="center" gap="xl">
          <ThemeIcon
            size={80}
            radius="xl"
            color="accent"
            variant="gradient"
            gradient={{ from: 'accent.4', to: 'accent.6', deg: 45 }}
          >
            <IconBrandDiscord size={50} />
          </ThemeIcon>

          <Stack align="center" gap="sm">
            <Title order={1} size="h2" c="white" ta="center">
              TRPG_APP
            </Title>
            <Text c="dimmed" size="md" ta="center" maw={300}></Text>
          </Stack>

          <Button
            component="a"
            href={discordAuthUrl}
            target="_blank"
            rel="noreferrer"
            size="lg"
            radius="xl"
            fullWidth
            color="accent"
            variant="gradient"
            gradient={{ from: 'accent.5', to: 'accent.7', deg: 45 }}
            leftSection={<IconBrandDiscord size={20} />}
            style={{
              fontSize: '16px',
              fontWeight: 600,
              boxShadow: '0 4px 14px 0 rgba(103, 58, 183, 0.3)',
              transition: 'all 0.2s ease'
            }}
            styles={{
              root: {
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 20px 0 rgba(103, 58, 183, 0.4)'
                }
              }
            }}
          >
            Discordでログイン
          </Button>

          <Text size="xs" c="dimmed" ta="center"></Text>
        </Stack>
      </Paper>
    </Container>
  )
}
