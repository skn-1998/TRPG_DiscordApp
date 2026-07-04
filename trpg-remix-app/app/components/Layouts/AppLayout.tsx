'use client'

import { useMantineTheme } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Header } from './Header'
import { Footer } from './Footer'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [opened, { toggle }] = useDisclosure()
  const theme = useMantineTheme()

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: theme.colors.bg[0],
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* 通常フローのヘッダー */}
      <Header opened={opened} toggle={toggle} />

      {/* メインコンテンツエリア */}
      <main
        style={{
          flex: 1, // 利用可能なスペースを全て使用
          padding: '16px' // 通常のパディング
        }}
      >
        {children}
      </main>

      {/* 通常フローのフッター（ページ最下部に配置） */}
      <Footer />
    </div>
  )
}
