import { Module } from '@nestjs/common'
import { InteractionsController } from './interactions.controller'
import { InteractionsService } from './interactions.service'
import { EventEmitterModule } from '@nestjs/event-emitter'

// 🆕 Interaction Registry (Events方式の自動ルーティング)
import { InteractionRegistryModule } from './registry/interaction-registry.module'

/**
 * Discord Interactions Module
 *
 * 🎯 目的: Discord.js インタラクション処理の統合管理（Registry への委譲 + thin service）
 *
 * 📋 責務:
 * - Discord.js ボタン/モーダル/セレクトメニューのインタラクションを Registry へルーティング
 *
 * 🆕 Registry方式（Events方式と統一）:
 * - InteractionRegistryService による自動ルーティング（ファイル名 = customIdパターン）
 *
 * 🏗️ 構造課題③（ARCHITECTURE §8）:
 * - diceRoll / characterEdit / characterThread の handler は各 feature 所有へ移管済み。
 *   各 feature module が onModuleInit で自身の handler を registry 登録する。
 * - これにより interactions core は feature handler module を import しない。
 *
 * 🔧 P1-A slim 化（2026-06-04）:
 * - 監視サービス（Performance/Metrics/Alert/DiscordMonitor）は DiscordModule が所有するため当 module の
 *   providers/exports から撤去（重複 provider＝重複 @OnEvent を解消）。
 * - dice 計算・ロジック系は DiceServicesModule が所有。Part B 以降 interactions は dice を直接使わないため
 *   DiceServicesModule の import / re-export を撤去。
 *
 * ✅ P1-A 最終（2026-06-04）: ChannelCreate リスナーを characterEdit feature
 *   （CharacterEditChannelCreateListenerService）へ移管し、InteractionsService/Controller から
 *   ChannelCreateOrchestratorService 依存を撤去。これにより CharacterEditModule import を撤去でき、
 *   interactions core は feature module を一切 import しない（§8 達成）。挙動は不変。
 */
@Module({
  controllers: [InteractionsController],
  providers: [InteractionsService],
  exports: [
    // Registry を re-export（下流が InteractionRegistryService / PatternMatcherService を解決できるように）
    InteractionRegistryModule,
    InteractionsService
  ],
  imports: [InteractionRegistryModule, EventEmitterModule]
})
export class InteractionsModule {}
