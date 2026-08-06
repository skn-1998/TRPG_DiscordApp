import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // next dev の自動生成する CLAUDE.md / AGENTS.md が AI アシスタントの文脈へ混入するのを防ぐ。
  agentRules: false,
  async redirects() {
    // 旧 Remix スタブの 302 ではなく、campaign と同じ 307 に統一する。
    return [
      { source: '/character', destination: '/user/character', permanent: false },
      { source: '/character/grid', destination: '/user/character', permanent: false },
      { source: '/character/edit', destination: '/user/character', permanent: false },
      { source: '/character/:id', destination: '/user/character', permanent: false },
      { source: '/character/:id/edit', destination: '/user/character', permanent: false },
    ]
  },
}

export default nextConfig
