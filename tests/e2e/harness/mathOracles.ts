/**
 * Authoritative Mathematical Oracles for InkPi Desktop
 * Strictly derived from mathematical theory and PROJECT.md § Feature Inventory (F11 - F15)
 */

// --- 1. Poset DAG & Topological Sort Oracle (F11) ---
export interface PosetOracleNode {
  id: string
  name: string
}

export interface PosetOracleEdge {
  from: string
  to: string
}

export interface PosetOracleResult {
  hasCycle: boolean
  topologicalOrder: string[]
  transitiveClosure: Map<string, Set<string>>
  reachableFrom: (a: string, b: string) => boolean
}

export function computePosetOracle(
  nodes: PosetOracleNode[],
  edges: PosetOracleEdge[]
): PosetOracleResult {
  const nodeIds = nodes.map((n) => n.id)
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  const closure = new Map<string, Set<string>>()

  for (const id of nodeIds) {
    inDegree.set(id, 0)
    adj.set(id, [])
    closure.set(id, new Set<string>())
  }

  for (const edge of edges) {
    adj.get(edge.from)?.push(edge.to)
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
    closure.get(edge.from)?.add(edge.to)
  }

  // Kahn's Algorithm for Topological Sort & Cycle Detection
  const queue: string[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id)
  }

  const topologicalOrder: string[] = []
  while (queue.length > 0) {
    const u = queue.shift()!
    topologicalOrder.push(u)
    for (const v of adj.get(u) || []) {
      const newDeg = (inDegree.get(v) || 0) - 1
      inDegree.set(v, newDeg)
      if (newDeg === 0) {
        queue.push(v)
      }
    }
  }

  const hasCycle = topologicalOrder.length !== nodeIds.length

  // Warshall's Transitive Closure Algorithm
  for (const k of nodeIds) {
    for (const i of nodeIds) {
      if (closure.get(i)?.has(k)) {
        for (const j of nodeIds) {
          if (closure.get(k)?.has(j)) {
            closure.get(i)!.add(j)
          }
        }
      }
    }
  }

  return {
    hasCycle,
    topologicalOrder: hasCycle ? [] : topologicalOrder,
    transitiveClosure: closure,
    reachableFrom: (a: string, b: string) => Boolean(closure.get(a)?.has(b)),
  }
}

// --- 2. 0-1 Knapsack Dynamic Programming Oracle (F12) ---
export interface KnapsackItem {
  id: string
  name: string
  weight: number // Tokens
  value: number  // Activation score
}

export interface KnapsackResult {
  maxValue: number
  totalWeight: number
  selectedItemIds: string[]
}

export function computeKnapsackOracle(
  items: KnapsackItem[],
  capacity: number
): KnapsackResult {
  const n = items.length
  // dp[i][w] = max value using subset of first i items with weight <= w
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(capacity + 1).fill(0)
  )

  for (let i = 1; i <= n; i++) {
    const item = items[i - 1]
    for (let w = 0; w <= capacity; w++) {
      if (item.weight <= w) {
        dp[i][w] = Math.max(
          dp[i - 1][w],
          dp[i - 1][w - item.weight] + item.value
        )
      } else {
        dp[i][w] = dp[i - 1][w]
      }
    }
  }

  // Backtracking to find selected items
  const selected: string[] = []
  let currW = capacity
  let totalW = 0

  for (let i = n; i > 0; i--) {
    if (dp[i][currW] !== dp[i - 1][currW]) {
      const item = items[i - 1]
      selected.push(item.id)
      currW -= item.weight
      totalW += item.weight
    }
  }

  return {
    maxValue: dp[n][capacity],
    totalWeight: totalW,
    selectedItemIds: selected.reverse(),
  }
}

// --- 3. Corpus-Level TF-IDF & Cosine Similarity Oracle (F13) ---
export interface DocumentScrap {
  id: string
  text: string
  tokens: string[]
}

export function computeCorpusIdf(documents: DocumentScrap[]): Map<string, number> {
  const n = documents.length
  const docFreq = new Map<string, number>()

  for (const doc of documents) {
    const uniqueTokens = new Set(doc.tokens)
    for (const t of uniqueTokens) {
      docFreq.set(t, (docFreq.get(t) || 0) + 1)
    }
  }

  const idfMap = new Map<string, number>()
  for (const [token, df] of docFreq.entries()) {
    // Smoothed IDF: ln(1 + (N / (DF + 1))) + 1
    const idf = Math.log(1 + n / (df + 1)) + 1
    idfMap.set(token, idf)
  }

  return idfMap
}

export function computeTfIdfCosine(
  queryTokens: string[],
  docTokens: string[],
  idfMap: Map<string, number>
): number {
  const qTf = new Map<string, number>()
  for (const t of queryTokens) qTf.set(t, (qTf.get(t) || 0) + 1)

  const dTf = new Map<string, number>()
  for (const t of docTokens) dTf.set(t, (dTf.get(t) || 0) + 1)

  let dotProduct = 0
  let normQ = 0
  let normD = 0

  for (const [t, count] of qTf.entries()) {
    const idf = idfMap.get(t) || 1.0
    const weight = count * idf
    normQ += weight * weight
  }

  for (const [t, count] of dTf.entries()) {
    const idf = idfMap.get(t) || 1.0
    const weight = count * idf
    normD += weight * weight
    if (qTf.has(t)) {
      const qWeight = qTf.get(t)! * idf
      dotProduct += qWeight * weight
    }
  }

  if (normQ === 0 || normD === 0) return 0
  return dotProduct / (Math.sqrt(normQ) * Math.sqrt(normD))
}

