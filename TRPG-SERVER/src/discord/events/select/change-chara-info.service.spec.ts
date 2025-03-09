import { Test, TestingModule } from '@nestjs/testing'
import { ChangeCharaInfoService } from './change-chara-info.service'

describe('ChangeCharaInfoService', () => {
  let service: ChangeCharaInfoService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChangeCharaInfoService]
    }).compile()

    service = module.get<ChangeCharaInfoService>(ChangeCharaInfoService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
