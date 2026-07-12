export type UnaryOperator = '+' | '-';
export type BinaryOperator = '+' | '-' | '*' | '/' | '==' | '!=' | '<' | '<=' | '>' | '>=';

export type AstNode =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'tableName'; name: string }
  | { type: 'ref'; path: string }
  | { type: 'unary'; operator: UnaryOperator; argument: AstNode }
  | { type: 'binary'; operator: BinaryOperator; left: AstNode; right: AstNode }
  | { type: 'call'; name: string; args: AstNode[] };

export function countAstNodes(node: AstNode): number {
  switch (node.type) {
    case 'number':
    case 'string':
    case 'boolean':
    case 'tableName':
    case 'ref':
      return 1;
    case 'unary':
      return 1 + countAstNodes(node.argument);
    case 'binary':
      return 1 + countAstNodes(node.left) + countAstNodes(node.right);
    case 'call':
      return 1 + node.args.reduce((sum, arg) => sum + countAstNodes(arg), 0);
  }
}
