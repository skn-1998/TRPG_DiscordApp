/**
 * 作成時ロールの宣言解決（rollOnCreateSpec）と出目の書き込み規則（creationRollValue）を検証する。
 *
 * 作成と振り直しの経路をまたぐ規則なので、経路側の spec
 * （character-instantiation.service.spec.ts / character-sheet-reroll.spec.ts）とは別に、
 * util 単体でも守るべき境界だけをここに置く。
 */
import { UnprocessableEntityException } from '@nestjs/common'
import type { SheetField } from '@trpg/sheet-engine'
import { creationRollValue } from './roll-on-create-spec.util'

describe('roll-on-create-spec.util', () => {
  it('行き先が other の作成時ロールを拒否する（publish を経ずに DB へ入った宣言への防壁）', () => {
    const track = { type: 'track', uid: 'uid-hp', id: 'hp', label: 'HP', style: 'gauge' } as unknown as SheetField

    expect(() => creationRollValue(track, undefined, 55, 'other')).toThrow(UnprocessableEntityException)
  })
})
