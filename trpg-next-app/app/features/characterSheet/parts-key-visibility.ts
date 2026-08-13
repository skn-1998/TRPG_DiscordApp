import { RESERVED_PARTS_KEY_IDS, UNSAFE_PARTS_KEYS } from '@trpg/sheet-engine'

export function isPresentablePartsKey(partsKey: string): boolean {
  // publish 上流は B12-FIX で reserved / UNSAFE 宣言を拒否するため、修正前の公開データだけをここで防御する。
  return !RESERVED_PARTS_KEY_IDS.some((reservedKey) => reservedKey === partsKey) && !UNSAFE_PARTS_KEYS.has(partsKey)
}
