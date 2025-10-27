// 依存グラフ管理: フィールド間の依存関係、循環参照検出

import type { DependencyGraph, Field } from '../types'
import { extractDependencies } from './formulaEngine'

// ========================================
// 依存グラフ構築
// ========================================

/**
 * フィールドから依存グラフを構築
 */
export function buildDependencyGraph(fields: Field[]): DependencyGraph {
  const graph: DependencyGraph = {}

  for (const field of fields) {
    if (field.type === 'computed' && field.formula) {
      const deps = extractDependencies(field.formula)
      graph[field.id] = new Set(deps)
    } else {
      graph[field.id] = new Set()
    }
  }

  return graph
}

// ========================================
// 循環参照検出
// ========================================

/**
 * DFSで循環参照を検出
 */
export function detectCircularDependency(graph: DependencyGraph): string[] | null {
  const visited = new Set<string>()
  const recStack = new Set<string>()

  function dfs(node: string, path: string[]): string[] | null {
    if (recStack.has(node)) {
      // 循環検出
      const cycleStart = path.indexOf(node)
      return path.slice(cycleStart).concat(node)
    }

    if (visited.has(node)) return null

    visited.add(node)
    recStack.add(node)
    path.push(node)

    const deps = graph[node]
    if (deps) {
      for (const dep of deps) {
        const cycle = dfs(dep, [...path])
        if (cycle) return cycle
      }
    }

    recStack.delete(node)
    return null
  }

  for (const node of Object.keys(graph)) {
    const cycle = dfs(node, [])
    if (cycle) return cycle
  }

  return null
}

// ========================================
// トポロジカルソート
// ========================================

/**
 * トポロジカルソート（依存順にフィールドを並べる）
 */
export function topologicalSort(graph: DependencyGraph): string[] | null {
  const inDegree = new Map<string, number>()
  const nodes = Object.keys(graph)

  // 初期化
  for (const node of nodes) {
    inDegree.set(node, 0)
  }

  // 入次数を計算
  for (const node of nodes) {
    for (const dep of graph[node] || []) {
      inDegree.set(dep, (inDegree.get(dep) || 0) + 1)
    }
  }

  // 入次数0のノードをキューに
  const queue: string[] = []
  for (const [node, degree] of inDegree) {
    if (degree === 0) queue.push(node)
  }

  const sorted: string[] = []

  while (queue.length > 0) {
    const node = queue.shift()!
    sorted.push(node)

    for (const dep of graph[node] || []) {
      inDegree.set(dep, inDegree.get(dep)! - 1)
      if (inDegree.get(dep) === 0) {
        queue.push(dep)
      }
    }
  }

  // 全ノードがソートされていない場合は循環あり
  if (sorted.length !== nodes.length) {
    return null
  }

  return sorted
}

// ========================================
// 依存先取得
// ========================================

/**
 * 指定フィールドが依存している全フィールドを取得（再帰的）
 */
export function getAllDependencies(fieldId: string, graph: DependencyGraph): Set<string> {
  const allDeps = new Set<string>()

  function collect(id: string) {
    const deps = graph[id]
    if (!deps) return

    for (const dep of deps) {
      if (!allDeps.has(dep)) {
        allDeps.add(dep)
        collect(dep)
      }
    }
  }

  collect(fieldId)
  return allDeps
}

/**
 * 指定フィールドに依存している全フィールドを取得（逆方向）
 */
export function getAllDependents(fieldId: string, graph: DependencyGraph): Set<string> {
  const dependents = new Set<string>()

  for (const [node, deps] of Object.entries(graph)) {
    if (deps.has(fieldId)) {
      dependents.add(node)
      // 再帰的に依存先も取得
      for (const dep of getAllDependents(node, graph)) {
        dependents.add(dep)
      }
    }
  }

  return dependents
}
