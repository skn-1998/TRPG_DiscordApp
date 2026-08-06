type NodeEnvironment = 'development' | 'production' | 'test'

interface ServerEnvironment {
  nodeEnv: NodeEnvironment
  serverDomain: string
  hostDomain: string
  discordApplicationId: string
}

const DEFAULT_SERVER_DOMAIN = 'http://127.0.0.1:3000'
const DEFAULT_HOST_DOMAIN = 'http://127.0.0.1:5173'

let validatedEnvironment: ServerEnvironment | undefined

function parseNodeEnvironment(value: string | undefined): NodeEnvironment {
  const nodeEnv = value ?? 'development'

  if (nodeEnv === 'development' || nodeEnv === 'production' || nodeEnv === 'test') {
    return nodeEnv
  }

  throw new Error('NODE_ENV must be development, production, or test')
}

function parseUrl(name: 'SERVER_DOMAIN' | 'HOST_DOMAIN', value: string | undefined, fallback: string): string {
  const url = value ?? fallback

  try {
    new URL(url)
    return url
  } catch {
    throw new Error(`${name} must be a valid URL`)
  }
}

function parseRequiredString(name: 'DISCORD_APPLICATIONID', value: string | undefined): string {
  if (value) {
    return value
  }

  throw new Error(`${name} is required`)
}

function getEnvironment(): ServerEnvironment {
  if (!validatedEnvironment) {
    validatedEnvironment = {
      nodeEnv: parseNodeEnvironment(process.env.NODE_ENV),
      serverDomain: parseUrl('SERVER_DOMAIN', process.env.SERVER_DOMAIN, DEFAULT_SERVER_DOMAIN),
      hostDomain: parseUrl('HOST_DOMAIN', process.env.HOST_DOMAIN, DEFAULT_HOST_DOMAIN),
      discordApplicationId: parseRequiredString('DISCORD_APPLICATIONID', process.env.DISCORD_APPLICATIONID)
    }
  }

  return validatedEnvironment
}

export function getNodeEnv(): NodeEnvironment {
  return getEnvironment().nodeEnv
}

export function getServerDomain(): string {
  return getEnvironment().serverDomain
}

export function getHostDomain(): string {
  return getEnvironment().hostDomain
}

export function getDiscordApplicationId(): string {
  return getEnvironment().discordApplicationId
}

export function isProduction(): boolean {
  return getNodeEnv() === 'production'
}
