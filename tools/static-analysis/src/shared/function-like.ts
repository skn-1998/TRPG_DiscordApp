import {
  Node,
  type ArrowFunction,
  type ClassDeclaration,
  type ClassExpression,
  type ConstructorDeclaration,
  type FunctionDeclaration,
  type FunctionExpression,
  type GetAccessorDeclaration,
  type MethodDeclaration,
  type SetAccessorDeclaration,
} from 'ts-morph';

/**
 * What every analysis in this package counts as a function. Each tool used to carry its own
 * copy of this list, its own predicate and its own naming rules, and the copies had already
 * drifted: one declaration was reported under two different names depending on which tool
 * printed it, so two reports about the same code could not be read side by side.
 */
export type FunctionLikeNode =
  | ArrowFunction
  | ConstructorDeclaration
  | FunctionDeclaration
  | FunctionExpression
  | GetAccessorDeclaration
  | MethodDeclaration
  | SetAccessorDeclaration;

export type ClassLikeNode = ClassDeclaration | ClassExpression;

/** Members that could exist as a free function; a constructor exists only to build its instance. */
export type MemberFunctionLikeNode = GetAccessorDeclaration | MethodDeclaration | SetAccessorDeclaration;

/**
 * How long a reported name may get. A callee written as a chained builder runs to hundreds of
 * characters, which is a source listing rather than a name.
 */
const MAX_NAME_LENGTH = 120;

export function isFunctionLikeNode(node: Node): node is FunctionLikeNode {
  return Node.isArrowFunction(node)
    || Node.isConstructorDeclaration(node)
    || Node.isFunctionDeclaration(node)
    || Node.isFunctionExpression(node)
    || isMemberFunctionLike(node);
}

export function isClassLikeNode(node: Node): node is ClassLikeNode {
  return Node.isClassDeclaration(node) || Node.isClassExpression(node);
}

export function isMemberFunctionLike(node: Node): node is MemberFunctionLikeNode {
  return Node.isGetAccessorDeclaration(node)
    || Node.isMethodDeclaration(node)
    || Node.isSetAccessorDeclaration(node);
}

/**
 * The name to report a declaration under, or null when nothing in the syntax names it.
 *
 * A member is qualified with the class it belongs to (`AuthService.validateToken`), including
 * one written as a property (`class A { handle = () => {} }` is `A.handle`). A function
 * expression or arrow borrows the name of whatever binds it; handed straight to a call it is
 * named after the callee, with `(...)` so that a callback passed to `it(...)` cannot be read as
 * a declaration named `it`.
 */
export function functionLikeName(node: FunctionLikeNode): string | null {
  if (Node.isConstructorDeclaration(node)) return qualifyWithClass(node, 'constructor');
  if (isMemberFunctionLike(node)) return qualifyWithClass(node, node.getName());
  if (Node.isFunctionDeclaration(node)) {
    const name = node.getName();
    return name === undefined ? null : toReportedName(name);
  }

  const parent = node.getParent();
  if (parent === undefined) return null;
  if (Node.isVariableDeclaration(parent) || Node.isPropertyAssignment(parent)) {
    return toReportedName(parent.getName());
  }
  if (Node.isPropertyDeclaration(parent)) return qualifyWithClass(node, parent.getName());
  if (Node.isCallExpression(parent)) return toReportedName(`${parent.getExpression().getText()}(...)`);
  return null;
}

function qualifyWithClass(node: Node, memberName: string): string {
  const className = node.getFirstAncestor(isClassLikeNode)?.getName();
  return toReportedName(className === undefined ? memberName : `${className}.${memberName}`);
}

/**
 * A name is written on one line of a report, so the source text behind it is collapsed to
 * single spaces -- a chained callee spans lines and would otherwise put raw newlines in the
 * field -- and cut to a length a reader can take in.
 */
function toReportedName(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length <= MAX_NAME_LENGTH ? collapsed : `${collapsed.slice(0, MAX_NAME_LENGTH)}...`;
}
