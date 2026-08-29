/**
 * `prefix_英数` 形の uid を作り、衝突時は同じ prefix で再発行する。
 * Invariant: random 部は crypto 経路で 12 字固定、fallback 経路で最大 12 字。publish.ts の
 * 「section.id 最大 32 + '_' + random 12」という上限依存を守るため、12 字超へ延長しない。
 * `row` prefix での生成形は engine の LIST_ROW_ID_PATTERN に適合する。
 */
export function createStableUid(existingUids: Set<string>, prefix = 'uid'): string {
  const randomPart = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    }
    return Math.random().toString(36).slice(2, 14)
  }

  let uid = `${prefix}_${randomPart()}`
  while (existingUids.has(uid)) {
    uid = `${prefix}_${randomPart()}`
  }
  return uid
}
