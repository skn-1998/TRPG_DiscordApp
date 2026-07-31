// publish/evaluator 共有の内部 helper。index 非公開。
export function assertArity(name: string, args: { length: number }, expected: number): void {
  if (args.length !== expected) throw new Error(`${name} expects ${expected} arguments`);
}
