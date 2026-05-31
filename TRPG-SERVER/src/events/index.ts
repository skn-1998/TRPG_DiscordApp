/**
 * Events Layer Index
 * ルートイベント層の統一エクスポート
 */

// Event Contracts
export * from './contracts'

// Event Bus Services
export { GlobalEventBusService } from './bus/global-event-bus.service'

// Event Handlers
export { CharacterEventHandler } from './handlers/character-event.handler'
export { DiscordIntegrationHandler } from './handlers/discord-integration.handler'

// Events Module
export { EventsModule } from './events.module'
