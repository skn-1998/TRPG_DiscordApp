import { DynamicModule } from '@nestjs/common'
import { TypeOrmModuleOptions } from '@nestjs/typeorm'

export class TypeOrmModule {
  static forRoot(options?: TypeOrmModuleOptions): DynamicModule {
    return {
      module: TypeOrmModule,
      providers: [],
      exports: []
    }
  }

  static forFeature(entities?: any[]): DynamicModule {
    return {
      module: TypeOrmModule,
      providers: [],
      exports: []
    }
  }
}
