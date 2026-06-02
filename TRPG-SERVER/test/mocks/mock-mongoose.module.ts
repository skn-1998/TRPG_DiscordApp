import { DynamicModule } from '@nestjs/common'

export class MongooseModule {
  static forRoot(_uri: string): DynamicModule {
    return {
      module: MongooseModule,
      providers: [],
      exports: []
    }
  }

  static forFeature(_models?: any[]): DynamicModule {
    return {
      module: MongooseModule,
      providers: [],
      exports: []
    }
  }
}
