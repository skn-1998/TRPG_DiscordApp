/**
 * 作成時ロールの出目の書き込み規則（creationRollValue）を検証する。
 *
 * 作成と振り直しの経路をまたぐ規則なので、経路側の spec
 * （character-instantiation.service.spec.ts / character-sheet-reroll.spec.ts）とは別に、
 * util 単体でも守るべき境界だけをここに置く。
 * 対になる述語 rollOnCreateSpec は engine 側（packages/sheet-engine/src/__tests__/roll-on-create.spec.ts）。
 */
import { UnprocessableEntityException } from '@nestjs/common'
import type { SheetField } from '@trpg/sheet-engine'
import { creationRollValue } from './creation-roll-value.util'

describe('creation-roll-value.util', () => {
  it('行き先が other の作成時ロールを拒否する（publish を経ずに DB へ入った宣言への防壁）', () => {
    const track = { type: 'track', uid: 'uid-hp', id: 'hp', label: 'HP', style: 'gauge' } as unknown as SheetField

    expect(() => creationRollValue(track, undefined, 55, 'other')).toThrow(UnprocessableEntityException)
  })
})
