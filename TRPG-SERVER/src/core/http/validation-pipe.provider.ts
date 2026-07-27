import { ValidationPipe, type Provider, type ValidationPipeOptions } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'

export const APP_VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  transform: true,
  whitelist: true
}

export const APP_VALIDATION_PIPE_PROVIDER: Provider = {
  provide: APP_PIPE,
  useFactory: () => new ValidationPipe(APP_VALIDATION_PIPE_OPTIONS)
}
