import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // next dev の自動生成する CLAUDE.md / AGENTS.md が AI アシスタントの文脈へ混入するのを防ぐ。
  agentRules: false,
}

export default nextConfig
