import { Test, TestingModule } from '@nestjs/testing'
import { DiceFromContextMenuService } from './dice-from-context-menu.service'

describe('DiceFromContextMenuService', () => {
  let service: DiceFromContextMenuService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DiceFromContextMenuService]
    }).compile()

    service = module.get<DiceFromContextMenuService>(DiceFromContextMenuService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
