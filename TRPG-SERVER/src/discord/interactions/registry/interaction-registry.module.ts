import { Module } from '@nestjs/common'
import { InteractionRegistryService } from './interaction-registry.service'
import { PatternMatcherService } from './pattern-matcher.service'

/**
 * Interaction Registry Module
 *
 * 🎯 目的: InteractionRegistryService / PatternMatcherService の提供を独立モジュール化
 *
 * 📋 責務:
 * - インタラクションハンドラーの登録・ルーティング機構（Registry）の DI 提供
 * - customId パターンマッチング機構（PatternMatcher）の DI 提供
 *
 * 🏗️ 位置づけ:
 * ARCHITECTURE §8 の目標「feature 側が InteractionRegistryService を import して
 * handler を登録する」へ向けた第一歩。registry の提供元を InteractionsModule から
 * 分離し、後続ステップで feature module から再利用できるようにする。
 *
 * ⚠️ 挙動不変: registry / pattern-matcher の実体・登録ロジック・routing は不変。
 */
@Module({
  providers: [InteractionRegistryService, PatternMatcherService],
  exports: [InteractionRegistryService, PatternMatcherService]
})
export class InteractionRegistryModule {}
