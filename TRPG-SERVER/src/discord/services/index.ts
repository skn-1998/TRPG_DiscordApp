// Discord Services Main Exports

// === 新しいフォルダ構造のサービス ===
// Dice Services
export * from './dice'

// Monitoring Services
export * from './monitoring'

// Channel Services
export * from './channel'

// === 既存の基盤サービス（維持） ===
export { DiscordClientService } from './discord-client.service'
export { CommandManagerService } from './command-manager.service'
export { DiscordCommandRegistrationService } from './discord-command-registration.service'
export { DiscordGuildManagerService } from './discord-guild-manager.service'
export { DiscordChannelManagerService } from './discord-channel-manager.service' // オーケストレーター
export { DiscordInteractionHandlerService } from './discord-interaction-handler.service'

// === 完了した統合作業 ===
// ✅ Phase 2完了: dice/ フォルダに統合
// ✅ Phase 3完了: monitoring/ フォルダに統合
// ✅ Phase 4完了: channel/ フォルダに統合

// === 廃止されたサービス ===
// ✅ dice-calculation-handler.service.ts (Phase 2で削除)
// ✅ flexible-dice-calculator.service.ts (Phase 2で削除)
// ✅ preset-dice-handler.service.ts (Phase 2で削除)
// ✅ discord-performance-monitor.service.ts (Phase 3で削除)
// ✅ performance-metrics-integration.service.ts (Phase 3で削除)
// ✅ alert-system.service.ts (Phase 3で削除)
// ✅ dice-notation-handler.service.ts (dice/フォルダに統合)
