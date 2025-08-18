/**
 * System Events Contract
 * システムレベル・インフラレベルのイベント契約定義
 */

export interface SystemEvent {
  timestamp: Date
  source: 'system' | 'monitoring' | 'infrastructure'
  sessionId?: string
}

// ============================================================================
// Performance Events
// ============================================================================

export interface PerformanceMetricsCollectedEvent extends SystemEvent {
  type: 'system.performance.metrics.collected'
  metrics: {
    cpu: number
    memory: number
    responseTime: number
    errorRate: number
    activeConnections: number
  }
}

export interface PerformanceDegradationEvent extends SystemEvent {
  type: 'system.performance.degraded'
  degradation: {
    metric: 'cpu' | 'memory' | 'responseTime' | 'errorRate'
    currentValue: number
    threshold: number
    severity: 'warning' | 'critical'
  }
}

// ============================================================================
// Error Events
// ============================================================================

export interface SystemErrorEvent extends SystemEvent {
  type: 'system.error.occurred'
  error: {
    code: string
    message: string
    stack?: string
    context?: any
    severity: 'low' | 'medium' | 'high' | 'critical'
  }
}

export interface CircularDependencyDetectedEvent extends SystemEvent {
  type: 'system.circular.dependency.detected'
  dependency: {
    modules: string[]
    cycle: string[]
    severity: 'warning' | 'error'
  }
}

// ============================================================================
// Audit Events
// ============================================================================

export interface AuditLogEvent extends SystemEvent {
  type: 'system.audit.logged'
  audit: {
    action: string
    userId?: string
    resource: string
    details?: any
    outcome: 'success' | 'failure'
  }
}

export interface SecurityAlertEvent extends SystemEvent {
  type: 'system.security.alert'
  alert: {
    type: 'authentication' | 'authorization' | 'data_breach' | 'suspicious_activity'
    severity: 'low' | 'medium' | 'high' | 'critical'
    details: any
    userId?: string
  }
}

// ============================================================================
// Health Check Events
// ============================================================================

export interface HealthCheckEvent extends SystemEvent {
  type: 'system.health.check'
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    services: {
      database: boolean
      discord: boolean
      cache: boolean
      eventBus: boolean
    }
    uptime: number
  }
}

export interface ServiceAvailabilityChangedEvent extends SystemEvent {
  type: 'system.service.availability.changed'
  service: {
    name: string
    status: 'up' | 'down' | 'degraded'
    previousStatus: 'up' | 'down' | 'degraded'
    downtime?: number
  }
}

// ============================================================================
// Configuration Events
// ============================================================================

export interface ConfigurationChangedEvent extends SystemEvent {
  type: 'system.configuration.changed'
  configuration: {
    key: string
    oldValue: any
    newValue: any
    source: 'environment' | 'database' | 'file'
  }
}

// ============================================================================
// Startup/Shutdown Events
// ============================================================================

export interface SystemStartedEvent extends SystemEvent {
  type: 'system.started'
  startup: {
    duration: number
    modules: string[]
    version: string
    environment: 'development' | 'staging' | 'production'
  }
}

export interface SystemShutdownEvent extends SystemEvent {
  type: 'system.shutdown'
  shutdown: {
    reason: 'manual' | 'error' | 'update' | 'resource'
    graceful: boolean
    uptime: number
  }
}

// ============================================================================
// Union Types
// ============================================================================

export type SystemEventType =
  | PerformanceMetricsCollectedEvent
  | PerformanceDegradationEvent
  | SystemErrorEvent
  | CircularDependencyDetectedEvent
  | AuditLogEvent
  | SecurityAlertEvent
  | HealthCheckEvent
  | ServiceAvailabilityChangedEvent
  | ConfigurationChangedEvent
  | SystemStartedEvent
  | SystemShutdownEvent

// ============================================================================
// Event Type Guards
// ============================================================================

export const isPerformanceEvent = (event: any): boolean => event.type?.startsWith('system.performance.')

export const isErrorEvent = (event: any): boolean => event.type?.includes('.error.') || event.type?.includes('.alert')

export const isHealthEvent = (event: any): boolean =>
  event.type?.startsWith('system.health.') || event.type?.startsWith('system.service.')

export const isSystemEvent = (event: any): event is SystemEventType => event.type?.startsWith('system.')
