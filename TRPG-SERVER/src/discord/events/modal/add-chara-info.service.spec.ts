import { Test, TestingModule } from '@nestjs/testing'
import { AddCharaInfoService } from './add-chara-info.service'

describe('AddCharaInfoService', () => {
  let service: AddCharaInfoService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AddCharaInfoService]
    }).compile()

    service = module.get<AddCharaInfoService>(AddCharaInfoService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
