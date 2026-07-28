import type { DynamicModule, ForwardReference, Provider, Type } from '@nestjs/common'
import { MODULE_METADATA, PIPES_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import { ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_PIPE, MetadataScanner } from '@nestjs/core'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AppModule } from './app.module'
import { APP_GLOBAL_EXCEPTION_FILTER_PROVIDER } from './core/http/global-exception.filter'
import { APP_VALIDATION_PIPE_OPTIONS, APP_VALIDATION_PIPE_PROVIDER } from './core/http/validation-pipe.provider'

interface ApplicationGraph {
  controllers: Type<unknown>[]
  providers: Provider[]
}

type RouteArgumentMetadata = Record<string, { pipes?: unknown[] }>

const isObject = (value: unknown): value is Record<PropertyKey, unknown> => typeof value === 'object' && value !== null

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  isObject(value) && typeof value.then === 'function'

const isForwardReference = (value: unknown): value is ForwardReference =>
  isObject(value) && typeof value.forwardRef === 'function'

const isDynamicModule = (value: unknown): value is DynamicModule => isObject(value) && 'module' in value

const collectApplicationGraph = async (rootModule: Type<unknown>): Promise<ApplicationGraph> => {
  const controllers = new Set<Type<unknown>>()
  const providers: Provider[] = []
  const visitedModules = new Set<unknown>()

  const collect = async (moduleReference: unknown): Promise<void> => {
    // NOTE: 現 production graph の forwardRef() は0件で、この分岐は実経路・変異ともに未検証の防御コード。
    if (isForwardReference(moduleReference)) {
      await collect(moduleReference.forwardRef())
      return
    }
    if (visitedModules.has(moduleReference)) {
      return
    }
    visitedModules.add(moduleReference)

    // Promise 自体と解決後 module の両方を visited 対象にし、偽陰性なく重複・循環走査も止める。
    if (isPromiseLike(moduleReference)) {
      await collect(await moduleReference)
      return
    }
    if (isDynamicModule(moduleReference)) {
      moduleReference.controllers?.forEach((controller) => controllers.add(controller))
      providers.push(...(moduleReference.providers ?? []))
      for (const moduleImport of moduleReference.imports ?? []) {
        await collect(moduleImport)
      }
      await collect(moduleReference.module)
      return
    }
    if (typeof moduleReference !== 'function') {
      return
    }

    const moduleControllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleReference) as
      Type<unknown>[] | undefined
    const moduleImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleReference) as unknown[] | undefined
    const moduleProviders = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, moduleReference) as Provider[] | undefined

    moduleControllers?.forEach((controller) => controllers.add(controller))
    providers.push(...(moduleProviders ?? []))
    for (const moduleImport of moduleImports ?? []) {
      await collect(moduleImport)
    }
  }

  await collect(rootModule)
  return {
    controllers: [...controllers].sort((left, right) => left.name.localeCompare(right.name)),
    providers
  }
}

const metadataScanner = new MetadataScanner()

let applicationGraph: ApplicationGraph
let reachableControllers: Type<unknown>[]
let controllerMethodTargets: Array<{
  controller: Type<unknown>
  methodName: string
  label: string
  target: object
}>
let parameterPipeMetadataTargets: Array<{ label: string; pipes: unknown[] }>

