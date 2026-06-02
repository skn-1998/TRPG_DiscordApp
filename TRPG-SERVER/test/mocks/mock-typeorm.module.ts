import { DynamicModule } from '@nestjs/common'
import { TypeOrmModuleOptions } from '@nestjs/typeorm'

export class TypeOrmModule {
  static forRoot(_options?: TypeOrmModuleOptions): DynamicModule {
    return {
      module: TypeOrmModule,
      providers: [],
      exports: []
    }
  }

  static forFeature(_entities?: any[]): DynamicModule {
    return {
      module: TypeOrmModule,
      providers: [],
      exports: []
    }
  }
}