// --- 4. Chinese Pinyin Tonal Classification Oracle (F14) ---
export type MandarinTone = 'ping' | 'ze'

// Standard Pinyin Tone Mappings:
// Tones 1 (阴平) & 2 (阳平) -> 'ping'
// Tones 3 (上声) & 4 (去声) -> 'ze'
export const PINYIN_TONE_DICTIONARY: Record<string, MandarinTone> = {
  // Common literary / fantasy naming characters
  '锋': 'ping', // fēng (Tone 1) - Previous heuristic incorrectly marked as 'ze'
  '尊': 'ping', // zūn (Tone 1) - Previous heuristic incorrectly marked as 'ze'
  '岳': 'ze',   // yuè (Tone 4) - Previous heuristic incorrectly marked as 'ping'
  '天': 'ping', // tiān (Tone 1)
  '云': 'ping', // yún (Tone 2)
  '风': 'ping', // fēng (Tone 1)
  '雷': 'ping', // léi (Tone 2)
  '清': 'ping', // qīng (Tone 1)
  '龙': 'ping', // lóng (Tone 2)
  '玄': 'ping', // xuán (Tone 2)
  '寒': 'ping', // hán (Tone 2)
  '凌': 'ping', // líng (Tone 2)
  '霄': 'ping', // xiāo (Tone 1)
  '渊': 'ping', // yuān (Tone 1)
  '苍': 'ping', // cāng (Tone 1)
  '剑': 'ze',   // jiàn (Tone 4)
  '圣': 'ze',   // shèng (Tone 4)
  '帝': 'ze',   // dì (Tone 4)
  '道': 'ze',   // dào (Tone 4)
  '霸': 'ze',   // bà (Tone 4)
  '傲': 'ze',   // ào (Tone 4)
  '煞': 'ze',   // shà (Tone 4)
  '影': 'ze',   // yǐng (Tone 3)
  '海': 'ze',   // hǎi (Tone 3)
  '雨': 'ze',   // yǔ (Tone 3)
  '雪': 'ze',   // xuě (Tone 3)
  '墨': 'ze',   // mò (Tone 4)
  '楚': 'ze',   // chǔ (Tone 3)
  '陆': 'ze',   // lù (Tone 4)
}

// --- 5. OLS 2nd-Degree Polynomial Regression Oracle (F15) ---
export interface OlsQuadraticResult {
  beta0: number
  beta1: number
  beta2: number
  r2: number
  apexRatio: number
}

export function computeOlsQuadraticOracle(
  points: { x: number; y: number }[]
): OlsQuadraticResult {
  const n = points.length
  if (n < 3) {
    return { beta0: 0, beta1: 0, beta2: 0, r2: 0, apexRatio: 0 }
  }

  // Linear system: (X^T * X) * Beta = X^T * Y
  // where rows of X are [1, x_i, x_i^2]
  let s0 = n
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0
  let t0 = 0, t1 = 0, t2 = 0

  for (const p of points) {
    const x = p.x
    const y = p.y
    const x2 = x * x
    s1 += x
    s2 += x2
    s3 += x2 * x
    s4 += x2 * x2

    t0 += y
    t1 += x * y
    t2 += x2 * y
  }

  // 3x3 Determinant for Cramer's Rule
  const det =
    s0 * (s2 * s4 - s3 * s3) -
    s1 * (s1 * s4 - s2 * s3) +
    s2 * (s1 * s3 - s2 * s2)

  if (Math.abs(det) < 1e-12) {
    return { beta0: 0, beta1: 0, beta2: 0, r2: 0, apexRatio: 0 }
  }

  const det0 =
    t0 * (s2 * s4 - s3 * s3) -
    s1 * (t1 * s4 - t2 * s3) +
    s2 * (t1 * s3 - t2 * s2)

  const det1 =
    s0 * (t1 * s4 - t2 * s3) -
    t0 * (s1 * s4 - s2 * s3) +
    s2 * (s1 * t2 - s2 * t1)

  const det2 =
    s0 * (s2 * t2 - s3 * t1) -
    s1 * (s1 * t2 - s2 * t1) +
    t0 * (s1 * s3 - s2 * s2)

  const beta0 = det0 / det
  const beta1 = det1 / det
  const beta2 = det2 / det

  // R^2 = 1 - SS_res / SS_tot
  const meanY = t0 / n
  let ssTot = 0
  let ssRes = 0

  for (const p of points) {
    const yPred = beta0 + beta1 * p.x + beta2 * p.x * p.x
    ssRes += (p.y - yPred) * (p.y - yPred)
    ssTot += (p.y - meanY) * (p.y - meanY)
  }

  const r2 = ssTot === 0 ? 1.0 : Math.max(0, 1 - ssRes / ssTot)
  // Apex of y = beta2*x^2 + beta1*x + beta0 is x = -beta1 / (2 * beta2)
  const apexRatio = beta2 !== 0 ? -beta1 / (2 * beta2) : 0

  return {
    beta0,
    beta1,
    beta2,
    r2,
    apexRatio,
  }
}