describe('AppModule', () => {
  beforeAll(async () => {
    applicationGraph = await collectApplicationGraph(AppModule)
    reachableControllers = applicationGraph.controllers
    controllerMethodTargets = reachableControllers.flatMap((controller) => {
      const prototype = controller.prototype as Record<string, unknown>

      // Nest と同じ走査で prototype chain を辿り、同名 method は派生 controller から解決した実装だけを検査する。
      return metadataScanner.getAllMethodNames(controller.prototype).flatMap((methodName) => {
        const target = prototype[methodName]
        return typeof target === 'function'
          ? [{ controller, methodName, label: `${controller.name}.${methodName}`, target }]
          : []
      })
    })
    parameterPipeMetadataTargets = controllerMethodTargets.flatMap(({ controller, methodName, label }) => {
      const routeArguments = Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, methodName) as
        RouteArgumentMetadata | undefined

      return Object.entries(routeArguments ?? {}).map(([parameterKey, metadata]) => ({
        label: `${label} parameter ${parameterKey}`,
        pipes: metadata.pipes ?? []
      }))
    })
  })

  it('production module graph 全体で共有 APP_PIPE provider を一意に登録する', () => {
    const appPipeProviders = applicationGraph.providers.filter(
      (provider) => isObject(provider) && provider.provide === APP_PIPE
    )

    expect(appPipeProviders).toHaveLength(1)
    expect(appPipeProviders[0]).toBe(APP_VALIDATION_PIPE_PROVIDER)
  })

  it('production module graph 全体で共有 APP_FILTER provider を一意に登録する', () => {
    const appFilterProviders = applicationGraph.providers.filter(
      (provider) => isObject(provider) && provider.provide === APP_FILTER
    )

    expect(appFilterProviders).toHaveLength(1)
    expect(appFilterProviders[0]).toBe(APP_GLOBAL_EXCEPTION_FILTER_PROVIDER)
  })

  it('PromiseLike import を await し、非同期 DynamicModule の provider まで収集する', () => {
    // ConfigService は @nestjs/config の公開 token。同期到達する基底 ConfigModule は useExisting だが、
    // forRoot() の Promise 経路は useFactory で登録するため、この組み合わせが非同期走査の安定した証拠になる。
    const asyncConfigServiceProvider = applicationGraph.providers.find(
      (provider) =>
        isObject(provider) && provider.provide === ConfigService && typeof provider.useFactory === 'function'
    )

    expect(asyncConfigServiceProvider).toEqual(
      expect.objectContaining({
        provide: ConfigService,
        useFactory: expect.any(Function)
      })
    )
  })

  it('APP_PIPE の options を transform と whitelist の厳密な組み合わせに固定する', () => {
    expect(APP_VALIDATION_PIPE_OPTIONS).toStrictEqual({
      transform: true,
      whitelist: true
    })
  })

  it('AppModule の非同期 module graph から到達可能な controller を導出する', () => {
    // この厳密一致は controller 収集の完全空振りを防ぐ。method / parameter は各検査で別に非空性を固定する。
    expect(reachableControllers.map((controller) => controller.name)).toEqual([
      'AppController',
      'AuthController',
      'CharacterController',
      'CharacterSheetController',
      'CharacterSheetTemplateController',
      'CommandsController',
      'DiscordController',
      'InteractionsController',
      'PerformanceDashboardController',
      'UserController'
    ])
  })

  it('到達可能な controller と method は local pipe を持たず AppModule の APP_PIPE に委譲する', () => {
    expect(controllerMethodTargets).not.toHaveLength(0)
    expect(controllerMethodTargets.map(({ label }) => label)).toContain('AuthController.login')

    const offenders = [
      ...reachableControllers.flatMap((controller) => {
        const pipes = Reflect.getMetadata(PIPES_METADATA, controller) as unknown[] | undefined
        return pipes?.length ? [`${controller.name} (class)`] : []
      }),
      ...controllerMethodTargets.flatMap(({ label, target }) => {
        const pipes = Reflect.getMetadata(PIPES_METADATA, target) as unknown[] | undefined
        return pipes?.length ? [label] : []
      })
    ]

    expect(offenders).toEqual([])
  })

  it('到達可能な controller method の parameter は local pipe を持たず AppModule の APP_PIPE に委譲する', () => {
    expect(parameterPipeMetadataTargets).not.toHaveLength(0)

    const offenders = parameterPipeMetadataTargets.filter(({ pipes }) => pipes.length > 0).map(({ label }) => label)

    expect(offenders).toEqual([])
  })

  it('bootstrap は useGlobalPipes で第2の global pipe を登録しない', () => {
    // main.ts は import 時に bootstrap() を実行するため、副作用を起動しない architecture test としてソースを検査する。
    const mainSource = readFileSync(join(__dirname, 'main.ts'), 'utf8')

    expect(mainSource).not.toContain('useGlobalPipes')
  })

  it('bootstrap は useGlobalFilters で第2の global filter を登録しない', () => {
    // main.ts は import 時に bootstrap() を実行するため、副作用を起動しない architecture test としてソースを検査する。
    const mainSource = readFileSync(join(__dirname, 'main.ts'), 'utf8')

    expect(mainSource).not.toContain('useGlobalFilters')
  })
})
