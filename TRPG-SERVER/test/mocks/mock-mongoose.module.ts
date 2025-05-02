import { DynamicModule } from '@nestjs/common'

export class MongooseModule {
  static forRoot(uri: string): DynamicModule {
    return {
      module: MongooseModule,
      providers: [],
      exports: []
    }
  }

  static forFeature(models?: any[]): DynamicModule {
    return {
      module: MongooseModule,
      providers: [],
      exports: []
    }
  }
}
